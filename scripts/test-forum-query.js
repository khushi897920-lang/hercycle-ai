/**
 * Regression suite for lib/forum-query.js — parameter normalisation, keyset
 * cursors and ILIKE escaping for the community feed.
 *
 * The bug this guards: the feed used to receive a hard-coded 20 rows and filter
 * them in the browser —
 *
 *     supabase.from('forum_posts').order('created_at', {ascending:false}).limit(20)
 *     …
 *     initialPosts.filter(p => p.title.toLowerCase().includes(q))
 *
 * — so the search box searched twenty rows rather than the forum, reported
 * "No discussions match your search" over a non-empty archive, and left every
 * post older than the newest twenty unreachable.
 *
 * The interesting failures are all in the untrusted-input handling that the
 * rewrite introduced, so that is what this pins:
 *
 *   - `%` and `_` are ILIKE wildcards, so an unescaped search for `50_50`
 *     matches `50X50`, and a search for `%` matches the entire table.
 *   - PostgREST expresses the filter as `or=(title.ilike.*q*,content.ilike.*q*)`,
 *     in which `,` and `()` are syntax. An unescaped search for `hi, there`
 *     produces a malformed filter and a 400 on an ordinary human query.
 *   - `created_at` is not unique, so a cursor on the timestamp alone silently
 *     skips or repeats rows written in the same millisecond.
 *
 *   node scripts/test-forum-query.js
 */

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  SORT_NEWEST,
  SORT_OLDEST,
  buildCursorFilter,
  buildFeedPage,
  buildSearchFilter,
  decodeCursor,
  encodeCursor,
  escapeIlikePattern,
  normaliseCategory,
  normaliseLimit,
  normaliseSearchTerm,
  normaliseSort,
  parseFeedQuery,
  toQueryString,
} from '../lib/forum-query.js'

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

function checkDeep(actual, expected, label) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${b}`)
  console.error(`       actual:   ${a}`)
}

function checkTrue(actual, label) {
  check(Boolean(actual), true, label)
}

function section(name) {
  console.log(`\n— ${name}`)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Search term normalisation
 * ────────────────────────────────────────────────────────────────────────── */

section('search term normalisation')
{
  check(normaliseSearchTerm('metformin'), 'metformin', 'an ordinary term passes through')
  check(normaliseSearchTerm('  metformin  '), 'metformin', 'surrounding whitespace is trimmed')

  // "  pcod   diet " and "pcod diet" are the same query; treating them
  // differently makes the result count look unstable while typing.
  check(
    normaliseSearchTerm('pcod   diet'), 'pcod diet',
    'internal whitespace runs are collapsed'
  )

  check(normaliseSearchTerm(''), null, 'an empty term is not a search')
  check(normaliseSearchTerm('   '), null, 'a whitespace-only term is not a search')
  check(
    normaliseSearchTerm('a'), null,
    `a term below the ${MIN_SEARCH_LENGTH}-character minimum is not a search`
  )
  check(normaliseSearchTerm('ab'), 'ab', 'the minimum length is inclusive')
  check(normaliseSearchTerm(null), null, 'null is not a search')
  check(normaliseSearchTerm(42), null, 'a non-string is not a search')

  check(
    normaliseSearchTerm('x'.repeat(500)).length, MAX_SEARCH_LENGTH,
    'an absurdly long term is truncated rather than sent to the database'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * ILIKE escaping — the injection-shaped bugs
 * ────────────────────────────────────────────────────────────────────────── */

section('ILIKE pattern escaping')
{
  check(escapeIlikePattern('metformin'), 'metformin', 'ordinary text is unchanged')

  // Without this, searching `50_50` matches `50X50`.
  check(escapeIlikePattern('50_50'), '50\\_50', 'the `_` single-character wildcard is escaped')
  // Without this, searching `%` matches every post in the table.
  check(escapeIlikePattern('100%'), '100\\%', 'the `%` multi-character wildcard is escaped')
  check(escapeIlikePattern('a"b'), 'a\\"b', 'a double quote is escaped so it cannot end the literal')

  // Backslash must be escaped first, or the escapes added for % and _ get
  // double-escaped by the backslash pass.
  check(
    escapeIlikePattern('a\\b'), 'a\\\\b',
    'a backslash is escaped, and is escaped first so it does not corrupt the others'
  )
  check(
    escapeIlikePattern('a\\%b'), 'a\\\\\\%b',
    'a literal backslash followed by a percent is escaped correctly, not doubly'
  )
  check(escapeIlikePattern(''), '', 'an empty string escapes to an empty string')
  check(escapeIlikePattern(null), '', 'null escapes to an empty string rather than "null"')
}

section('search filter construction')
{
  const filter = buildSearchFilter('metformin')
  checkTrue(filter.includes('title.ilike.'), 'the filter searches the title')
  checkTrue(filter.includes('content.ilike.'), 'the filter searches the body')

  // The reason the pattern is quoted: `,` separates branches in a PostgREST
  // `or=` filter, so an unquoted comma splits it into malformed pieces.
  const withComma = buildSearchFilter('hi, there')
  check(
    withComma, 'title.ilike."%hi, there%",content.ilike."%hi, there%"',
    'a comma in the term stays inside the quoted literal instead of splitting the filter'
  )

  const withParens = buildSearchFilter('pcod (mild)')
  checkTrue(
    withParens.includes('"%pcod (mild)%"'),
    'parentheses in the term stay inside the quoted literal'
  )

  checkTrue(
    buildSearchFilter('50%_off').includes('50\\%\\_off'),
    'wildcards are still escaped inside the quoted literal'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Limit, sort and category
 * ────────────────────────────────────────────────────────────────────────── */

section('limit clamping')
{
  check(normaliseLimit(undefined), DEFAULT_PAGE_SIZE, 'an absent limit uses the default')
  check(normaliseLimit(''), DEFAULT_PAGE_SIZE, 'an empty limit uses the default')
  check(normaliseLimit('10'), 10, 'a numeric string is honoured')
  check(normaliseLimit(10.7), 10, 'a fractional limit is floored')
  check(normaliseLimit(0), 1, 'zero is clamped up to one')
  check(normaliseLimit(-5), 1, 'a negative limit is clamped up to one')

  // Without the ceiling, `?limit=100000` is an unauthenticated way to make the
  // server serialise the whole forum.
  check(normaliseLimit(100000), MAX_PAGE_SIZE, 'an absurd limit is clamped to the ceiling')
  check(normaliseLimit('lots'), DEFAULT_PAGE_SIZE, 'a non-numeric limit uses the default')
}

section('sort normalisation')
{
  check(normaliseSort('newest'), SORT_NEWEST, 'newest is accepted')
  check(normaliseSort('oldest'), SORT_OLDEST, 'oldest is accepted')
  check(normaliseSort('OLDEST'), SORT_OLDEST, 'sort is case-insensitive')
  check(normaliseSort(' oldest '), SORT_OLDEST, 'sort is trimmed')
  check(normaliseSort('random'), SORT_NEWEST, 'an unknown sort falls back to newest')
  check(normaliseSort(null), SORT_NEWEST, 'a missing sort falls back to newest')
}

section('category normalisation')
{
  check(normaliseCategory('pcod-advice'), 'pcod-advice', 'a slug is accepted')
  check(
    normaliseCategory('9f8a1c2e-0000-4aaa-bbbb-000000000001'),
    '9f8a1c2e-0000-4aaa-bbbb-000000000001',
    'a uuid is accepted — the feed links by slug but the column stores ids'
  )
  check(normaliseCategory('all'), null, '"all" means no filter')
  check(normaliseCategory(''), null, 'an empty category means no filter')
  check(normaliseCategory(null), null, 'a missing category means no filter')

  // Neither of these can be a real slug, so they are a typo or an attempt to
  // reach the filter syntax.
  check(normaliseCategory('pcod advice'), null, 'a category with a space is rejected')
  check(normaliseCategory('a".or(1.eq.1)'), null, 'a category containing filter syntax is rejected')
  check(normaliseCategory('x'.repeat(200)), null, 'an over-long category is rejected')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cursors
 * ────────────────────────────────────────────────────────────────────────── */

section('cursor round-trip')
{
  const row = { created_at: '2026-08-01T12:34:56.789Z', id: 'post-42' }
  const cursor = encodeCursor(row)
  checkTrue(cursor, 'a well-formed row produces a cursor')

  const decoded = decodeCursor(cursor)
  check(decoded.createdAt, row.created_at, 'the timestamp survives the round trip')
  check(decoded.id, String(row.id), 'the id survives the round trip')

  check(
    decodeCursor(encodeCursor({ created_at: '2026-08-01T00:00:00Z', id: 12345 })).id, '12345',
    'a numeric id round-trips as a string'
  )

  // An id is opaque and may contain anything, including the separator; an ISO
  // timestamp never can. Splitting from the right would hand part of the id to
  // the timestamp and reject the whole cursor.
  const oddIdRow = { created_at: '2026-08-01T00:00:00Z', id: 'a|b|c' }
  check(
    decodeCursor(encodeCursor(oddIdRow)).createdAt, '2026-08-01T00:00:00Z',
    'an id containing the separator does not corrupt the timestamp'
  )
  check(
    decodeCursor(encodeCursor(oddIdRow)).id, 'a|b|c',
    '…and the id is taken whole, from the first separator onwards'
  )

  check(encodeCursor(null), null, 'a null row produces no cursor')
  check(encodeCursor({ id: 'x' }), null, 'a row with no timestamp produces no cursor')
  check(encodeCursor({ created_at: '2026-08-01' }), null, 'a row with no id produces no cursor')
}

section('cursor decoding degrades gracefully')
{
  // Every one of these is reachable by hand-editing the address bar. None of
  // them should be a 500; they should all mean "start from the beginning".
  check(decodeCursor(''), null, 'an empty cursor is ignored')
  check(decodeCursor(null), null, 'a null cursor is ignored')
  check(decodeCursor('!!!not base64!!!'), null, 'unparseable base64 is ignored')
  check(
    decodeCursor(Buffer.from('no-separator').toString('base64')), null,
    'a cursor with no separator is ignored'
  )
  check(
    decodeCursor(Buffer.from('|orphan').toString('base64')), null,
    'a cursor with an empty timestamp is ignored'
  )
  check(
    decodeCursor(Buffer.from('2026-08-01T00:00:00Z|').toString('base64')), null,
    'a cursor with an empty id is ignored'
  )
  check(
    decodeCursor(Buffer.from('not-a-date|post-1').toString('base64')), null,
    'a cursor whose timestamp is not a real date is ignored — Postgres would reject the comparison'
  )
}

section('cursor filter')
{
  const cursor = { createdAt: '2026-08-01T12:00:00Z', id: 'post-42' }

  const desc = buildCursorFilter(cursor, false)
  checkTrue(desc.includes('created_at.lt.'), 'newest-first pages strictly backwards in time')
  checkTrue(
    desc.includes('and(created_at.eq.') && desc.includes('id.lt.'),
    'the same-instant tie-break is included — created_at is not unique'
  )

  const asc = buildCursorFilter(cursor, true)
  checkTrue(asc.includes('created_at.gt.'), 'oldest-first pages strictly forwards in time')
  checkTrue(asc.includes('id.gt.'), '…with the tie-break in the same direction')

  checkTrue(
    desc.includes(`"${cursor.createdAt}"`),
    'the timestamp is quoted so its colons are not read as filter syntax'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Page assembly
 * ────────────────────────────────────────────────────────────────────────── */

section('page assembly')
{
  const rows = Array.from({ length: 21 }, (_, i) => ({
    id: `post-${i}`,
    created_at: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
  }))

  // The route asks for limit + 1; the extra row is how "is there more?" is
  // answered without a second count query.
  const full = buildFeedPage(rows, 20)
  check(full.posts.length, 20, 'the extra probe row is trimmed off the page')
  check(full.hasMore, true, 'its presence sets hasMore')
  checkTrue(full.nextCursor, 'a next cursor is issued')
  check(
    decodeCursor(full.nextCursor).id, 'post-19',
    'the cursor anchors on the last *returned* row, not on the trimmed probe row'
  )

  const last = buildFeedPage(rows.slice(0, 15), 20)
  check(last.posts.length, 15, 'a short page is returned whole')
  check(last.hasMore, false, 'a short page is the last page')
  // Handing back a cursor here would make the client issue a request that is
  // guaranteed to return nothing.
  check(last.nextCursor, null, 'the last page issues no cursor')

  const exact = buildFeedPage(rows.slice(0, 20), 20)
  check(exact.hasMore, false, 'exactly `limit` rows means there is no next page')

  const empty = buildFeedPage([], 20)
  check(empty.posts.length, 0, 'an empty result is an empty page')
  check(empty.hasMore, false, '…with no next page')

  checkDeep(buildFeedPage(null, 20).posts, [], 'a null result set is handled')
  checkDeep(
    buildFeedPage([null, { id: 'a', created_at: '2026-08-01T00:00:00Z' }, undefined], 20).posts,
    [{ id: 'a', created_at: '2026-08-01T00:00:00Z' }],
    'null rows are filtered out'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * End to end
 * ────────────────────────────────────────────────────────────────────────── */

section('parseFeedQuery')
{
  const query = parseFeedQuery(new URLSearchParams('q=%20metformin%20&sort=oldest&limit=5'))
  check(query.search, 'metformin', 'the search term is normalised')
  check(query.sort, SORT_OLDEST, 'the sort is normalised')
  check(query.ascending, true, 'oldest-first maps to ascending')
  check(query.limit, 5, 'the limit is honoured')
  check(query.cursor, null, 'no cursor means the first page')

  const defaults = parseFeedQuery(new URLSearchParams(''))
  check(defaults.search, null, 'no query means no search')
  check(defaults.categoryId, null, 'no category means no filter')
  check(defaults.sort, SORT_NEWEST, 'the default sort is newest')
  check(defaults.ascending, false, 'newest-first maps to descending')
  check(defaults.limit, DEFAULT_PAGE_SIZE, 'the default page size applies')

  // A plain object works too, so a Server Component can call it directly.
  const fromObject = parseFeedQuery({ q: 'pcod', category: 'pcod-advice' })
  check(fromObject.search, 'pcod', 'a plain object is accepted')
  check(fromObject.categoryId, 'pcod-advice', 'the `category` alias is accepted')

  const hostile = parseFeedQuery(new URLSearchParams('limit=99999&sort=drop&cursor=garbage'))
  check(hostile.limit, MAX_PAGE_SIZE, 'a hostile limit is clamped')
  check(hostile.sort, SORT_NEWEST, 'a hostile sort falls back')
  check(hostile.cursor, null, 'a hostile cursor is ignored rather than fatal')
}

section('toQueryString')
{
  check(toQueryString({}), '', 'an empty query serialises to nothing')
  check(toQueryString({ search: 'pcod' }), 'q=pcod', 'the search term is serialised')
  check(
    toQueryString({ sort: SORT_NEWEST }), '',
    'the default sort is omitted, so the URL stays clean'
  )
  check(toQueryString({ sort: SORT_OLDEST }), 'sort=oldest', 'a non-default sort is serialised')
  check(
    toQueryString({ limit: DEFAULT_PAGE_SIZE }), '',
    'the default limit is omitted'
  )

  // The round trip is what guarantees the client and the route agree on the
  // parameter names.
  const roundTripped = parseFeedQuery(
    new URLSearchParams(toQueryString({ search: 'pcod diet', categoryId: 'pcod-advice', sort: SORT_OLDEST }))
  )
  check(roundTripped.search, 'pcod diet', 'a serialised search survives a round trip')
  check(roundTripped.categoryId, 'pcod-advice', 'a serialised category survives a round trip')
  check(roundTripped.sort, SORT_OLDEST, 'a serialised sort survives a round trip')
}

console.log('')
if (failed > 0) {
  console.error(`❌ ${failed} forum query assertion(s) failed (${passed} passed).`)
  process.exit(1)
}
console.log(`✅ All ${passed} forum query assertions passed.`)

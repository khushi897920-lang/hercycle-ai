/**
 * Regression suite for lib/sync-failure-view.js — turning dead-lettered offline
 * mutations into something a person can read and act on.
 *
 * The bug this is part of fixing: `lib/OfflineContext.jsx` has exposed
 * `failedSyncItems`, `retryFailedSync` and `discardFailedSync` since the
 * sync-queue rewrite, and nothing in the app ever consumed them —
 *
 *     grep -rn "retryFailedSync|discardFailedSync|failedSyncItems" components app
 *     # only the definitions in lib/OfflineContext.jsx
 *
 * — so a change that permanently failed to sync was moved into an IndexedDB
 * store the user cannot see, announced by one transient toast, and then
 * forgotten. `lib/sync-queue.js` documents the intended behaviour as
 * "dead-letter, **surface to the user**"; the surfacing half was never built.
 *
 * What this suite pins is the part that is easy to get subtly wrong: grouping
 * (three edits to one day are one problem, not three losses), classification
 * (a server rejection is not fixed by a retry, so it must not be offered one),
 * and the fact that nothing is ever silently dropped from the list.
 *
 *   node scripts/test-sync-failure-view.js
 */

import {
  FAILURE_KINDS,
  SEVERITY,
  classifyFailure,
  describeTarget,
  explainFailure,
  formatRelativeTime,
  groupFailures,
  summariseFailures,
  targetKey,
} from '../lib/sync-failure-view.js'

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

/** A dead-letter record as `OfflineContext.deadLetter` writes it. */
function record(overrides = {}) {
  return {
    id: 1,
    url: '/api/log-day',
    method: 'POST',
    body: { date: '2026-08-12', symptoms: ['Cramps'] },
    reason: 'permanent',
    attempts: 1,
    lastError: 'Rejected by the server',
    deadLetteredAt: 1_700_000_000_000,
    ...overrides,
  }
}

const NOW = 1_700_000_000_000

/* ────────────────────────────────────────────────────────────────────────────
 * Classification
 * ────────────────────────────────────────────────────────────────────────── */

section('failure classification')
{
  check(classifyFailure('permanent'), FAILURE_KINDS.REJECTED, 'a permanent rejection is a rejection')
  check(classifyFailure('max-attempts'), FAILURE_KINDS.GAVE_UP, 'an exhausted retry budget is "gave up"')

  // An item the UI cannot categorise is still an item the user has lost.
  // Dropping it would reproduce the exact bug this module exists to fix.
  check(classifyFailure('something-new'), FAILURE_KINDS.UNKNOWN, 'an unrecognised reason is unknown, not dropped')
  check(classifyFailure(undefined), FAILURE_KINDS.UNKNOWN, 'a missing reason is unknown')
  check(classifyFailure(null), FAILURE_KINDS.UNKNOWN, 'a null reason is unknown')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Target identity
 * ────────────────────────────────────────────────────────────────────────── */

section('target identity')
{
  check(
    targetKey(record()), 'log-day:2026-08-12',
    'a daily log is identified by its date — the thing the user recognises'
  )
  check(
    targetKey(record({ url: '/api/cycles', method: 'POST', body: { start_date: '2026-08-01' } })),
    'cycle-start:2026-08-01',
    'a period start is identified by its date'
  )
  check(
    targetKey(record({ url: '/api/cycles', method: 'PATCH', body: { id: 'c-7' } })),
    'cycle-end:c-7',
    'a period end is identified by the cycle it closes'
  )
  check(
    targetKey(record({ url: '/api/weight', method: 'POST', body: { date: '2026-08-12', kg: 60 } })),
    'weight:2026-08-12',
    'a weight entry is identified by its date'
  )

  // Two different days must never collapse into one row.
  checkTrue(
    targetKey(record({ body: { date: '2026-08-12' } })) !==
      targetKey(record({ body: { date: '2026-08-13' } })),
    'two different days are two different targets'
  )

  check(
    targetKey(record({ url: '/api/unknown', method: 'put' })), 'PUT /api/unknown',
    'an unrecognised endpoint falls back to method and URL, uppercased'
  )
  check(targetKey(null), 'unknown', 'a null record has a stable key rather than throwing')
}

section('target descriptions never mention HTTP')
{
  const format = (iso) => `${iso} (formatted)`

  checkTrue(
    describeTarget(record(), format).includes('2026-08-12 (formatted)'),
    'the date formatter is applied'
  )
  checkTrue(
    describeTarget(record(), format).toLowerCase().includes('daily log'),
    'a daily log is described as a daily log'
  )
  checkTrue(
    describeTarget(record({ url: '/api/cycles', method: 'POST', body: { start_date: '2026-08-01' } }), format)
      .toLowerCase().includes('period'),
    'a cycle start is described as a period'
  )

  // "A daily log for 12 August" is something a person can decide about;
  // "POST /api/log-day failed with 422" is not.
  for (const item of [
    record(),
    record({ url: '/api/cycles', method: 'POST', body: { start_date: '2026-08-01' } }),
    record({ url: '/api/cycles', method: 'PATCH', body: { id: 'c-1' } }),
    record({ url: '/api/weight', body: { date: '2026-08-12' } }),
  ]) {
    const text = describeTarget(item)
    checkTrue(
      !/\b(POST|PATCH|GET|4\d\d|5\d\d)\b/.test(text),
      `"${text}" is free of HTTP jargon`
    )
  }

  check(describeTarget(null), 'An unknown change', 'a null record still describes itself')
  checkTrue(
    describeTarget(record({ body: {} })).length > 0,
    'a log with no date still has a description'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Relative time
 * ────────────────────────────────────────────────────────────────────────── */

section('relative time')
{
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  check(formatRelativeTime(NOW, NOW), 'just now', 'the present is "just now"')
  check(formatRelativeTime(NOW - 30_000, NOW), 'just now', 'under a minute is "just now"')
  check(formatRelativeTime(NOW - minute, NOW), '1 minute ago', 'the singular is used at one minute')
  check(formatRelativeTime(NOW - 5 * minute, NOW), '5 minutes ago', 'the plural is used beyond one')
  check(formatRelativeTime(NOW - hour, NOW), '1 hour ago', 'the hour boundary is exact')
  check(formatRelativeTime(NOW - 23 * hour, NOW), '23 hours ago', 'just under a day is still hours')
  check(formatRelativeTime(NOW - day, NOW), '1 day ago', 'the day boundary is exact')
  check(formatRelativeTime(NOW - 29 * day, NOW), '29 days ago', 'just under a month is still days')
  check(formatRelativeTime(NOW - 60 * day, NOW), '2 months ago', 'beyond a month reads in months')

  // A record stamped in the future is clock skew, not a prediction.
  check(formatRelativeTime(NOW + hour, NOW), 'just now', 'a future timestamp degrades to "just now"')
  check(formatRelativeTime(null, NOW), 'recently', 'a missing timestamp degrades to "recently"')
  check(formatRelativeTime('nonsense', NOW), 'recently', 'an unparseable timestamp degrades to "recently"')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Grouping — the reason this module exists
 * ────────────────────────────────────────────────────────────────────────── */

section('grouping collapses repeated edits to the same thing')
{
  // A user who edits the same day three times offline queues three operations.
  // When the server rejects that day, all three dead-letter. Three identical
  // rows would imply three separate losses.
  const groups = groupFailures([
    record({ id: 1, deadLetteredAt: NOW - 3000 }),
    record({ id: 2, deadLetteredAt: NOW - 2000 }),
    record({ id: 3, deadLetteredAt: NOW - 1000 }),
  ], { now: NOW })

  check(groups.length, 1, 'three edits to one day are one problem')
  check(groups[0].occurrences, 3, '…with the edit count preserved')
  checkDeep(groups[0].ids, [1, 2, 3], '…and every underlying id retained, so retry/discard covers them all')
  check(groups[0].failedAt, NOW - 1000, 'the group carries the most recent failure time')
}

section('grouping keeps distinct targets distinct')
{
  const groups = groupFailures([
    record({ id: 1, body: { date: '2026-08-12' }, deadLetteredAt: NOW - 5000 }),
    record({ id: 2, body: { date: '2026-08-13' }, deadLetteredAt: NOW - 1000 }),
    record({ id: 3, url: '/api/cycles', method: 'POST', body: { start_date: '2026-08-01' }, deadLetteredAt: NOW - 9000 }),
  ], { now: NOW })

  check(groups.length, 3, 'three different targets stay three rows')
  check(groups[0].key, 'log-day:2026-08-13', 'the most recent failure sorts first')
  check(groups[2].key, 'cycle-start:2026-08-01', 'the oldest failure sorts last')
}

section('the stricter classification wins within a group')
{
  // If any attempt against a target was rejected outright, a plain retry will
  // not clear the group — so it must not be offered one.
  const groups = groupFailures([
    record({ id: 1, reason: 'max-attempts', deadLetteredAt: NOW - 2000 }),
    record({ id: 2, reason: 'permanent', deadLetteredAt: NOW - 1000 }),
  ], { now: NOW })

  check(groups.length, 1, 'both attempts group together')
  check(groups[0].kind, FAILURE_KINDS.REJECTED, 'a rejection in the group makes the group a rejection')
  check(groups[0].isRetryable, false, '…so no retry is offered')
}

section('a retryable group is offered a retry')
{
  const groups = groupFailures([record({ reason: 'max-attempts' })], { now: NOW })
  check(groups[0].kind, FAILURE_KINDS.GAVE_UP, 'an exhausted budget is "gave up"')
  check(groups[0].isRetryable, true, '…which a retry may well fix, since the server may simply have been down')

  const unknown = groupFailures([record({ reason: 'who-knows' })], { now: NOW })
  check(
    unknown[0].isRetryable, true,
    'an unclassifiable failure is offered a retry — the optimistic default is the safe one here'
  )
}

section('grouping is robust and never silently drops anything')
{
  checkDeep(groupFailures(null, { now: NOW }), [], 'a null list yields no groups')
  checkDeep(groupFailures(undefined, { now: NOW }), [], 'an undefined list yields no groups')
  checkDeep(groupFailures([], { now: NOW }), [], 'an empty list yields no groups')

  const withNulls = groupFailures([null, record({ id: 1 }), undefined], { now: NOW })
  check(withNulls.length, 1, 'null entries are skipped')

  // A record written by an older build, with none of the current bookkeeping,
  // must still appear — it represents real lost data.
  const legacy = groupFailures([{ url: '/api/log-day', body: { date: '2026-08-12' } }], { now: NOW })
  check(legacy.length, 1, 'a record with no reason or timestamp still appears in the list')
  check(legacy[0].kind, FAILURE_KINDS.UNKNOWN, '…classified as unknown')
  check(legacy[0].failedAtLabel, 'recently', '…with a graceful timestamp')

  // `failedAt` is the fallback field written by planNextAttempt.
  const fallbackStamp = groupFailures(
    [{ url: '/api/log-day', body: { date: '2026-08-12' }, failedAt: NOW - 60_000 }],
    { now: NOW }
  )
  check(fallbackStamp[0].failedAtLabel, '1 minute ago', 'the `failedAt` fallback timestamp is honoured')

  // Ordering must not depend on Map insertion order.
  const items = [
    record({ id: 1, body: { date: '2026-08-01' }, deadLetteredAt: NOW }),
    record({ id: 2, body: { date: '2026-08-02' }, deadLetteredAt: NOW }),
  ]
  checkDeep(
    groupFailures(items, { now: NOW }).map((g) => g.key),
    groupFailures([...items].reverse(), { now: NOW }).map((g) => g.key),
    'equal timestamps are broken by key, so the order is stable across renders'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Summary
 * ────────────────────────────────────────────────────────────────────────── */

section('summary and severity')
{
  const none = summariseFailures([])
  check(none.total, 0, 'an empty set has no failures')
  check(none.severity, SEVERITY.NONE, '…and no severity, so no badge is shown')
  check(none.anyRetryable, false, '…and nothing to retry')

  const retryable = summariseFailures(groupFailures([record({ reason: 'max-attempts' })], { now: NOW }))
  check(retryable.total, 1, 'one retryable failure is counted')
  check(retryable.severity, SEVERITY.RETRYABLE, '…as merely retryable')
  check(retryable.anyRetryable, true, '…so "retry all" is worth offering')

  // Any server rejection escalates the whole set: those are the ones a retry
  // cannot clear, so they are what the badge should warn about.
  const mixed = summariseFailures(groupFailures([
    record({ id: 1, reason: 'max-attempts', body: { date: '2026-08-12' } }),
    record({ id: 2, reason: 'permanent', body: { date: '2026-08-13' } }),
  ], { now: NOW }))
  check(mixed.total, 2, 'both failures are counted')
  check(mixed.retryable, 1, 'one of them is retryable')
  check(mixed.actionRequired, 1, 'one of them needs a decision')
  check(mixed.severity, SEVERITY.ACTION_REQUIRED, 'a single rejection escalates the whole set')
  check(mixed.anyRetryable, true, '…but the retryable one is still offered a retry')

  checkDeep(summariseFailures(null), summariseFailures([]), 'a null group list is handled')
}

section('explanations are translatable keys, not sentences')
{
  // The module decides *what* to say; the UI decides how to say it in the
  // user's language, so the copy stays in the message catalogue.
  check(
    explainFailure({ kind: FAILURE_KINDS.REJECTED, occurrences: 1 }).key, 'reason_rejected',
    'a rejection maps to its own key'
  )
  check(
    explainFailure({ kind: FAILURE_KINDS.GAVE_UP, occurrences: 2 }).key, 'reason_gave_up',
    'an exhausted budget maps to its own key'
  )
  check(
    explainFailure({ kind: FAILURE_KINDS.UNKNOWN, occurrences: 1 }).key, 'reason_unknown',
    'an unknown failure still gets an explanation'
  )
  check(
    explainFailure({ kind: FAILURE_KINDS.GAVE_UP, occurrences: 3 }).params.occurrences, 3,
    'the occurrence count is passed through for interpolation'
  )
  check(explainFailure(null).key, 'reason_unknown', 'a null group still gets an explanation')
  check(explainFailure(undefined).params.occurrences, 1, '…with a sane default count')
}

console.log('')
if (failed > 0) {
  console.error(`❌ ${failed} sync failure view assertion(s) failed (${passed} passed).`)
  process.exit(1)
}
console.log(`✅ All ${passed} sync failure view assertions passed.`)

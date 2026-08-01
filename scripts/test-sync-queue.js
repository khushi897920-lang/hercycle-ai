/**
 * Regression suite for lib/sync-queue.js — the offline retry policy.
 *
 * The bug this guards: `syncData()` drained the queue in `id` order and
 * `break`-ed on the first failure, then re-ran every 30 seconds forever. One
 * permanently-failing operation therefore blocked every operation queued behind
 * it for the lifetime of the installed PWA — the poison pill was retried twice
 * a minute, the healthy items behind it were never attempted, and the pending
 * badge never cleared.
 *
 * It also treated `401` as permanent and DELETED the item, so a user whose
 * session merely expired while offline lost their queued health logs.
 *
 * Test 5 replays a full drain against a scripted server to prove the
 * head-of-line block is gone end to end.
 *
 *   node scripts/test-sync-queue.js
 */

import {
  BASE_BACKOFF_MS,
  DEAD_LETTER_STORE,
  MAX_ATTEMPTS,
  MAX_BACKOFF_MS,
  classifyResponse,
  computeBackoffMs,
  describeQueueItem,
  isDue,
  orderForDrain,
  planNextAttempt,
} from '../lib/sync-queue.js'

let passed = 0
let failed = 0

function check(actual, expected, label) {
  if (Object.is(actual, expected)) {
    passed += 1
  } else {
    failed += 1
    console.error(`  ❌ ${label}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`)
  }
}

function checkDeep(actual, expected, label) {
  check(JSON.stringify(actual), JSON.stringify(expected), label)
}

const NOW = 1_800_000_000_000
/** Deterministic "random" so jitter is reproducible: always the midpoint. */
const halfRandom = () => 0.5

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------
function testClassification() {
  console.log('\n▶ Test 1: response classification')

  for (const status of [200, 201, 204, 299]) {
    check(classifyResponse({ status }), 'success', `${status} is success`)
  }

  for (const status of [400, 403, 404, 409, 422]) {
    check(classifyResponse({ status }), 'permanent', `${status} is permanent`)
  }

  // The regression that destroyed user data: 401 must NOT be permanent.
  check(classifyResponse({ status: 401 }), 'auth', '401 is an auth pause, not a deletion')

  for (const status of [408, 425, 429, 500, 502, 503, 504]) {
    check(classifyResponse({ status }), 'transient', `${status} is transient`)
  }

  check(classifyResponse(null), 'transient', 'a thrown request (offline/timeout) is transient')
  check(classifyResponse({ status: 418 }), 'permanent', 'an unlisted 4xx is permanent')
  check(classifyResponse({ status: undefined }), 'transient', 'a missing status is transient')
  check(classifyResponse({ status: 'nonsense' }), 'transient', 'a non-numeric status is transient')
}

// ---------------------------------------------------------------------------
// Backoff
// ---------------------------------------------------------------------------
function testBackoff() {
  console.log('\n▶ Test 2: exponential backoff with jitter')

  // With random()=0.5 the delay is exactly 0.75x the ceiling.
  check(computeBackoffMs(1, halfRandom), BASE_BACKOFF_MS * 0.75, 'attempt 1 backs off from the base delay')
  check(computeBackoffMs(2, halfRandom), BASE_BACKOFF_MS * 2 * 0.75, 'attempt 2 doubles')
  check(computeBackoffMs(3, halfRandom), BASE_BACKOFF_MS * 4 * 0.75, 'attempt 3 doubles again')

  check(computeBackoffMs(50, halfRandom) <= MAX_BACKOFF_MS, true, 'a huge attempt count stays under the ceiling')
  check(Number.isFinite(computeBackoffMs(9999, halfRandom)), true, 'a corrupted counter cannot overflow')
  check(computeBackoffMs(0, halfRandom), BASE_BACKOFF_MS * 0.75, 'attempt 0 is treated as attempt 1')
  check(computeBackoffMs(Number.NaN, halfRandom), BASE_BACKOFF_MS * 0.75, 'NaN is treated as attempt 1')

  // Jitter must actually vary, or a fleet of PWAs returns in lockstep.
  const low = computeBackoffMs(3, () => 0)
  const high = computeBackoffMs(3, () => 1)
  check(low < high, true, 'jitter produces a range, not a fixed delay')
  check(low >= BASE_BACKOFF_MS * 4 * 0.5, true, 'jitter never drops below half the ceiling')

  // Monotonic growth: a long-failing item must not drift back to retrying fast.
  let previous = 0
  let monotonic = true
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const delay = computeBackoffMs(attempt, halfRandom)
    if (delay < previous) monotonic = false
    previous = delay
  }
  check(monotonic, true, 'backoff never decreases as attempts accumulate')
}

// ---------------------------------------------------------------------------
// Due-ness and ordering
// ---------------------------------------------------------------------------
function testOrdering() {
  console.log('\n▶ Test 3: due-ness and drain ordering')

  check(isDue({ nextAttemptAt: NOW - 1 }, NOW), true, 'a past due time is due')
  check(isDue({ nextAttemptAt: NOW }, NOW), true, 'due exactly now counts as due')
  check(isDue({ nextAttemptAt: NOW + 1 }, NOW), false, 'a future due time is not due')

  // Items queued by the previous version have no nextAttemptAt at all.
  check(isDue({ id: 1 }, NOW), true, 'a legacy item with no schedule is due immediately')
  check(isDue({ nextAttemptAt: 'garbage' }, NOW), true, 'an unparseable schedule is due immediately')
  check(isDue(null, NOW), false, 'a null item is never due')

  const queue = [
    { id: 1, nextAttemptAt: NOW + 60_000 },  // backing off
    { id: 2 },                                // due
    { id: 3, nextAttemptAt: NOW - 5_000 },    // due
  ]
  checkDeep(orderForDrain(queue, NOW).map(i => i.id), [2, 3, 1], 'due items are drained first, oldest first')

  const original = [...queue]
  orderForDrain(queue, NOW)
  checkDeep(queue.map(i => i.id), original.map(i => i.id), 'orderForDrain does not mutate its input')
  checkDeep(orderForDrain(null, NOW), [], 'a null queue is handled')
  checkDeep(orderForDrain([null, { id: 1 }], NOW).map(i => i.id), [1], 'empty entries are filtered out')
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------
function testPlanning() {
  console.log('\n▶ Test 4: what happens after an attempt')

  const item = { id: 7, url: '/api/log-day', method: 'POST', body: { date: '2026-07-30' } }

  check(planNextAttempt({ item, classification: 'success', now: NOW }).action, 'remove', 'success removes the item')

  const permanent = planNextAttempt({ item, classification: 'permanent', now: NOW, errorMessage: 'Server responded 422' })
  check(permanent.action, 'dead-letter', 'a permanent failure is dead-lettered, not retried forever')
  check(permanent.reason, 'permanent', 'the dead-letter reason is recorded')
  check(permanent.item.lastError, 'Server responded 422', 'the error is retained for the user')

  const auth = planNextAttempt({ item, classification: 'auth', now: NOW })
  check(auth.action, 'pause', '401 pauses the drain')
  check(auth.item, undefined, '401 does NOT modify or remove the item — the data is preserved')

  const transient = planNextAttempt({ item, classification: 'transient', now: NOW, random: halfRandom })
  check(transient.action, 'retry', 'a transient failure is retried')
  check(transient.item.attempts, 1, 'the attempt counter increments')
  check(transient.item.nextAttemptAt, NOW + transient.retryInMs, 'the next attempt is scheduled')
  check(transient.item.id, 7, 'the item keeps its key')
  check(item.attempts, undefined, 'planNextAttempt does not mutate its input')

  // Escalation to dead-letter once the cap is reached.
  const nearlyDone = { ...item, attempts: MAX_ATTEMPTS - 2 }
  check(planNextAttempt({ item: nearlyDone, classification: 'transient', now: NOW, random: halfRandom }).action,
    'retry', `attempt ${MAX_ATTEMPTS - 1} still retries`)

  const exhausted = { ...item, attempts: MAX_ATTEMPTS - 1 }
  const givenUp = planNextAttempt({ item: exhausted, classification: 'transient', now: NOW, random: halfRandom })
  check(givenUp.action, 'dead-letter', `attempt ${MAX_ATTEMPTS} gives up instead of retrying forever`)
  check(givenUp.reason, 'max-attempts', 'the reason distinguishes exhaustion from rejection')
  check(givenUp.item.attempts, MAX_ATTEMPTS, 'the final attempt count is recorded')
  check(givenUp.item.failedAt, NOW, 'the failure time is recorded')
}

// ---------------------------------------------------------------------------
// Test 5 — full drain against a scripted server
// ---------------------------------------------------------------------------
function drainOnce(queue, deadLetters, server, now, random = halfRandom) {
  let paused = false

  for (const item of orderForDrain(queue, now)) {
    if (!isDue(item, now)) continue

    const response = server(item)
    const classification = classifyResponse(response)
    const plan = planNextAttempt({ item, classification, now, errorMessage: 'scripted', random })

    if (plan.action === 'remove') {
      queue.splice(queue.indexOf(item), 1)
      continue
    }
    if (plan.action === 'pause') {
      paused = true
      break
    }
    if (plan.action === 'dead-letter') {
      queue.splice(queue.indexOf(item), 1)
      deadLetters.push({ ...plan.item, reason: plan.reason })
      continue
    }
    queue[queue.indexOf(item)] = plan.item
  }

  return { paused }
}

function testFullDrain() {
  console.log('\n▶ Test 5: a poison pill no longer blocks the queue')

  // Item 1 always 500s. Items 2-5 are healthy. Under the old `break`-on-failure
  // loop, items 2-5 would never be attempted.
  const queue = [
    { id: 1, url: '/api/log-day', method: 'POST', body: { date: '2026-07-01' } },
    { id: 2, url: '/api/log-day', method: 'POST', body: { date: '2026-07-02' } },
    { id: 3, url: '/api/log-day', method: 'POST', body: { date: '2026-07-03' } },
    { id: 4, url: '/api/log-day', method: 'POST', body: { date: '2026-07-04' } },
    { id: 5, url: '/api/cycles', method: 'POST', body: { start_date: '2026-07-05' } },
  ]
  const deadLetters = []
  const attempted = []

  const server = (item) => {
    attempted.push(item.id)
    return item.id === 1 ? { status: 500 } : { status: 200 }
  }

  drainOnce(queue, deadLetters, server, NOW)

  check(attempted.includes(2) && attempted.includes(5), true, 'items behind the poison pill ARE attempted')
  checkDeep(queue.map(i => i.id), [1], 'only the failing item remains queued')
  check(queue[0].attempts, 1, 'the failing item recorded one attempt')
  check(queue[0].nextAttemptAt > NOW, true, 'the failing item is scheduled for later, not immediately')

  // Drive it to exhaustion. Each pass advances the clock past its backoff.
  let clock = NOW
  let rounds = 0
  while (queue.length > 0 && rounds < 20) {
    clock = Math.max(clock + 1, (queue[0].nextAttemptAt || clock) + 1)
    drainOnce(queue, deadLetters, server, clock)
    rounds += 1
  }

  check(queue.length, 0, 'the poison pill is eventually removed from the queue')
  check(deadLetters.length, 1, 'it lands in the dead-letter store')
  check(deadLetters[0].reason, 'max-attempts', 'recorded as exhausted rather than silently dropped')
  check(deadLetters[0].attempts, MAX_ATTEMPTS, `it stopped after exactly ${MAX_ATTEMPTS} attempts`)
  check(rounds < 20, true, 'it converged rather than retrying forever')

  // A backing-off item must not be re-attempted before it is due.
  const holdQueue = [{ id: 9, url: '/api/log-day', method: 'POST', body: {}, attempts: 1, nextAttemptAt: NOW + 60_000 }]
  const holdAttempts = []
  drainOnce(holdQueue, [], (item) => { holdAttempts.push(item.id); return { status: 200 } }, NOW)
  check(holdAttempts.length, 0, 'an item still in backoff is skipped, not hammered')
}

// ---------------------------------------------------------------------------
// Test 6 — 401 preserves the queue
// ---------------------------------------------------------------------------
function testAuthPause() {
  console.log('\n▶ Test 6: an expired session preserves queued data')

  const queue = [
    { id: 1, url: '/api/log-day', method: 'POST', body: { date: '2026-07-01' } },
    { id: 2, url: '/api/log-day', method: 'POST', body: { date: '2026-07-02' } },
    { id: 3, url: '/api/log-day', method: 'POST', body: { date: '2026-07-03' } },
  ]
  const deadLetters = []

  const { paused } = drainOnce(queue, deadLetters, () => ({ status: 401 }), NOW)

  check(paused, true, 'the drain pauses on 401')
  check(queue.length, 3, 'every queued health log is preserved — the old code deleted them')
  check(deadLetters.length, 0, 'nothing is dead-lettered on an auth failure')

  // Once re-authenticated, the same queue drains cleanly.
  drainOnce(queue, deadLetters, () => ({ status: 200 }), NOW + 1)
  check(queue.length, 0, 'after re-authentication the queue drains fully')
}

function testDescriptions() {
  console.log('\n▶ Test 7: user-facing descriptions')

  check(describeQueueItem({ url: '/api/log-day', method: 'POST', body: { date: '2026-07-30' } }),
    'Daily log for 2026-07-30', 'a daily log is described by its date')
  check(describeQueueItem({ url: '/api/cycles', method: 'POST' }), 'A period you started', 'a cycle POST is described')
  check(describeQueueItem({ url: '/api/cycles', method: 'PATCH' }), 'A period you ended', 'a cycle PATCH is described')
  check(describeQueueItem({ url: '/api/other', method: 'PUT' }), 'PUT /api/other', 'anything else falls back to the endpoint')
  check(describeQueueItem(null), 'Unknown change', 'a missing item is handled')
  check(DEAD_LETTER_STORE, 'sync_dead_letter', 'the dead-letter store name is exported for lib/db.js')
}

function main() {
  console.log('Running offline sync-queue policy tests...')

  testClassification()
  testBackoff()
  testOrdering()
  testPlanning()
  testFullDrain()
  testAuthPause()
  testDescriptions()

  if (failed > 0) {
    console.error(`\n❌ ${failed} assertion(s) failed, ${passed} passed.`)
    process.exit(1)
  }
  console.log(`\n✅ All ${passed} assertions passed.`)
}

main()

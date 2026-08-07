/**
 * Regression suite for lib/ml-client.js and lib/ml-schemas.js — the transport
 * policy and the response contract for the optional ML microservice.
 *
 * Guards the three failures that lived in the old inline `fetch()` inside
 * lib/api-helpers.js:
 *
 *   1. No timeout. There was no AbortController and no signal, so an ML
 *      container that accepted the connection and never answered left the
 *      route's `await` pending until the platform killed the function.
 *   2. No retry and no breaker. A single transient 502 discarded the ML result,
 *      while a permanently dead service was re-dialled on every request.
 *   3. No validation. `if (data && data.prediction)` accepted any truthy value,
 *      and that value was returned verbatim to the UI.
 *
 * Everything here runs without a network: `fetch`, the clock, the jitter source
 * and the backoff sleep are all injected.
 *
 *   node scripts/test-ml-client.js
 */

import {
  BREAKER_CLOSED,
  BREAKER_HALF_OPEN,
  BREAKER_OPEN,
  DEFAULT_ML_RETRIES,
  DEFAULT_ML_TIMEOUT_MS,
  MAX_ML_BACKOFF_MS,
  ML_FAILURE_REASONS,
  callMlService,
  classifyMlResponse,
  computeMlBackoffMs,
  createCircuitBreaker,
  isMlServiceConfigured,
  resolveMlConfig,
} from '../lib/ml-client.js'

import {
  SCHEMA_REJECTIONS,
  normaliseConfidence,
  normaliseCycleLength,
  normalisePredictionDate,
  parseMlPrediction,
  parseMlRisk,
} from '../lib/ml-schemas.js'

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
 * Test doubles
 * ────────────────────────────────────────────────────────────────────────── */

/** A minimal stand-in for a fetch Response. */
function fakeResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      if (body === '__invalid_json__') throw new SyntaxError('Unexpected token')
      return body
    },
  }
}

/**
 * Builds a fetch double that replays a scripted list of outcomes and records
 * how many times it was called — which is how the "does not retry" assertions
 * are made.
 *
 * An outcome is either a Response-alike, an Error to throw, or the string
 * `'hang'` to never settle until the caller's signal aborts.
 */
function scriptedFetch(outcomes) {
  const calls = []
  const impl = (url, init) => {
    calls.push({ url, init })
    const outcome = outcomes[Math.min(calls.length - 1, outcomes.length - 1)]

    if (outcome === 'hang') {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal
        if (!signal) return
        if (signal.aborted) {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
          return
        }
        signal.addEventListener(
          'abort',
          () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
          { once: true }
        )
      })
    }

    if (outcome instanceof Error) return Promise.reject(outcome)
    return Promise.resolve(outcome)
  }

  impl.calls = calls
  return impl
}

/** Swallows the module's warn output so the suite log stays readable. */
const quietLog = { warn() {}, debug() {} }

/** Zero-delay backoff, so retry tests do not actually wait. */
const instantSleep = async () => {}

const BASE_ENV = { ML_SERVICE_URL: 'http://ml.test', ML_SERVICE_TIMEOUT_MS: '250' }

/* ────────────────────────────────────────────────────────────────────────────
 * resolveMlConfig
 * ────────────────────────────────────────────────────────────────────────── */

section('configuration is clamped, never trusted')
{
  const empty = resolveMlConfig({})
  check(empty.baseUrl, null, 'no URL configured -> baseUrl is null')
  check(empty.timeoutMs, DEFAULT_ML_TIMEOUT_MS, 'timeout falls back to the default')
  check(empty.retries, DEFAULT_ML_RETRIES, 'retries falls back to the default')
  check(isMlServiceConfigured({}), false, 'isMlServiceConfigured is false with no URL')

  const publicOnly = resolveMlConfig({ NEXT_PUBLIC_ML_SERVICE_URL: 'http://public.test' })
  check(publicOnly.baseUrl, 'http://public.test', 'NEXT_PUBLIC_ML_SERVICE_URL is honoured')

  const bothSet = resolveMlConfig({
    ML_SERVICE_URL: 'http://server.test',
    NEXT_PUBLIC_ML_SERVICE_URL: 'http://public.test',
  })
  check(bothSet.baseUrl, 'http://server.test', 'the server-side URL wins when both are set')

  // A trailing slash plus the leading slash on the path yields `//predict-cycle`,
  // which some routers 404 on.
  check(
    resolveMlConfig({ ML_SERVICE_URL: 'http://ml.test///' }).baseUrl,
    'http://ml.test',
    'trailing slashes are stripped from the base URL'
  )
  check(
    resolveMlConfig({ ML_SERVICE_URL: '   ' }).baseUrl,
    null,
    'a whitespace-only URL counts as not configured'
  )

  // The point of clamping: a typo must degrade to a sane value rather than
  // disable the timeout or spin the retry loop.
  check(
    resolveMlConfig({ ML_SERVICE_TIMEOUT_MS: '0' }).timeoutMs, 250,
    'a zero timeout is clamped up, never left as "no timeout"'
  )
  check(
    resolveMlConfig({ ML_SERVICE_TIMEOUT_MS: '999999' }).timeoutMs, 30000,
    'an absurd timeout is clamped down'
  )
  check(
    resolveMlConfig({ ML_SERVICE_TIMEOUT_MS: '4s' }).timeoutMs, DEFAULT_ML_TIMEOUT_MS,
    'a non-numeric timeout falls back to the default'
  )
  check(
    resolveMlConfig({ ML_SERVICE_RETRIES: '99' }).retries, 5,
    'the retry budget is capped'
  )
  check(
    resolveMlConfig({ ML_SERVICE_RETRIES: '0' }).retries, 0,
    'retries may legitimately be disabled'
  )
  check(
    resolveMlConfig({ ML_SERVICE_BREAKER_THRESHOLD: '-4' }).breakerThreshold, 1,
    'a negative breaker threshold is clamped to 1'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * classifyMlResponse
 * ────────────────────────────────────────────────────────────────────────── */

section('response classification')
{
  check(classifyMlResponse(null), 'transient', 'a thrown request is transient')
  check(classifyMlResponse(undefined), 'transient', 'an absent response is transient')
  check(classifyMlResponse({ status: 200 }), 'success', '200 is success')
  check(classifyMlResponse({ status: 204 }), 'success', '204 is success')
  check(classifyMlResponse({ status: 299 }), 'success', 'the top of the 2xx range is success')

  // These will not change on retry, so retrying only delays a correct fallback.
  for (const status of [400, 401, 403, 404, 405, 409, 415, 422]) {
    check(classifyMlResponse({ status }), 'permanent', `${status} is permanent`)
  }

  for (const status of [408, 425, 429, 500, 502, 503, 504]) {
    check(classifyMlResponse({ status }), 'transient', `${status} is transient`)
  }

  check(classifyMlResponse({ status: 418 }), 'permanent', 'an unlisted 4xx defaults to permanent')
  check(classifyMlResponse({ status: 302 }), 'transient', 'an unfollowed redirect is transient')
  check(classifyMlResponse({ status: 'oops' }), 'transient', 'a non-numeric status is transient')
}

/* ────────────────────────────────────────────────────────────────────────────
 * computeMlBackoffMs
 * ────────────────────────────────────────────────────────────────────────── */

section('retry backoff')
{
  const noJitter = () => 0
  const fullJitter = () => 1

  check(computeMlBackoffMs(1, noJitter, 100), 50, 'attempt 1 floors at half the ceiling')
  check(computeMlBackoffMs(1, fullJitter, 100), 100, 'attempt 1 tops out at the ceiling')
  check(computeMlBackoffMs(2, noJitter, 100), 100, 'attempt 2 doubles the ceiling')
  check(computeMlBackoffMs(3, noJitter, 100), 200, 'attempt 3 doubles again')

  checkTrue(
    computeMlBackoffMs(40, fullJitter, 100) <= MAX_ML_BACKOFF_MS,
    'a corrupted attempt counter cannot exceed the backoff ceiling'
  )
  check(
    computeMlBackoffMs(0, noJitter, 100), 50,
    'a zero attempt count is treated as the first attempt'
  )
  check(
    computeMlBackoffMs(NaN, noJitter, 100), 50,
    'a NaN attempt count is treated as the first attempt'
  )

  // Jitter has to actually vary, or a fleet retries in lockstep.
  const spread = new Set([0, 0.25, 0.5, 0.75, 1].map((r) => computeMlBackoffMs(2, () => r, 100)))
  checkTrue(spread.size > 1, 'jitter produces a spread of delays, not a fixed one')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Circuit breaker
 * ────────────────────────────────────────────────────────────────────────── */

section('circuit breaker state machine')
{
  const breaker = createCircuitBreaker({ threshold: 3, cooldownMs: 1000 })
  const t0 = 1_000_000

  check(breaker.state(t0), BREAKER_CLOSED, 'a fresh breaker is closed')
  check(breaker.allowRequest(t0), true, 'a closed breaker allows requests')

  breaker.onFailure(t0)
  check(breaker.state(t0), BREAKER_CLOSED, 'one failure does not open the breaker')
  breaker.onFailure(t0 + 1)
  check(breaker.state(t0 + 1), BREAKER_CLOSED, 'two failures do not open the breaker')
  breaker.onFailure(t0 + 2)
  check(breaker.state(t0 + 2), BREAKER_OPEN, 'the threshold-th failure opens the breaker')
  check(breaker.allowRequest(t0 + 3), false, 'an open breaker refuses requests')

  // Short of the cooldown it stays open...
  check(breaker.state(t0 + 999), BREAKER_OPEN, 'the breaker stays open during the cooldown')

  // ...and reading it after the cooldown is what promotes it. No timers.
  check(breaker.state(t0 + 1002), BREAKER_HALF_OPEN, 'the cooldown elapsing half-opens it')

  check(breaker.allowRequest(t0 + 1002), true, 'half-open lets one probe through')
  check(
    breaker.allowRequest(t0 + 1002), false,
    'half-open refuses a second concurrent probe — a recovering service sees one request'
  )

  // A failed probe re-opens and restarts the cooldown from the probe time.
  breaker.onFailure(t0 + 1002)
  check(breaker.state(t0 + 1002), BREAKER_OPEN, 'a failed probe re-opens the breaker')
  check(
    breaker.state(t0 + 1500), BREAKER_OPEN,
    'the cooldown restarts from the failed probe, not from the original opening'
  )
  check(breaker.state(t0 + 2003), BREAKER_HALF_OPEN, 'the restarted cooldown eventually elapses')

  // A successful probe closes it and forgets the failure history entirely.
  breaker.allowRequest(t0 + 2003)
  breaker.onSuccess()
  check(breaker.state(t0 + 2003), BREAKER_CLOSED, 'a successful probe closes the breaker')
  checkDeep(
    breaker.snapshot(t0 + 2003).consecutiveFailures, 0,
    'closing the breaker clears the failure counter'
  )

  breaker.onFailure(t0 + 3000)
  breaker.reset()
  check(breaker.state(t0 + 3000), BREAKER_CLOSED, 'reset() returns the breaker to closed')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Schema: field normalisers
 * ────────────────────────────────────────────────────────────────────────── */

section('confidence normalisation')
{
  check(normaliseConfidence('85%'), '85%', 'a percent string passes through')
  check(normaliseConfidence('85'), '85%', 'a bare numeric string gains the sign')
  check(normaliseConfidence(' 85 % '), '85%', 'surrounding whitespace is tolerated')
  check(normaliseConfidence(85), '85%', 'a number is rendered as a percentage')
  check(normaliseConfidence(85.4), '85%', 'a fractional percentage is rounded')
  check(normaliseConfidence(0.85), '85%', 'a 0..1 probability is scaled to a percentage')
  check(normaliseConfidence(0), '0%', 'zero confidence is a legitimate value')
  check(normaliseConfidence(100), '100%', 'full confidence is a legitimate value')

  // Every one of these previously reached the UI and rendered as "undefined%".
  check(normaliseConfidence(null), null, 'null is rejected')
  check(normaliseConfidence(undefined), null, 'undefined is rejected')
  check(normaliseConfidence(''), null, 'an empty string is rejected')
  check(normaliseConfidence('high'), null, 'a non-numeric word is rejected')
  check(normaliseConfidence(101), null, 'an out-of-range percentage is rejected')
  check(normaliseConfidence(-5), null, 'a negative percentage is rejected')
  check(normaliseConfidence(NaN), null, 'NaN is rejected')
  check(normaliseConfidence(Infinity), null, 'Infinity is rejected')
  check(normaliseConfidence({}), null, 'an object is rejected')
}

section('prediction date normalisation')
{
  check(
    normalisePredictionDate('Aug 12, 2026'), 'Aug 12, 2026',
    'the fallback engine\'s own format is accepted'
  )
  check(
    normalisePredictionDate('2026-08-12'), '2026-08-12',
    'an ISO date is accepted — a Python service would naturally emit this'
  )
  check(normalisePredictionDate('  2026-08-12  '), '2026-08-12', 'whitespace is trimmed')

  // This is the payload that rendered as "Invalid Date".
  check(normalisePredictionDate('soon'), null, 'an unparseable string is rejected')
  check(normalisePredictionDate(''), null, 'an empty string is rejected')
  check(normalisePredictionDate(null), null, 'null is rejected')
  check(normalisePredictionDate(1754000000000), null, 'a raw timestamp number is rejected')
}

section('cycle length normalisation')
{
  check(normaliseCycleLength(28), 28, 'a typical cycle length is accepted')
  check(normaliseCycleLength('30'), 30, 'a numeric string is coerced')
  check(normaliseCycleLength(28.6), 29, 'a fractional length is rounded')
  check(normaliseCycleLength(21), 21, 'the lower bound is inclusive')
  check(normaliseCycleLength(45), 45, 'the upper bound is inclusive')

  // Rejected rather than clamped: a service claiming 90 days is broken or
  // looking at someone else's data, and clamping to 45 would hide that.
  check(normaliseCycleLength(90), null, 'an out-of-range length is rejected, not clamped')
  check(normaliseCycleLength(3), null, 'an implausibly short length is rejected')
  check(normaliseCycleLength('twenty-eight'), null, 'a non-numeric length is rejected')
  check(normaliseCycleLength(null), null, 'null is rejected')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Schema: parseMlPrediction
 * ────────────────────────────────────────────────────────────────────────── */

section('prediction payload validation')
{
  const good = { nextPeriodDate: 'Aug 12, 2026', confidence: '85%', averageCycleLength: 28 }

  const enveloped = parseMlPrediction({ prediction: good })
  check(enveloped.ok, true, 'an enveloped prediction is accepted')
  checkDeep(enveloped.value, good, 'the enveloped value is returned normalised')

  const bare = parseMlPrediction(good)
  check(bare.ok, true, 'a bare prediction object is also accepted')

  // The exact values the old truthiness check let through.
  check(parseMlPrediction('ok').ok, false, 'a string body is rejected')
  check(parseMlPrediction('ok').reason, SCHEMA_REJECTIONS.NOT_AN_OBJECT, '…as not-an-object')
  check(parseMlPrediction(null).ok, false, 'a null body is rejected')
  check(parseMlPrediction([]).ok, false, 'an array body is rejected — [] is truthy')
  check(parseMlPrediction({}).ok, false, 'an empty object is rejected')
  check(parseMlPrediction({ prediction: {} }).ok, false, 'an empty envelope is rejected')

  check(
    parseMlPrediction({ ...good, nextPeriodDate: 'soon' }).reason,
    SCHEMA_REJECTIONS.BAD_DATE,
    'an unparseable date is reported as such'
  )
  check(
    parseMlPrediction({ ...good, confidence: null }).reason,
    SCHEMA_REJECTIONS.BAD_CONFIDENCE,
    'a null confidence is reported as such'
  )
  check(
    parseMlPrediction({ ...good, averageCycleLength: 0 }).reason,
    SCHEMA_REJECTIONS.BAD_CYCLE_LENGTH,
    'a zero cycle length is reported as such'
  )
  check(
    parseMlPrediction({ nextPeriodDate: 'Aug 12, 2026', confidence: '85%' }).ok, false,
    'a partial payload is a failure, not a result to be topped up with defaults'
  )

  // Optional enrichment fields ride along when well-formed.
  const rich = parseMlPrediction({
    ...good,
    missedCycles: 2,
    isStale: true,
    hasEnoughRecentData: false,
    lastLoggedDate: '2026-05-01',
    isIrregular: true,
    varianceStdDev: 6.44,
    predictionWindow: { from: 'Aug 6, 2026', to: 'Aug 18, 2026' },
  })
  check(rich.ok, true, 'a rich payload is accepted')
  check(rich.value.missedCycles, 2, 'missedCycles is carried through')
  check(rich.value.isStale, true, 'isStale is carried through')
  check(rich.value.varianceStdDev, 6.4, 'varianceStdDev is rounded to one decimal')
  check(
    rich.value.regularityLabel, 'Irregular Cycle',
    'regularityLabel is derived when the service omits it'
  )
  checkDeep(
    rich.value.predictionWindow, { from: 'Aug 6, 2026', to: 'Aug 18, 2026' },
    'a complete prediction window is carried through'
  )

  // A half-populated range renders as "Aug 12, 2026 – undefined".
  const halfWindow = parseMlPrediction({ ...good, predictionWindow: { from: 'Aug 6, 2026' } })
  check(halfWindow.ok, true, 'a bad optional field does not invalidate the whole payload')
  check(
    halfWindow.value.predictionWindow, undefined,
    'a half-populated prediction window is dropped rather than half-rendered'
  )

  const junkOptional = parseMlPrediction({ ...good, missedCycles: 'lots', isStale: 'yes' })
  check(junkOptional.ok, true, 'wrongly-typed optional fields do not invalidate the payload')
  check(junkOptional.value.missedCycles, undefined, 'a non-numeric missedCycles is dropped')
  check(junkOptional.value.isStale, undefined, 'a non-boolean isStale is dropped')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Schema: parseMlRisk
 * ────────────────────────────────────────────────────────────────────────── */

section('risk payload validation')
{
  const good = { score: 62, tier: 'HIGH RISK', factors: ['Irregular cycle patterns detected'] }

  const enveloped = parseMlRisk({ risk: good })
  check(enveloped.ok, true, 'an enveloped risk result is accepted')
  check(enveloped.value.score, 62, 'the score is carried through')
  check(enveloped.value.tier, 'HIGH RISK', 'the tier is carried through')
  checkTrue(
    enveloped.value.recommendation.length > 0,
    'a missing recommendation is filled — it carries no clinical claim of its own'
  )

  check(parseMlRisk(good).ok, true, 'a bare risk object is also accepted')
  check(
    parseMlRisk({ score: 40, label: 'MEDIUM' }).value.tier, 'MEDIUM RISK',
    'the legacy `label` alias is normalised onto `tier`'
  )

  check(parseMlRisk({}).ok, false, 'an empty object is rejected')
  check(parseMlRisk({ score: 62 }).ok, false, 'a score with no tier is rejected')
  check(parseMlRisk({ tier: 'HIGH RISK' }).ok, false, 'a tier with no score is rejected')
  check(parseMlRisk({ score: 200, tier: 'HIGH RISK' }).ok, false, 'an out-of-range score is rejected')
  check(parseMlRisk({ score: -1, tier: 'LOW RISK' }).ok, false, 'a negative score is rejected')
  check(
    parseMlRisk({ score: 40, tier: 'PROBABLY FINE' }).ok, false,
    'an unrecognised tier is rejected rather than defaulted to LOW RISK'
  )
  check(parseMlRisk({ score: 62, tier: 'HIGH RISK' }).reason, undefined, 'a valid result has no reason')
  check(
    parseMlRisk('LOW RISK').reason, SCHEMA_REJECTIONS.NOT_AN_OBJECT,
    'a string body is rejected as not-an-object'
  )
  checkDeep(
    parseMlRisk({ score: 10, tier: 'LOW RISK', factors: ['a', 2, null, 'b'] }).value.factors,
    ['a', 'b'],
    'non-string factors are filtered out'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * callMlService — the end-to-end policy
 * ────────────────────────────────────────────────────────────────────────── */

async function runTransportTests() {
  section('callMlService: the service is optional')
  {
    const fetchImpl = scriptedFetch([fakeResponse(200, { ok: true })])
    const result = await callMlService('/predict-cycle', {}, {
      env: {}, fetchImpl, log: quietLog, parse: () => ({ ok: true, value: 1 }),
    })
    check(result.ok, false, 'an unconfigured ML service is a clean failure, not an error')
    check(result.reason, ML_FAILURE_REASONS.DISABLED, '…reported as `disabled`')
    check(fetchImpl.calls.length, 0, 'no request is made when the service is not configured')

    // Simulates a runtime where `globalThis.fetch` is absent (Node < 18 with no
    // polyfill), which is what the default parameter would resolve to there.
    const noFetch = await callMlService('/predict-cycle', {}, {
      env: BASE_ENV, fetchImpl: null, log: quietLog, parse: () => ({ ok: true, value: 1 }),
    })
    check(
      noFetch.reason, ML_FAILURE_REASONS.DISABLED,
      'a runtime with no global fetch degrades instead of throwing a ReferenceError'
    )
  }

  section('callMlService: happy path')
  {
    const good = { prediction: { nextPeriodDate: 'Aug 12, 2026', confidence: '85%', averageCycleLength: 28 } }
    const fetchImpl = scriptedFetch([fakeResponse(200, good)])
    const breaker = createCircuitBreaker()

    const result = await callMlService('/predict-cycle', { cycle_history: [] }, {
      env: BASE_ENV, fetchImpl, breaker, log: quietLog, parse: parseMlPrediction,
    })

    check(result.ok, true, 'a valid 2xx is used')
    check(result.attempts, 1, 'the happy path takes exactly one attempt')
    check(result.value.confidence, '85%', 'the validated value is returned')
    check(fetchImpl.calls.length, 1, 'exactly one request is issued')
    check(fetchImpl.calls[0].url, 'http://ml.test/predict-cycle', 'the URL is joined correctly')
    check(fetchImpl.calls[0].init.method, 'POST', 'the request is a POST')
    checkTrue(fetchImpl.calls[0].init.signal, 'every request carries an abort signal')
    checkDeep(
      JSON.parse(fetchImpl.calls[0].init.body), { cycle_history: [] },
      'the payload is serialised as JSON'
    )
  }

  section('callMlService: a hanging service is bounded by the timeout')
  {
    // The original bug: no AbortController meant this await never settled.
    const fetchImpl = scriptedFetch(['hang'])
    const breaker = createCircuitBreaker()
    const started = Date.now()

    const result = await callMlService('/predict-cycle', {}, {
      env: { ...BASE_ENV, ML_SERVICE_RETRIES: '0' },
      fetchImpl, breaker, log: quietLog, sleep: instantSleep, parse: parseMlPrediction,
    })
    const elapsed = Date.now() - started

    check(result.ok, false, 'a hanging service fails rather than hanging the route')
    check(result.reason, ML_FAILURE_REASONS.TIMEOUT, '…reported as a timeout')
    checkTrue(elapsed < 3000, `the call returned in ${elapsed}ms rather than hanging`)
  }

  section('callMlService: transient faults are retried')
  {
    const good = { risk: { score: 30, tier: 'MEDIUM RISK', factors: [] } }
    const fetchImpl = scriptedFetch([fakeResponse(502, null), fakeResponse(200, good)])
    const breaker = createCircuitBreaker()

    const result = await callMlService('/pcod-risk', {}, {
      env: BASE_ENV, fetchImpl, breaker, log: quietLog, sleep: instantSleep, parse: parseMlRisk,
    })

    check(result.ok, true, 'a 502 followed by a 200 succeeds on the retry')
    check(result.attempts, 2, 'it took two attempts')
    check(fetchImpl.calls.length, 2, 'two requests were issued')
    check(breaker.snapshot(0).consecutiveFailures, 0, 'a recovered call leaves the breaker clean')
  }

  section('callMlService: the retry budget is finite')
  {
    const fetchImpl = scriptedFetch([fakeResponse(503, null)])
    const breaker = createCircuitBreaker()

    const result = await callMlService('/pcod-risk', {}, {
      env: { ...BASE_ENV, ML_SERVICE_RETRIES: '2' },
      fetchImpl, breaker, log: quietLog, sleep: instantSleep, parse: parseMlRisk,
    })

    check(result.ok, false, 'a persistently failing service gives up')
    check(result.reason, ML_FAILURE_REASONS.TRANSIENT, '…reported as transient')
    check(fetchImpl.calls.length, 3, 'retries=2 means three attempts, not an unbounded loop')
  }

  section('callMlService: network errors are transient')
  {
    const fetchImpl = scriptedFetch([new TypeError('fetch failed'), fakeResponse(200, {
      prediction: { nextPeriodDate: '2026-08-12', confidence: 90, averageCycleLength: 29 },
    })])
    const result = await callMlService('/predict-cycle', {}, {
      env: BASE_ENV, fetchImpl, breaker: createCircuitBreaker(), log: quietLog,
      sleep: instantSleep, parse: parseMlPrediction,
    })

    check(result.ok, true, 'a thrown fetch is retried and can still succeed')
    check(result.value.confidence, '90%', 'a numeric confidence is normalised on the way out')
  }

  section('callMlService: permanent rejections are not retried')
  {
    for (const status of [400, 401, 404, 422]) {
      const fetchImpl = scriptedFetch([fakeResponse(status, { error: 'nope' })])
      const result = await callMlService('/pcod-risk', {}, {
        env: { ...BASE_ENV, ML_SERVICE_RETRIES: '3' },
        fetchImpl, breaker: createCircuitBreaker(), log: quietLog,
        sleep: instantSleep, parse: parseMlRisk,
      })

      check(result.reason, ML_FAILURE_REASONS.PERMANENT, `${status} fails as permanent`)
      check(result.status, status, `${status} is reported on the result`)
      check(fetchImpl.calls.length, 1, `${status} is not retried — retrying only delays the fallback`)
    }
  }

  section('callMlService: an unusable 2xx body is not retried either')
  {
    // A 200 the schema rejects is the service's answer, not a connection fault.
    const fetchImpl = scriptedFetch([fakeResponse(200, { prediction: 'looks fine to me' })])
    const breaker = createCircuitBreaker()

    const result = await callMlService('/predict-cycle', {}, {
      env: { ...BASE_ENV, ML_SERVICE_RETRIES: '3' },
      fetchImpl, breaker, log: quietLog, sleep: instantSleep, parse: parseMlPrediction,
    })

    check(result.ok, false, 'a 200 with an unusable body does not become a result')
    check(result.reason, ML_FAILURE_REASONS.INVALID_RESPONSE, '…reported as an invalid response')
    check(fetchImpl.calls.length, 1, 'retrying would return the same body, so it is not retried')
    check(
      breaker.snapshot(0).consecutiveFailures, 1,
      'a service emitting garbage still counts as unhealthy'
    )
  }

  section('callMlService: a 200 carrying HTML does not crash the route')
  {
    // An ingress error page or a followed login redirect is a real shape.
    const fetchImpl = scriptedFetch([fakeResponse(200, '__invalid_json__')])
    const result = await callMlService('/predict-cycle', {}, {
      env: BASE_ENV, fetchImpl, breaker: createCircuitBreaker(), log: quietLog,
      sleep: instantSleep, parse: parseMlPrediction,
    })
    check(result.reason, ML_FAILURE_REASONS.INVALID_RESPONSE, 'an unparseable body is an invalid response')
  }

  section('callMlService: the breaker short-circuits a dead service')
  {
    const fetchImpl = scriptedFetch([fakeResponse(500, null)])
    const breaker = createCircuitBreaker({ threshold: 2, cooldownMs: 1000 })
    let clock = 5_000_000
    const now = () => clock
    const opts = {
      env: { ...BASE_ENV, ML_SERVICE_RETRIES: '0' },
      fetchImpl, breaker, now, log: quietLog, sleep: instantSleep, parse: parseMlPrediction,
    }

    const first = await callMlService('/predict-cycle', {}, opts)
    check(first.reason, ML_FAILURE_REASONS.TRANSIENT, 'the first failure goes to the wire')
    const second = await callMlService('/predict-cycle', {}, opts)
    check(second.reason, ML_FAILURE_REASONS.TRANSIENT, 'the second failure goes to the wire')
    check(fetchImpl.calls.length, 2, 'two requests reached the service')

    const third = await callMlService('/predict-cycle', {}, opts)
    check(third.reason, ML_FAILURE_REASONS.CIRCUIT_OPEN, 'the third call is short-circuited')
    check(third.attempts, 0, 'a short-circuited call makes no attempt')
    check(
      fetchImpl.calls.length, 2,
      'a dead service costs nothing per request once the breaker is open'
    )

    // After the cooldown a single probe is allowed through.
    clock += 1500
    const probe = await callMlService('/predict-cycle', {}, opts)
    check(probe.reason, ML_FAILURE_REASONS.TRANSIENT, 'the half-open probe reaches the service')
    check(fetchImpl.calls.length, 3, 'exactly one probe was issued')

    // A failed probe re-opens, so the next call is short-circuited again.
    const afterProbe = await callMlService('/predict-cycle', {}, opts)
    check(afterProbe.reason, ML_FAILURE_REASONS.CIRCUIT_OPEN, 'a failed probe re-opens the breaker')
  }

  section('callMlService: a recovered service closes the breaker')
  {
    const good = { prediction: { nextPeriodDate: 'Aug 12, 2026', confidence: '85%', averageCycleLength: 28 } }
    const fetchImpl = scriptedFetch([
      fakeResponse(500, null), fakeResponse(500, null), fakeResponse(200, good),
    ])
    const breaker = createCircuitBreaker({ threshold: 2, cooldownMs: 1000 })
    let clock = 7_000_000
    const opts = {
      env: { ...BASE_ENV, ML_SERVICE_RETRIES: '0' },
      fetchImpl, breaker, now: () => clock, log: quietLog, sleep: instantSleep,
      parse: parseMlPrediction,
    }

    await callMlService('/predict-cycle', {}, opts)
    await callMlService('/predict-cycle', {}, opts)
    check(breaker.state(clock), BREAKER_OPEN, 'the breaker opened')

    clock += 1500
    const recovered = await callMlService('/predict-cycle', {}, opts)
    check(recovered.ok, true, 'the probe succeeded')
    check(breaker.state(clock), BREAKER_CLOSED, 'a successful probe closes the breaker')
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * predictNextPeriod / calculatePCODRisk — the callers still fall back
 * ────────────────────────────────────────────────────────────────────────── */

async function runCallerTests() {
  const { predictNextPeriod, calculatePCODRisk } = await import('../lib/api-helpers.js')

  section('api-helpers falls back to the rule-based engine')
  {
    const history = [
      { start_date: '2026-05-01', cycle_length: 28 },
      { start_date: '2026-05-29', cycle_length: 28 },
      { start_date: '2026-06-26', cycle_length: 28 },
    ]

    // A dead service must still produce a real, correct prediction.
    const dead = scriptedFetch([fakeResponse(503, null)])
    const prediction = await predictNextPeriod(history, new Date('2026-07-01T12:00:00Z'), {
      env: { ...BASE_ENV, ML_SERVICE_RETRIES: '0' },
      fetchImpl: dead, breaker: createCircuitBreaker(), log: quietLog, sleep: instantSleep,
    })
    check(prediction.averageCycleLength, 28, 'the fallback engine still computes a cycle length')
    checkTrue(prediction.nextPeriodDate.length > 0, 'the fallback engine still names a date')
    checkTrue(/^\d{1,3}%$/.test(prediction.confidence), 'the fallback confidence is well-formed')

    // The unvalidated-payload bug: this used to be returned verbatim.
    const garbage = scriptedFetch([fakeResponse(200, { prediction: { confidence: null } })])
    const fromGarbage = await predictNextPeriod(history, new Date('2026-07-01T12:00:00Z'), {
      env: BASE_ENV, fetchImpl: garbage, breaker: createCircuitBreaker(),
      log: quietLog, sleep: instantSleep,
    })
    check(
      fromGarbage.confidence === null, false,
      'a malformed ML payload never reaches the caller — the fallback answers instead'
    )
    check(fromGarbage.averageCycleLength, 28, 'the fallback prediction is complete')

    // A valid ML payload is preferred over the fallback.
    const mlGood = scriptedFetch([fakeResponse(200, {
      prediction: { nextPeriodDate: 'Sep 01, 2026', confidence: '91%', averageCycleLength: 30 },
    })])
    const fromMl = await predictNextPeriod(history, new Date('2026-07-01T12:00:00Z'), {
      env: BASE_ENV, fetchImpl: mlGood, breaker: createCircuitBreaker(),
      log: quietLog, sleep: instantSleep,
    })
    check(fromMl.confidence, '91%', 'a valid ML prediction is preferred over the fallback')
    check(fromMl.averageCycleLength, 30, '…including its cycle length')

    const riskDead = scriptedFetch([new TypeError('fetch failed')])
    const risk = await calculatePCODRisk(history, ['acne', 'fatigue'], {
      env: { ...BASE_ENV, ML_SERVICE_RETRIES: '0' },
      fetchImpl: riskDead, breaker: createCircuitBreaker(), log: quietLog, sleep: instantSleep,
    })
    checkTrue(['LOW RISK', 'MEDIUM RISK', 'HIGH RISK'].includes(risk.tier), 'the fallback risk tier is real')
    checkTrue(Number.isFinite(risk.score), 'the fallback risk score is numeric')

    const riskMl = scriptedFetch([fakeResponse(200, { risk: { score: 71, tier: 'HIGH RISK', factors: ['x'] } })])
    const mlRisk = await calculatePCODRisk(history, ['acne'], {
      env: BASE_ENV, fetchImpl: riskMl, breaker: createCircuitBreaker(),
      log: quietLog, sleep: instantSleep,
    })
    check(mlRisk.score, 71, 'a valid ML risk result is preferred over the fallback')
    check(mlRisk.tier, 'HIGH RISK', '…including its tier')
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Run
 * ────────────────────────────────────────────────────────────────────────── */

await runTransportTests()
await runCallerTests()

console.log('')
if (failed > 0) {
  console.error(`❌ ${failed} ML client assertion(s) failed (${passed} passed).`)
  process.exit(1)
}
console.log(`✅ All ${passed} ML client assertions passed.`)

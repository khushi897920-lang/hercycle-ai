/**
 * Regression suite for lib/pcod-risk-result.js and the risk-shape contract in
 * lib/api-helpers.js.
 *
 * Guards the fix for the fabricated-assessment bug: /api/pcod-risk answered a
 * failed screening with a hard-coded `{ score: 25, label: 'LOW RISK' }` payload
 * at HTTP 200, the offline client returned the same constant when it had
 * nothing cached, and the UI collapsed anything unrecognised to 'LOW RISK' via
 * `pcodRisk?.tier || pcodRisk?.label || 'LOW RISK'`.
 *
 *   node scripts/test-pcod-risk-result.js
 */

import {
  RISK_TIERS,
  RISK_UNAVAILABLE_REASONS,
  isRiskResult,
  normaliseRiskResult,
  normaliseTier,
  riskUnavailable,
} from '../lib/pcod-risk-result.js'

import { calculatePCODRisk } from '../lib/api-helpers.js'

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

function section(title) {
  console.log(`\n— ${title}`)
}

// ───────────────────────────────────────────────────────────────────────────
section('tier normalisation never invents a tier')

check(normaliseTier('HIGH RISK'), 'HIGH RISK', 'canonical high')
check(normaliseTier('MEDIUM RISK'), 'MEDIUM RISK', 'canonical medium')
check(normaliseTier('LOW RISK'), 'LOW RISK', 'canonical low')
check(normaliseTier('MEDIUM'), 'MEDIUM RISK', 'bare MEDIUM is accepted')
check(normaliseTier('med'), 'MEDIUM RISK', 'lowercase abbreviation is accepted')
check(normaliseTier('high risk'), 'HIGH RISK', 'lowercase is accepted')

// The heart of the bug: an unrecognised value has to be absence, not "low".
check(normaliseTier(undefined), null, 'undefined is not a tier')
check(normaliseTier(null), null, 'null is not a tier')
check(normaliseTier(''), null, 'an empty string is not a tier')
check(normaliseTier('   '), null, 'whitespace is not a tier')
check(normaliseTier('UNKNOWN'), null, 'an unrecognised string is not a tier')
check(normaliseTier(25), null, 'a number is not a tier')

// ───────────────────────────────────────────────────────────────────────────
section('result validation')

const good = normaliseRiskResult({
  score: 55,
  tier: 'MEDIUM RISK',
  factors: ['Irregular cycle patterns detected'],
  recommendation: 'Keep tracking your cycle and maintaining healthy habits.',
})
check(good?.score, 55, 'score passes through')
check(good?.tier, 'MEDIUM RISK', 'tier passes through')
check(good?.factors.length, 1, 'factors pass through')
check(good?.recommendation.startsWith('Keep tracking'), true, 'recommendation passes through')

// The legacy error payload used `label` where the success payload used `tier`.
// Accepting the alias keeps cached payloads from older builds renderable, but
// the output always speaks one language.
const legacy = normaliseRiskResult({ score: 40, label: 'MEDIUM RISK' })
check(legacy?.tier, 'MEDIUM RISK', 'the legacy `label` key is accepted as `tier`')
check('label' in (legacy || {}), false, 'the output never carries `label`')

check(normaliseRiskResult(null), null, 'null is not a result')
check(normaliseRiskResult(undefined), null, 'undefined is not a result')
check(normaliseRiskResult('LOW RISK'), null, 'a bare string is not a result')
check(normaliseRiskResult({}), null, 'an empty object is not a result')
check(normaliseRiskResult({ score: 25 }), null, 'a score with no tier is not a result')
check(normaliseRiskResult({ tier: 'LOW RISK' }), null, 'a tier with no score is not a result')
check(normaliseRiskResult({ score: 'lots', tier: 'LOW RISK' }), null, 'a non-numeric score is not a result')
check(normaliseRiskResult({ score: -1, tier: 'LOW RISK' }), null, 'a negative score is not a result')
check(normaliseRiskResult({ score: 101, tier: 'LOW RISK' }), null, 'a score above 100 is not a result')
check(normaliseRiskResult({ score: Number.NaN, tier: 'LOW RISK' }), null, 'NaN is not a result')
check(normaliseRiskResult({ score: 0, tier: 'LOW RISK' })?.score, 0, 'a genuine zero score IS a result')

check(
  normaliseRiskResult({ score: 30, tier: 'LOW RISK', factors: 'not an array' })?.factors.length,
  0,
  'a malformed factors field degrades to an empty list rather than throwing'
)
check(
  normaliseRiskResult({ score: 30, tier: 'LOW RISK', factors: ['ok', 7, null] })?.factors.length,
  1,
  'non-string factors are dropped'
)

check(isRiskResult({ score: 10, tier: 'LOW RISK' }), true, 'isRiskResult accepts a real result')
check(isRiskResult({ score: 10 }), false, 'isRiskResult rejects a partial payload')

// ───────────────────────────────────────────────────────────────────────────
section('the unavailable response carries no result')

const unavailable = riskUnavailable(RISK_UNAVAILABLE_REASONS.BACKEND)
check(unavailable.success, false, 'success is false')
check(unavailable.available, false, 'available is false')
check(unavailable.reason, 'backend_unavailable', 'the reason is reported')
check('data' in unavailable, false, 'there is no data key to accidentally render')
check('score' in unavailable, false, 'there is no score')
check('tier' in unavailable, false, 'there is no tier')
check(normaliseRiskResult(unavailable), null, 'an unavailable response is not mistakable for a result')

check(riskUnavailable().reason, 'backend_unavailable', 'the reason defaults to backend')
check(riskUnavailable(RISK_UNAVAILABLE_REASONS.OFFLINE).reason, 'offline', 'offline is reportable')

// ───────────────────────────────────────────────────────────────────────────
section('calculatePCODRisk agrees with the contract')

const realResult = await calculatePCODRisk(
  [
    { start_date: '2026-01-05', cycle_length: 28 },
    { start_date: '2026-02-20', cycle_length: 46 },
    { start_date: '2026-03-10', cycle_length: 19 },
    { start_date: '2026-05-01', cycle_length: 52 },
  ],
  [
    { date: '2026-04-01', symptoms: ['acne', 'fatigue'] },
    { date: '2026-04-02', symptoms: ['acne', 'fatigue'] },
    { date: '2026-04-03', symptoms: ['acne', 'hair loss'] },
  ]
)

check(isRiskResult(realResult), true, 'a real computation satisfies the contract')
check(RISK_TIERS.includes(realResult.tier), true, 'the tier is one of the three known tiers')
check('label' in realResult, false, 'the engine speaks `tier`, not `label`')

// This is precisely why a failed query must not fall through to `cycles || []`:
// "no history" is answered with a reassuring zero, which is indistinguishable
// from a genuine low-risk assessment once it reaches the UI.
const emptyHistory = await calculatePCODRisk([], [])
check(emptyHistory.score, 0, 'an empty history scores zero')
check(emptyHistory.tier, 'LOW RISK', 'an empty history reads as LOW RISK')
check(
  isRiskResult(emptyHistory),
  true,
  'and it validates as a real result — so the route has to reject DB errors before reaching here'
)

// ───────────────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\n❌ ${failed} assertion(s) failed, ${passed} passed.`)
  process.exit(1)
}

console.log(`\n✅ All ${passed} PCOD risk contract assertions passed.`)

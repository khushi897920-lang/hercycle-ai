/**
 * pcod-risk-result.js — the shape contract for a PCOD risk assessment, shared
 * by the API route, the offline client and the UI.
 *
 * ## Why this module exists
 *
 * The risk screening had three places that could produce a result — the route
 * handler, the offline client's local calculation, and the localStorage cache —
 * and each of them had its own idea of what a result looked like. Two of the
 * consequences were user-visible:
 *
 * 1. **Failures were dressed up as results.** The route's catch block returned
 *    a hard-coded `{ score: 25, label: 'LOW RISK', factors: [...] }` with HTTP
 *    200, and the offline client returned the same constant when it had nothing
 *    cached. Neither was computed from anything. In an app whose purpose is to
 *    help someone notice a condition, a fabricated "you're fine" is the single
 *    worst thing to render.
 *
 * 2. **The field name disagreed.** `calculatePCODRisk()` returns `tier`; the
 *    error payloads returned `label`. The UI papered over it with
 *    `pcodRisk?.tier || pcodRisk?.label || 'LOW RISK'`, which quietly turned
 *    *any* unrecognised shape into a low-risk reading.
 *
 * The rule this module enforces:
 *
 *   > A risk result is either a real computation or it is absent.
 *   > There is no third state, and absence never renders as a tier.
 *
 * No imports, so it is usable from Route Handlers, Client Components and plain
 * Node scripts alike.
 */

/** The three tiers `calculatePCODRisk` can return, ordered by severity. */
export const RISK_TIERS = ['LOW RISK', 'MEDIUM RISK', 'HIGH RISK']

/** Why an assessment is missing. Rendered as an explanation, never as a tier. */
export const RISK_UNAVAILABLE_REASONS = {
  /** A dependency (database, ML service) did not answer. */
  BACKEND: 'backend_unavailable',
  /** The device is offline and has nothing cached to compute from. */
  OFFLINE: 'offline',
  /** There genuinely is not enough logged history yet. */
  INSUFFICIENT_DATA: 'insufficient_data',
}

/**
 * Normalises a raw tier string onto one of {@link RISK_TIERS}.
 *
 * Accepts the historical spellings the UI had accumulated (`MEDIUM`, `Med`,
 * `high risk`) so a cached payload written by an older build still renders.
 * Returns `null` — never a default tier — when the value is unrecognisable.
 *
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normaliseTier(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null

  const upper = raw.toUpperCase()
  if (upper.includes('HIGH')) return 'HIGH RISK'
  if (upper.includes('MED')) return 'MEDIUM RISK'
  if (upper.includes('LOW')) return 'LOW RISK'
  return null
}

/**
 * Validates and normalises a risk payload from any source.
 *
 * A payload only counts as a result if it carries a numeric score in range and
 * a recognisable tier. The legacy `label` key is accepted as an alias for
 * `tier` so cached payloads keep working, but the output always uses `tier`.
 *
 * @param {unknown} raw
 * @returns {{score: number, tier: string, factors: string[], recommendation: string}|null}
 *   `null` when `raw` is not a real result — callers must treat that as absence
 *   rather than substituting a default.
 */
export function normaliseRiskResult(raw) {
  if (!raw || typeof raw !== 'object') return null

  const score = Number(raw.score)
  if (!Number.isFinite(score) || score < 0 || score > 100) return null

  const tier = normaliseTier(raw.tier ?? raw.label)
  if (!tier) return null

  return {
    score: Math.round(score),
    tier,
    factors: Array.isArray(raw.factors) ? raw.factors.filter((f) => typeof f === 'string') : [],
    recommendation: typeof raw.recommendation === 'string' ? raw.recommendation : '',
  }
}

/**
 * True when `raw` is a real, renderable assessment.
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isRiskResult(raw) {
  return normaliseRiskResult(raw) !== null
}

/**
 * The response body for "we could not assess right now".
 *
 * Deliberately carries **no `data`** — absence of a result is the honest
 * answer, and anything placed here would eventually be rendered as one.
 *
 * @param {string} [reason] one of {@link RISK_UNAVAILABLE_REASONS}
 * @returns {{success: false, available: false, reason: string}}
 */
export function riskUnavailable(reason = RISK_UNAVAILABLE_REASONS.BACKEND) {
  return { success: false, available: false, reason }
}

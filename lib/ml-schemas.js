/**
 * ml-schemas.js — the shape contract for anything the ML microservice returns.
 *
 * ## Why this module exists
 *
 * The only check the ML path ever performed was truthiness:
 *
 *     if (data && data.prediction) return data.prediction
 *
 * `data.prediction` could be the string `"ok"`, an empty object, or
 * `{ confidence: null, averageCycleLength: "twenty-eight" }` and all three
 * passed. Whatever it was got returned straight out of `/api/predict-cycle` and
 * handed to `PredictionCard`, which renders `confidence` and `nextPeriodDate`
 * directly — so a malformed payload surfaced as `undefined%` next to
 * `Invalid Date`, while a correct rule-based answer sat unused one line below.
 *
 * The same held for `/pcod-risk`, where the unvalidated payload became the risk
 * tier the app tells users to show a clinician.
 *
 * The rule this module enforces:
 *
 *   > An ML response is used only if it is a complete, in-range result.
 *   > A partial one is a failure, and a failure means the rule-based engine.
 *
 * These are deliberately *strict*. Being lenient here — filling a missing
 * `confidence` with a default, coercing a bad `averageCycleLength` to 28 —
 * would manufacture a result that neither engine actually computed. Rejecting
 * costs nothing, because the fallback is always available and always correct.
 *
 * Every parser returns a discriminated result rather than throwing:
 *
 *     { ok: true,  value }            // validated and normalised
 *     { ok: false, reason }           // a short machine-readable cause
 *
 * No imports beyond the shared risk contract, so this is usable from Route
 * Handlers, Client Components and plain Node scripts alike.
 */

import { normaliseRiskResult } from './pcod-risk-result.js'

/** Cycle lengths outside this range are rejected, matching the fallback engine. */
export const MIN_CYCLE_LENGTH = 21
export const MAX_CYCLE_LENGTH = 45

/** Machine-readable rejection causes, surfaced in logs. */
export const SCHEMA_REJECTIONS = {
  NOT_AN_OBJECT: 'not_an_object',
  MISSING_ENVELOPE: 'missing_envelope',
  BAD_DATE: 'bad_next_period_date',
  BAD_CONFIDENCE: 'bad_confidence',
  BAD_CYCLE_LENGTH: 'bad_average_cycle_length',
  BAD_RISK: 'bad_risk_result',
}

/**
 * True when `value` is a plain object we can read keys off.
 *
 * Arrays are excluded on purpose: `[]` is truthy and `[].prediction` is
 * `undefined`, which is exactly the class of value the old truthiness check let
 * through.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Normalises a confidence value onto the `"NN%"` string the UI renders.
 *
 * Accepts the two shapes an ML implementation plausibly emits — the string
 * `"85%"` and the number `85` — plus a `0..1` probability, which is the most
 * likely thing a model actually produces. Anything else is rejected rather than
 * guessed at.
 *
 * @param {unknown} raw
 * @returns {string|null} `"85%"`, or `null` when unusable
 */
export function normaliseConfidence(raw) {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    // A model returning 0..1 is a probability; anything above 1 is already a
    // percentage. 1 itself is ambiguous, and is read as 1% rather than 100%
    // because claiming perfect certainty from an ambiguous value is the more
    // damaging of the two mistakes.
    const percent = raw > 0 && raw < 1 ? raw * 100 : raw
    if (percent < 0 || percent > 100) return null
    return `${Math.round(percent)}%`
  }

  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d{1,3}(?:\.\d+)?)\s*%?$/)
  if (!match) return null

  const percent = Number(match[1])
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null

  return `${Math.round(percent)}%`
}

/**
 * Validates the human-readable next-period date.
 *
 * The fallback engine emits `"Aug 12, 2026"`, so the contract is "a string that
 * a Date can actually parse" rather than a fixed format — an ML service written
 * in Python will more naturally emit `"2026-08-12"`, and both are renderable.
 *
 * A date the browser cannot parse is exactly the payload that produced
 * `Invalid Date` in the prediction card, so it is rejected here.
 *
 * @param {unknown} raw
 * @returns {string|null} the original string, or `null`
 */
export function normalisePredictionDate(raw) {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (!trimmed) return null

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null

  return trimmed
}

/**
 * Validates a cycle length against the same range the fallback engine clamps to.
 *
 * Out-of-range is rejected rather than clamped: a service claiming a 90-day
 * average is either broken or looking at someone else's data, and silently
 * rewriting it to 45 would hide that.
 *
 * @param {unknown} raw
 * @returns {number|null}
 */
export function normaliseCycleLength(raw) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null

  const rounded = Math.round(parsed)
  if (rounded < MIN_CYCLE_LENGTH || rounded > MAX_CYCLE_LENGTH) return null

  return rounded
}

/**
 * Copies through the optional enrichment fields the fallback engine also
 * produces, dropping anything of the wrong type.
 *
 * These are optional by design: an ML service that only answers the three core
 * fields is still perfectly usable, and the UI already treats every one of these
 * as "render if present".
 *
 * @param {Record<string, unknown>} source
 * @param {Record<string, unknown>} target mutated in place
 */
function copyOptionalPredictionFields(source, target) {
  if (Number.isFinite(Number(source.missedCycles))) {
    target.missedCycles = Math.max(0, Math.round(Number(source.missedCycles)))
  }
  if (typeof source.isStale === 'boolean') {
    target.isStale = source.isStale
  }
  if (typeof source.hasEnoughRecentData === 'boolean') {
    target.hasEnoughRecentData = source.hasEnoughRecentData
  }
  if (typeof source.lastLoggedDate === 'string' && source.lastLoggedDate.trim()) {
    target.lastLoggedDate = source.lastLoggedDate.trim()
  }
  if (typeof source.isIrregular === 'boolean') {
    target.isIrregular = source.isIrregular
    target.regularityLabel = typeof source.regularityLabel === 'string' && source.regularityLabel.trim()
      ? source.regularityLabel.trim()
      : (source.isIrregular ? 'Irregular Cycle' : 'Regular Cycle')
  }
  if (Number.isFinite(Number(source.varianceStdDev))) {
    target.varianceStdDev = Math.round(Number(source.varianceStdDev) * 10) / 10
  }

  // The window is only carried through when *both* ends are renderable dates.
  // A half-populated range renders as "Aug 12, 2026 – undefined".
  const window = source.predictionWindow
  if (isPlainObject(window)) {
    const from = normalisePredictionDate(window.from)
    const to = normalisePredictionDate(window.to)
    if (from && to) target.predictionWindow = { from, to }
  }
}

/**
 * Validates a `/predict-cycle` response body.
 *
 * Accepts either the enveloped form the current code expects
 * (`{ prediction: {...} }`) or a bare prediction object, so an ML
 * implementation is not forced into one convention.
 *
 * @param {unknown} raw the parsed JSON body
 * @returns {{ok: true, value: object}|{ok: false, reason: string}}
 */
export function parseMlPrediction(raw) {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: SCHEMA_REJECTIONS.NOT_AN_OBJECT }
  }

  const candidate = isPlainObject(raw.prediction) ? raw.prediction : raw

  // Distinguish "wrong envelope" from "bad fields" so the log says which.
  if (!isPlainObject(candidate)) {
    return { ok: false, reason: SCHEMA_REJECTIONS.MISSING_ENVELOPE }
  }

  const nextPeriodDate = normalisePredictionDate(candidate.nextPeriodDate)
  if (!nextPeriodDate) {
    return { ok: false, reason: SCHEMA_REJECTIONS.BAD_DATE }
  }

  const confidence = normaliseConfidence(candidate.confidence)
  if (!confidence) {
    return { ok: false, reason: SCHEMA_REJECTIONS.BAD_CONFIDENCE }
  }

  const averageCycleLength = normaliseCycleLength(candidate.averageCycleLength)
  if (averageCycleLength === null) {
    return { ok: false, reason: SCHEMA_REJECTIONS.BAD_CYCLE_LENGTH }
  }

  const value = { nextPeriodDate, confidence, averageCycleLength }
  copyOptionalPredictionFields(candidate, value)

  return { ok: true, value }
}

/**
 * Validates a `/pcod-risk` response body.
 *
 * Delegates the actual shape rules to {@link normaliseRiskResult}, which is
 * already the single contract for a risk result everywhere else in the app —
 * so an ML-sourced assessment and a locally-computed one are guaranteed to be
 * indistinguishable downstream.
 *
 * @param {unknown} raw the parsed JSON body
 * @returns {{ok: true, value: object}|{ok: false, reason: string}}
 */
export function parseMlRisk(raw) {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: SCHEMA_REJECTIONS.NOT_AN_OBJECT }
  }

  const candidate = isPlainObject(raw.risk) ? raw.risk : raw

  const normalised = normaliseRiskResult(candidate)
  if (!normalised) {
    return { ok: false, reason: SCHEMA_REJECTIONS.BAD_RISK }
  }

  // The fallback engine always supplies a recommendation, and the risk card
  // renders it unconditionally. Fill only this one field, because unlike a
  // score or a tier it carries no clinical claim of its own.
  if (!normalised.recommendation) {
    normalised.recommendation = normalised.tier === 'HIGH RISK'
      ? 'Consider consulting with a healthcare provider for detailed assessment.'
      : 'Keep tracking your cycle and maintaining healthy habits.'
  }

  return { ok: true, value: normalised }
}

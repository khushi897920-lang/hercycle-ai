/**
 * moderation-verdict.js — the decision half of community content moderation.
 *
 * ## Why this module exists
 *
 * `lib/ai-moderation.js` used to be the whole feature: it built the request,
 * awaited it with no deadline, read `data.choices[0].message.content` without
 * checking that `choices` had anything in it, `JSON.parse`d whatever came back,
 * and expressed every possible failure as the same fail-closed object. Two
 * route handlers await it inline before writing to the database, so any of
 * those steps taking its time is a forum post that never completes.
 *
 * Separating the *decision* from the *network* buys three things:
 *
 * 1. It is testable. Every branch below is reachable from
 *    `scripts/test-moderation-verdict.js` without a provider, a key, or a
 *    socket.
 * 2. Failures stop being interchangeable. "The provider timed out" and "the
 *    provider says this is abuse" both block the post, but only one of them is
 *    the user's fault, and only one of them is worth retrying. The old code
 *    told the user the same thing either way.
 * 3. The policy — how long, how much text, what counts as an answer — is
 *    written down in one place instead of being implied by the order of a
 *    try/catch.
 *
 * ## The contract
 *
 * Everything here is pure. No imports, no `fetch`, no clock reads except the
 * ones passed in. It is safe in Route Handlers, Server Components and plain
 * Node scripts alike.
 *
 * The one invariant that must not be weakened:
 *
 *   > When moderation cannot produce a real answer, the content is rejected.
 *
 * Failing open on an unreachable provider would turn an outage into an
 * unmoderated forum, which for a PCOD and menstrual-health community is the
 * worse of the two failures by a wide margin.
 */

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

/**
 * Hard ceiling on the text handed to a provider.
 *
 * Neither forum route validated length. `app/api/forum/posts/route.js` checked
 * only that `title` and `content` were truthy, so a multi-megabyte body was
 * forwarded verbatim — to Gemini, and then again to Groq on fallback. That is
 * a slow, expensive request per attempt, reachable by anyone with an account
 * at the ordinary `crudLimiter` rate.
 *
 * 8 000 characters is far above any genuine forum post (the longest posts in
 * the seed data are under 1 200) and far below the point where the request
 * cost matters.
 */
export const MAX_MODERATION_CHARS = 8000

/** Per-provider deadline. Matches the 8 s used by `app/api/chat/route.js`. */
export const PROVIDER_TIMEOUT_MS = 8000

/**
 * Ceiling on the whole moderation attempt, primary plus fallback.
 *
 * Two providers at 8 s each is 16 s of wall clock in the worst case, and the
 * user is watching a spinner for all of it. The budget is what stops the
 * fallback from starting when there is no time left to finish it.
 */
export const TOTAL_BUDGET_MS = 12000

/**
 * Minimum time that must remain before a fallback is worth attempting. Below
 * this the fallback would be cut off mid-flight, so it is skipped and the
 * failure is reported immediately rather than 500 ms later.
 */
export const MIN_FALLBACK_MS = 1500

// ---------------------------------------------------------------------------
// Outcome vocabulary
// ---------------------------------------------------------------------------

/**
 * Why a moderation attempt ended the way it did.
 *
 * These are deliberately distinct rather than collapsed into a boolean,
 * because they call for different handling:
 *
 * - `APPROVED` / `REJECTED`   a provider answered. The verdict is real.
 * - `TIMED_OUT`               nobody answered in time. Worth retrying.
 * - `UNAVAILABLE`             the providers errored or are unconfigured.
 * - `TOO_LONG`                the submission is over `MAX_MODERATION_CHARS`.
 *                             Never sent anywhere; a 400, not a 403.
 * - `EMPTY`                   nothing to moderate after trimming.
 */
export const OUTCOMES = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected',
  TIMED_OUT: 'timed_out',
  UNAVAILABLE: 'unavailable',
  TOO_LONG: 'too_long',
  EMPTY: 'empty',
})

/**
 * The HTTP status each outcome should produce.
 *
 * The old code answered every failure with the 403 that means "your post
 * violates our community guidelines". A user whose perfectly ordinary post was
 * blocked by a provider outage was told she had broken the rules.
 */
const OUTCOME_STATUS = Object.freeze({
  [OUTCOMES.APPROVED]: 200,
  [OUTCOMES.REJECTED]: 403,
  [OUTCOMES.TIMED_OUT]: 503,
  [OUTCOMES.UNAVAILABLE]: 503,
  [OUTCOMES.TOO_LONG]: 400,
  [OUTCOMES.EMPTY]: 400,
})

/** Whether trying again in a moment could plausibly succeed. */
const OUTCOME_RETRYABLE = Object.freeze({
  [OUTCOMES.APPROVED]: false,
  [OUTCOMES.REJECTED]: false,
  [OUTCOMES.TIMED_OUT]: true,
  [OUTCOMES.UNAVAILABLE]: true,
  [OUTCOMES.TOO_LONG]: false,
  [OUTCOMES.EMPTY]: false,
})

const DEFAULT_MESSAGES = Object.freeze({
  [OUTCOMES.REJECTED]: 'This post does not meet our community guidelines.',
  [OUTCOMES.TIMED_OUT]:
    'We could not check this post in time. Nothing was lost — please try posting again.',
  [OUTCOMES.UNAVAILABLE]:
    'Post checking is temporarily unavailable. Please try again in a few minutes.',
  [OUTCOMES.TOO_LONG]: `Please keep your post under ${MAX_MODERATION_CHARS.toLocaleString('en-US')} characters.`,
  [OUTCOMES.EMPTY]: 'There is nothing here to post.',
})

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Verdict
 * @property {boolean} isAppropriate  the field the existing call sites read
 * @property {string}  outcome        one of {@link OUTCOMES}
 * @property {string}  reason         user-facing text; never a provider error
 * @property {number}  status         the HTTP status the route should send
 * @property {boolean} retryable      whether trying again could help
 * @property {string|null} provider   which provider answered, if any
 * @property {string|null} detail     operator-facing text, for the log only
 */

/**
 * Builds a verdict. The only constructor — nothing else in the codebase should
 * be assembling this shape by hand.
 *
 * `reason` is what the user sees, so it never carries `detail`, which is where
 * provider error strings, status codes and stack messages go. Echoing those
 * back is how a moderation endpoint turns into a probe for which AI vendor you
 * use and whether your key is valid.
 *
 * @param {string} outcome
 * @param {{ reason?: string, provider?: string|null, detail?: string|null }} [options]
 * @returns {Verdict}
 */
export function makeVerdict(outcome, options = {}) {
  const known = Object.values(OUTCOMES).includes(outcome) ? outcome : OUTCOMES.UNAVAILABLE

  return {
    isAppropriate: known === OUTCOMES.APPROVED,
    outcome: known,
    reason:
      typeof options.reason === 'string' && options.reason.trim().length > 0
        ? options.reason.trim()
        : DEFAULT_MESSAGES[known] || '',
    status: OUTCOME_STATUS[known],
    retryable: OUTCOME_RETRYABLE[known],
    provider: options.provider || null,
    detail: options.detail || null,
  }
}

// ---------------------------------------------------------------------------
// Input policy
// ---------------------------------------------------------------------------

/**
 * Checks a submission before any provider is contacted.
 *
 * Returns `null` when the content is fine to send — the caller should read that
 * as "carry on", not as an error. A non-null return is a finished verdict and
 * no network call should happen.
 *
 * @param {unknown} content
 * @param {number}  [maxChars=MAX_MODERATION_CHARS]
 * @returns {Verdict|null}
 */
export function checkContentLength(content, maxChars = MAX_MODERATION_CHARS) {
  if (typeof content !== 'string') {
    return makeVerdict(OUTCOMES.EMPTY, { detail: `content was ${typeof content}` })
  }

  const trimmed = content.trim()
  if (trimmed.length === 0) {
    return makeVerdict(OUTCOMES.EMPTY, { detail: 'content was blank after trimming' })
  }

  // Measured on the untrimmed string: whitespace still costs tokens, and a
  // submission padded to 2 MB with newlines is exactly the request this cap
  // exists to refuse.
  if (content.length > maxChars) {
    return makeVerdict(OUTCOMES.TOO_LONG, {
      detail: `content was ${content.length} characters, limit is ${maxChars}`,
    })
  }

  return null
}

// ---------------------------------------------------------------------------
// Reading what a provider actually sent back
// ---------------------------------------------------------------------------

/**
 * Pulls the assistant text out of an OpenAI-shaped completion response.
 *
 * The previous implementation was:
 *
 *     const responseText = data.choices[0].message.content;
 *
 * Groq answers a filtered request with `{"choices": []}`, and some failure
 * modes return `{"error": {...}}` with HTTP 200. `data.choices[0]` is then
 * `undefined` and reading `.message` throws a `TypeError` — which the outer
 * handler caught and reported to the user as a guidelines violation, while the
 * real cause never reached the log in a recognisable form.
 *
 * Returns `null` rather than throwing. A provider that did not answer is a
 * fact to be handled, not an exception.
 *
 * @param {unknown} payload the parsed JSON body
 * @returns {string|null}
 */
export function extractCompletionText(payload) {
  if (!payload || typeof payload !== 'object') return null

  const choices = payload.choices
  if (!Array.isArray(choices) || choices.length === 0) return null

  const first = choices[0]
  if (!first || typeof first !== 'object') return null

  const message = first.message
  if (!message || typeof message !== 'object') return null

  const content = message.content
  if (typeof content !== 'string' || content.trim().length === 0) return null

  return content
}

/**
 * Recovers a JSON object from model output.
 *
 * Both providers are asked for raw JSON and mostly comply. When they do not,
 * it is one of a small number of well-known shapes:
 *
 *   ```json\n{"isAppropriate": true}\n```      fenced
 *   Here is the analysis: {"isAppropriate": true}   prefixed with prose
 *   {"isAppropriate": true}\n\nLet me know…         followed by prose
 *
 * The old code stripped the fences and called `JSON.parse` on the rest, which
 * threw on the other two. On the Gemini path that throw was indistinguishable
 * from a network error, so it burned the Groq fallback on a problem a retry
 * could never fix.
 *
 * Strategy: strip fences, try a direct parse, and only if that fails fall back
 * to the outermost balanced `{...}` span. Returns `null` when there is nothing
 * parseable — never throws.
 *
 * @param {unknown} text
 * @returns {object|null}
 */
export function extractJsonObject(text) {
  if (typeof text !== 'string') return null

  const withoutFences = text
    .replace(/```(?:json|JSON)?/g, '')
    .replace(/```/g, '')
    .trim()

  if (withoutFences.length === 0) return null

  const direct = tryParseObject(withoutFences)
  if (direct) return direct

  const span = findBalancedObject(withoutFences)
  return span ? tryParseObject(span) : null
}

/**
 * Returns the first brace-balanced `{...}` span in `text`, or `null`.
 *
 * Depth counting rather than `indexOf('{')` … `lastIndexOf('}')`: the naive
 * span breaks on a trailing sentence that happens to contain a closing brace,
 * which models produce often enough ("…note the } character"). Braces inside
 * string literals are skipped, with `\` honoured as an escape, so a reason
 * field containing a brace cannot unbalance the scan either.
 *
 * @param {string} text
 * @returns {string|null}
 */
function findBalancedObject(text) {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i += 1) {
    const char = text[i]

    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      // Only meaningful inside a string, but harmless outside one: JSON has no
      // other use for a backslash.
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
}

function tryParseObject(candidate) {
  try {
    const parsed = JSON.parse(candidate)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Turns raw provider text into a verdict.
 *
 * A provider that returns something unreadable has *not* voted. It is
 * `UNAVAILABLE`, so the caller may still try the fallback — as opposed to
 * `REJECTED`, which is a real answer and ends the attempt.
 *
 * `isAppropriate` must be a genuine boolean. The old check was
 * `typeof parsed.isAppropriate !== 'boolean'`, which was right, but it threw
 * rather than returning, so the distinction was lost by the time anything
 * could act on it. A model that answers `"true"` as a string has not followed
 * the schema, and guessing what it meant is how a moderation bypass gets in.
 *
 * @param {string|null} rawText
 * @param {string} provider
 * @returns {Verdict}
 */
export function interpretProviderText(rawText, provider) {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    return makeVerdict(OUTCOMES.UNAVAILABLE, {
      provider,
      detail: `${provider} returned no text`,
    })
  }

  const parsed = extractJsonObject(rawText)
  if (!parsed) {
    return makeVerdict(OUTCOMES.UNAVAILABLE, {
      provider,
      detail: `${provider} returned text that is not JSON`,
    })
  }

  if (typeof parsed.isAppropriate !== 'boolean') {
    return makeVerdict(OUTCOMES.UNAVAILABLE, {
      provider,
      detail: `${provider} returned isAppropriate as ${typeof parsed.isAppropriate}`,
    })
  }

  if (parsed.isAppropriate) {
    return makeVerdict(OUTCOMES.APPROVED, { provider })
  }

  // The model's own words are shown to the user, because "this reads as
  // harassment" is more useful than a generic refusal — but only when it is a
  // short, plain string. A model that returns a paragraph, an object, or an
  // echo of the submission gets replaced with the default text.
  const modelReason =
    typeof parsed.reason === 'string' && parsed.reason.trim().length > 0 && parsed.reason.length <= 300
      ? parsed.reason.trim()
      : null

  return makeVerdict(OUTCOMES.REJECTED, { provider, reason: modelReason })
}

// ---------------------------------------------------------------------------
// Combining attempts
// ---------------------------------------------------------------------------

/**
 * Classifies a thrown error into an outcome.
 *
 * An `AbortError` is what an `AbortController` deadline produces, so it is the
 * signal for `TIMED_OUT`. Everything else — a DNS failure, a 401 from a bad
 * key, a 429, a socket reset — is `UNAVAILABLE`.
 *
 * @param {unknown} error
 * @param {string}  provider
 * @returns {Verdict}
 */
export function classifyProviderError(error, provider) {
  const name = error?.name
  const message = error?.message || String(error || 'unknown error')

  const timedOut = name === 'AbortError' || name === 'TimeoutError' || /timed? ?out/i.test(message)

  return makeVerdict(timedOut ? OUTCOMES.TIMED_OUT : OUTCOMES.UNAVAILABLE, {
    provider,
    detail: `${provider}: ${message}`,
  })
}

/**
 * Decides whether the fallback provider is worth attempting.
 *
 * Two independent reasons not to:
 *
 * - The primary produced a *real* answer. Approved or rejected are both
 *   verdicts; asking a second model to overturn the first is not a fallback,
 *   it is a second opinion nobody asked for.
 * - There is not enough of the budget left. Starting an 8 s call with 400 ms
 *   remaining just moves the same failure later.
 *
 * @param {Verdict} primary
 * @param {number}  remainingMs
 * @param {number}  [minMs=MIN_FALLBACK_MS]
 * @returns {boolean}
 */
export function shouldTryFallback(primary, remainingMs, minMs = MIN_FALLBACK_MS) {
  if (!primary) return false
  if (primary.outcome === OUTCOMES.APPROVED || primary.outcome === OUTCOMES.REJECTED) return false
  if (!Number.isFinite(remainingMs) || remainingMs < minMs) return false
  return true
}

/**
 * Merges a primary and a fallback attempt into the verdict the route acts on.
 *
 * A real answer from either provider wins. When neither answered, the failures
 * are combined, and `TIMED_OUT` is preferred over `UNAVAILABLE` because it is
 * the more actionable of the two: it tells the user their post is fine and
 * they should try again, rather than that something is broken.
 *
 * Both `detail` strings are kept so the log shows what each provider did,
 * which was the thing the old nested try/catch made impossible to see.
 *
 * @param {Verdict} primary
 * @param {Verdict|null} fallback
 * @returns {Verdict}
 */
export function combineAttempts(primary, fallback) {
  if (!fallback) return primary

  if (fallback.outcome === OUTCOMES.APPROVED || fallback.outcome === OUTCOMES.REJECTED) {
    return fallback
  }

  const detail = [primary?.detail, fallback.detail].filter(Boolean).join(' | ') || null
  const timedOut =
    primary?.outcome === OUTCOMES.TIMED_OUT || fallback.outcome === OUTCOMES.TIMED_OUT

  return makeVerdict(timedOut ? OUTCOMES.TIMED_OUT : OUTCOMES.UNAVAILABLE, {
    provider: null,
    detail,
  })
}

/**
 * How long is left of the budget.
 *
 * Takes the clock as an argument so the budget arithmetic is testable without
 * waiting for real time to pass.
 *
 * @param {number} startedAt  the value of `now()` when the attempt began
 * @param {number} budgetMs
 * @param {() => number} [now=Date.now]
 * @returns {number} never negative
 */
export function remainingBudget(startedAt, budgetMs, now = Date.now) {
  const elapsed = now() - startedAt
  const left = budgetMs - elapsed
  return left > 0 ? left : 0
}

/**
 * The deadline for a single provider call: whatever is smaller, the per-call
 * timeout or what is left of the overall budget.
 *
 * @param {number} remainingMs
 * @param {number} [perCallMs=PROVIDER_TIMEOUT_MS]
 * @returns {number}
 */
export function providerDeadline(remainingMs, perCallMs = PROVIDER_TIMEOUT_MS) {
  const bounded = Number.isFinite(remainingMs) && remainingMs > 0 ? remainingMs : 0
  return Math.min(perCallMs, bounded)
}

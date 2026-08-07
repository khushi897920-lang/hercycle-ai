/**
 * ai-moderation.js — the network half of community content moderation.
 *
 * Every forum post and every comment passes through `moderateContent()` before
 * it reaches the database, so this function sits directly in front of a write
 * the user is watching a spinner for. It previously had no deadline of any
 * kind: neither the Gemini call nor the Groq `fetch` carried an
 * `AbortController`, and the Groq call was reached from the Gemini `catch`, so
 * a slow provider meant two unbounded network calls in series.
 *
 * The decision logic — what counts as an answer, how a malformed response is
 * read, which failure beats which — lives in `lib/moderation-verdict.js` and
 * is unit-tested there. This file is only responsible for making the calls and
 * making sure they end.
 *
 * The fail-closed rule is unchanged and deliberate: when moderation cannot
 * produce a real answer the content is rejected. What has changed is that the
 * user is now told *which* thing happened, because "we could not check this,
 * please try again" and "this breaks the rules" are not the same message to
 * receive about a post describing your own diagnosis.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from './logger.js'
import {
  MIN_FALLBACK_MS,
  OUTCOMES,
  PROVIDER_TIMEOUT_MS,
  TOTAL_BUDGET_MS,
  checkContentLength,
  classifyProviderError,
  combineAttempts,
  extractCompletionText,
  interpretProviderText,
  makeVerdict,
  providerDeadline,
  remainingBudget,
  shouldTryFallback,
} from './moderation-verdict.js'

export { MAX_MODERATION_CHARS, OUTCOMES } from './moderation-verdict.js'

const MODERATION_INSTRUCTION =
  "You are a strict community moderator for a women's health app focusing on PCOD and menstrual health. " +
  'Analyze text for toxicity, harassment, hate speech, bullying, extreme profanity, or spam. ' +
  "Return ONLY a raw JSON object with { isAppropriate: boolean, reason: '...' } with no markdown formatting."

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.1-8b-instant'
const GEMINI_MODEL = 'gemini-2.5-flash'

/**
 * Runs `work` with a deadline, and makes sure the underlying request is
 * actually cancelled rather than merely abandoned.
 *
 * The distinction matters on a serverless platform: an abandoned promise keeps
 * the invocation billable and holds the socket open. `AbortController` is what
 * releases both.
 *
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} work
 * @param {number} ms
 * @returns {Promise<T>}
 */
async function withDeadline(work, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await work(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Gemini moderation call.
 *
 * The signal is threaded through `sendMessage`'s request options, which is the
 * documented way to cancel a `@google/generative-ai` call.
 *
 * The client is constructed here rather than at module scope. The old
 * module-level `new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')` was
 * evaluated at import time, so a key supplied later in the process lifetime —
 * or in a test — was never picked up, and an empty key produced a client that
 * looked valid and failed on first use.
 *
 * @param {string} content
 * @param {AbortSignal} signal
 * @returns {Promise<string|null>} raw model text
 */
async function callGemini(content, signal) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: MODERATION_INSTRUCTION }] },
      { role: 'model', parts: [{ text: 'Understood. I am ready to analyze content.' }] },
    ],
  })

  const result = await chat.sendMessage(`Analyze the following content:\n---\n${content}\n---`, {
    signal,
  })

  // `result.response.text()` throws when the candidate was blocked by the
  // provider's own safety filter rather than answered. That is a provider
  // outcome, not a crash, so it becomes "no text" and is classified upstream
  // like any other unusable response.
  try {
    return result?.response?.text?.() ?? null
  } catch {
    return null
  }
}

/**
 * Groq moderation call.
 *
 * @param {string} content
 * @param {AbortSignal} signal
 * @returns {Promise<string|null>} raw model text
 */
async function callGroq(content, signal) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set')
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: MODERATION_INSTRUCTION },
        { role: 'user', content: `Analyze the following content:\n---\n${content}\n---` },
      ],
      max_tokens: 150,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Groq API returned status ${response.status}`)
  }

  // A 200 carrying a body that is not JSON is a gateway error page, not an
  // answer.
  let payload
  try {
    payload = await response.json()
  } catch {
    return null
  }

  // `extractCompletionText` is the defensive read that replaces
  // `data.choices[0].message.content`, which threw a TypeError on the empty
  // `choices` array Groq returns for a filtered request.
  return extractCompletionText(payload)
}

/**
 * Attempts one provider and converts whatever happens into a verdict.
 *
 * Nothing thrown by a provider escapes this function. That is the property
 * that lets the caller be a straight-line sequence instead of nested
 * try/catches, and it is why a JSON parse failure can no longer be mistaken
 * for a network failure.
 *
 * @param {(content: string, signal: AbortSignal) => Promise<string|null>} call
 * @param {string} provider
 * @param {string} content
 * @param {number} timeoutMs
 * @returns {Promise<import('./moderation-verdict').Verdict>}
 */
async function attemptProvider(call, provider, content, timeoutMs) {
  if (timeoutMs <= 0) {
    return makeVerdict(OUTCOMES.TIMED_OUT, {
      provider,
      detail: `${provider}: no time left in the moderation budget`,
    })
  }

  try {
    const text = await withDeadline((signal) => call(content, signal), timeoutMs)
    return interpretProviderText(text, provider)
  } catch (error) {
    return classifyProviderError(error, provider)
  }
}

/**
 * Evaluates text for toxicity, harassment and appropriateness.
 *
 * Gemini is asked first; Groq is the fallback, but only when Gemini failed to
 * produce an answer *and* enough of the budget remains to finish a second
 * call. A rejection from Gemini is a real answer and ends the attempt — the
 * old code's `catch`-driven fallback could not tell the two apart, so a model
 * that said "this is harassment" in prose rather than JSON was quietly asked
 * again by a different model.
 *
 * The returned object keeps `isAppropriate` and `reason`, so both existing
 * call sites work unchanged, and adds `outcome`, `status` and `retryable` for
 * routes that want to distinguish a refusal from an outage.
 *
 * @param {string} content
 * @param {{ now?: () => number, budgetMs?: number, perCallMs?: number }} [options]
 *   injection seams for tests; production passes nothing
 * @returns {Promise<import('./moderation-verdict').Verdict>}
 */
export async function moderateContent(content, options = {}) {
  const now = options.now || Date.now
  const budgetMs = options.budgetMs ?? TOTAL_BUDGET_MS
  const perCallMs = options.perCallMs ?? PROVIDER_TIMEOUT_MS

  const refusedBeforeDispatch = checkContentLength(content)
  if (refusedBeforeDispatch) {
    logger.warn(`Moderation refused before dispatch: ${refusedBeforeDispatch.detail}`)
    return refusedBeforeDispatch
  }

  const hasGemini = Boolean(process.env.GEMINI_API_KEY)
  const hasGroq = Boolean(process.env.GROQ_API_KEY)

  // Unconfigured is still fail-closed, but it is an operator problem and it is
  // logged as one. The previous code threw here, which reached the route's
  // generic 500 handler and told the user nothing useful.
  if (!hasGemini && !hasGroq) {
    logger.error('Moderation is unconfigured: neither GEMINI_API_KEY nor GROQ_API_KEY is set')
    return makeVerdict(OUTCOMES.UNAVAILABLE, { detail: 'no moderation provider configured' })
  }

  const startedAt = now()

  let primary
  if (hasGemini) {
    const deadline = providerDeadline(remainingBudget(startedAt, budgetMs, now), perCallMs)
    primary = await attemptProvider(callGemini, 'gemini', content, deadline)
  } else {
    primary = makeVerdict(OUTCOMES.UNAVAILABLE, {
      provider: 'gemini',
      detail: 'gemini: GEMINI_API_KEY is not set',
    })
  }

  let fallback = null
  const left = remainingBudget(startedAt, budgetMs, now)

  if (hasGroq && shouldTryFallback(primary, left, MIN_FALLBACK_MS)) {
    logger.warn(`Moderation falling back to Groq (${primary.detail || primary.outcome})`)
    fallback = await attemptProvider(callGroq, 'groq', content, providerDeadline(left, perCallMs))
  }

  const verdict = combineAttempts(primary, fallback)

  if (verdict.outcome === OUTCOMES.TIMED_OUT || verdict.outcome === OUTCOMES.UNAVAILABLE) {
    // `detail` and not `reason`: the operator gets the provider strings, the
    // user gets the plain-language message.
    logger.error(`Moderation could not reach a verdict — ${verdict.detail || 'no detail'}`)
  }

  return verdict
}

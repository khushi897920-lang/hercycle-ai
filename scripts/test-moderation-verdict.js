/**
 * Regression suite for lib/moderation-verdict.js and lib/forum-limits.js.
 *
 * The bug this is part of fixing: `moderateContent()` had no deadline on
 * either provider, read `data.choices[0].message.content` without checking
 * that `choices` had anything in it, `JSON.parse`d arbitrary model output, and
 * expressed a network timeout and a genuine "this is harassment" as the same
 * fail-closed object — which both forum write routes then reported to the user
 * as a 403 "your post violates our community guidelines".
 *
 * What this suite pins is the part that is easy to get subtly wrong and
 * impossible to check by hand: that an unreadable provider response is treated
 * as "did not answer" rather than as a verdict, that a real verdict from the
 * primary provider is never second-guessed by the fallback, that the budget
 * arithmetic cannot start a call it has no time to finish, and — the invariant
 * that matters most — that no path anywhere returns `isAppropriate: true`
 * without a provider having genuinely said so.
 *
 *   node scripts/test-moderation-verdict.js
 */

import {
  MAX_MODERATION_CHARS,
  MIN_FALLBACK_MS,
  OUTCOMES,
  PROVIDER_TIMEOUT_MS,
  checkContentLength,
  classifyProviderError,
  combineAttempts,
  extractCompletionText,
  extractJsonObject,
  interpretProviderText,
  makeVerdict,
  providerDeadline,
  remainingBudget,
  shouldTryFallback,
} from '../lib/moderation-verdict.js'

import {
  FORUM_LIMITS,
  validateCommentLength,
  validateSubmissionLength,
} from '../lib/forum-limits.js'

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

function checkTruthy(value, label) {
  check(Boolean(value), true, label)
}

function section(title) {
  console.log(`\n${title}`)
}

// ---------------------------------------------------------------------------

section('extractCompletionText — the read that used to throw')

check(
  extractCompletionText({ choices: [{ message: { content: '{"isAppropriate":true}' } }] }),
  '{"isAppropriate":true}',
  'reads content out of a well-formed completion'
)

// This is the exact payload Groq returns for a filtered request. The old
// `data.choices[0].message.content` raised "Cannot read properties of
// undefined (reading 'message')", which the outer catch turned into a
// guidelines violation shown to the user.
check(extractCompletionText({ choices: [] }), null, 'empty choices array is null, not a throw')
check(extractCompletionText({ error: { message: 'invalid_api_key' } }), null, '{error} body with HTTP 200 is null')
check(extractCompletionText({}), null, 'missing choices is null')
check(extractCompletionText(null), null, 'null payload is null')
check(extractCompletionText(undefined), null, 'undefined payload is null')
check(extractCompletionText('a string'), null, 'non-object payload is null')
check(extractCompletionText({ choices: [null] }), null, 'null first choice is null')
check(extractCompletionText({ choices: [{}] }), null, 'choice without message is null')
check(extractCompletionText({ choices: [{ message: {} }] }), null, 'message without content is null')
check(
  extractCompletionText({ choices: [{ message: { content: '   ' } }] }),
  null,
  'whitespace-only content is null'
)
check(
  extractCompletionText({ choices: [{ message: { content: 42 } }] }),
  null,
  'non-string content is null'
)

// ---------------------------------------------------------------------------

section('extractJsonObject — recovering JSON from model prose')

checkDeep(
  extractJsonObject('{"isAppropriate": true}'),
  { isAppropriate: true },
  'bare JSON parses'
)
checkDeep(
  extractJsonObject('```json\n{"isAppropriate": false, "reason": "spam"}\n```'),
  { isAppropriate: false, reason: 'spam' },
  'fenced JSON parses (the only case the old code handled)'
)
checkDeep(
  extractJsonObject('Here is the analysis: {"isAppropriate": true}'),
  { isAppropriate: true },
  'JSON preceded by prose parses — the old code threw here'
)
checkDeep(
  extractJsonObject('{"isAppropriate": true}\n\nLet me know if you need more detail.'),
  { isAppropriate: true },
  'JSON followed by prose parses'
)
checkDeep(
  extractJsonObject('{"isAppropriate": false, "meta": {"model": "x"}}'),
  { isAppropriate: false, meta: { model: 'x' } },
  'nested objects survive the balanced-brace fallback'
)
check(extractJsonObject('no json at all'), null, 'prose with no object is null')
check(extractJsonObject('{ this is not json }'), null, 'brace-delimited non-JSON is null')
check(extractJsonObject('[1, 2, 3]'), null, 'a top-level array is not an object')
check(extractJsonObject(''), null, 'empty string is null')
check(extractJsonObject('```json\n```'), null, 'empty fences are null')
check(extractJsonObject(null), null, 'null is null')
check(extractJsonObject(42), null, 'a number is null')

// A trailing brace inside a sentence must not truncate the object. This is
// why the fallback counts depth instead of taking indexOf('{')..lastIndexOf('}').
checkDeep(
  extractJsonObject('{"isAppropriate": true, "reason": "fine"} — note the } character'),
  { isAppropriate: true, reason: 'fine' },
  'a stray closing brace in trailing prose does not break extraction'
)
checkDeep(
  extractJsonObject('Result: {"isAppropriate": false, "reason": "used {curly} braces"} done'),
  { isAppropriate: false, reason: 'used {curly} braces' },
  'braces inside a string value do not unbalance the scan'
)
checkDeep(
  extractJsonObject('Result: {"isAppropriate": false, "reason": "a \\" quote"} done'),
  { isAppropriate: false, reason: 'a " quote' },
  'an escaped quote does not end the string early'
)
check(
  extractJsonObject('prose { unterminated'),
  null,
  'an unbalanced opening brace is null rather than a partial parse'
)

// ---------------------------------------------------------------------------

section('interpretProviderText — turning text into a verdict')

const approved = interpretProviderText('{"isAppropriate": true}', 'gemini')
check(approved.outcome, OUTCOMES.APPROVED, 'true maps to APPROVED')
check(approved.isAppropriate, true, 'APPROVED sets isAppropriate')
check(approved.status, 200, 'APPROVED is a 200')
check(approved.provider, 'gemini', 'the answering provider is recorded')

const rejected = interpretProviderText('{"isAppropriate": false, "reason": "Targeted harassment"}', 'groq')
check(rejected.outcome, OUTCOMES.REJECTED, 'false maps to REJECTED')
check(rejected.isAppropriate, false, 'REJECTED clears isAppropriate')
check(rejected.status, 403, 'REJECTED is a 403')
check(rejected.retryable, false, 'a refusal is not retryable')
check(rejected.reason, 'Targeted harassment', "the model's own short reason is shown to the user")

// A model that returns an essay, or the submission back, is not a message to
// put in front of the user.
const longReason = interpretProviderText(
  JSON.stringify({ isAppropriate: false, reason: 'x'.repeat(400) }),
  'groq'
)
check(longReason.outcome, OUTCOMES.REJECTED, 'an over-long reason is still a rejection')
checkTruthy(longReason.reason.length < 300, 'an over-long reason is replaced with the default text')

const objectReason = interpretProviderText(
  JSON.stringify({ isAppropriate: false, reason: { code: 'spam' } }),
  'groq'
)
check(objectReason.outcome, OUTCOMES.REJECTED, 'a non-string reason is still a rejection')
checkTruthy(objectReason.reason.length > 0, 'a non-string reason falls back to default text')

// The critical one. A model that answers "true" as a string has not followed
// the schema, and guessing that it meant boolean true is a moderation bypass.
const stringBoolean = interpretProviderText('{"isAppropriate": "true"}', 'gemini')
check(stringBoolean.outcome, OUTCOMES.UNAVAILABLE, 'a stringified boolean is not an answer')
check(stringBoolean.isAppropriate, false, 'a stringified boolean does not approve content')

check(interpretProviderText('{"verdict": "ok"}', 'gemini').outcome, OUTCOMES.UNAVAILABLE, 'a missing isAppropriate is not an answer')
check(interpretProviderText('I cannot help with that.', 'gemini').outcome, OUTCOMES.UNAVAILABLE, 'prose with no JSON is not an answer')
check(interpretProviderText('', 'gemini').outcome, OUTCOMES.UNAVAILABLE, 'empty text is not an answer')
check(interpretProviderText(null, 'gemini').outcome, OUTCOMES.UNAVAILABLE, 'null text is not an answer')

// ---------------------------------------------------------------------------

section('checkContentLength — refusing before dispatch')

check(checkContentLength('a normal post'), null, 'ordinary content is cleared to send')
check(checkContentLength('x'.repeat(MAX_MODERATION_CHARS)), null, 'content exactly at the cap is allowed')

const tooLong = checkContentLength('x'.repeat(MAX_MODERATION_CHARS + 1))
check(tooLong.outcome, OUTCOMES.TOO_LONG, 'one character over the cap is refused')
check(tooLong.status, 400, 'too long is a 400, not a 403 — it is not a guidelines matter')
check(tooLong.retryable, false, 'resubmitting the same over-long text will not help')

// Whitespace padding still costs tokens, so the cap is measured untrimmed.
check(
  checkContentLength(`hello${' '.repeat(MAX_MODERATION_CHARS)}`).outcome,
  OUTCOMES.TOO_LONG,
  'whitespace padding counts toward the cap'
)

check(checkContentLength('').outcome, OUTCOMES.EMPTY, 'empty string is EMPTY')
check(checkContentLength('   \n\t ').outcome, OUTCOMES.EMPTY, 'whitespace-only is EMPTY')
check(checkContentLength(null).outcome, OUTCOMES.EMPTY, 'null is EMPTY')
check(checkContentLength(undefined).outcome, OUTCOMES.EMPTY, 'undefined is EMPTY')
check(checkContentLength(12345).outcome, OUTCOMES.EMPTY, 'a number is EMPTY')
check(checkContentLength('x'.repeat(50), 20).outcome, OUTCOMES.TOO_LONG, 'the cap is overridable')

// ---------------------------------------------------------------------------

section('classifyProviderError — a timeout is not an outage')

check(
  classifyProviderError(Object.assign(new Error('aborted'), { name: 'AbortError' }), 'gemini').outcome,
  OUTCOMES.TIMED_OUT,
  'AbortError — what the deadline produces — is TIMED_OUT'
)
check(
  classifyProviderError(Object.assign(new Error('nope'), { name: 'TimeoutError' }), 'groq').outcome,
  OUTCOMES.TIMED_OUT,
  'TimeoutError is TIMED_OUT'
)
check(
  classifyProviderError(new Error('Request timed out after 8 seconds'), 'groq').outcome,
  OUTCOMES.TIMED_OUT,
  'a timeout described only in the message is still TIMED_OUT'
)
check(
  classifyProviderError(new Error('Groq API returned status 401'), 'groq').outcome,
  OUTCOMES.UNAVAILABLE,
  'a bad key is UNAVAILABLE, not a timeout'
)
check(
  classifyProviderError(new Error('getaddrinfo ENOTFOUND'), 'gemini').outcome,
  OUTCOMES.UNAVAILABLE,
  'a DNS failure is UNAVAILABLE'
)
check(classifyProviderError(undefined, 'gemini').outcome, OUTCOMES.UNAVAILABLE, 'a thrown undefined is UNAVAILABLE')

const timedOut = classifyProviderError(
  Object.assign(new Error('aborted'), { name: 'AbortError' }),
  'gemini'
)
check(timedOut.status, 503, 'a timeout is a 503')
check(timedOut.retryable, true, 'a timeout is worth retrying')
check(timedOut.isAppropriate, false, 'a timeout still blocks the post — fail closed')
checkTruthy(timedOut.detail.includes('gemini'), 'the operator detail names the provider')
checkTruthy(!timedOut.reason.includes('gemini'), 'the user-facing reason does not leak the provider name')

// ---------------------------------------------------------------------------

section('shouldTryFallback — when a second provider is worth asking')

const unavailable = makeVerdict(OUTCOMES.UNAVAILABLE, { provider: 'gemini' })

check(shouldTryFallback(unavailable, 9000), true, 'an unanswered primary with time left falls back')
check(
  shouldTryFallback(makeVerdict(OUTCOMES.TIMED_OUT, {}), 9000),
  true,
  'a timed-out primary with time left falls back'
)
check(
  shouldTryFallback(makeVerdict(OUTCOMES.APPROVED, {}), 9000),
  false,
  'an approval is a real answer — no second opinion'
)
check(
  shouldTryFallback(makeVerdict(OUTCOMES.REJECTED, {}), 9000),
  false,
  'a rejection is a real answer — the fallback must not overturn it'
)
check(shouldTryFallback(unavailable, MIN_FALLBACK_MS - 1), false, 'below the minimum, do not start a call')
check(shouldTryFallback(unavailable, MIN_FALLBACK_MS), true, 'exactly at the minimum, go ahead')
check(shouldTryFallback(unavailable, 0), false, 'no budget left means no fallback')
check(shouldTryFallback(unavailable, NaN), false, 'a non-finite budget means no fallback')
check(shouldTryFallback(null, 9000), false, 'no primary verdict means no fallback')

// ---------------------------------------------------------------------------

section('combineAttempts — merging two failures')

check(
  combineAttempts(makeVerdict(OUTCOMES.UNAVAILABLE, {}), makeVerdict(OUTCOMES.APPROVED, { provider: 'groq' })).outcome,
  OUTCOMES.APPROVED,
  'the fallback answering wins'
)
check(
  combineAttempts(makeVerdict(OUTCOMES.TIMED_OUT, {}), makeVerdict(OUTCOMES.REJECTED, { provider: 'groq' })).outcome,
  OUTCOMES.REJECTED,
  'a fallback rejection wins'
)
check(
  combineAttempts(makeVerdict(OUTCOMES.APPROVED, { provider: 'gemini' }), null).outcome,
  OUTCOMES.APPROVED,
  'no fallback leaves the primary untouched'
)

const bothTimedOut = combineAttempts(
  makeVerdict(OUTCOMES.TIMED_OUT, { detail: 'gemini: aborted' }),
  makeVerdict(OUTCOMES.UNAVAILABLE, { detail: 'groq: status 500' })
)
check(bothTimedOut.outcome, OUTCOMES.TIMED_OUT, 'TIMED_OUT is preferred — it is the more actionable message')
checkTruthy(bothTimedOut.detail.includes('gemini'), 'the merged detail keeps the primary failure')
checkTruthy(bothTimedOut.detail.includes('groq'), 'the merged detail keeps the fallback failure')

check(
  combineAttempts(
    makeVerdict(OUTCOMES.UNAVAILABLE, { detail: 'gemini: bad key' }),
    makeVerdict(OUTCOMES.UNAVAILABLE, { detail: 'groq: bad key' })
  ).outcome,
  OUTCOMES.UNAVAILABLE,
  'two outages merge to UNAVAILABLE'
)

// ---------------------------------------------------------------------------

section('budget arithmetic')

check(remainingBudget(1000, 12000, () => 1000), 12000, 'nothing elapsed leaves the full budget')
check(remainingBudget(1000, 12000, () => 5000), 8000, 'elapsed time is subtracted')
check(remainingBudget(1000, 12000, () => 20000), 0, 'an overrun clamps to zero, never negative')

check(providerDeadline(20000), PROVIDER_TIMEOUT_MS, 'the per-call timeout caps a large budget')
check(providerDeadline(3000), 3000, 'a small budget caps the per-call timeout')
check(providerDeadline(0), 0, 'no budget means no deadline to give')
check(providerDeadline(-500), 0, 'a negative budget clamps to zero')
check(providerDeadline(5000, 2000), 2000, 'the per-call timeout is overridable')

// ---------------------------------------------------------------------------

section('makeVerdict — the invariant')

// Every outcome except APPROVED must block the write. If this ever fails, an
// outage has become an unmoderated forum.
for (const outcome of Object.values(OUTCOMES)) {
  const verdict = makeVerdict(outcome, {})
  check(
    verdict.isAppropriate,
    outcome === OUTCOMES.APPROVED,
    `${outcome} approves content only when it is APPROVED`
  )
  checkTruthy(Number.isInteger(verdict.status), `${outcome} carries an HTTP status`)
  checkTruthy(typeof verdict.retryable === 'boolean', `${outcome} says whether a retry could help`)
}

check(makeVerdict('not-a-real-outcome', {}).outcome, OUTCOMES.UNAVAILABLE, 'an unknown outcome degrades to UNAVAILABLE')
check(makeVerdict('not-a-real-outcome', {}).isAppropriate, false, 'an unknown outcome does not approve content')
check(makeVerdict(OUTCOMES.REJECTED, { reason: '   ' }).reason.length > 0, true, 'a blank reason falls back to default text')

// ---------------------------------------------------------------------------

section('forum-limits — size policy at the route boundary')

check(validateSubmissionLength({ title: 'Hi', content: 'Hello' }), null, 'an ordinary post is accepted')
check(validateSubmissionLength({ title: '', content: 'Hello' }) !== null, true, 'a blank title is rejected')
check(validateSubmissionLength({ title: '   ', content: 'Hello' }) !== null, true, 'a whitespace title is rejected')
check(validateSubmissionLength({ title: 'Hi', content: '  ' }) !== null, true, 'blank content is rejected')
check(validateSubmissionLength({ title: 42, content: 'Hello' }) !== null, true, 'a non-string title is rejected')
check(
  validateSubmissionLength({ title: 'x'.repeat(FORUM_LIMITS.TITLE), content: 'ok' }),
  null,
  'a title exactly at the cap is accepted'
)
check(
  validateSubmissionLength({ title: 'x'.repeat(FORUM_LIMITS.TITLE + 1), content: 'ok' }) !== null,
  true,
  'a title one over the cap is rejected'
)
check(
  validateSubmissionLength({ title: 'ok', content: 'x'.repeat(FORUM_LIMITS.CONTENT + 1) }) !== null,
  true,
  'a body one over the cap is rejected'
)

// The reason the content cap is derived rather than chosen: a post the route
// accepts but moderation refuses to read would be rejected *after* the
// provider call, which is the cost the check exists to avoid.
checkTruthy(
  FORUM_LIMITS.TITLE + FORUM_LIMITS.CONTENT <= MAX_MODERATION_CHARS,
  'the largest acceptable post still fits inside the moderation cap'
)

check(validateCommentLength('Thanks for sharing this.'), null, 'an ordinary comment is accepted')
check(validateCommentLength(''), 'A comment cannot be empty.', 'an empty comment is rejected')
check(validateCommentLength('   '), 'A comment cannot be empty.', 'a whitespace comment is rejected')
check(validateCommentLength(null) !== null, true, 'a null comment is rejected')
check(validateCommentLength('x'.repeat(FORUM_LIMITS.COMMENT)), null, 'a comment at the cap is accepted')
check(
  validateCommentLength('x'.repeat(FORUM_LIMITS.COMMENT + 1)) !== null,
  true,
  'a comment one over the cap is rejected'
)
checkTruthy(FORUM_LIMITS.COMMENT <= MAX_MODERATION_CHARS, 'the largest acceptable comment fits inside the moderation cap')

// ---------------------------------------------------------------------------

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

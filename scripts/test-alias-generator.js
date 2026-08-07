/**
 * Regression suite for lib/alias-generator.js, lib/alias-display.js and
 * lib/alias-words.js.
 *
 * The bug this is part of fixing: the forum's only identity was drawn from two
 * 40-word lists — 1,600 possible names for the entire user base, which by the
 * birthday bound is a coin flip at 47 users. A collision presents two
 * different people to every reader as the same person, in threads where they
 * are describing their own diagnoses. Separately, the alias was an unsalted
 * `sha256(userId)`, so anyone holding a Clerk id could compute that user's
 * forum name offline and find everything she had written.
 *
 * The two properties worth pinning are the ones no amount of manual testing
 * would catch:
 *
 *   1. **Scale.** 100,000 synthetic ids produce 100,000 distinct aliases.
 *      The old scheme cannot get past 1,600 no matter how many you feed it.
 *   2. **Secrecy.** The same id under two different secrets produces two
 *      unrelated aliases, so the mapping is not computable without the key.
 *
 * The distribution check is here because rejection sampling is easy to get
 * wrong in a way that looks fine — a subtly biased sampler still returns
 * plausible names.
 *
 *   node scripts/test-alias-generator.js
 */

import crypto from 'crypto'

import {
  ADJECTIVES,
  ALIAS_SPACE,
  DISCRIMINATOR_ALPHABET,
  DISCRIMINATOR_LENGTH,
  DISCRIMINATOR_RANGE,
  NOUNS,
} from '../lib/alias-words.js'
import {
  MISSING_ALIAS_LABEL,
  hasDiscriminator,
  isLegacyAlias,
  renderStoredAlias,
} from '../lib/alias-display.js'

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

function checkTruthy(value, label) {
  check(Boolean(value), true, label)
}

function section(title) {
  console.log(`\n${title}`)
}

/**
 * Derives an alias under a specific secret.
 *
 * The generator reads `process.env` at call time rather than at import — a
 * module-level read would capture whatever the environment happened to be when
 * Next.js first pulled the module in — so swapping the secret needs nothing
 * more than setting it immediately before the call. No module cache busting,
 * and nothing left set afterwards.
 *
 * @param {string} secret
 * @param {string} userId
 * @returns {string}
 */
function aliasUnderSecret(secret, userId) {
  const previous = process.env.FORUM_ALIAS_SECRET
  process.env.FORUM_ALIAS_SECRET = secret
  try {
    return generateAlias(userId)
  } finally {
    process.env.FORUM_ALIAS_SECRET = previous
  }
}

// A secret is set for the whole suite so the fallback warning does not fire on
// every import and drown the output.
process.env.FORUM_ALIAS_SECRET = 'test-secret-for-the-alias-suite'
const { describeAliasSpace, generateAlias } = await import('../lib/alias-generator.js')

// ---------------------------------------------------------------------------

section('word lists')

check(ADJECTIVES.length, 96, 'the adjective list holds 96 entries')
check(NOUNS.length, 96, 'the noun list holds 96 entries')
check(ADJECTIVES.length, NOUNS.length, 'both lists are the same length')
check(new Set(ADJECTIVES).size, ADJECTIVES.length, 'no duplicate adjectives')
check(new Set(NOUNS).size, NOUNS.length, 'no duplicate nouns')
check(new Set([...ADJECTIVES, ...NOUNS]).size, ADJECTIVES.length + NOUNS.length, 'no word appears in both lists')

// Rule 1 of the editing policy in lib/alias-words.js: append only. Changing an
// existing entry changes the alias of every user whose hash lands on it.
check(ADJECTIVES[0], 'Brave', 'the first adjective is unchanged')
check(ADJECTIVES[39], 'Noble', 'the fortieth adjective is unchanged')
check(NOUNS[0], 'Lotus', 'the first noun is unchanged')
check(NOUNS[39], 'Spirit', 'the fortieth noun is unchanged')

checkTruthy(
  ADJECTIVES.every((word) => /^[A-Z][a-z]+$/.test(word)),
  'every adjective is a single capitalised word'
)
checkTruthy(
  NOUNS.every((word) => /^[A-Z][a-z]+$/.test(word)),
  'every noun is a single capitalised word'
)

check(ALIAS_SPACE, 96 * 96 * DISCRIMINATOR_RANGE, 'the alias space is the product of the three dimensions')
check(DISCRIMINATOR_RANGE, 32 ** 5, 'the discriminator spans 32^5 values')
check(ALIAS_SPACE, 9216 * 33_554_432, 'the alias space is 309 billion')
check(DISCRIMINATOR_ALPHABET.length, 32, 'the alphabet is base32')
check(new Set(DISCRIMINATOR_ALPHABET).size, 32, 'no character appears twice in the alphabet')

// ---------------------------------------------------------------------------

section('shape and determinism')

const alias = generateAlias('user_2abcDEF123')
checkTruthy(hasDiscriminator(alias), `"${alias}" has the Adjective Noun XXXXX shape`)
check(generateAlias('user_2abcDEF123'), alias, 'the same id gives the same alias')
check(generateAlias('user_2abcDEF123'), alias, 'and again — it is a pure function of the id')

const [adjective, noun, suffix] = alias.split(' ')
checkTruthy(ADJECTIVES.includes(adjective), 'the adjective comes from the list')
checkTruthy(NOUNS.includes(noun), 'the noun comes from the list')
check(suffix.length, DISCRIMINATOR_LENGTH, 'the discriminator is always the full width')
checkTruthy(
  [...suffix].every((char) => DISCRIMINATOR_ALPHABET.includes(char)),
  'every discriminator character comes from the alphabet'
)

// hasDiscriminator() writes the alphabet out as a regex character class rather
// than importing it. This is the check that keeps the two from drifting apart.
checkTruthy(
  [...DISCRIMINATOR_ALPHABET].every((char) => hasDiscriminator(`Gentle Willow ${char.repeat(DISCRIMINATOR_LENGTH)}`)),
  'the display regex accepts every character the generator can emit'
)
checkTruthy(
  ['I', 'L', 'O', 'U'].every((char) => !DISCRIMINATOR_ALPHABET.includes(char)),
  'the ambiguous characters I, L, O and U are excluded'
)

// ---------------------------------------------------------------------------

section('collisions at scale — the whole point of the change')

const SAMPLE = 100_000
const seen = new Map()
const collisions = []

for (let i = 0; i < SAMPLE; i += 1) {
  // Shaped like a real Clerk id rather than "user_1", "user_2": sequential
  // inputs are the easy case for a hash, and would flatter the result.
  const id = `user_${crypto.createHash('sha1').update(`seed-${i}`).digest('hex').slice(0, 24)}`
  const name = generateAlias(id)
  if (seen.has(name)) collisions.push([seen.get(name), id, name])
  else seen.set(name, id)
}

check(seen.size, SAMPLE, `${SAMPLE.toLocaleString('en-US')} distinct ids produce that many distinct aliases`)
check(collisions.length, 0, 'no two users share a name')

if (collisions.length > 0) {
  for (const [a, b, name] of collisions.slice(0, 5)) {
    console.error(`       ${a} and ${b} are both "${name}"`)
  }
}

// For contrast: the old scheme could not have passed the line above, because
// it had only 1,600 names to hand out.
const OLD_SPACE = 40 * 40
checkTruthy(seen.size > OLD_SPACE, 'the number of distinct aliases exceeds the entire old alias space')

// ---------------------------------------------------------------------------

section('birthday odds')

const space = describeAliasSpace()
check(space.total, ALIAS_SPACE, 'describeAliasSpace reports the real total')
check(space.collisionOdds(0), 0, 'no users, no collisions')
check(space.collisionOdds(1), 0, 'one user cannot collide with anyone')
checkTruthy(space.collisionOdds(100) < 1e-7, 'at 100 users the odds are under one in ten million')
checkTruthy(space.collisionOdds(100_000) < 0.02, 'at 100,000 users the odds are under 2 %')
checkTruthy(space.collisionOdds(2_000_000) > 0.5, 'the 50 % point is in the millions of users, not at 47')

// The same figures under the old space, to show what was being fixed.
const oldOdds = (k) => 1 - Math.exp((-k * (k - 1)) / (2 * OLD_SPACE))
checkTruthy(oldOdds(47) > 0.49, 'the old scheme was a coin flip at 47 users')
checkTruthy(oldOdds(100) > 0.95, 'the old scheme collided with 95 % probability at 100 users')
checkTruthy(
  space.collisionOdds(100) < oldOdds(100) / 1_000_000,
  'the new odds at 100 users are more than a millionfold better'
)

// ---------------------------------------------------------------------------

section('the secret — aliases must not be computable from a user id alone')

const idUnderTest = 'user_2xyzABC987'
const aliasA = aliasUnderSecret('secret-alpha', idUnderTest)
const aliasB = aliasUnderSecret('secret-beta', idUnderTest)
const aliasAAgain = aliasUnderSecret('secret-alpha', idUnderTest)

checkTruthy(aliasA !== aliasB, 'the same id under a different secret gives a different alias')
check(aliasAAgain, aliasA, 'the same id under the same secret is stable across calls')

// A second pair, so the first is not passing on a lucky single draw.
checkTruthy(
  aliasUnderSecret('secret-gamma', 'user_other') !== aliasUnderSecret('secret-delta', 'user_other'),
  'a second id also diverges under different secrets'
)

// A plain unsalted sha256 of the id — what the old implementation computed —
// must no longer determine the answer.
const legacyHash = crypto.createHash('sha256').update(idUnderTest).digest('hex')
const legacyAdjective = ADJECTIVES.slice(0, 40)[parseInt(legacyHash.substring(0, 8), 16) % 40]
const legacyNoun = NOUNS.slice(0, 40)[parseInt(legacyHash.substring(8, 16), 16) % 40]
checkTruthy(
  aliasA !== `${legacyAdjective} ${legacyNoun}`,
  'the alias is no longer recoverable by hashing the user id'
)

process.env.FORUM_ALIAS_SECRET = 'test-secret-for-the-alias-suite'

// ---------------------------------------------------------------------------

section('distribution — rejection sampling must not skew the lists')

const adjectiveCounts = new Map()
const nounCounts = new Map()
const symbolCounts = new Map()

const DIST_SAMPLE = 60_000
for (let i = 0; i < DIST_SAMPLE; i += 1) {
  const id = `dist_${crypto.createHash('sha1').update(`d-${i}`).digest('hex').slice(0, 20)}`
  const [adj, nn, suffix] = generateAlias(id).split(' ')
  adjectiveCounts.set(adj, (adjectiveCounts.get(adj) || 0) + 1)
  nounCounts.set(nn, (nounCounts.get(nn) || 0) + 1)
  for (const char of suffix) symbolCounts.set(char, (symbolCounts.get(char) || 0) + 1)
}

check(adjectiveCounts.size, ADJECTIVES.length, 'every adjective is reachable')
check(nounCounts.size, NOUNS.length, 'every noun is reachable')

const expectedPerWord = DIST_SAMPLE / ADJECTIVES.length
const worstAdjective = Math.max(...[...adjectiveCounts.values()].map((c) => Math.abs(c - expectedPerWord)))
const worstNoun = Math.max(...[...nounCounts.values()].map((c) => Math.abs(c - expectedPerWord)))

// Five standard deviations of a binomial(n, 1/96) is a bound random sampling
// clears comfortably and a biased sampler does not.
const tolerance = 5 * Math.sqrt(DIST_SAMPLE * (1 / 96) * (1 - 1 / 96))
checkTruthy(worstAdjective < tolerance, `adjective frequencies are within tolerance (worst ${worstAdjective.toFixed(0)} < ${tolerance.toFixed(0)})`)
checkTruthy(worstNoun < tolerance, `noun frequencies are within tolerance (worst ${worstNoun.toFixed(0)} < ${tolerance.toFixed(0)})`)

// The old modulo-into-40 had its bias in the first 16 entries. Check that
// range specifically rather than trusting the aggregate to reveal it.
const firstSixteen = ADJECTIVES.slice(0, 16).reduce((sum, word) => sum + (adjectiveCounts.get(word) || 0), 0)
const expectedFirstSixteen = (DIST_SAMPLE * 16) / 96
checkTruthy(
  Math.abs(firstSixteen - expectedFirstSixteen) < 4 * Math.sqrt(expectedFirstSixteen),
  'the first sixteen adjectives are not over-represented'
)

check(symbolCounts.size, DISCRIMINATOR_ALPHABET.length, 'every discriminator character is reachable')

const symbolDraws = DIST_SAMPLE * DISCRIMINATOR_LENGTH
const expectedPerSymbol = symbolDraws / DISCRIMINATOR_ALPHABET.length
const worstSymbol = Math.max(...[...symbolCounts.values()].map((c) => Math.abs(c - expectedPerSymbol)))
const symbolTolerance = 5 * Math.sqrt(symbolDraws * (1 / 32) * (1 - 1 / 32))
checkTruthy(
  worstSymbol < symbolTolerance,
  `discriminator characters are uniform (worst ${worstSymbol.toFixed(0)} < ${symbolTolerance.toFixed(0)})`
)

// ---------------------------------------------------------------------------

section('invalid input is an error, not a plausible name')

for (const bad of [null, undefined, '', '   ', 42, {}, []]) {
  let threw = false
  try {
    generateAlias(bad)
  } catch (error) {
    threw = error instanceof TypeError
  }
  check(threw, true, `generateAlias(${JSON.stringify(bad)}) throws a TypeError`)
}

// ---------------------------------------------------------------------------

section('rendering stored aliases — history must not move')

check(renderStoredAlias('Brave Lotus'), 'Brave Lotus', 'a legacy two-word alias renders unchanged')
check(renderStoredAlias('Gentle Willow 7K2QX'), 'Gentle Willow 7K2QX', 'a current alias renders unchanged')
check(renderStoredAlias('  Quiet Fern 00007  '), 'Quiet Fern 00007', 'surrounding whitespace is trimmed')
check(renderStoredAlias(''), MISSING_ALIAS_LABEL, 'an empty alias falls back to the missing-data label')
check(renderStoredAlias(null), MISSING_ALIAS_LABEL, 'a null alias falls back')
check(renderStoredAlias(undefined), MISSING_ALIAS_LABEL, 'an undefined alias falls back')
check(renderStoredAlias(12345), MISSING_ALIAS_LABEL, 'a non-string alias falls back')

// The fallback must not look like a real alias, which 'Anonymous User' did.
checkTruthy(!isLegacyAlias(MISSING_ALIAS_LABEL), 'the missing-data label is not mistakable for a generated alias')
checkTruthy(!hasDiscriminator(MISSING_ALIAS_LABEL), 'the missing-data label has no discriminator')

check(isLegacyAlias('Brave Lotus'), true, 'a two-word alias is recognised as legacy')
check(isLegacyAlias('Gentle Willow 7K2QX'), false, 'a current alias is not legacy')
check(isLegacyAlias('Anonymous User'), true, 'the old fallback was indistinguishable from a real alias — this is why it went')
check(isLegacyAlias(''), false, 'an empty string is not a legacy alias')
check(isLegacyAlias(null), false, 'null is not a legacy alias')

check(hasDiscriminator('Gentle Willow 7K2QX'), true, 'a current alias is recognised')
check(hasDiscriminator('Gentle Willow 7K2Q'), false, 'a four-character suffix is not a discriminator')
check(hasDiscriminator('Gentle Willow 7K2QXY'), false, 'a six-character suffix is not a discriminator')
check(hasDiscriminator('Gentle Willow 7K2QI'), false, 'a suffix using an excluded character is rejected')
check(hasDiscriminator('Gentle Willow'), false, 'a two-word alias has no discriminator')

// ---------------------------------------------------------------------------

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

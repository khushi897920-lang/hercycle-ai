/**
 * alias-generator.js — the anonymous identity used throughout the community.
 *
 * `forum_posts.author_alias` and `forum_comments.author_alias` are the only
 * author information the UI ever renders; `user_id` is never exposed. So this
 * function is not a cosmetic nicety — it *is* the forum's identity model, and
 * it had two problems.
 *
 * ## 1. It collided
 *
 * Two 40-word lists give 1,600 aliases for the whole user base. By the
 * birthday bound that is 11 % at 20 users, 50 % at 47, and 96 % at 100 — and
 * at 200 users the expected number of colliding *pairs* is about twelve.
 *
 * A collision here means two different people are presented to every reader as
 * the same person, in threads where they are describing their own diagnoses.
 * Advice gets attributed to the wrong person, and nobody — including the two
 * users — can tell them apart. See `lib/alias-words.js` for the new space.
 *
 * ## 2. It was reversible
 *
 * The alias was an unsalted `sha256(userId)`. Clerk ids are not secret: they
 * appear in webhook payloads, in support tooling, and in the `user_id` column
 * of every table an admin can read. Anyone holding one could compute that
 * user's forum name offline and find everything she had ever written. The
 * anonymity was one `sha256()` call deep.
 *
 * Derivation is now `HMAC-SHA512(secret, userId)`. Without the server-side
 * secret the mapping cannot be computed or precomputed at all.
 *
 * ## A note on rotation
 *
 * Changing the derivation changes what `generateAlias()` returns for an
 * existing user. That is a one-time rotation and it is deliberate: the old
 * alias was not a durable identity, because it was not unique. Nothing in the
 * database moves — `author_alias` is stored per row, so every historical post
 * and comment keeps the name it was written under and old threads stay
 * internally consistent. New writes use the new name. Use
 * {@link renderStoredAlias} for anything read back out of the database, and
 * never re-derive an alias for a row that already has one.
 */

import crypto from 'crypto'

import {
  ADJECTIVES,
  ALIAS_SPACE,
  DISCRIMINATOR_ALPHABET,
  DISCRIMINATOR_LENGTH,
  DISCRIMINATOR_RANGE,
  NOUNS,
} from './alias-words.js'

export { ALIAS_SPACE } from './alias-words.js'

// Re-exported so server code has one import for both halves. The definitions
// live in `lib/alias-display.js`, which has no `crypto` dependency and is
// therefore safe to import from a Client Component — see the note at the top
// of that file for why the split matters.
export { hasDiscriminator, isLegacyAlias, renderStoredAlias } from './alias-display.js'

/**
 * Namespace mixed into the HMAC message.
 *
 * The same secret may one day key another derivation. Domain-separating means
 * a future `HMAC(secret, userId)` elsewhere cannot be used to recover, or be
 * recovered from, a forum alias.
 */
const ALIAS_NAMESPACE = 'hercycle:forum-alias:v2'

/**
 * Development-only fallback secret.
 *
 * Named so that it is obvious in a log or a grep what it is, and so that
 * shipping it to production is a visible mistake rather than a silent one.
 * `resolveSecret` warns once when it is used.
 */
const DEV_FALLBACK_SECRET = 'hercycle-local-development-alias-secret-do-not-use-in-production'

let warnedAboutFallback = false

/**
 * Resolves the HMAC key.
 *
 * `FORUM_ALIAS_SECRET` is the intended source. `SUPABASE_SERVICE_ROLE_KEY` is
 * accepted as a fallback because it is already required on every server that
 * runs this code, is never sent to a browser, and is stable across deploys —
 * so an existing deployment gets non-reversible aliases without a new
 * environment variable, and gets *stable* ones, which a random per-boot key
 * would not.
 *
 * Both are read at call time rather than at module load: a module-level read
 * captures whatever the environment happened to be at import, which in Next.js
 * is not necessarily when the route runs.
 *
 * @returns {string}
 */
function resolveSecret() {
  const configured = process.env.FORUM_ALIAS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (configured && configured.length > 0) return configured

  if (!warnedAboutFallback) {
    warnedAboutFallback = true
    // console rather than lib/logger: this module is imported by plain Node
    // scripts and must not drag a logger — and its dependency graph — in.
    console.warn(
      '[alias-generator] Neither FORUM_ALIAS_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set. ' +
        'Falling back to a well-known development secret — forum aliases are reversible in this process.'
    )
  }

  return DEV_FALLBACK_SECRET
}

/**
 * A stream of uniformly distributed integers derived from a seed.
 *
 * The old code took `parseInt(hash.substring(0, 8), 16) % 40`. Two problems
 * with that, one theoretical and one not:
 *
 * - **Modulo bias.** The 8 hex digits span 0…4,294,967,295, which is
 *   4,294,967,296 values. `4294967296 % 40 === 16`, so the first 16 words of
 *   the list were each one-in-107,374,183 more likely than the rest. Tiny, and
 *   free to remove.
 * - **Only 64 of 256 bits were used**, so the majority of the hash was
 *   computed and thrown away — and there was nothing left to derive a
 *   discriminator from.
 *
 * Rejection sampling removes the bias exactly: values in the final, partial
 * block of the 2³² range are discarded rather than folded. When the current
 * block of key material runs out, more is derived by re-keying with an
 * incrementing counter, so the stream never terminates and the sampler never
 * has to compromise.
 */
class UniformSampler {
  /**
   * @param {Buffer} seed
   * @param {string} secret
   */
  constructor(seed, secret) {
    this.secret = secret
    this.counter = 0
    this.block = seed
    this.offset = 0
  }

  /** Derives the next block of key material. */
  refill() {
    this.counter += 1
    this.block = crypto
      .createHmac('sha512', this.secret)
      .update(`${ALIAS_NAMESPACE}:stream:${this.counter}`)
      .update(this.block)
      .digest()
    this.offset = 0
  }

  /** @returns {number} the next uint32 from the stream */
  nextWord() {
    if (this.offset + 4 > this.block.length) this.refill()
    const word = this.block.readUInt32BE(this.offset)
    this.offset += 4
    return word
  }

  /**
   * A uniformly distributed integer in `[0, max)`.
   *
   * @param {number} max
   * @returns {number}
   */
  nextBelow(max) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new RangeError(`nextBelow requires a positive integer, received ${max}`)
    }

    // The largest multiple of `max` that fits in a uint32. Anything at or
    // above it is in the partial block and is discarded.
    const limit = Math.floor(0x100000000 / max) * max

    // Bounded in practice: the rejection probability per draw is under
    // max/2³², which for our largest `max` (10,000) is about one in 429,497.
    for (;;) {
      const word = this.nextWord()
      if (word < limit) return word % max
    }
  }
}

/**
 * Generates the anonymous alias for a user.
 *
 * Deterministic: the same user id and the same secret always produce the same
 * alias, which is what makes a user recognisable across her own thread.
 *
 * @param {string} userId the Clerk user id
 * @returns {string} e.g. `"Gentle Willow 7K2QX"`
 * @throws {TypeError} when `userId` is missing or not a string
 */
export function generateAlias(userId) {
  // The old code answered a missing id with the literal string
  // 'Anonymous User' — which is also a perfectly plausible thing to render, so
  // a bug that lost the user id looked exactly like a normal author. Both
  // callers already return 401 before reaching here, so a missing id at this
  // point is a programming error and should read as one.
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new TypeError('generateAlias requires a non-empty user id')
  }

  const secret = resolveSecret()

  const seed = crypto
    .createHmac('sha512', secret)
    .update(ALIAS_NAMESPACE)
    .update(userId)
    .digest()

  const sampler = new UniformSampler(seed, secret)

  const adjective = ADJECTIVES[sampler.nextBelow(ADJECTIVES.length)]
  const noun = NOUNS[sampler.nextBelow(NOUNS.length)]

  // Drawn symbol by symbol rather than as one integer in [0, 32^5). Both are
  // uniform over the same space, but this way the sampler never has to handle
  // a bound above 2³², and the zero-padding problem — where `String(7)` would
  // silently produce a one-character discriminator — cannot arise.
  let discriminator = ''
  for (let i = 0; i < DISCRIMINATOR_LENGTH; i += 1) {
    discriminator += DISCRIMINATOR_ALPHABET[sampler.nextBelow(DISCRIMINATOR_ALPHABET.length)]
  }

  return `${adjective} ${noun} ${discriminator}`
}

/**
 * Describes the alias space, for tests and for anyone sizing the scheme
 * against a projected user count.
 *
 * `collisionOdds(k)` is the standard birthday approximation
 * `1 − e^(−k(k−1) / 2n)`, which is what "will two of our users end up with the
 * same name" actually asks.
 *
 * @returns {{ adjectives: number, nouns: number, discriminators: number, total: number, collisionOdds: (users: number) => number }}
 */
export function describeAliasSpace() {
  return {
    adjectives: ADJECTIVES.length,
    nouns: NOUNS.length,
    discriminators: DISCRIMINATOR_RANGE,
    total: ALIAS_SPACE,
    collisionOdds(users) {
      if (!Number.isFinite(users) || users < 2) return 0
      return 1 - Math.exp((-users * (users - 1)) / (2 * ALIAS_SPACE))
    },
  }
}

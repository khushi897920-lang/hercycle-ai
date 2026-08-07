/**
 * alias-words.js — the vocabulary anonymous forum names are built from.
 *
 * Kept separate from `lib/alias-generator.js` so the lists can be extended
 * without touching the derivation, and so the derivation can be read without
 * scrolling past two hundred words.
 *
 * ## Why these lists are this long
 *
 * The original lists held 40 adjectives and 40 nouns — 1,600 possible aliases
 * for the entire user base. By the birthday bound that is a coin flip at 47
 * users and a near-certainty at 100:
 *
 *   P(collision) ≈ 1 − e^(−k² / 2n)   with n = 1600
 *
 *   k =  20  →  11 %
 *   k =  47  →  50 %
 *   k = 100  →  96 %
 *
 * Two users rendered under the same name is not a cosmetic problem here. The
 * alias is the *only* identity the forum has — `user_id` is never exposed — so
 * a collision presents two different people to every reader as one person, in
 * threads where they are describing their own diagnoses.
 *
 * 96 × 96 = 9,216 pairs, and `lib/alias-generator.js` appends a
 * five-character discriminator, giving 309 billion distinct aliases. That
 * moves the 50 % collision point from 47 users to roughly 654,000. See
 * {@link DISCRIMINATOR_LENGTH} for how the width was chosen.
 *
 * ## Rules for editing these lists
 *
 * 1. **Append only.** Changing or reordering an existing entry changes the
 *    alias of every user whose hash lands on that index.
 * 2. **Nothing that reads as a judgement.** These names are attached to posts
 *    about people's bodies. "Fierce" and "Gentle" are fine; anything
 *    describing a body, a diagnosis, or a mood is not.
 * 3. **No word that could be read as a real name** — an alias that looks like
 *    a name undermines the point of having one.
 * 4. Keep both lists the same length. Nothing depends on it, but an uneven
 *    pair is a sign someone appended to one and forgot the other.
 */

/**
 * The first 40 entries of each list are the originals, in their original
 * order, so that a user whose hash happens to land in that range keeps a
 * familiar-looking name.
 */
export const ADJECTIVES = Object.freeze([
  // — original 40 —
  'Brave', 'Gentle', 'Fierce', 'Quiet', 'Calm', 'Bright', 'Kind', 'Wise', 'Bold', 'Swift',
  'Happy', 'Proud', 'Strong', 'Sunny', 'Cool', 'Lucky', 'Wild', 'Silent', 'Mighty', 'Clever',
  'Golden', 'Silver', 'Crystal', 'Crimson', 'Azure', 'Jade', 'Violet', 'Amber', 'Coral', 'Pearl',
  'Cosmic', 'Lunar', 'Solar', 'Stellar', 'Astral', 'Mystic', 'Magic', 'Secret', 'Hidden', 'Noble',
  // — temperament —
  'Radiant', 'Serene', 'Vivid', 'Steady', 'Nimble', 'Patient', 'Curious', 'Earnest', 'Humble', 'Merry',
  'Tender', 'Fearless', 'Graceful', 'Spirited', 'Resolute', 'Warm', 'Quick', 'Keen', 'Bonny', 'Cheerful',
  // — colour and material —
  'Velvet', 'Copper', 'Ivory', 'Indigo', 'Scarlet', 'Emerald', 'Sapphire', 'Opal', 'Topaz', 'Ruby',
  // — weather and light —
  'Twilight', 'Dawning', 'Misty', 'Frosted', 'Glowing', 'Drifting', 'Rustling', 'Whispering', 'Wandering', 'Blooming',
  // — scale and place —
  'Ancient', 'Timeless', 'Boundless', 'Endless', 'Northern', 'Southern', 'Eastern', 'Western', 'Highland', 'Lowland',
  // — craft —
  'Gilded', 'Woven', 'Braided', 'Painted', 'Carved', 'Feathered',
])

export const NOUNS = Object.freeze([
  // — original 40 —
  'Lotus', 'Tulip', 'Rose', 'Lily', 'Orchid', 'Daisy', 'Iris', 'Fern', 'Ivy', 'Willow',
  'Phoenix', 'Dragon', 'Eagle', 'Falcon', 'Hawk', 'Raven', 'Dove', 'Swan', 'Robin', 'Lark',
  'River', 'Ocean', 'Mountain', 'Forest', 'Meadow', 'Valley', 'Star', 'Moon', 'Sun', 'Cloud',
  'Seeker', 'Dreamer', 'Thinker', 'Wanderer', 'Traveler', 'Healer', 'Guide', 'Friend', 'Soul', 'Spirit',
  // — flowers —
  'Jasmine', 'Marigold', 'Peony', 'Poppy', 'Lavender', 'Camellia', 'Magnolia', 'Hibiscus', 'Bluebell', 'Clover',
  // — birds —
  'Heron', 'Kestrel', 'Wren', 'Finch', 'Swallow', 'Nightingale', 'Kingfisher', 'Osprey', 'Pelican', 'Sparrow',
  // — landscape —
  'Harbour', 'Lagoon', 'Canyon', 'Prairie', 'Glacier', 'Summit', 'Delta', 'Orchard', 'Grove', 'Reef',
  // — sky —
  'Comet', 'Nebula', 'Aurora', 'Horizon', 'Meridian', 'Ember', 'Lantern', 'Beacon', 'Compass', 'Anchor',
  // — roles —
  'Weaver', 'Gardener', 'Keeper', 'Listener', 'Builder', 'Runner', 'Voyager', 'Storyteller', 'Navigator', 'Harvester',
  // — weather and terrain —
  'Cascade', 'Monsoon', 'Zephyr', 'Thicket', 'Boulder', 'Trellis',
])

/**
 * The alphabet the discriminator suffix is drawn from.
 *
 * Crockford base32: the digits plus the uppercase letters, minus `I`, `L`, `O`
 * and `U`. The first three are dropped because they are unreadable next to
 * `1` and `0` in the middle of a name, and `U` because excluding it keeps
 * accidental words from forming in a five-character run.
 */
export const DISCRIMINATOR_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * How many characters the discriminator carries.
 *
 * The width is set by the birthday bound, not by taste. A derived alias cannot
 * be *guaranteed* unique without asking the database, so the only lever is
 * making a collision improbable enough to disregard:
 *
 *   n = 96 × 96 × 32^L        P(collision at k users) ≈ 1 − e^(−k² / 2n)
 *
 *   L = 0 (the old scheme, 40-word lists)  n = 1,600          50 % at 47 users
 *   L = 4 (4 decimal digits)               n = 92.2 million   50 % at 11,300
 *   L = 5 (base32)                         n = 309 billion    50 % at 654,000
 *   L = 6 (base32)                         n = 9.9 trillion   50 % at 3.7 million
 *
 * Five is where the odds stop mattering for an app of this kind — at 100,000
 * users the expected number of colliding pairs is 0.016 — while the alias
 * still reads as a name with a tag ("Gentle Willow 7K2QX") rather than as a
 * serial number.
 */
export const DISCRIMINATOR_LENGTH = 5

/** The number of values the discriminator can take. */
export const DISCRIMINATOR_RANGE = DISCRIMINATOR_ALPHABET.length ** DISCRIMINATOR_LENGTH

/** Total distinct aliases the scheme can produce. */
export const ALIAS_SPACE = ADJECTIVES.length * NOUNS.length * DISCRIMINATOR_RANGE

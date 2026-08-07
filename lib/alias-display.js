/**
 * alias-display.js — rendering an alias that already exists on a row.
 *
 * Deliberately separate from `lib/alias-generator.js`, which imports Node's
 * `crypto`. The components that display an author name — `PostCard`,
 * `CommentSection`, the post page — are Client Components, and pulling the
 * generator into them would drag `crypto` into the browser bundle. It would
 * also put the *derivation* one import away from client code, which is
 * exactly the thing that must stay on the server: an alias derived in the
 * browser is an alias whose secret is in the browser.
 *
 * So the split is a boundary, not a file-size preference:
 *
 *   lib/alias-generator.js   server only. Derives a NEW alias for a NEW write.
 *   lib/alias-display.js     safe anywhere. Renders a STORED alias.
 *
 * No imports here, by design.
 */

/**
 * Shown when a row has no alias at all.
 *
 * The previous fallback was `'Anonymous User'`, which is indistinguishable
 * from a real generated alias — so a bug that lost the author name rendered as
 * an ordinary-looking author rather than as missing data. This one reads as
 * what it is.
 */
export const MISSING_ALIAS_LABEL = 'Community member'

/**
 * Renders the `author_alias` column value.
 *
 * Every historical `forum_posts` and `forum_comments` row carries the alias it
 * was written under, and that must keep rendering exactly as stored. Aliases
 * are per-row precisely so that they cannot change under a reader — a name in
 * a two-year-old thread should still be the name the person posted as.
 *
 * @param {unknown} stored
 * @returns {string}
 */
export function renderStoredAlias(stored) {
  if (typeof stored === 'string' && stored.trim().length > 0) return stored.trim()
  return MISSING_ALIAS_LABEL
}

/**
 * Whether an alias was produced by the pre-rotation two-word scheme
 * (`"Brave Lotus"` rather than `"Brave Lotus 7K2QX"`).
 *
 * Not used to change how anything renders — old names render as themselves.
 * It exists so the proportion of legacy names in the forum can be reported on,
 * and so the test suite can assert the two formats are distinguishable.
 *
 * @param {unknown} alias
 * @returns {boolean}
 */
export function isLegacyAlias(alias) {
  if (typeof alias !== 'string') return false
  return /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(alias.trim())
}

/**
 * Whether an alias carries the discriminator suffix added by the current
 * scheme.
 *
 * The character class is written out rather than imported from
 * `lib/alias-words.js` so that this module keeps its no-imports property and
 * stays free to be pulled into a Client Component. It is Crockford base32 —
 * digits and uppercase letters minus `I`, `L`, `O` and `U`. If the alphabet
 * there ever changes, `scripts/test-alias-generator.js` fails on the
 * round-trip check rather than letting the two drift apart quietly.
 *
 * @param {unknown} alias
 * @returns {boolean}
 */
export function hasDiscriminator(alias) {
  if (typeof alias !== 'string') return false
  return /^[A-Z][a-z]+ [A-Z][a-z]+ [0-9A-HJKMNP-TV-Z]{5}$/.test(alias.trim())
}

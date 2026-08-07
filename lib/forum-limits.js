/**
 * forum-limits.js — size policy for community submissions.
 *
 * Neither forum write route validated length. `app/api/forum/posts/route.js`
 * checked only that `categoryId`, `title` and `content` were truthy, and
 * `app/api/forum/comments/route.js` only that `postId` and `content` were —
 * so the size of what reached the moderation providers, and then the database,
 * was whatever the client chose to send.
 *
 * The limits live here rather than inline in the routes so that the two write
 * paths cannot drift apart, and so the boundary cases are reachable from a
 * test without standing up a request.
 *
 * These are deliberately generous. The point is not to police how much someone
 * writes about her own health; it is to make the request cost bounded.
 */

import { MAX_MODERATION_CHARS } from './moderation-verdict.js'

/**
 * Field ceilings, in characters.
 *
 * `content` is pinned to the moderation cap rather than chosen independently:
 * a body the route accepts but moderation refuses to read would be rejected
 * *after* the provider call rather than before it, which is the cost this
 * check exists to avoid. Post title and body are moderated as one string, so
 * the combined length is what has to fit.
 */
export const FORUM_LIMITS = Object.freeze({
  TITLE: 200,
  CONTENT: MAX_MODERATION_CHARS - 200,
  COMMENT: 4000,
})

/**
 * Validates a post submission.
 *
 * Returns `null` when the submission is acceptable, or a user-facing message
 * when it is not. A message is not an exception: the caller answers 400 with
 * it, because "this is too long" is something the user can act on directly.
 *
 * @param {{ title?: unknown, content?: unknown }} fields
 * @returns {string|null}
 */
export function validateSubmissionLength(fields = {}) {
  const { title, content } = fields

  if (typeof title !== 'string' || title.trim().length === 0) {
    return 'A title is required.'
  }
  if (typeof content !== 'string' || content.trim().length === 0) {
    return 'Post content is required.'
  }

  if (title.length > FORUM_LIMITS.TITLE) {
    return `Please keep the title under ${FORUM_LIMITS.TITLE} characters.`
  }
  if (content.length > FORUM_LIMITS.CONTENT) {
    return `Please keep your post under ${FORUM_LIMITS.CONTENT.toLocaleString('en-US')} characters.`
  }

  return null
}

/**
 * Validates a comment submission.
 *
 * @param {unknown} content
 * @returns {string|null}
 */
export function validateCommentLength(content) {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return 'A comment cannot be empty.'
  }
  if (content.length > FORUM_LIMITS.COMMENT) {
    return `Please keep your comment under ${FORUM_LIMITS.COMMENT.toLocaleString('en-US')} characters.`
  }
  return null
}

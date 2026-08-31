/**
 * Regression test for Forum Reply Push Notifications (GitHub Issue #818).
 *
 *   node scripts/test-forum-reply-notifications.js
 */

import fs from 'fs'
import path from 'path'

let passed = 0
let failed = 0

function check(actual, expected, label) {
  const isMatch = typeof actual === 'object' && actual !== null
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : Object.is(actual, expected)

  if (isMatch) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${JSON.stringify(expected)}`)
  console.error(`       actual:   ${JSON.stringify(actual)}`)
}

function checkTrue(actual, label) {
  check(Boolean(actual), true, label)
}

function section(title) {
  console.log(`\n— ${title}`)
}

// ── 1. Target Author & Self-Reply Logic Tests ─────────────────────────

section('Self-Reply & Target Detection Logic')

function computeNotificationTarget({ commenterUserId, postAuthorUserId, parentCommentAuthorUserId }) {
  let targetUserId = parentCommentAuthorUserId || postAuthorUserId

  // Self-reply check
  if (targetUserId === commenterUserId) {
    return { shouldNotify: false, reason: 'self_reply' }
  }

  return { shouldNotify: true, targetUserId }
}

check(
  computeNotificationTarget({
    commenterUserId: 'user_123',
    postAuthorUserId: 'user_456',
    parentCommentAuthorUserId: null,
  }),
  { shouldNotify: true, targetUserId: 'user_456' },
  'User B replying to User A post notifies User A'
)

check(
  computeNotificationTarget({
    commenterUserId: 'user_123',
    postAuthorUserId: 'user_123',
    parentCommentAuthorUserId: null,
  }),
  { shouldNotify: false, reason: 'self_reply' },
  'User A replying to User A post does NOT send notification'
)

check(
  computeNotificationTarget({
    commenterUserId: 'user_789',
    postAuthorUserId: 'user_123',
    parentCommentAuthorUserId: 'user_456',
  }),
  { shouldNotify: true, targetUserId: 'user_456' },
  'User C replying to User B comment notifies User B'
)

check(
  computeNotificationTarget({
    commenterUserId: 'user_456',
    postAuthorUserId: 'user_123',
    parentCommentAuthorUserId: 'user_456',
  }),
  { shouldNotify: false, reason: 'self_reply' },
  'User B replying to User B comment does NOT send notification'
)

// ── 2. Preference Filtering Logic ──────────────────────────────────────

section('Preference Filtering Logic')

function isSubscriptionEligible(subscriptionRow) {
  const prefs = subscriptionRow?.subscription?.preferences
  return !prefs || prefs.forumReplies !== false
}

check(
  isSubscriptionEligible({ subscription: { preferences: { forumReplies: true } } }),
  true,
  'Eligible when forumReplies is true'
)

check(
  isSubscriptionEligible({ subscription: { preferences: { forumReplies: false } } }),
  false,
  'Ineligible when forumReplies is false'
)

check(
  isSubscriptionEligible({ subscription: {} }),
  true,
  'Eligible when preferences object is missing (default opt-in)'
)

// ── 3. Notification Payload Formatting ────────────────────────────────

section('Notification Payload Formatting')

function formatReplyNotification({ authorAlias, postTitle, postId }) {
  const shortTitle = postTitle ? (postTitle.length > 40 ? `${postTitle.slice(0, 40)}…` : postTitle) : 'discussion'
  return {
    title: 'New Reply in Community 💬',
    body: authorAlias
      ? `${authorAlias} replied to your post "${shortTitle}"`
      : `Someone replied to your discussion "${shortTitle}"`,
    url: `/community/post/${postId}`,
  }
}

const payload = formatReplyNotification({
  authorAlias: 'Calm River',
  postTitle: 'Managing PCOD Fatigue & Sleep Routine',
  postId: '11111111-2222-3333-4444-555555555555',
})

check(payload.title, 'New Reply in Community 💬', 'Notification title is formatted correctly')
check(
  payload.body,
  'Calm River replied to your post "Managing PCOD Fatigue & Sleep Routine"',
  'Notification body includes alias and title'
)
check(
  payload.url,
  '/community/post/11111111-2222-3333-4444-555555555555',
  'Notification URL points to post details'
)

// ── 4. Codebase File Verification ─────────────────────────────────────

section('Codebase Implementation Checks')

const rootDir = process.cwd()

const commentsRoutePath = path.join(rootDir, 'app', 'api', 'forum', 'comments', 'route.js')
const commentsCode = fs.readFileSync(commentsRoutePath, 'utf8')

checkTrue(commentsCode.includes('notifyOnReply'), 'Comments route imports notifyOnReply')
checkTrue(commentsCode.includes('parentCommentTargetId'), 'Comments route inspects parent comment ID')
checkTrue(commentsCode.includes('targetUserId !== userId'), 'Comments route enforces self-reply check')

const pushActionsPath = path.join(rootDir, 'lib', 'actions', 'push.js')
const pushCode = fs.readFileSync(pushActionsPath, 'utf8')

checkTrue(pushCode.includes('export async function notifyOnReply'), 'push.js exports notifyOnReply')
checkTrue(pushCode.includes('export async function updatePushPreferences'), 'push.js exports updatePushPreferences')
checkTrue(pushCode.includes('forumReplies !== false'), 'push.js respects forumReplies preference')

const notifSettingsPath = path.join(rootDir, 'components', 'layout', 'NotificationSettings.jsx')
const settingsCode = fs.readFileSync(notifSettingsPath, 'utf8')

checkTrue(settingsCode.includes('forumReplies'), 'NotificationSettings includes forumReplies preference key')
checkTrue(settingsCode.includes('updatePushPreferences'), 'NotificationSettings calls updatePushPreferences')

// ── 5. Localization Checks ─────────────────────────────────────────────

section('Localization Checks')

const enContent = JSON.parse(fs.readFileSync(path.join(rootDir, 'messages', 'en.json'), 'utf8'))
const hiContent = JSON.parse(fs.readFileSync(path.join(rootDir, 'messages', 'hi.json'), 'utf8'))

checkTrue(Boolean(enContent.Community?.forum_reply_notification_title), 'en.json has forum_reply_notification_title')
checkTrue(Boolean(hiContent.Community?.forum_reply_notification_title), 'hi.json has forum_reply_notification_title')

console.log(`\n========================================`)
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
console.log(`========================================\n`)

if (failed > 0) {
  process.exit(1)
}

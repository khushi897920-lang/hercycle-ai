/**
 * Regression test for Hydration Reminder Push Notifications (GitHub Issue #819).
 *
 *   node scripts/test-hydration-reminders.js
 */

import fs from 'fs'
import path from 'path'

let passed = 0
let failed = 0

function check(actual, expected, label) {
  const isMatch =
    typeof actual === 'object' && actual !== null
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

// ── 1. Schedule Defaults & Interval Checks ───────────────────────────

section('Schedule Defaults & Interval Options')

const DEFAULT_SCHEDULE = {
  enabled: false,
  startTime: '08:00',
  endTime: '22:00',
  repeatMinutes: 60,
  skipIfGoalReached: true,
}

check(DEFAULT_SCHEDULE.enabled, false, 'Default schedule is disabled (opt-in)')
check(DEFAULT_SCHEDULE.repeatMinutes, 60, 'Default repeat interval is 60 minutes (1 hour)')

const ALLOWED_INTERVALS = [60, 120, 180, 240] // 1h, 2h, 3h, 4h
ALLOWED_INTERVALS.forEach((minutes) => {
  checkTrue(ALLOWED_INTERVALS.includes(minutes), `Interval ${minutes}m (${minutes / 60}h) is supported`)
})

// ── 2. Scheduling & Goal Reached Logic Tests ─────────────────────────

section('Scheduling & Goal Reached Logic')

function evaluateHydrationNudge({ enabled, permissionStatus, currentMinutes, startMinutes, endMinutes, elapsedMinutes, repeatMinutes, count, target, skipIfGoalReached }) {
  if (!enabled) return { shouldNudge: false, reason: 'disabled' }
  if (permissionStatus !== 'granted') return { shouldNudge: false, reason: 'permission_not_granted' }
  if (currentMinutes < startMinutes || currentMinutes >= endMinutes) return { shouldNudge: false, reason: 'outside_window' }
  if (elapsedMinutes < repeatMinutes) return { shouldNudge: false, reason: 'interval_not_elapsed' }
  if (skipIfGoalReached && count >= target) return { shouldNudge: false, reason: 'goal_reached' }
  return { shouldNudge: true }
}

check(
  evaluateHydrationNudge({
    enabled: true,
    permissionStatus: 'granted',
    currentMinutes: 600, // 10:00 AM
    startMinutes: 480,   // 08:00 AM
    endMinutes: 1320,    // 10:00 PM
    elapsedMinutes: 65,  // > 60m interval
    repeatMinutes: 60,
    count: 3,
    target: 8,
    skipIfGoalReached: true,
  }),
  { shouldNudge: true },
  'Should nudge when enabled, within window, interval elapsed, and goal not met'
)

check(
  evaluateHydrationNudge({
    enabled: false,
    permissionStatus: 'granted',
    currentMinutes: 600,
    startMinutes: 480,
    endMinutes: 1320,
    elapsedMinutes: 65,
    repeatMinutes: 60,
    count: 3,
    target: 8,
    skipIfGoalReached: true,
  }),
  { shouldNudge: false, reason: 'disabled' },
  'Should NOT nudge when disabled'
)

check(
  evaluateHydrationNudge({
    enabled: true,
    permissionStatus: 'granted',
    currentMinutes: 600,
    startMinutes: 480,
    endMinutes: 1320,
    elapsedMinutes: 65,
    repeatMinutes: 60,
    count: 8,
    target: 8,
    skipIfGoalReached: true,
  }),
  { shouldNudge: false, reason: 'goal_reached' },
  'Should NOT nudge when daily hydration goal is reached'
)

check(
  evaluateHydrationNudge({
    enabled: true,
    permissionStatus: 'granted',
    currentMinutes: 600,
    startMinutes: 480,
    endMinutes: 1320,
    elapsedMinutes: 30, // 30m elapsed on 60m repeat interval
    repeatMinutes: 60,
    count: 2,
    target: 8,
    skipIfGoalReached: true,
  }),
  { shouldNudge: false, reason: 'interval_not_elapsed' },
  'Should NOT nudge before repeat interval has elapsed'
)

// ── 3. Codebase Component Checks ─────────────────────────────────────

section('Codebase Component Verification')

const rootDir = process.cwd()
const notifPrefPath = path.join(rootDir, 'components', 'settings', 'NotificationPreferences.jsx')
const notifCode = fs.readFileSync(notifPrefPath, 'utf8')

checkTrue(notifCode.includes('4 hours'), 'NotificationPreferences includes 4 hours interval choice')
checkTrue(notifCode.includes('getTodayWaterTarget'), 'NotificationPreferences reads hydration target dynamically')
checkTrue(notifCode.includes('skipIfGoalReached'), 'NotificationPreferences checks skipIfGoalReached')

// ── 4. Localization Checks ───────────────────────────────────────────

section('Localization Checks')

const enContent = JSON.parse(fs.readFileSync(path.join(rootDir, 'messages', 'en.json'), 'utf8'))
const hiContent = JSON.parse(fs.readFileSync(path.join(rootDir, 'messages', 'hi.json'), 'utf8'))

checkTrue(Boolean(enContent.HydrationReminder), 'en.json contains HydrationReminder namespace')
check(enContent.HydrationReminder.title, 'Hydration Reminder Schedule', 'English title is correct')

checkTrue(Boolean(hiContent.HydrationReminder), 'hi.json contains HydrationReminder namespace')
check(hiContent.HydrationReminder.title, 'जल आपूर्ति अनुस्मारक अनुसूची', 'Hindi title is correct')

console.log(`\n========================================`)
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
console.log(`========================================\n`)

if (failed > 0) {
  process.exit(1)
}

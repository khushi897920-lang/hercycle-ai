/**
 * scripts/test-rbac-permissions.js
 *
 * Integration test suite for Role-Based Access Control (RBAC) & Team Management.
 */

import assert from 'assert'
import {
  ROLES,
  PERMISSIONS,
  hasPermission,
  getTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  revokeMemberAccess,
  verifyRbacPermission,
} from '../lib/rbac.js'

function testPermissionMatrix() {
  console.log('Test 1: Role Permission Matrix Evaluation')

  // Viewer
  assert(hasPermission(ROLES.VIEWER, PERMISSIONS.VIEW_TELEMETRY), 'Viewer must view telemetry')
  assert(hasPermission(ROLES.VIEWER, PERMISSIONS.VIEW_LINEAGE), 'Viewer must view lineage')
  assert(!hasPermission(ROLES.VIEWER, PERMISSIONS.RUN_SWEEPS), 'Viewer must NOT run sweeps')
  assert(!hasPermission(ROLES.VIEWER, PERMISSIONS.CREATE_DATASETS), 'Viewer must NOT create datasets')
  assert(!hasPermission(ROLES.VIEWER, PERMISSIONS.MANAGE_TEAM), 'Viewer must NOT manage team')

  // Runner
  assert(hasPermission(ROLES.RUNNER, PERMISSIONS.VIEW_TELEMETRY), 'Runner must view telemetry')
  assert(hasPermission(ROLES.RUNNER, PERMISSIONS.RUN_SWEEPS), 'Runner must run sweeps')
  assert(hasPermission(ROLES.RUNNER, PERMISSIONS.RUN_EXPERIMENTS), 'Runner must run experiments')
  assert(!hasPermission(ROLES.RUNNER, PERMISSIONS.CREATE_DATASETS), 'Runner must NOT create datasets')
  assert(!hasPermission(ROLES.RUNNER, PERMISSIONS.MANAGE_TEAM), 'Runner must NOT manage team')

  // Editor
  assert(hasPermission(ROLES.EDITOR, PERMISSIONS.RUN_SWEEPS), 'Editor must run sweeps')
  assert(hasPermission(ROLES.EDITOR, PERMISSIONS.CREATE_DATASETS), 'Editor must create datasets')
  assert(hasPermission(ROLES.EDITOR, PERMISSIONS.CREATE_SWEEPS), 'Editor must create sweeps')
  assert(!hasPermission(ROLES.EDITOR, PERMISSIONS.MANAGE_TEAM), 'Editor must NOT manage team')

  // Admin
  assert(hasPermission(ROLES.ADMIN, PERMISSIONS.VIEW_TELEMETRY), 'Admin must view telemetry')
  assert(hasPermission(ROLES.ADMIN, PERMISSIONS.RUN_SWEEPS), 'Admin must run sweeps')
  assert(hasPermission(ROLES.ADMIN, PERMISSIONS.CREATE_DATASETS), 'Admin must create datasets')
  assert(hasPermission(ROLES.ADMIN, PERMISSIONS.MANAGE_TEAM), 'Admin must manage team')

  console.log('  ✓ Permission matrix tests passed.')
}

function testTeamManagementOperations() {
  console.log('\nTest 2: Team Member Operations (Invite, Role Update, Revoke)')

  const initialMembers = getTeamMembers()
  assert(initialMembers.length >= 4, 'Must have initial mock team members')

  // Invite member
  const testEmail = 'new.scientist@hercycle.ai'
  const invited = inviteTeamMember(testEmail, 'runner', 'admin@hercycle.ai')
  assert.strictEqual(invited.userEmail, testEmail)
  assert.strictEqual(invited.role, 'runner')
  assert.strictEqual(invited.status, 'pending')

  // Duplicate invite throws error
  assert.throws(() => inviteTeamMember(testEmail, 'editor'), /already a team member/)

  // Update role
  const updated = updateMemberRole(invited.userId, 'editor')
  assert.strictEqual(updated.role, 'editor')
  assert.strictEqual(updated.status, 'active')

  // Revoke member access
  const revoked = revokeMemberAccess(invited.userId)
  assert.strictEqual(revoked.userEmail, testEmail)

  // Verify member removed from directory
  const currentMembers = getTeamMembers()
  assert(!currentMembers.some((m) => m.userId === invited.userId), 'Member must be removed')

  console.log('  ✓ Team management operations passed.')
}

function testRbacMiddlewareVerification() {
  console.log('\nTest 3: RBAC Middleware Permission Guard Verification')

  // Mock Request with x-user-role header: 'viewer'
  const mockReqViewer = {
    headers: {
      get: (key) => (key.toLowerCase() === 'x-user-role' ? 'viewer' : null),
    },
  }


  // Viewer accessing telemetry -> allowed
  const viewerTeleCheck = verifyRbacPermission(mockReqViewer, PERMISSIONS.VIEW_TELEMETRY)
  assert.strictEqual(viewerTeleCheck.authorized, true)

  // Viewer attempting sweep trigger -> denied with 403 reason
  const viewerRunCheck = verifyRbacPermission(mockReqViewer, PERMISSIONS.RUN_SWEEPS)
  assert.strictEqual(viewerRunCheck.authorized, false)
  assert(viewerRunCheck.reason.includes('lacks required permission'))

  // Mock Request with x-user-role header: 'runner'
  const mockReqRunner = {
    headers: {
      get: (key) => (key.toLowerCase() === 'x-user-role' ? 'runner' : null),
    },
  }

  // Runner executing sweep -> allowed
  const runnerSweepCheck = verifyRbacPermission(mockReqRunner, PERMISSIONS.RUN_SWEEPS)
  assert.strictEqual(runnerSweepCheck.authorized, true)

  // Runner managing team -> denied
  const runnerTeamCheck = verifyRbacPermission(mockReqRunner, PERMISSIONS.MANAGE_TEAM)
  assert.strictEqual(runnerTeamCheck.authorized, false)

  console.log('  ✓ RBAC middleware verification passed.')
}

function runAllTests() {
  console.log('=== Running Role-Based Access Control (RBAC) Test Suite ===\n')
  testPermissionMatrix()
  testTeamManagementOperations()
  testRbacMiddlewareVerification()
  console.log('\n=== All RBAC Integration Tests Passed Successfully! ===')
}

runAllTests()

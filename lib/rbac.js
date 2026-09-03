/**
 * lib/rbac.js
 *
 * Role-Based Access Control (RBAC) engine for team collaboration in HerCycle AI.
 * Defines role entities (viewer, runner, editor, admin), maps permission sets,
 * and enforces route-level and API-level access verification.
 */

import crypto from 'crypto'

export const ROLES = {
  VIEWER: 'viewer',
  RUNNER: 'runner',
  EDITOR: 'editor',
  ADMIN: 'admin',
}

export const PERMISSIONS = {
  VIEW_TELEMETRY: 'VIEW_TELEMETRY',
  VIEW_LINEAGE: 'VIEW_LINEAGE',
  VIEW_SWEEPS: 'VIEW_SWEEPS',
  VIEW_TEAM: 'VIEW_TEAM',
  RUN_SWEEPS: 'RUN_SWEEPS',
  RUN_EXPERIMENTS: 'RUN_EXPERIMENTS',
  CREATE_DATASETS: 'CREATE_DATASETS',
  CREATE_SWEEPS: 'CREATE_SWEEPS',
  EDIT_MODELS: 'EDIT_MODELS',
  MANAGE_TEAM: 'MANAGE_TEAM',
}

export const ROLE_PERMISSIONS = {
  [ROLES.VIEWER]: new Set([
    PERMISSIONS.VIEW_TELEMETRY,
    PERMISSIONS.VIEW_LINEAGE,
    PERMISSIONS.VIEW_SWEEPS,
    PERMISSIONS.VIEW_TEAM,
  ]),
  [ROLES.RUNNER]: new Set([
    PERMISSIONS.VIEW_TELEMETRY,
    PERMISSIONS.VIEW_LINEAGE,
    PERMISSIONS.VIEW_SWEEPS,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.RUN_SWEEPS,
    PERMISSIONS.RUN_EXPERIMENTS,
  ]),
  [ROLES.EDITOR]: new Set([
    PERMISSIONS.VIEW_TELEMETRY,
    PERMISSIONS.VIEW_LINEAGE,
    PERMISSIONS.VIEW_SWEEPS,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.RUN_SWEEPS,
    PERMISSIONS.RUN_EXPERIMENTS,
    PERMISSIONS.CREATE_DATASETS,
    PERMISSIONS.CREATE_SWEEPS,
    PERMISSIONS.EDIT_MODELS,
  ]),
  [ROLES.ADMIN]: new Set([
    PERMISSIONS.VIEW_TELEMETRY,
    PERMISSIONS.VIEW_LINEAGE,
    PERMISSIONS.VIEW_SWEEPS,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.RUN_SWEEPS,
    PERMISSIONS.RUN_EXPERIMENTS,
    PERMISSIONS.CREATE_DATASETS,
    PERMISSIONS.CREATE_SWEEPS,
    PERMISSIONS.EDIT_MODELS,
    PERMISSIONS.MANAGE_TEAM,
  ]),
}

/**
 * Checks if a role possesses a required permission.
 *
 * @param {string} role User role ('viewer', 'runner', 'editor', 'admin')
 * @param {string} permission Permission string
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false
  const permissions = ROLE_PERMISSIONS[role.toLowerCase()]
  if (!permissions) return false
  return permissions.has(permission)
}

/**
 * In-memory mock team storage for development and offline testing.
 */
let MOCK_TEAM_MEMBERS = [
  {
    id: 'mem-admin-01',
    userId: 'user_admin_01',
    userEmail: 'admin@hercycle.ai',
    role: 'admin',
    status: 'active',
    invitedBy: 'system',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'mem-editor-01',
    userId: 'user_editor_01',
    userEmail: 'data.science@hercycle.ai',
    role: 'editor',
    status: 'active',
    invitedBy: 'admin@hercycle.ai',
    createdAt: '2026-08-10T10:00:00.000Z',
  },
  {
    id: 'mem-runner-01',
    userId: 'user_runner_01',
    userEmail: 'ml.runner@hercycle.ai',
    role: 'runner',
    status: 'active',
    invitedBy: 'admin@hercycle.ai',
    createdAt: '2026-08-15T14:30:00.000Z',
  },
  {
    id: 'mem-viewer-01',
    userId: 'user_viewer_01',
    userEmail: 'auditor@hercycle.ai',
    role: 'viewer',
    status: 'active',
    invitedBy: 'admin@hercycle.ai',
    createdAt: '2026-08-20T09:15:00.000Z',
  },
]

/**
 * Retrieves all members of the active team.
 */
export function getTeamMembers() {
  return [...MOCK_TEAM_MEMBERS]
}

/**
 * Invites a new team member.
 */
export function inviteTeamMember(email, role = 'viewer', invitedBy = 'admin@hercycle.ai') {
  const existing = MOCK_TEAM_MEMBERS.find((m) => m.userEmail.toLowerCase() === email.toLowerCase())
  if (existing) {
    throw new Error(`User ${email} is already a team member or has a pending invite`)
  }

  const newMember = {
    id: `mem-${Date.now().toString(36)}`,
    userId: `user_${Date.now().toString(36)}`,
    userEmail: email.toLowerCase().trim(),
    role: Object.values(ROLES).includes(role.toLowerCase()) ? role.toLowerCase() : 'viewer',
    status: 'pending',
    invitedBy,
    createdAt: new Date().toISOString(),
  }

  MOCK_TEAM_MEMBERS.push(newMember)
  return newMember
}

/**
 * Updates a team member's assigned role.
 */
export function updateMemberRole(userId, newRole) {
  const member = MOCK_TEAM_MEMBERS.find((m) => m.userId === userId || m.id === userId)
  if (!member) {
    throw new Error(`Team member with ID ${userId} not found`)
  }

  if (!Object.values(ROLES).includes(newRole.toLowerCase())) {
    throw new Error(`Invalid role: ${newRole}`)
  }

  member.role = newRole.toLowerCase()
  member.status = 'active'
  member.updatedAt = new Date().toISOString()
  return member
}

/**
 * Revokes a team member's access.
 */
export function revokeMemberAccess(userId) {
  const index = MOCK_TEAM_MEMBERS.findIndex((m) => m.userId === userId || m.id === userId)
  if (index === -1) {
    throw new Error(`Team member with ID ${userId} not found`)
  }

  const removed = MOCK_TEAM_MEMBERS.splice(index, 1)[0]
  return removed
}

/**
 * Verifies RBAC permission for a request context.
 * Inspects `x-user-role` header or session context, falling back to default admin role in dev setup.
 *
 * @param {Request} req Next.js Request object
 * @param {string} requiredPermission Permission string from PERMISSIONS
 * @returns {{ authorized: boolean, role: string, userId: string, reason?: string }}
 */
export function verifyRbacPermission(req, requiredPermission) {
  let userRole = 'admin' // Default single-tenant dev role

  if (req && req.headers) {
    const headerRole = req.headers.get('x-user-role')
    if (headerRole && Object.values(ROLES).includes(headerRole.toLowerCase())) {
      userRole = headerRole.toLowerCase()
    }
  }

  const authorized = hasPermission(userRole, requiredPermission)
  if (!authorized) {
    return {
      authorized: false,
      role: userRole,
      userId: 'anonymous',
      reason: `Role '${userRole}' lacks required permission '${requiredPermission}'`,
    }
  }

  return {
    authorized: true,
    role: userRole,
    userId: 'user_active',
  }
}

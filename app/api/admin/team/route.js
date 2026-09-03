import { NextResponse } from 'next/server'
import {
  getTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  revokeMemberAccess,
  verifyRbacPermission,
  PERMISSIONS,
} from '@/lib/rbac'

export async function GET(request) {
  const authCheck = verifyRbacPermission(request, PERMISSIONS.VIEW_TEAM)
  if (!authCheck.authorized) {
    return NextResponse.json({ success: false, error: authCheck.reason }, { status: 403 })
  }

  const members = getTeamMembers()
  return NextResponse.json({
    success: true,
    data: {
      teamName: 'HerCycle AI Engineering & ML Ops',
      currentUserRole: authCheck.role,
      members,
    },
  })
}

export async function POST(request) {
  const authCheck = verifyRbacPermission(request, PERMISSIONS.MANAGE_TEAM)
  if (!authCheck.authorized) {
    return NextResponse.json({ success: false, error: authCheck.reason }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { email, role } = body

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email address is required' }, { status: 400 })
    }

    const newMember = inviteTeamMember(email, role || 'viewer')
    return NextResponse.json({ success: true, data: newMember })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

export async function PATCH(request) {
  const authCheck = verifyRbacPermission(request, PERMISSIONS.MANAGE_TEAM)
  if (!authCheck.authorized) {
    return NextResponse.json({ success: false, error: authCheck.reason }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json({ success: false, error: 'User ID and new role are required' }, { status: 400 })
    }

    const updated = updateMemberRole(userId, role)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

export async function DELETE(request) {
  const authCheck = verifyRbacPermission(request, PERMISSIONS.MANAGE_TEAM)
  if (!authCheck.authorized) {
    return NextResponse.json({ success: false, error: authCheck.reason }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId search parameter is required' }, { status: 400 })
    }

    const removed = revokeMemberAccess(userId)
    return NextResponse.json({ success: true, message: `Revoked access for ${removed.userEmail}` })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

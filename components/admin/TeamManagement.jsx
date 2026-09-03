'use me'
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Shield,
  UserPlus,
  UserCheck,
  UserX,
  Mail,
  CheckCircle2,
  AlertCircle,
  Key,
  X,
  ChevronDown,
  Info
} from 'lucide-react'

const ROLE_BADGE_COLORS = {
  admin: { bg: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
  editor: { bg: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: 'rgba(99, 102, 241, 0.3)' },
  runner: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', border: 'rgba(245, 158, 11, 0.3)' },
  viewer: { bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' },
}

export default function TeamManagement() {
  const [teamName, setTeamName] = useState('HerCycle AI Engineering & ML Ops')
  const [currentUserRole, setCurrentUserRole] = useState('admin')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [notification, setNotification] = useState(null)
  const [simulatedRole, setSimulatedRole] = useState('admin')

  const fetchTeamMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/team', {
        headers: { 'x-user-role': simulatedRole },
      })
      const json = await res.json()

      if (json.success) {
        setTeamName(json.data.teamName)
        setCurrentUserRole(json.data.currentUserRole)
        setMembers(json.data.members || [])
      } else {
        setNotification({ type: 'error', text: json.error || 'Access denied' })
      }
    } catch (err) {
      console.error('Error fetching team members:', err)
      setNotification({ type: 'error', text: 'Network error loading team members' })
    } finally {
      setLoading(false)
    }
  }, [simulatedRole])

  useEffect(() => {
    fetchTeamMembers()
  }, [fetchTeamMembers])

  const handleInviteSubmit = async (e) => {
    e.preventDefault()
    if (!inviteEmail) return

    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': simulatedRole,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const json = await res.json()

      if (json.success) {
        setNotification({ type: 'success', text: `Invitation sent to ${inviteEmail} as ${inviteRole.toUpperCase()}` })
        setShowInviteModal(false)
        setInviteEmail('')
        await fetchTeamMembers()
      } else {
        setNotification({ type: 'error', text: json.error || 'Failed to send invitation' })
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Error inviting team member' })
    } finally {
      setTimeout(() => setNotification(null), 4000)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch('/api/admin/team', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': simulatedRole,
        },
        body: JSON.stringify({ userId, role: newRole }),
      })
      const json = await res.json()

      if (json.success) {
        setNotification({ type: 'success', text: `Updated user role to ${newRole.toUpperCase()}` })
        await fetchTeamMembers()
      } else {
        setNotification({ type: 'error', text: json.error || 'Failed to update role' })
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Error updating role' })
    } finally {
      setTimeout(() => setNotification(null), 4000)
    }
  }

  const handleRevoke = async (userId, email) => {
    if (!window.confirm(`Are you sure you want to revoke access for ${email}?`)) return

    try {
      const res = await fetch(`/api/admin/team?userId=${userId}`, {
        method: 'DELETE',
        headers: { 'x-user-role': simulatedRole },
      })
      const json = await res.json()

      if (json.success) {
        setNotification({ type: 'success', text: `Access revoked for ${email}` })
        await fetchTeamMembers()
      } else {
        setNotification({ type: 'error', text: json.error || 'Failed to revoke access' })
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Error revoking access' })
    } finally {
      setTimeout(() => setNotification(null), 4000)
    }
  }

  const isAdmin = currentUserRole === 'admin'

  return (
    <div className="glass-card team-management-card" style={{ marginTop: '2rem', padding: '1.75rem' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '9999px', marginBottom: '0.5rem' }}>
            <Shield size={14} />
            <span>Role-Based Access Control (RBAC)</span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            {teamName}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Manage team members, assign granular permissions, and control access to ML models and telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Simulation Role Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.8)', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.8rem' }}>
            <span style={{ color: '#94a3b8' }}>Test Role:</span>
            <select
              value={simulatedRole}
              onChange={(e) => setSimulatedRole(e.target.value)}
              style={{ background: 'transparent', color: '#38bdf8', border: 'none', fontWeight: 700, cursor: 'pointer', outline: 'none' }}
            >
              <option value="admin" style={{ background: '#0f172a' }}>Admin</option>
              <option value="editor" style={{ background: '#0f172a' }}>Editor</option>
              <option value="runner" style={{ background: '#0f172a' }}>Runner</option>
              <option value="viewer" style={{ background: '#0f172a' }}>Viewer</option>
            </select>
          </div>

          <button
            onClick={() => setShowInviteModal(true)}
            disabled={!isAdmin}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: isAdmin ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : '#334155',
              color: '#ffffff',
              border: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: isAdmin ? 'pointer' : 'not-allowed',
              opacity: isAdmin ? 1 : 0.6,
              boxShadow: isAdmin ? '0 4px 14px rgba(239, 68, 68, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <UserPlus size={16} /> Invite Member
          </button>
        </div>
      </div>

      {notification && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)',
            border: notification.type === 'error' ? '1px solid #ef4444' : '1px solid #34d399',
            color: notification.type === 'error' ? '#fca5a5' : '#6ee7b7'
          }}
        >
          {notification.text}
        </div>
      )}

      {/* Role Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase' }}>Admin</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>Full access & Team Management</div>
        </div>
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase' }}>Editor</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>Create Datasets & Sweeps</div>
        </div>
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase' }}>Runner</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>Run Sweeps & Experiments</div>
        </div>
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.25)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase' }}>Viewer</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>Read-only Telemetry & Lineage</div>
        </div>
      </div>

      {/* Team Members Directory Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="cm-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Member Email</th>
              <th>Status</th>
              <th>Assigned Role</th>
              <th>Joined Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map((mem) => {
              const badgeStyle = ROLE_BADGE_COLORS[mem.role] || ROLE_BADGE_COLORS.viewer
              return (
                <tr key={mem.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Mail size={14} color="#94a3b8" />
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{mem.userEmail}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        background: mem.status === 'active' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: mem.status === 'active' ? '#6ee7b7' : '#fcd34d'
                      }}
                    >
                      {mem.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {isAdmin ? (
                      <select
                        value={mem.role}
                        onChange={(e) => handleRoleChange(mem.userId, e.target.value)}
                        style={{
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: `1px solid ${badgeStyle.border}`,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="admin" style={{ background: '#0f172a' }}>ADMIN</option>
                        <option value="editor" style={{ background: '#0f172a' }}>EDITOR</option>
                        <option value="runner" style={{ background: '#0f172a' }}>RUNNER</option>
                        <option value="viewer" style={{ background: '#0f172a' }}>VIEWER</option>
                      </select>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontWeight: 700,
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: `1px solid ${badgeStyle.border}`
                        }}
                      >
                        {mem.role.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {new Date(mem.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      onClick={() => handleRevoke(mem.userId, mem.userEmail)}
                      disabled={!isAdmin}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: isAdmin ? 'pointer' : 'not-allowed',
                        opacity: isAdmin ? 1 : 0.5
                      }}
                    >
                      <UserX size={12} /> Revoke
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '480px', color: '#f8fafc', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>User Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@hercycle.ai"
                  className="filter-input"
                  style={{ width: '100%' }}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Assign Role</label>
                <select className="filter-select" style={{ width: '100%' }} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="viewer">Viewer (Read-only access)</option>
                  <option value="runner">Runner (Trigger experiments & sweeps)</option>
                  <option value="editor">Editor (Create datasets & sweeps)</option>
                  <option value="admin">Admin (Full access & Team Management)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#ffffff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

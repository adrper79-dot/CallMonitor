'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient'

interface TeamMember {
  id: string
  role: string
  created_at: string
  user: {
    id: string
    email: string
    phone?: string
    created_at: string
  }
}

interface PendingInvite {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

interface TeamManagementProps {
  organizationId: string | null
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-900/50 text-amber-300 border-amber-600',
  admin: 'bg-purple-900/50 text-purple-300 border-purple-600',
  operator: 'bg-blue-900/50 text-blue-300 border-blue-600',
  analyst: 'bg-green-900/50 text-green-300 border-green-600',
  viewer: 'bg-slate-700/50 text-slate-300 border-slate-600',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full access, billing, and team management',
  admin: 'Manage team, calls, and settings',
  operator: 'Make calls, view recordings, run campaigns',
  analyst: 'View recordings, transcripts, and analytics',
  viewer: 'View-only access to dashboards',
}

export default function TeamManagement({ organizationId }: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('operator')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchTeam()
  }, [organizationId])

  async function fetchTeam() {
    if (!organizationId) return

    try {
      setLoading(true)
      const data = await apiGet('/api/team/members')

      if (data.success) {
        setMembers(data.members || [])
        setPendingInvites(data.pending_invites || [])
        setCurrentUserId(data.current_user_id)
      } else {
        setError(data.error?.message || 'Failed to load team')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    setError(null)
    setInviteSuccess(null)

    try {
      const data = await apiPost('/api/team/invites', {
        email: inviteEmail.trim(),
        role: inviteRole,
      })

      if (data.success) {
        setInviteSuccess(`Invitation sent to ${inviteEmail}`)
        setInviteEmail('')
        setShowInviteForm(false)
        fetchTeam() // Refresh list
      } else {
        setError(data.error?.message || 'Failed to send invitation')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      const data = await apiPost('/api/team/members', {
        member_id: memberId,
        role: newRole,
      })

      if (data.success) {
        fetchTeam()
      } else {
        setError(data.error?.message || 'Failed to update role')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update role')
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this team member?')) return

    try {
      const data = await apiDelete(`/api/team/members/${memberId}`)

      if (data.success) {
        fetchTeam()
      } else {
        setError(data.error?.message || 'Failed to remove member')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove member')
    }
  }

  async function handleCancelInvite(inviteId: string) {
    try {
      const data = await apiDelete(`/api/team/invites/${inviteId}`)

      if (data.success) {
        fetchTeam()
      } else {
        setError(data.error?.message || 'Failed to cancel invitation')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel invitation')
    }
  }

  const currentUserRole = members.find((m) => m.user?.id === currentUserId)?.role
  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'admin'

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-slate-400 mt-4">Loading team...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span>👥</span> Team Management
          </h2>
          <p className="text-sm text-slate-400">
            {members.length} member{members.length !== 1 ? 's' : ''}
            {pendingInvites.length > 0 &&
              ` • ${pendingInvites.length} pending invite${pendingInvites.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {canManageTeam && (
          <Button onClick={() => setShowInviteForm(true)} className="bg-teal-600 hover:bg-teal-700">
            + Invite Member
          </Button>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {inviteSuccess && (
        <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm">
          {inviteSuccess}
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <form
          onSubmit={handleInvite}
          className="p-4 bg-slate-800/50 rounded-xl border border-slate-700"
        >
          <h3 className="font-medium text-white mb-4">Invite Team Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            >
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <p className="text-xs text-slate-500 mt-2">{ROLE_DESCRIPTIONS[inviteRole]}</p>
          <div className="flex gap-2 mt-4">
            <Button type="submit" disabled={inviting} className="bg-teal-600 hover:bg-teal-700">
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowInviteForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Members List */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="text-left p-4 text-xs text-slate-400 uppercase tracking-wide">
                Member
              </th>
              <th className="text-left p-4 text-xs text-slate-400 uppercase tracking-wide">Role</th>
              <th className="text-left p-4 text-xs text-slate-400 uppercase tracking-wide">
                Joined
              </th>
              {canManageTeam && (
                <th className="text-right p-4 text-xs text-slate-400 uppercase tracking-wide">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-slate-700/30">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center text-white font-bold">
                      {member.user?.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-white font-medium">{member.user?.email}</p>
                      {member.user?.id === currentUserId && (
                        <span className="text-xs text-teal-400">You</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  {canManageTeam && member.role !== 'owner' && member.user?.id !== currentUserId ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[member.role]} bg-transparent cursor-pointer`}
                    >
                      <option value="admin">Admin</option>
                      <option value="operator">Operator</option>
                      <option value="analyst">Analyst</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[member.role]}`}
                    >
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                  )}
                </td>
                <td className="p-4 text-sm text-slate-400">
                  {new Date(member.created_at).toLocaleDateString()}
                </td>
                {canManageTeam && (
                  <td className="p-4 text-right">
                    {member.role !== 'owner' && member.user?.id !== currentUserId && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Pending Invitations</h3>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">✉️</span>
                  <div>
                    <p className="text-white">{invite.email}</p>
                    <p className="text-xs text-slate-400">
                      Role: {invite.role} • Expires{' '}
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {canManageTeam && (
                  <button
                    onClick={() => handleCancelInvite(invite.id)}
                    className="text-slate-400 hover:text-red-400 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Legend */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
            <div key={role} className="text-center p-2">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[role]} mb-2`}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

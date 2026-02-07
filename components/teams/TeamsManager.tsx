'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/apiClient'

interface Team {
  id: string
  name: string
  description: string | null
  team_type: string
  manager_name: string | null
  manager_email: string | null
  member_count: number
  is_active: boolean
  created_at: string
}

interface TeamMember {
  id: string
  user_id: string
  name: string
  email: string
  team_role: string
  org_role: string
  joined_at: string
}

interface OrgMember {
  id: string
  user_id: string
  name: string
  email: string
  role: string
  created_at: string
}

export default function TeamsManager() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', description: '', team_type: 'department' })
  const [showAddMember, setShowAddMember] = useState(false)

  const loadTeams = useCallback(async () => {
    try {
      const data = await apiGet('/api/teams')
      setTeams(data.teams || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOrgMembers = useCallback(async () => {
    try {
      const data = await apiGet('/api/team/members')
      setOrgMembers(data.members || [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadTeams()
    loadOrgMembers()
  }, [loadTeams, loadOrgMembers])

  const loadTeamMembers = async (teamId: string) => {
    setSelectedTeam(teamId)
    try {
      const data = await apiGet(`/api/teams/${teamId}/members`)
      setTeamMembers(data.members || [])
    } catch {
      setTeamMembers([])
    }
  }

  const createTeam = async () => {
    if (!newTeam.name.trim()) return
    try {
      await apiPost('/api/teams', newTeam)
      setNewTeam({ name: '', description: '', team_type: 'department' })
      setShowCreateForm(false)
      loadTeams()
    } catch (err: any) {
      alert(err.message || 'Failed to create team')
    }
  }

  const deleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to deactivate this team?')) return
    try {
      await apiDelete(`/api/teams/${teamId}`)
      loadTeams()
      if (selectedTeam === teamId) {
        setSelectedTeam(null)
        setTeamMembers([])
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete team')
    }
  }

  const addMemberToTeam = async (userId: string, teamRole = 'member') => {
    if (!selectedTeam) return
    try {
      await apiPost(`/api/teams/${selectedTeam}/members`, { user_id: userId, team_role: teamRole })
      loadTeamMembers(selectedTeam)
      setShowAddMember(false)
    } catch (err: any) {
      alert(err.message || 'Failed to add member')
    }
  }

  const removeMemberFromTeam = async (userId: string) => {
    if (!selectedTeam) return
    try {
      await apiDelete(`/api/teams/${selectedTeam}/members/${userId}`)
      loadTeamMembers(selectedTeam)
    } catch (err: any) {
      alert(err.message || 'Failed to remove member')
    }
  }

  const TEAM_TYPE_LABELS: Record<string, string> = {
    department: '🏢 Department',
    squad: '👥 Squad',
    region: '🌍 Region',
    custom: '⚙️ Custom',
  }

  const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    compliance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    agent: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    lead: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    member: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    observer: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-500',
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const selectedTeamData = teams.find((t) => t.id === selectedTeam)
  const existingMemberIds = teamMembers.map((m) => m.user_id)
  const availableMembers = orgMembers.filter((m) => !existingMemberIds.includes(m.user_id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Teams & Departments
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Organize your team into departments and squads
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Create Team
        </button>
      </div>

      {/* Create team form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">New Team</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={newTeam.name}
              onChange={(e) => setNewTeam((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Team name"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <input
              value={newTeam.description}
              onChange={(e) => setNewTeam((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description (optional)"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <select
              value={newTeam.team_type}
              onChange={(e) => setNewTeam((prev) => ({ ...prev, team_type: e.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="department">Department</option>
              <option value="squad">Squad</option>
              <option value="region">Region</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createTeam}
              disabled={!newTeam.name.trim()}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Teams grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => loadTeamMembers(team.id)}
            className={`text-left p-4 rounded-xl border transition-all hover:shadow-md ${
              selectedTeam === team.id
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 ring-2 ring-blue-300'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {TEAM_TYPE_LABELS[team.team_type] || team.team_type}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{team.name}</h3>
                {team.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {team.description}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteTeam(team.id)
                }}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                title="Deactivate team"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
                {team.member_count} members
              </span>
              {team.manager_name && <span>Mgr: {team.manager_name}</span>}
            </div>
          </button>
        ))}

        {teams.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400 dark:text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
            <p className="text-sm">No teams created yet</p>
            <p className="text-xs mt-1">Create your first team to organize your members</p>
          </div>
        )}
      </div>

      {/* Team members detail */}
      {selectedTeam && selectedTeamData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {selectedTeamData.name} — Members
            </h3>
            <button
              onClick={() => setShowAddMember(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Member
            </button>
          </div>

          {/* Add member dropdown */}
          {showAddMember && (
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-xs text-gray-500 mb-2">Select an org member to add:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {availableMembers.length === 0 ? (
                  <p className="text-xs text-gray-400">All org members are already in this team</p>
                ) : (
                  availableMembers.map((m) => (
                    <button
                      key={m.user_id}
                      onClick={() => addMemberToTeam(m.user_id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm flex items-center justify-between transition-colors"
                    >
                      <div>
                        <span className="text-gray-900 dark:text-gray-100">
                          {m.name || m.email}
                        </span>
                        {m.name && <span className="text-gray-400 ml-2 text-xs">{m.email}</span>}
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] || ROLE_COLORS.viewer}`}
                      >
                        {m.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => setShowAddMember(false)}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Member list */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {teamMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No members yet</p>
              </div>
            ) : (
              teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-sm font-medium text-blue-700 dark:text-blue-300">
                      {(member.name || member.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {member.name || member.email}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[member.team_role] || ROLE_COLORS.member}`}
                    >
                      {member.team_role}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[member.org_role] || ROLE_COLORS.viewer}`}
                    >
                      {member.org_role}
                    </span>
                    <button
                      onClick={() => removeMemberFromTeam(member.user_id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Remove from team"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

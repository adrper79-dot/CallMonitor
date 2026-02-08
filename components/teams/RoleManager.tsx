'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/apiClient'

interface Member {
  id: string
  user_id: string
  name: string
  email: string
  role: string
  created_at: string
}

interface RoleManagerProps {
  className?: string
}

const ROLES = [
  {
    value: 'viewer',
    label: 'Viewer',
    level: 1,
    description: 'Read-only access to calls and reports',
  },
  {
    value: 'agent',
    label: 'Agent',
    level: 2,
    description: 'Can make/receive calls, view own data',
  },
  {
    value: 'manager',
    label: 'Manager',
    level: 3,
    description: 'Manage team, view all data, create reports',
  },
  {
    value: 'compliance',
    label: 'Compliance',
    level: 3,
    description: 'Audit access, scorecards, compliance reports',
  },
  {
    value: 'admin',
    label: 'Admin',
    level: 4,
    description: 'Full admin except org deletion/transfer',
  },
  {
    value: 'owner',
    label: 'Owner',
    level: 5,
    description: 'Full control including org management',
  },
]

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  compliance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  agent: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

export default function RoleManager({ className }: RoleManagerProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState('')

  const loadMembers = useCallback(async () => {
    try {
      const data = await apiGet('/api/team/members')
      setMembers(data.members || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const updateRole = async (userId: string, newRole: string) => {
    try {
      await apiPatch(`/api/teams/members/${userId}/role`, { role: newRole })
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m)))
      setEditingMember(null)
    } catch (err: any) {
      alert(err.message || 'Failed to update role')
    }
  }

  if (loading) {
    return <div className="animate-pulse h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
  }

  return (
    <div className={className || ''}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Role Management
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Assign roles to control access levels
          </p>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {ROLES.map((r) => (
          <div key={r.value} className="group relative">
            <span className={`text-xs px-2 py-1 rounded-full cursor-help ${ROLE_COLORS[r.value]}`}>
              {r.label} (L{r.level})
            </span>
            <div className="hidden group-hover:block absolute z-10 bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap shadow-lg">
              {r.description}
            </div>
          </div>
        ))}
      </div>

      {/* Members table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase">
                Member
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase">
                Current Role
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {members.map((member) => (
              <tr
                key={member.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-sm font-medium text-blue-700 dark:text-blue-300">
                      {(member.name || member.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {member.name || 'Unnamed'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[member.role] || ROLE_COLORS.viewer}`}
                  >
                    {member.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {editingMember === member.user_id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800"
                      >
                        <option value="">Select role...</option>
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => selectedRole && updateRole(member.user_id, selectedRole)}
                        disabled={!selectedRole}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg disabled:opacity-40 hover:bg-blue-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMember(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingMember(member.user_id)
                        setSelectedRole(member.role)
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Change role
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

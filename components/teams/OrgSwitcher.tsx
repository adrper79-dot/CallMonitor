'use client'

import React, { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/apiClient'

interface Org {
  id: string
  name: string
  plan: string | null
  plan_status: string | null
  role: string
  member_count: number
  joined_at: string
}

interface OrgSwitcherProps {
  currentOrgName?: string
  className?: string
  onSwitch?: (org: Org) => void
}

export default function OrgSwitcher({ currentOrgName, className, onSwitch }: OrgSwitcherProps) {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadOrgs()
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadOrgs = async () => {
    try {
      const data = await apiGet('/api/teams/my-orgs')
      setOrgs(data.organizations || [])
      setCurrentOrgId(data.current_org_id)
    } catch {
      /* ignore */
    }
  }

  const switchOrg = async (org: Org) => {
    if (org.id === currentOrgId) {
      setIsOpen(false)
      return
    }

    setLoading(true)
    try {
      const data = await apiPost('/api/teams/switch-org', { organization_id: org.id })
      if (data.success) {
        setCurrentOrgId(org.id)
        setIsOpen(false)
        onSwitch?.(org)
        // Reload the page to refresh all data with new org context
        window.location.reload()
      }
    } catch (err: any) {
      alert(err.message || 'Failed to switch organization')
    } finally {
      setLoading(false)
    }
  }

  // If user only belongs to one org, don't show the switcher
  if (orgs.length <= 1) {
    return null
  }

  const currentOrg = orgs.find((o) => o.id === currentOrgId)
  const displayName = currentOrg?.name || currentOrgName || 'Organization'

  const ROLE_BADGES: Record<string, string> = {
    owner: 'text-purple-600 dark:text-purple-400',
    admin: 'text-red-600 dark:text-red-400',
    manager: 'text-blue-600 dark:text-blue-400',
    compliance: 'text-amber-600 dark:text-amber-400',
    agent: 'text-green-600 dark:text-green-400',
    viewer: 'text-gray-500 dark:text-gray-400',
  }

  return (
    <div className={`relative ${className || ''}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
      >
        <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          {displayName[0]?.toUpperCase() || 'O'}
        </div>
        <span className="font-medium text-gray-900 dark:text-gray-100 max-w-[120px] truncate">
          {displayName}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Switch Organization
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => switchOrg(org)}
                disabled={loading}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                  org.id === currentOrgId
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {org.name[0]?.toUpperCase() || 'O'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {org.name}
                    </span>
                    {org.id === currentOrgId && (
                      <svg
                        className="w-4 h-4 text-blue-600 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-0.5">
                    <span className={ROLE_BADGES[org.role] || ROLE_BADGES.viewer}>{org.role}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-400">{org.member_count} members</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

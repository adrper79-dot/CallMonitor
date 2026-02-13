'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSession } from '@/components/AuthProvider'
import { FeatureFlagRedirect } from '@/components/layout/FeatureFlagRedirect'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import { logger } from '@/lib/logger'
import { apiGet } from '@/lib/apiClient'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TeamMember {
  id: string
  name: string
  email: string
  status: 'online' | 'calling' | 'idle' | 'offline'
  current_call_id?: string
  calls_today: number
  collections_today: number
  last_activity: string
}

interface TeamStats {
  total_members: number
  active_callers: number
  total_calls_today: number
  total_collections_today: number
  avg_call_duration: number
  team_efficiency: number
}

export default function ManagerDashboardPage() {
  const { data: session, status } = useSession()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string>('Your Organization')
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTeamData = useCallback(async () => {
    if (!organizationId) return

    try {
      setRefreshing(true)

      // Fetch team members and their current status
      const [membersRes, statsRes] = await Promise.all([
        apiGet('/api/manager/team-members'),
        apiGet('/api/manager/team-stats')
      ])

      if (membersRes.success) {
        setTeamMembers(membersRes.members || [])
      }

      if (statsRes.success) {
        setTeamStats(statsRes.stats)
      }
    } catch (error) {
      logger.error('Failed to fetch team data', error as Error)
    } finally {
      setRefreshing(false)
    }
  }, [organizationId])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!organizationId) return

    const interval = setInterval(() => {
      fetchTeamData()
    }, 30000)

    return () => clearInterval(interval)
  }, [organizationId, fetchTeamData])

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const orgId = session.user.organization_id
      if (!orgId) {
        setLoading(false)
        return
      }
      setOrganizationId(orgId)

      apiGet('/api/organizations/current')
        .then((data) => {
          setOrganizationId(data.organization?.id || orgId)
          setOrganizationName(data.organization?.name || 'Your Organization')
          setLoading(false)
          fetchTeamData()
        })
        .catch((err) => {
          logger.error('Failed to fetch organization data', err)
          setOrganizationId(orgId)
          setLoading(false)
          fetchTeamData()
        })
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
  }, [session, status, fetchTeamData])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800'
      case 'calling': return 'bg-blue-100 text-blue-800'
      case 'idle': return 'bg-yellow-100 text-yellow-800'
      case 'offline': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading manager dashboard...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session?.user) {
    return (
      <ProtectedGate
        title="Manager Dashboard"
        description="Please sign in to access the manager dashboard."
        redirectUrl="/manager"
      />
    )
  }

  // Check if user has manager role (this would be checked server-side in production)
  const userRole = session.user.role
  if (userRole !== 'manager' && userRole !== 'admin' && userRole !== 'owner') {
    return (
      <ProtectedGate
        title="Manager Dashboard"
        description="You need manager-level access to view this dashboard."
        redirectUrl="/dashboard"
      />
    )
  }

  return (
    <>
      <FeatureFlagRedirect to="/command" />
      {/* Page Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Manager Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Real-time team performance and activity monitoring
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchTeamData}
                disabled={refreshing}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {refreshing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
                ) : (
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Refresh
              </button>
              <span className="text-xs text-gray-500">
                Auto-updates every 30s
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Team Stats Overview */}
        {teamStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamStats.total_members}</div>
                <p className="text-xs text-muted-foreground">
                  {teamStats.active_callers} currently active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamStats.total_calls_today}</div>
                <p className="text-xs text-muted-foreground">
                  Avg duration: {formatDuration(teamStats.avg_call_duration)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collections Today</CardTitle>
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(teamStats.total_collections_today)}</div>
                <p className="text-xs text-muted-foreground">
                  Team efficiency: {teamStats.team_efficiency}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Callers</CardTitle>
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamStats.active_callers}</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round((teamStats.active_callers / teamStats.total_members) * 100)}% utilization
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Team Members Status */}
        <Card>
          <CardHeader>
            <CardTitle>Team Member Status</CardTitle>
            <p className="text-sm text-muted-foreground">
              Real-time status of all team members
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Badge className={getStatusColor(member.status)}>
                      {member.status}
                    </Badge>

                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {member.calls_today} calls
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(member.collections_today)}
                      </div>
                    </div>

                    {member.current_call_id && (
                      <div className="text-xs text-blue-600">
                        On call #{member.current_call_id.slice(-8)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {teamMembers.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No team members found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
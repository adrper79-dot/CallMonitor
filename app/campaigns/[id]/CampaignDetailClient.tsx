'use client'

/**
 * /campaigns/[id] — Campaign detail page with Predictive Dialer
 *
 * Shows campaign info, progress, call log, and integrates the
 * DialerPanel component for real-time dialer control.
 *
 * RBAC: All roles can view; Owner/Admin can start/stop dialer.
 * Tenant isolation: organization_id from session (never query params).
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/components/AuthProvider'
import { apiGet, apiPut } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { useRBAC } from '@/hooks/useRBAC'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DialerPanel } from '@/components/voice/DialerPanel'
import {
  ArrowLeft,
  Phone,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Loader2,
} from 'lucide-react'

interface CampaignDetail {
  id: string
  name: string
  description: string
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'canceled'
  call_flow_type: 'secret_shopper' | 'survey' | 'outbound' | 'test'
  total_targets: number
  calls_completed: number
  calls_successful: number
  calls_failed: number
  pacing_mode: string
  max_concurrent: number
  created_at: string
  updated_at: string
}

interface RecentCall {
  id: string
  target_name: string
  target_phone: string
  status: string
  duration_seconds: number
  outcome: string
  created_at: string
}

export default function CampaignDetailClient() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const campaignId = params?.id as string

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userId = (session?.user as any)?.id
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const { role } = useRBAC(organizationId)
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

  // Fetch organization ID
  const fetchOrganization = useCallback(async () => {
    if (!userId) return
    try {
      const data = await apiGet<{
        success: boolean
        organization: { id: string; name: string }
        role: string
      }>(`/api/users/${userId}/organization`)
      if (data.organization?.id) {
        setOrganizationId(data.organization.id)
      }
    } catch (err) {
      logger.error('Error fetching organization', err, { userId })
    }
  }, [userId])

  // Fetch campaign details
  const fetchCampaign = useCallback(async () => {
    if (!campaignId || campaignId === 'placeholder') return
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<{ campaign?: CampaignDetail; recent_calls?: RecentCall[] }>(
        `/api/campaigns/${campaignId}`
      )
      if (data.campaign) {
        setCampaign(data.campaign)
      } else {
        setError('Campaign not found')
      }
      if (data.recent_calls) {
        setRecentCalls(data.recent_calls)
      }
    } catch (err) {
      logger.error('Error fetching campaign', err, { campaignId })
      setError('Failed to load campaign details')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    if (userId) fetchOrganization()
  }, [userId, fetchOrganization])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  const getStatusBadge = (status: CampaignDetail['status']) => {
    const config: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-gray-500' },
      scheduled: { label: 'Scheduled', className: 'bg-blue-500' },
      active: { label: 'Active', className: 'bg-green-500 animate-pulse' },
      paused: { label: 'Paused', className: 'bg-yellow-500' },
      completed: { label: 'Completed', className: 'bg-emerald-600' },
      canceled: { label: 'Canceled', className: 'bg-red-500' },
    }
    const c = config[status] || config.draft
    return <Badge className={c.className}>{c.label}</Badge>
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  if (!session || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-500">Please sign in to view campaign details.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Button variant="ghost" onClick={() => router.push('/campaigns')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns
        </Button>
        <div className="rounded-lg bg-destructive/10 p-6 text-center">
          <XCircle className="mx-auto h-12 w-12 text-destructive mb-2" />
          <p className="text-sm text-destructive">{error || 'Campaign not found'}</p>
        </div>
      </div>
    )
  }

  const progressPct =
    campaign.total_targets > 0
      ? Math.round((campaign.calls_completed / campaign.total_targets) * 100)
      : 0

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/campaigns')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-900">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
            </div>
            {campaign.description && (
              <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
        </div>
        <Badge variant="secondary" className="capitalize">
          {campaign.call_flow_type.replace('_', ' ')}
        </Badge>
      </div>

      {/* Stats + Dialer side-by-side */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column — Stats cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress & Key Metrics */}
          <div className="grid sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Target className="h-3.5 w-3.5" /> Total Targets
                </div>
                <div className="text-2xl font-semibold">{campaign.total_targets}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Phone className="h-3.5 w-3.5" /> Completed
                </div>
                <div className="text-2xl font-semibold">{campaign.calls_completed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Successful
                </div>
                <div className="text-2xl font-semibold text-green-600">
                  {campaign.calls_successful}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Progress
                </div>
                <div className="text-2xl font-semibold">{progressPct}%</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Calls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Calls</CardTitle>
              <CardDescription>Latest call activity for this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {recentCalls.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Phone className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  No calls recorded yet
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {recentCalls.map((call) => (
                    <div
                      key={call.id}
                      className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-muted/50 border"
                    >
                      <div>
                        <span className="font-medium">{call.target_name || 'Unknown'}</span>
                        <span className="text-muted-foreground ml-2">{call.target_phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                        <Badge
                          variant={call.status === 'completed' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {call.outcome || call.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — Dialer Panel */}
        <div className="lg:col-span-1">
          {organizationId && (
            <DialerPanel
              campaignId={campaign.id}
              campaignName={campaign.name}
              organizationId={organizationId}
            />
          )}
        </div>
      </div>
    </div>
  )
}

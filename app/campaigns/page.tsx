'use client'

/**
 * Campaign Manager Page
 *
 * Bulk call campaign management UI
 * Features: List campaigns, create new, view details, execute
 * RBAC: All can view, Owner/Admin can manage
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiGet } from '@/lib/apiClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { Loader2, Plus, PlayCircle, PauseCircle, XCircle } from 'lucide-react'
import { logger } from '@/lib/logger'
import { useRBAC } from '@/hooks/useRBAC'

interface Campaign {
  id: string
  name: string
  description: string
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'canceled'
  call_flow_type: 'secret_shopper' | 'survey' | 'outbound' | 'test'
  total_targets: number
  calls_completed: number
  calls_successful: number
  created_at: string
}

export default function CampaignsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const userId = (session?.user as any)?.id
  const { role } = useRBAC(organizationId)
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

  const fetchOrganization = useCallback(async () => {
    try {
      const data = await apiGet<{
        success: boolean
        organization: { id: string; name: string; plan: string; plan_status: string }
        role: string
      }>(`/api/users/${userId}/organization`)
      if (data.organization?.id) {
        setOrganizationId(data.organization.id)
      } else {
        setError('Organization not found. Please contact support.')
      }
    } catch (err) {
      logger.error('Error fetching organization', err, { userId })
      setError('Failed to load organization. Please try again.')
    }
  }, [userId])

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<{ campaigns?: Campaign[] }>(
        `/api/campaigns?orgId=${organizationId}`
      )
      setCampaigns(data.campaigns || [])
    } catch (err) {
      logger.error('Error fetching campaigns', err, { organizationId })
      setError('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    if (userId) {
      fetchOrganization()
    }
  }, [userId, fetchOrganization])

  useEffect(() => {
    if (organizationId) {
      fetchCampaigns()
    }
  }, [organizationId, fetchCampaigns])

  const getStatusBadge = (status: Campaign['status']) => {
    const variants = {
      draft: { label: 'Draft', variant: 'secondary' as const },
      scheduled: { label: 'Scheduled', variant: 'default' as const },
      active: { label: 'Active', variant: 'success' as const },
      paused: { label: 'Paused', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'success' as const },
      canceled: { label: 'Canceled', variant: 'error' as const },
    }
    const config = variants[status]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (!session || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-500">Please sign in to access campaigns.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Campaign Manager</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage bulk call campaigns for secret shopper, surveys, and outbound calls
            </p>
          </div>
          {isOwnerOrAdmin && (
            <Button onClick={() => router.push('/campaigns/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          )}
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>View and manage your call campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12">
                <PlayCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-sm font-medium">No campaigns yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first campaign to get started
                </p>
                <Button onClick={() => router.push('/campaigns/new')} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow
                        key={campaign.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/campaigns/${campaign.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            {campaign.description && (
                              <p className="text-sm text-muted-foreground truncate max-w-md">
                                {campaign.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {campaign.call_flow_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">{campaign.calls_completed}</span>
                            <span className="text-muted-foreground">
                              {' '}
                              / {campaign.total_targets}
                            </span>
                          </div>
                          {campaign.total_targets > 0 && (
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div
                                className="bg-primary h-1.5 rounded-full"
                                style={{
                                  width: `${(campaign.calls_completed / campaign.total_targets) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(campaign.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/campaigns/${campaign.id}`)
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        {campaigns.length > 0 && (
          <div className="grid md:grid-cols-4 gap-4 mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-semibold">{campaigns.length}</div>
                <div className="text-sm text-muted-foreground">Total Campaigns</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-semibold">
                  {campaigns.filter((c) => c.status === 'active').length}
                </div>
                <div className="text-sm text-muted-foreground">Active</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-semibold">
                  {campaigns.reduce((sum, c) => sum + c.calls_completed, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Calls Completed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-semibold">
                  {campaigns.reduce((sum, c) => sum + c.calls_successful, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Successful Calls</div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  )
}

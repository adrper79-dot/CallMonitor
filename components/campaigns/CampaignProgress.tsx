/**
 * Real-time Campaign Progress Component
 * 
 * Uses Supabase Realtime to show live campaign execution progress
 * Subscribes to campaign_calls table changes
 * 
 * Features:
 * - Real-time progress updates
 * - Live call status changes
 * - Progress bar animation
 * - Status breakdown (pending, calling, completed, failed)
 * 
 * @module components/campaigns/CampaignProgress
 */

'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { logger } from '@/lib/logger'

interface CampaignProgressProps {
  campaignId: string
  initialStats?: CampaignStats
}

interface CampaignStats {
  total: number
  completed: number
  successful: number
  failed: number
  pending: number
  calling: number
}

export function CampaignProgress({ campaignId, initialStats }: CampaignProgressProps) {
  const [stats, setStats] = useState<CampaignStats>(
    initialStats || {
      total: 0,
      completed: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      calling: 0,
    }
  )
  const [isLive, setIsLive] = useState(false)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Fetch current stats
    fetchStats()

    // Subscribe to campaign_calls changes for this campaign
    const channel = supabase
      .channel(`campaign_calls:${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_calls',
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          console.log('Campaign call updated:', payload)
          setIsLive(true)
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId, supabase])

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/stats`, {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
      }
    } catch (error) {
      logger.error('Failed to fetch campaign stats', error, { campaignId })
    }
  }

  const progressPercentage = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0

  const successRate = stats.completed > 0
    ? Math.round((stats.successful / stats.completed) * 100)
    : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Campaign Progress</CardTitle>
            <CardDescription>Real-time execution status</CardDescription>
          </div>
          {isLive && stats.calling > 0 && (
            <Badge variant="default" className="bg-green-500">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Live
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">
              {stats.completed} / {stats.total} calls
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {progressPercentage}% complete
          </p>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Pending</span>
            </div>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 text-blue-500" />
              <span>Calling</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{stats.calling}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Answered</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{stats.successful}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
          </div>
        </div>

        {/* Success Rate */}
        {stats.completed > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Success Rate</span>
              <span className="text-lg font-bold text-green-600">
                {successRate}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {stats.completed} completed calls
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

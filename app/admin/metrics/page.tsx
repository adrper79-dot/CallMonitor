'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/components/AuthProvider'
import { useRBAC } from '@/hooks/useRBAC'
import { apiGet } from '@/lib/apiClient'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { RefreshCw, Users, DollarSign, Clock, Phone, Database } from 'lucide-react'

interface Metrics {
  timestamp: string
  active_calls: number
  total_orgs: number
  total_users: number
  mrr: number
  concurrent_sessions: number
  total_hours_30d: number
  total_calls_30d: number
}

export default function AdminMetricsPage() {
  const { data: session } = useSession()
  const organizationId = session?.user?.organization_id || null
  const { role } = useRBAC(organizationId)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAuthorized = role === 'owner'

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<Metrics>('/admin/metrics')
      setMetrics(data)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthorized) return
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 10000) // 10s realtime
    return () => clearInterval(interval)
  }, [isAuthorized])

  if (!isAuthorized) {
    return <div className="p-8 text-center text-destructive">Super-admin access required.</div>
  }

  if (error) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold">Platform Metrics</h1>
        <div className="text-destructive">{error}</div>
        <button
          onClick={fetchMetrics}
          className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <RefreshCw className="w-4 h-4 mr-2 h-4 w-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Metrics</h1>
          <p className="text-muted-foreground">Realtime dashboard. Refreshes every 10s.</p>
        </div>
        <Badge variant="secondary">
          Last update:{' '}
          {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'N/A'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : (metrics?.active_calls ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concurrent Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : (metrics?.concurrent_sessions ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orgs</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : (metrics?.total_orgs ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : (metrics?.total_users ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatCurrency((metrics?.mrr || 0) * 100)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Call Hours (30d)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatNumber(metrics?.total_hours_30d ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

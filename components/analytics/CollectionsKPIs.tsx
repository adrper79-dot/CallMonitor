'use client'

/**
 * CollectionsKPIs — Collections-specific KPI dashboard
 *
 * Contact rate, right-party contact rate, promise-to-pay rate,
 * $collected vs $assigned, aging buckets, and daily trends.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign, Users, PhoneCall, Handshake,
  TrendingUp, TrendingDown, Clock, Layers,
} from 'lucide-react'

interface KPIData {
  total_assigned: number
  total_collected: number
  recovery_rate: number
  contact_rate: number
  rpc_rate: number
  ptp_rate: number
  ptp_kept_rate: number
  avg_handle_time: number
  calls_today: number
  contacts_today: number
  collected_today: number
  aging_buckets: AgingBucket[]
  daily_trend: DailyPoint[]
}

interface AgingBucket {
  label: string
  count: number
  balance: number
  pct: number
}

interface DailyPoint {
  date: string
  collected: number
  contacts: number
  calls: number
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

const DEFAULT_AGING: AgingBucket[] = [
  { label: '0-30', count: 0, balance: 0, pct: 0 },
  { label: '31-60', count: 0, balance: 0, pct: 0 },
  { label: '61-90', count: 0, balance: 0, pct: 0 },
  { label: '91-120', count: 0, balance: 0, pct: 0 },
  { label: '120+', count: 0, balance: 0, pct: 0 },
]

function KPICard({ label, value, sub, icon, trend }: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | null
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
          </div>
          <div className="flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
            {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CollectionsKPIs() {
  const [data, setData] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')

  const fetchKPIs = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, agingRes] = await Promise.all([
        apiGet(`/api/collections/stats?period=${period}`),
        apiGet('/api/collections/aging'),
      ])
      const s = statsRes.stats || statsRes.data || statsRes
      setData({
        total_assigned: parseFloat(s.total_balance_due || s.total_assigned || 0),
        total_collected: parseFloat(s.total_recovered || s.total_collected || 0),
        recovery_rate: parseFloat(s.recovery_rate || 0) / 100,
        contact_rate: parseFloat(s.contact_rate || 0) / 100,
        rpc_rate: parseFloat(s.rpc_rate || 0) / 100,
        ptp_rate: parseFloat(s.ptp_rate || 0) / 100,
        ptp_kept_rate: parseFloat(s.ptp_kept_rate || 0) / 100,
        avg_handle_time: s.avg_handle_time || 0,
        calls_today: s.calls_today || s.total_calls || 0,
        contacts_today: s.contacts_today || 0,
        collected_today: parseFloat(s.collected_today || 0),
        aging_buckets: agingRes.buckets || agingRes.data || DEFAULT_AGING,
        daily_trend: s.daily_trend || [],
      })
    } catch (err: any) {
      logger.error('Failed to fetch collections KPIs', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchKPIs() }, [fetchKPIs])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No collections data available</p>
        </CardContent>
      </Card>
    )
  }

  const maxAgingBalance = Math.max(...data.aging_buckets.map((b) => b.balance), 1)

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Collections Performance</h3>
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPIs: Money */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total Assigned"
          value={fmt(data.total_assigned)}
          icon={<DollarSign className="w-4 h-4 text-gray-600" />}
        />
        <KPICard
          label="Total Collected"
          value={fmt(data.total_collected)}
          sub={`${pct(data.recovery_rate)} recovery`}
          icon={<DollarSign className="w-4 h-4 text-green-600" />}
          trend={data.recovery_rate > 0.15 ? 'up' : data.recovery_rate < 0.05 ? 'down' : null}
        />
        <KPICard
          label="Collected Today"
          value={fmt(data.collected_today)}
          icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
        />
        <KPICard
          label="Calls Today"
          value={data.calls_today.toLocaleString()}
          sub={`${data.contacts_today} contacts`}
          icon={<PhoneCall className="w-4 h-4 text-purple-600" />}
        />
      </div>

      {/* Secondary KPIs: Rates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Contact Rate"
          value={pct(data.contact_rate)}
          sub="Reached / Dialed"
          icon={<Users className="w-4 h-4 text-blue-600" />}
        />
        <KPICard
          label="RPC Rate"
          value={pct(data.rpc_rate)}
          sub="Right-Party Contacts"
          icon={<PhoneCall className="w-4 h-4 text-indigo-600" />}
        />
        <KPICard
          label="PTP Rate"
          value={pct(data.ptp_rate)}
          sub="Promise to Pay"
          icon={<Handshake className="w-4 h-4 text-emerald-600" />}
        />
        <KPICard
          label="PTP Kept"
          value={pct(data.ptp_kept_rate)}
          sub="Promises honored"
          icon={<Handshake className="w-4 h-4 text-teal-600" />}
          trend={data.ptp_kept_rate > 0.6 ? 'up' : data.ptp_kept_rate < 0.3 ? 'down' : null}
        />
      </div>

      {/* Aging Buckets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            Aging Buckets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.aging_buckets.map((bucket) => (
              <div key={bucket.label} className="flex items-center gap-3">
                <div className="w-16 text-xs font-medium text-gray-600 dark:text-gray-400">{bucket.label} days</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          bucket.label === '120+' ? 'bg-red-500' :
                          bucket.label === '91-120' ? 'bg-orange-500' :
                          bucket.label === '61-90' ? 'bg-yellow-500' :
                          bucket.label === '31-60' ? 'bg-blue-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(bucket.balance / maxAgingBalance) * 100}%` }}
                      />
                    </div>
                    <div className="w-20 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                      {fmt(bucket.balance)}
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {bucket.count} accts
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily Trend (simple sparkline bars) */}
      {data.daily_trend.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              Daily Collections Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24">
              {data.daily_trend.slice(-14).map((d) => {
                const maxCol = Math.max(...data.daily_trend.map((p) => p.collected), 1)
                const h = (d.collected / maxCol) * 100
                return (
                  <div
                    key={d.date}
                    className="flex-1 bg-green-500 dark:bg-green-600 rounded-t hover:bg-green-600 transition-colors cursor-default"
                    style={{ height: `${Math.max(h, 2)}%` }}
                    title={`${d.date}: ${fmt(d.collected)} | ${d.calls} calls`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>{data.daily_trend[Math.max(data.daily_trend.length - 14, 0)]?.date}</span>
              <span>{data.daily_trend[data.daily_trend.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

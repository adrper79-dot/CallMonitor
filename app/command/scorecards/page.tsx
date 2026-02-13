'use client'

/**
 * /command/scorecards — Agent compliance & performance scorecards
 *
 * Reuses existing ScorecardAlerts, ScorecardTemplateLibrary, ScoreView.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle,
  RefreshCw, User, ChevronDown, ChevronUp,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const ScorecardAlerts = dynamic(() => import('@/components/voice/ScorecardAlerts'), { ssr: false })

interface AgentScore {
  agent_id: string
  agent_name: string
  total_score: number
  compliance_score: number
  quality_score: number
  efficiency_score: number
  calls_reviewed: number
  violations: number
  trend: 'up' | 'down' | 'stable'
}

export default function ScorecardsPage() {
  const { data: session } = useSession()
  const [scores, setScores] = useState<AgentScore[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'total_score' | 'compliance_score' | 'violations'>('total_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return
    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => { if (data.organization?.id) setOrgId(data.organization.id) })
      .catch((err: any) => logger.error('Failed to load org for scorecards', err))
  }, [session])

  const fetchScores = useCallback(async () => {
    try {
      const res = await apiGet('/api/scorecards?include=summary')
      const data = res.data || res.scorecards || []
      setScores(
        data.map((s: any) => ({
          agent_id: s.agent_id || s.id,
          agent_name: s.agent_name || s.name || 'Agent',
          total_score: s.total_score || s.score || 0,
          compliance_score: s.compliance_score || 0,
          quality_score: s.quality_score || 0,
          efficiency_score: s.efficiency_score || 0,
          calls_reviewed: s.calls_reviewed || 0,
          violations: s.violations || 0,
          trend: s.trend || 'stable',
        }))
      )
    } catch (err: any) {
      logger.error('Failed to fetch scorecards', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchScores() }, [fetchScores])

  const toggle = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('desc') }
  }

  const sorted = [...scores].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1
    return mul * ((a[sortField] as number) - (b[sortField] as number))
  })

  const avgScore = scores.length ? Math.round(scores.reduce((s, a) => s + a.total_score, 0) / scores.length) : 0
  const totalViolations = scores.reduce((s, a) => s + a.violations, 0)

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Scorecards</h1>
          <p className="text-sm text-gray-500 mt-0.5">Agent compliance & quality scores</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchScores} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Avg Score</p>
            <p className={`text-3xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Agents Reviewed</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{scores.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Violations</p>
            <p className="text-3xl font-bold text-red-600">{totalViolations}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <ScorecardAlerts organizationId={orgId} />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Agent</th>
                  <th
                    className="text-right py-3 px-4 text-xs font-medium text-gray-500 cursor-pointer select-none"
                    onClick={() => toggle('total_score')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Overall
                      {sortField === 'total_score' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </span>
                  </th>
                  <th
                    className="text-right py-3 px-4 text-xs font-medium text-gray-500 cursor-pointer select-none"
                    onClick={() => toggle('compliance_score')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Compliance
                      {sortField === 'compliance_score' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Quality</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Efficiency</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Reviewed</th>
                  <th
                    className="text-right py-3 px-4 text-xs font-medium text-gray-500 cursor-pointer select-none"
                    onClick={() => toggle('violations')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Violations
                      {sortField === 'violations' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </span>
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">Trend</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="py-3 px-4">
                        <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500 text-sm">
                      No scorecard data available
                    </td>
                  </tr>
                ) : (
                  sorted.map((agent) => (
                    <tr key={agent.agent_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-gray-500" />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{agent.agent_name}</span>
                        </div>
                      </td>
                      <td className={`py-2.5 px-4 text-right font-bold ${getScoreColor(agent.total_score)}`}>{agent.total_score}</td>
                      <td className={`py-2.5 px-4 text-right ${getScoreColor(agent.compliance_score)}`}>{agent.compliance_score}</td>
                      <td className={`py-2.5 px-4 text-right ${getScoreColor(agent.quality_score)}`}>{agent.quality_score}</td>
                      <td className={`py-2.5 px-4 text-right ${getScoreColor(agent.efficiency_score)}`}>{agent.efficiency_score}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-400">{agent.calls_reviewed}</td>
                      <td className="py-2.5 px-4 text-right">
                        {agent.violations > 0 ? (
                          <Badge className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">{agent.violations}</Badge>
                        ) : (
                          <Badge className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">0</Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {agent.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500 mx-auto" />}
                        {agent.trend === 'down' && <TrendingUp className="w-4 h-4 text-red-500 mx-auto rotate-180" />}
                        {agent.trend === 'stable' && <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

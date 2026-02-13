'use client'

/**
 * /campaigns/surveys — Post-call survey management
 *
 * Create and manage automated post-call CSAT/NPS surveys.
 * Results feed into agent scorecards and compliance metrics.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MessageSquare, RefreshCw, Plus, BarChart3,
  Star, TrendingUp, Users,
} from 'lucide-react'

interface Survey {
  id: string
  name: string
  type: 'csat' | 'nps' | 'custom'
  status: 'active' | 'paused' | 'draft'
  responses: number
  avg_score: number
  created_at: string
}

const typeColors: Record<string, string> = {
  csat: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20',
  nps: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20',
  custom: 'bg-gray-50 text-gray-600 dark:bg-gray-800',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-50 text-green-700 dark:bg-green-900/20',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20',
  draft: 'bg-gray-50 text-gray-600 dark:bg-gray-800',
}

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSurveys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/campaigns/surveys?limit=50')
      const data = res.data || res.surveys || []
      setSurveys(data.map((s: any) => ({
        id: s.id,
        name: s.name || s.title || 'Untitled Survey',
        type: s.type || 'csat',
        status: s.status || 'draft',
        responses: s.responses || s.response_count || 0,
        avg_score: s.avg_score || s.average_rating || 0,
        created_at: s.created_at,
      })))
    } catch (err: any) {
      logger.warn('Surveys endpoint not available', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSurveys() }, [fetchSurveys])

  const totalResponses = surveys.reduce((s, sv) => s + sv.responses, 0)
  const avgOverall = surveys.length > 0
    ? (surveys.reduce((s, sv) => s + sv.avg_score * sv.responses, 0) / Math.max(totalResponses, 1)).toFixed(1)
    : '0'

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Surveys</h1>
          </div>
          <p className="text-sm text-gray-500">Post-call CSAT &amp; NPS survey management</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          New Survey
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Surveys</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{surveys.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Active</p>
          <p className="text-2xl font-bold text-green-600">{surveys.filter((s) => s.status === 'active').length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Responses</p>
          <p className="text-2xl font-bold text-purple-600">{totalResponses}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Avg Score</p>
          <p className="text-2xl font-bold text-amber-600">{avgOverall}</p>
        </CardContent></Card>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))
        ) : surveys.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No surveys yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first post-call survey to start collecting feedback</p>
          </div>
        ) : (
          surveys.map((survey) => (
            <Card key={survey.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-50 dark:bg-purple-900/20 text-purple-600">
                    {survey.type === 'nps' ? <TrendingUp className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{survey.name}</span>
                      <Badge className={`text-[10px] ${typeColors[survey.type]}`}>{survey.type.toUpperCase()}</Badge>
                      <Badge className={`text-[10px] ${statusColors[survey.status]}`}>{survey.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {survey.responses} responses</span>
                      <span className="flex items-center gap-0.5"><Star className="w-3 h-3" /> {survey.avg_score} avg</span>
                      <span>Created {new Date(survey.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Results
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface SentimentScore {
  segment_index: number
  score: number
  objections: string[]
  escalation_recommended: boolean
  created_at: string
}

interface SentimentSummary {
  avg_score: number
  min_score: number
  max_score: number
  total_segments: number
  objection_count: number
  escalation_triggered: boolean
  escalation_triggered_at: string | null
}

interface SentimentWidgetProps {
  callId: string
  isActive: boolean
}

/** Score → color mapping */
function scoreColor(score: number): string {
  if (score >= 0.3) return 'text-green-500'
  if (score >= -0.2) return 'text-yellow-500'
  return 'text-red-500'
}

function scoreBg(score: number): string {
  if (score >= 0.3) return 'bg-green-500/10 border-green-500/30'
  if (score >= -0.2) return 'bg-yellow-500/10 border-yellow-500/30'
  return 'bg-red-500/10 border-red-500/30'
}

function scoreLabel(score: number): string {
  if (score >= 0.5) return 'Very Positive'
  if (score >= 0.2) return 'Positive'
  if (score >= -0.2) return 'Neutral'
  if (score >= -0.5) return 'Negative'
  return 'Very Negative'
}

function scoreEmoji(score: number): string {
  if (score >= 0.3) return '😊'
  if (score >= -0.2) return '😐'
  return '😠'
}

/**
 * SentimentWidget — Real-time sentiment gauge for active calls.
 *
 * Polls /api/sentiment/live/:callId every 3 seconds during active calls.
 * Displays current sentiment score, trend graph, and objection alerts.
 *
 * Professional Design System v3.0
 */
export function SentimentWidget({ callId, isActive }: SentimentWidgetProps) {
  const [scores, setScores] = useState<SentimentScore[]>([])
  const [summary, setSummary] = useState<SentimentSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const lastIndexRef = useRef(-1)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isActive || !callId) return

    const poll = async () => {
      try {
        const afterParam = lastIndexRef.current >= 0 ? `?after=${lastIndexRef.current}` : ''
        const res = await apiGet<any>(`/api/sentiment/live/${callId}${afterParam}`)
        if (res?.scores?.length > 0) {
          setScores((prev) => [...prev, ...res.scores])
          lastIndexRef.current = Math.max(...res.scores.map((s: SentimentScore) => s.segment_index))
        }
      } catch (err: any) {
        logger.warn('Sentiment poll error', { error: err?.message })
      }
    }

    poll() // Initial fetch
    pollRef.current = setInterval(poll, 3000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [callId, isActive])

  // Fetch summary on mount and when call ends
  useEffect(() => {
    if (!callId) return
    apiGet<any>(`/api/sentiment/summary/${callId}`)
      .then((res) => {
        if (res?.summary) setSummary(res.summary)
      })
      .catch(() => {})
  }, [callId, isActive])

  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null
  const currentScore = latestScore?.score ?? summary?.avg_score ?? 0
  const recentObjections = scores.filter((s) => s.objections?.length > 0).slice(-3)

  return (
    <div className={`rounded-xl border p-4 transition-all ${scoreBg(currentScore)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{scoreEmoji(currentScore)}</span>
          <h3 className="font-semibold text-sm">Sentiment Analysis</h3>
          {isActive && (
            <Badge variant="info" className="text-xs animate-pulse">
              LIVE
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs"
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </Button>
      </div>

      {/* Current score */}
      <div className="flex items-center gap-4 mb-3">
        <div className={`text-3xl font-bold ${scoreColor(currentScore)}`}>
          {currentScore.toFixed(2)}
        </div>
        <div className="text-sm text-muted-foreground">
          <div className={scoreColor(currentScore)}>{scoreLabel(currentScore)}</div>
          <div>{scores.length} segments analyzed</div>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Trend mini-chart (text-based) */}
          {scores.length > 1 && (
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Trend</div>
              <div className="flex items-end gap-0.5 h-8">
                {scores.slice(-20).map((s, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t transition-all ${
                      s.score >= 0.3
                        ? 'bg-green-500'
                        : s.score >= -0.2
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                    style={{
                      height: `${Math.max(4, ((s.score + 1) / 2) * 100)}%`,
                    }}
                    title={`Segment ${s.segment_index}: ${s.score.toFixed(2)}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Objection alerts */}
          {recentObjections.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-red-500">⚠️ Objections Detected</div>
              {recentObjections.map((s, i) => (
                <div
                  key={i}
                  className="text-xs bg-red-500/10 rounded px-2 py-1 border border-red-500/20"
                >
                  {s.objections.join(', ')}
                </div>
              ))}
            </div>
          )}

          {/* Escalation alert */}
          {(latestScore?.escalation_recommended || summary?.escalation_triggered) && (
            <div className="mt-2 p-2 bg-red-500/20 border border-red-500/40 rounded-lg text-xs text-red-600 font-medium">
              🚨 Escalation Recommended — Consider transferring to a supervisor
            </div>
          )}

          {/* Summary stats */}
          {summary && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <div className="font-medium">Avg</div>
                <div className={scoreColor(summary.avg_score)}>
                  {Number(summary.avg_score).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="font-medium">Min</div>
                <div className={scoreColor(summary.min_score)}>
                  {Number(summary.min_score).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="font-medium">Objections</div>
                <div>{summary.objection_count}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

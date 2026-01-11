"use client"

import React from 'react'
import { Badge } from '@/components/ui/badge'

export interface ScoreViewProps {
  score: {
    score: number
    scorecard_id: string | null
    breakdown: any
  }
}

export default function ScoreView({ score }: ScoreViewProps) {
  const scoreValue = score.score
  const breakdown = score.breakdown || {}
  const scorecardId = score.scorecard_id

  const scoreVariant = 
    scoreValue >= 80 ? 'success' :
    scoreValue >= 60 ? 'warning' :
    'error'

  const scoreLabel = 
    scoreValue >= 90 ? 'Excellent' :
    scoreValue >= 80 ? 'Good' :
    scoreValue >= 70 ? 'Fair' :
    scoreValue >= 60 ? 'Needs Improvement' :
    'Poor'

  return (
    <section aria-labelledby="score-view" className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 id="score-view" className="text-lg font-medium text-slate-100">
          Call Score
        </h4>
        {scorecardId && (
          <Badge variant="info">Scorecard: {scorecardId}</Badge>
        )}
      </div>

      <div className="p-6 bg-slate-900 rounded-md border border-slate-800 text-center">
        <div className="text-4xl font-bold text-slate-100 mb-2">{scoreValue}%</div>
        <Badge variant={scoreVariant} className="text-lg px-4 py-1">
          {scoreLabel}
        </Badge>
      </div>

      {Object.keys(breakdown).length > 0 && (
        <div className="p-4 bg-slate-900 rounded-md border border-slate-800">
          <div className="text-sm font-medium text-slate-100 mb-4">Score Breakdown</div>
          <div className="space-y-3">
            {Object.entries(breakdown).map(([key, value]: [string, any]) => {
              const itemScore = typeof value === 'number' ? value : value?.score || 0
              const itemVariant = 
                itemScore >= 80 ? 'success' :
                itemScore >= 60 ? 'warning' :
                'error'
              
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-slate-100">{key}</div>
                    {typeof value === 'object' && value?.notes && (
                      <div className="text-xs text-slate-400 mt-1">{value.notes}</div>
                    )}
                  </div>
                  <Badge variant={itemVariant}>{itemScore}%</Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {scorecardId && (
        <div className="p-4 bg-slate-900 rounded-md border border-slate-800">
          <div className="text-sm font-medium text-slate-100 mb-2">Scorecard Information</div>
          <div className="text-xs text-slate-400">
            This score was calculated using scorecard: <code className="text-slate-200">{scorecardId}</code>
          </div>
        </div>
      )}
    </section>
  )
}

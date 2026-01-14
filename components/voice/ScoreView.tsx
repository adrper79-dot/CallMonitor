"use client"

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/tableau/ProgressBar'

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

  const scoreColor = 
    scoreValue >= 80 ? 'green' :
    scoreValue >= 60 ? 'orange' :
    'red'

  const scoreLabel = 
    scoreValue >= 90 ? 'Excellent' :
    scoreValue >= 80 ? 'Good' :
    scoreValue >= 70 ? 'Fair' :
    scoreValue >= 60 ? 'Needs Improvement' :
    'Poor'

  return (
    <section aria-labelledby="score-view" className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 id="score-view" className="text-base font-semibold text-[#333333]">
          Call Score
        </h4>
        {scorecardId && (
          <Badge variant="info" aria-label={`Scorecard: ${scorecardId}`}>
            Scorecard: {scorecardId}
          </Badge>
        )}
      </div>

      <div className="p-6 bg-white border border-[#E5E5E5] rounded text-center">
        <div className="text-4xl font-semibold text-[#333333] mb-3 tabular-nums">{scoreValue}%</div>
        <Badge variant={scoreValue >= 80 ? 'success' : scoreValue >= 60 ? 'warning' : 'error'} className="text-base px-4 py-1.5">
          {scoreLabel}
        </Badge>
      </div>

      {Object.keys(breakdown).length > 0 && (
        <div className="p-5 bg-white border border-[#E5E5E5] rounded">
          <div className="text-sm font-semibold text-[#333333] mb-4">Score Breakdown</div>
          <div className="space-y-4">
            {Object.entries(breakdown).map(([key, value]: [string, any]) => {
              const itemScore = typeof value === 'number' ? value : value?.score || 0
              const itemColor = 
                itemScore >= 80 ? 'green' :
                itemScore >= 60 ? 'orange' :
                'red'
              
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#333333]">{key}</div>
                      {typeof value === 'object' && value?.notes && (
                        <div className="text-xs text-[#666666] mt-0.5">{value.notes}</div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-[#333333] tabular-nums ml-4">{itemScore}%</span>
                  </div>
                  <ProgressBar value={itemScore} color={itemColor} showValue={false} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {scorecardId && (
        <div className="p-4 bg-white border border-[#E5E5E5] rounded">
          <div className="text-sm font-semibold text-[#333333] mb-2">Scorecard Information</div>
          <div className="text-xs text-[#666666]">
            This score was calculated using scorecard: <code className="text-[#333333] font-mono bg-[#FAFAFA] px-1 py-0.5 rounded">{scorecardId}</code>
          </div>
        </div>
      )}
    </section>
  )
}

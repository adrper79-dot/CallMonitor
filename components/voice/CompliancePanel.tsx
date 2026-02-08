'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useActiveCall } from '@/hooks/useActiveCall'
import { checkCompliance } from '@/lib/compliance/complianceUtils'

interface CompliancePanelProps {
  organizationId: string | null
  callId?: string | null
}

export default function CompliancePanel({ organizationId, callId = null }: CompliancePanelProps) {
  const { status, isActive } = useActiveCall(callId)

  if (!isActive || status !== 'in-progress') return null

  const context = {
    isQAEvaluation: false,
    isSurvey: false,
    hasConfirmations: false,
    hasOutcome: false,
  }

  const result = checkCompliance('agreement', context)

  const riskScore = 0.25 // Placeholder - from Bond AI /compliance/analyze
  const riskColor = riskScore > 0.5 ? 'bg-destructive' : riskScore > 0.2 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <Card className="border-l-4 border-blue-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          Compliance Monitor
          <Badge variant="secondary" className="text-xs">Live</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">Risk Score</span>
          <Badge className={`${riskColor} text-white text-xs font-mono`}>
            {riskScore.toFixed(2)}
          </Badge>
        </div>
        {result.warning && (
          <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-amber-800">{result.description}</span>
          </div>
        )}
        <div className="text-xs text-gray-500">
          Recommendations: Confirm disclosures, monitor call frequency.
        </div>
      </CardContent>
    </Card>
  )
}
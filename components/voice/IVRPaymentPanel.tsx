'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiPost, apiFetch } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface IVRPaymentPanelProps {
  organizationId: string
  accountId: string
  accountPhone?: string
  balanceDue?: number
}

/**
 * IVRPaymentPanel — Start and monitor IVR payment collection flows.
 *
 * Allows agents to launch an IVR payment menu on an active call,
 * guiding the caller through balance check, payment, or agent transfer.
 *
 * Professional Design System v3.0
 */
export function IVRPaymentPanel({
  organizationId,
  accountId,
  accountPhone,
  balanceDue,
}: IVRPaymentPanelProps) {
  const [flowActive, setFlowActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ call_id?: string; message?: string } | null>(null)

  const startFlow = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiPost('/api/ivr/start', {
        account_id: accountId,
        flow_type: 'payment',
        language: 'en',
      })
      if (res?.success) {
        setFlowActive(true)
        setResult(res)
      } else {
        setError(res?.error || 'Failed to start IVR flow')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to start IVR')
      logger.error('IVR start error', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [accountId])

  return (
    <div className="rounded-xl border p-4 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📱</span>
          <h3 className="font-semibold text-sm">IVR Payment</h3>
          {flowActive && (
            <Badge variant="default" className="text-xs bg-purple-500 animate-pulse">
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Account info */}
      <div className="space-y-1 mb-3 text-xs text-muted-foreground">
        {accountPhone && (
          <div>
            Phone: <span className="font-medium text-foreground">{accountPhone}</span>
          </div>
        )}
        {balanceDue !== undefined && (
          <div>
            Balance Due:{' '}
            <span className="font-medium text-foreground">${Number(balanceDue).toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Flow status */}
      {flowActive && result && (
        <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded text-xs">
          ✅ IVR flow is active. The caller is navigating the payment menu.
          {result.call_id && (
            <div className="mt-1 text-muted-foreground">Call: {result.call_id}</div>
          )}
        </div>
      )}

      {/* IVR menu preview */}
      {!flowActive && (
        <div className="mb-3 p-2 bg-muted/50 rounded text-xs space-y-1">
          <div className="font-medium">IVR Menu:</div>
          <div>1️⃣ Check balance</div>
          <div>2️⃣ Make a payment</div>
          <div>3️⃣ Speak with an agent</div>
          <div>9️⃣ End call</div>
        </div>
      )}

      {/* Start button */}
      {!flowActive && (
        <Button
          onClick={startFlow}
          disabled={loading}
          size="sm"
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {loading ? 'Starting IVR...' : '📱 Start IVR Payment Flow'}
        </Button>
      )}

      {/* Error */}
      {error && <div className="mt-2 text-xs text-red-500 bg-red-500/10 rounded p-2">{error}</div>}
    </div>
  )
}

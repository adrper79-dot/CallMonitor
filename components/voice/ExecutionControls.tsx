"use client"

import React, { useState, useEffect, useRef } from 'react'
import { useRBAC, usePermission } from '@/hooks/useRBAC'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { useRealtime } from '@/hooks/useRealtime'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'

export interface ExecutionControlsProps {
  organizationId: string | null
  onCallPlaced?: (callId: string) => void
}

export default function ExecutionControls({ organizationId, onCallPlaced }: ExecutionControlsProps) {
  const { role } = useRBAC(organizationId)
  const canPlaceCall = usePermission(organizationId, 'call', 'execute')
  const { config } = useVoiceConfig(organizationId)
  const { toast } = useToast()
  const { updates, connected } = useRealtime(organizationId)

  const [placing, setPlacing] = useState(false)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [callStatus, setCallStatus] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const isPlacingCallRef = useRef(false)

  // Monitor real-time updates for active call
  useEffect(() => {
    if (!activeCallId || !updates.length) return

    updates.forEach((update) => {
      if (update.table === 'calls' && update.new?.id === activeCallId) {
        const status = update.new.status
        setCallStatus(status)
        
        if (status === 'completed' || status === 'failed' || status === 'no-answer' || status === 'busy') {
          setActiveCallId(null)
          setCallDuration(0)
        }
      }
    })
  }, [updates, activeCallId])

  // Timer for active calls
  useEffect(() => {
    if (!activeCallId || callStatus !== 'in_progress') return

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [activeCallId, callStatus])

  async function handlePlaceCall() {
    // Prevent double submission (race condition protection)
    if (isPlacingCallRef.current) {
      console.warn('handlePlaceCall: already placing call, ignoring duplicate click')
      return
    }
    
    if (!organizationId || !canPlaceCall || !config?.target_id) {
      toast({
        title: 'Error',
        description: 'Cannot place call: missing target or insufficient permissions',
        variant: 'destructive',
      })
      return
    }

    try {
      isPlacingCallRef.current = true
      setPlacing(true)
      setCallStatus('initiating')
      
      const res = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          target_id: config.target_id,
          campaign_id: config.campaign_id || null,
          modulations: {
            record: config.record || false,
            transcribe: config.transcribe || false,
            translate: config.translate || false,
            survey: config.survey || false,
            synthetic_caller: config.synthetic_caller || false,
          },
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to place call' }))
        throw new Error(errorData.error || 'Failed to place call')
      }

      const data = await res.json()
      const callId = data.call_id

      setActiveCallId(callId)
      setCallStatus('ringing')
      setCallDuration(0)
      onCallPlaced?.(callId)

      toast({
        title: 'Call placed',
        description: `Call ${callId} is being initiated...`,
      })
    } catch (err: any) {
      setCallStatus(null)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to place call',
        variant: 'destructive',
      })
    } finally {
      setPlacing(false)
      isPlacingCallRef.current = false
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const statusBadgeVariant = 
    callStatus === 'completed' ? 'success' :
    callStatus === 'failed' || callStatus === 'no-answer' || callStatus === 'busy' ? 'error' :
    callStatus === 'in_progress' ? 'info' :
    callStatus === 'ringing' ? 'warning' :
    'default'

  if (!canPlaceCall) {
    return (
      <div className="p-4 bg-slate-950 rounded-md border border-slate-800">
        <p className="text-sm text-slate-400">
          Only Owners, Admins, and Operators can place calls.
        </p>
      </div>
    )
  }

  return (
    <section aria-labelledby="execution-controls" className="w-full p-4 bg-slate-950 rounded-md border border-slate-800">
      <h3 id="execution-controls" className="text-lg font-medium text-slate-100 mb-4">
        Execution Controls
      </h3>

      <div className="space-y-4">
        <Button
          onClick={handlePlaceCall}
          disabled={placing || !config?.target_id || activeCallId !== null}
          className="w-full"
          size="lg"
          aria-label="Place call"
        >
          {placing ? 'Placing Call...' : activeCallId ? 'Call in Progress' : 'Place Call'}
        </Button>

        {activeCallId && callStatus && (
          <div className="p-3 bg-slate-900 rounded-md border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Call Status:</span>
              <Badge variant={statusBadgeVariant}>{callStatus}</Badge>
            </div>
            {callStatus === 'in_progress' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Duration:</span>
                <span className="text-sm font-mono text-slate-100">{formatDuration(callDuration)}</span>
              </div>
            )}
            <div className="mt-2 text-xs text-slate-500">
              Call ID: {activeCallId}
            </div>
            {!connected && (
              <div className="mt-2 text-xs text-amber-400">
                Real-time updates disconnected. Using polling fallback.
              </div>
            )}
          </div>
        )}

        {!config?.target_id && (
          <p className="text-sm text-amber-400">
            Please select a target number before placing a call.
          </p>
        )}
      </div>
    </section>
  )
}

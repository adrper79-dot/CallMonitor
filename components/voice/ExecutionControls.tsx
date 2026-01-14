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

  // Check if we have a valid dial target (either saved target or quick dial number)
  const hasDialTarget = config?.target_id || config?.quick_dial_number
  const dialTargetDisplay = config?.quick_dial_number || 
    (config?.target_id ? `Target: ${config.target_id.slice(0, 8)}...` : null)
  const fromNumberDisplay = config?.from_number || null
  const isBridgeCall = !!config?.from_number

  async function handlePlaceCall() {
    // Prevent double submission (race condition protection)
    if (isPlacingCallRef.current) {
      console.warn('handlePlaceCall: already placing call, ignoring duplicate click')
      return
    }
    
    if (!organizationId || !canPlaceCall || !hasDialTarget) {
      toast({
        title: 'Error',
        description: 'Cannot place call: enter a phone number or select a target first',
        variant: 'destructive',
      })
      return
    }

    try {
      isPlacingCallRef.current = true
      setPlacing(true)
      setCallStatus('initiating')
      
      // Build request body - use quick_dial_number if set, otherwise target_id
      const requestBody: Record<string, any> = {
        organization_id: organizationId,
        campaign_id: config.campaign_id || null,
        modulations: {
          record: config.record || false,
          transcribe: config.transcribe || false,
          translate: config.translate || false,
          survey: config.survey || false,
          synthetic_caller: config.synthetic_caller || false,
        },
      }
      
      // Set target phone number (who to call)
      if (config.quick_dial_number) {
        requestBody.to_number = config.quick_dial_number
      } else if (config.target_id) {
        requestBody.target_id = config.target_id
      }
      
      // Set from number (agent's phone for bridge calls)
      if (config.from_number) {
        requestBody.from_number = config.from_number
        requestBody.flow_type = 'bridge'  // This is a bridge call
      }
      
      const res = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to place call' }))
        // Handle error object {code, message} or string
        const errorMsg = typeof errorData.error === 'object' 
          ? (errorData.error?.message || errorData.error?.code || JSON.stringify(errorData.error))
          : (errorData.error || 'Failed to place call')
        throw new Error(errorMsg)
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
        {/* Show current dial configuration */}
        {hasDialTarget && (
          <div className="p-3 bg-slate-900 rounded-md border border-green-800 space-y-2">
            <div className="text-sm text-green-400">
              📞 Target: <span className="font-mono font-bold">{dialTargetDisplay}</span>
            </div>
            {fromNumberDisplay && (
              <div className="text-sm text-blue-400">
                📱 Agent: <span className="font-mono font-bold">{fromNumberDisplay}</span>
                <span className="text-xs ml-2">(bridge call)</span>
              </div>
            )}
            {!fromNumberDisplay && (
              <div className="text-xs text-slate-500">
                Direct call mode (no agent bridge)
              </div>
            )}
          </div>
        )}
        
        <Button
          onClick={handlePlaceCall}
          disabled={placing || !hasDialTarget || activeCallId !== null}
          className="w-full"
          size="lg"
          aria-label="Place call"
        >
          {placing ? 'Placing Call...' : activeCallId ? 'Call in Progress' : isBridgeCall ? '📞 Place Bridge Call' : '📞 Place Call'}
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

        {!hasDialTarget && (
          <p className="text-sm text-amber-400">
            ⚠️ Enter a phone number above or select a saved target to place a call.
          </p>
        )}
      </div>
    </section>
  )
}

"use client"

import React, { useState, useEffect, useRef } from 'react'
import { useRBAC, usePermission } from '@/hooks/useRBAC'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { useRealtime } from '@/hooks/useRealtime'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiPost } from '@/lib/api-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

export interface ExecutionControlsProps {
  organizationId: string | null
  onCallPlaced?: (callId: string) => void
}

/**
 * ExecutionControls - Professional Design System v3.0
 * 
 * The PRIMARY action on the page. Clean, focused, prominent.
 * One big call button with status feedback.
 */
export default function ExecutionControls({ organizationId, onCallPlaced }: ExecutionControlsProps) {
  const { role } = useRBAC(organizationId)
  const canPlaceCall = usePermission(organizationId, 'call', 'execute')
  const { config, updateConfig } = useVoiceConfig(organizationId)
  const { toast } = useToast()
  const { updates, connected } = useRealtime(organizationId)

  const [placing, setPlacing] = useState(false)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [callStatus, setCallStatus] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const isPlacingCallRef = useRef(false)
  const pendingOnboardingCall = useRef<any>(null)

  // Listen for onboarding completion to trigger immediate call
  useEffect(() => {
    function handleOnboardingComplete(e: CustomEvent) {
      const detail = e.detail
      if (detail?.targetNumber) {
        // Store the config to trigger call after config update
        pendingOnboardingCall.current = detail
        // Update config with onboarding values
        updateConfig({
          quick_dial_number: detail.targetNumber,
          from_number: detail.fromNumber || null,
          record: detail.record ?? true,
          transcribe: detail.transcribe ?? true,
        })
      }
    }

    window.addEventListener('onboarding:complete', handleOnboardingComplete as EventListener)
    return () => {
      window.removeEventListener('onboarding:complete', handleOnboardingComplete as EventListener)
    }
  }, [updateConfig])

  // Trigger call after config is updated from onboarding
  useEffect(() => {
    if (pendingOnboardingCall.current && config?.quick_dial_number === pendingOnboardingCall.current.targetNumber) {
      // Small delay to ensure config is fully propagated
      const timer = setTimeout(() => {
        pendingOnboardingCall.current = null
        handlePlaceCall()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [config?.quick_dial_number])

  // Monitor real-time updates for active call
  useEffect(() => {
    if (!activeCallId || !updates.length) return

    updates.forEach((update) => {
      const row = update.data as any
      if (update.table === 'calls' && row?.id === activeCallId) {
        const status = row.status
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

  const hasDialTarget = config?.target_id || config?.quick_dial_number
  const dialTargetDisplay = config?.quick_dial_number || 
    (config?.target_id ? `Target: ${config.target_id.slice(0, 8)}...` : null)
  const fromNumberDisplay = config?.from_number || null
  const isBridgeCall = !!config?.from_number

  async function handlePlaceCall() {
    if (isPlacingCallRef.current) return
    
    if (!organizationId || !canPlaceCall || !hasDialTarget) {
      toast({
        title: 'Cannot place call',
        description: 'Enter a phone number or select a target first',
        variant: 'destructive',
      })
      return
    }

    try {
      isPlacingCallRef.current = true
      setPlacing(true)
      setCallStatus('initiating')
      
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
      
      if (config.quick_dial_number) {
        requestBody.to_number = config.quick_dial_number
      } else if (config.target_id) {
        requestBody.target_id = config.target_id
      }
      
      if (config.from_number) {
        requestBody.from_number = config.from_number
        requestBody.flow_type = 'bridge'
      }
      
      const data = await apiPost('/api/voice/call', requestBody)
      const callId = data.call_id

      setActiveCallId(callId)
      setCallStatus('ringing')
      setCallDuration(0)
      onCallPlaced?.(callId)

      toast({
        title: 'Call placed',
        description: `Call ${callId.slice(0, 8)}... is being initiated`,
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
    callStatus === 'in_progress' ? 'success' :
    callStatus === 'ringing' ? 'warning' :
    'default'

  if (!canPlaceCall) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-4">
        <p className="text-sm text-gray-500">
          Only Owners, Admins, and Operators can place calls.
        </p>
      </div>
    )
  }

  return (
    <section className="bg-white rounded-md border border-gray-200 p-6">
      <div className="space-y-4">
        {/* Target Display */}
        {hasDialTarget && (
          <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
            <div className="text-sm text-gray-700">
              <span className="font-medium">Calling:</span>{' '}
              <span className="font-mono">{dialTargetDisplay}</span>
            </div>
            {fromNumberDisplay && (
              <div className="text-sm text-gray-500 mt-1">
                Agent phone: <span className="font-mono">{fromNumberDisplay}</span>
                <span className="text-xs ml-2">(bridge call)</span>
              </div>
            )}
          </div>
        )}
        
        {/* Primary Call Button */}
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handlePlaceCall()
          }}
          disabled={placing || !hasDialTarget || activeCallId !== null}
          variant="primary"
          size="lg"
          className="w-full h-14 text-base"
          aria-label="Place call"
        >
          {placing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Placing Call...
            </span>
          ) : activeCallId ? 'Call in Progress' : 'Place Call'}
        </Button>

        {/* Active Call Status */}
        {activeCallId && callStatus && (
          <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Status</span>
              <Badge variant={statusBadgeVariant}>{callStatus}</Badge>
            </div>
            {callStatus === 'in_progress' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Duration</span>
                <span className="text-sm font-mono text-gray-900">{formatDuration(callDuration)}</span>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-400">
              ID: {activeCallId.slice(0, 8)}...
            </div>
            {!connected && (
              <div className="mt-2 text-xs text-warning">
                Real-time updates disconnected
              </div>
            )}
          </div>
        )}

        {/* No target warning */}
        {!hasDialTarget && (
          <p className="text-sm text-gray-500 text-center">
            Enter a phone number above to place a call
          </p>
        )}
      </div>
    </section>
  )
}

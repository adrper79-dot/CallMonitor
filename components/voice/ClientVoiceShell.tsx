"use client"

import React, { useState, useEffect } from 'react'
import type { Call } from '@/app/voice/page'
import CallList from '@/components/voice/CallList'
import CallDetailView from '@/components/voice/CallDetailView'

export interface ClientVoiceShellProps {
  initialCalls: Call[]
  organizationId: string | null
  initialSelectedCallId?: string | null
}

export default function ClientVoiceShell({
  initialCalls,
  organizationId,
  initialSelectedCallId,
}: ClientVoiceShellProps) {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(initialSelectedCallId || null)
  const [calls, setCalls] = useState<Call[]>(initialCalls)

  // Listen for call selection events from activity feed
  useEffect(() => {
    function handleCallSelect(e: CustomEvent) {
      const callId = e.detail?.callId
      if (callId) {
        setSelectedCallId(callId)
        // Scroll to call detail
        document.getElementById('call-detail-container')?.scrollIntoView({ behavior: 'smooth' })
      }
    }

    window.addEventListener('call:select', handleCallSelect as EventListener)
    return () => {
      window.removeEventListener('call:select', handleCallSelect as EventListener)
    }
  }, [])

  async function handleModulationChange(mods: Record<string, boolean>) {
    // This would update voice_configs via API
    // For now, just log
    console.log('Modulation change:', mods)
  }

  return (
    <>
      {/* Call List */}
      <CallList
        calls={calls}
        selectedCallId={selectedCallId}
        organizationId={organizationId}
        onSelect={setSelectedCallId}
      />

      {/* Call Detail View - shown in main area via portal or direct render */}
      {selectedCallId && (
        <div className="hidden lg:block">
          {/* This will be rendered in main area via React Portal or direct render */}
        </div>
      )}
    </>
  )
}

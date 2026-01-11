"use client"

import React, { useState, useEffect } from 'react'
import type { Call } from '@/app/voice/page'
import VoiceHeader from './VoiceHeader'
import CallList from './CallList'
import CallDetailView from './CallDetailView'
import TargetCampaignSelector from './TargetCampaignSelector'
import ExecutionControls from './ExecutionControls'
import ActivityFeedEmbed from './ActivityFeedEmbed'

export interface VoiceOperationsClientProps {
  initialCalls: Call[]
  organizationId: string | null
  organizationName?: string
}

export default function VoiceOperationsClient({
  initialCalls,
  organizationId,
  organizationName,
}: VoiceOperationsClientProps) {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)

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
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <VoiceHeader organizationId={organizationId} organizationName={organizationName} />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail - Call List (25%) */}
        <aside className="w-1/4 border-r border-slate-800 flex flex-col overflow-hidden">
          <CallList
            calls={initialCalls}
            selectedCallId={selectedCallId}
            organizationId={organizationId}
            onSelect={setSelectedCallId}
          />
        </aside>

        {/* Main Area - Call Detail & Controls (50%) */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Target & Campaign Selector */}
            <TargetCampaignSelector organizationId={organizationId} />

            {/* Execution Controls */}
            <ExecutionControls organizationId={organizationId} />

            {/* Call Detail View */}
            <div id="call-detail-container">
              <CallDetailView
                callId={selectedCallId}
                organizationId={organizationId}
                onModulationChange={handleModulationChange}
              />
            </div>
          </div>
        </main>

        {/* Right Rail - Activity Feed (25%) */}
        <aside className="w-1/4 border-l border-slate-800 overflow-y-auto p-4">
          <ActivityFeedEmbed organizationId={organizationId} limit={20} />
        </aside>
      </div>
    </div>
  )
}

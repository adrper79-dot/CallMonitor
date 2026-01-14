"use client"

import React, { useState, useEffect } from 'react'
import type { Call } from '@/app/voice/page'
import { VoiceConfigProvider } from '@/hooks/useVoiceConfig'
import VoiceHeader from './VoiceHeader'
import CallList from './CallList'
import CallDetailView from './CallDetailView'
import TargetCampaignSelector from './TargetCampaignSelector'
import ExecutionControls from './ExecutionControls'
import ActivityFeedEmbed from './ActivityFeedEmbed'
import CallModulations from './CallModulations'
import { BookingsList } from './BookingsList'
import { BookingModal } from './BookingModal'
import ShopperScriptManager from './ShopperScriptManager'
import CallerIdManager from './CallerIdManager'

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
  const [showBookingModal, setShowBookingModal] = useState(false)

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
    // Modulation changes are handled by CallModulations component directly
  }

  return (
    <VoiceConfigProvider organizationId={organizationId}>
      <div className="flex flex-col h-screen bg-[#FAFAFA] text-[#333333]">
        {/* Header */}
        <VoiceHeader organizationId={organizationId} organizationName={organizationName} />

        {/* Main Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Rail - Call List + Bookings (25%) */}
          <aside className="w-1/4 border-r border-[#E5E5E5] flex flex-col overflow-hidden bg-white">
            {/* Scheduled Calls (Bookings) */}
            <div className="border-b border-[#E5E5E5] p-3 bg-[#FAFAFA]">
              <BookingsList
                onBookingClick={(booking) => {
                  // Booking details would be shown in a modal or detail view
                }}
                onNewBooking={() => setShowBookingModal(true)}
                limit={3}
              />
            </div>
            
            {/* Call List */}
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
              {/* Configuration Section - Always Visible */}
              <div className="space-y-6">
                {/* Target & Campaign Selector */}
                <TargetCampaignSelector organizationId={organizationId} />

                {/* Call Features (Modulations) - Always Visible */}
                <section aria-labelledby="call-features" className="p-4 bg-white rounded-lg border border-[#E5E5E5] shadow-sm">
                  <div className="mb-4">
                    <h2 id="call-features" className="text-lg font-semibold text-[#333333] mb-1">
                      Call Features
                    </h2>
                    <p className="text-sm text-[#666666]">
                      Configure recording, transcription, translation, and survey settings for all calls.
                      These settings apply organization-wide.
                    </p>
                  </div>
                  
                  <CallModulations
                    callId="org-default"
                    organizationId={organizationId}
                    initialModulations={{
                      record: false,
                      transcribe: false,
                      translate: false,
                      survey: false,
                      synthetic_caller: false,
                    }}
                    onChange={handleModulationChange}
                  />
                </section>

                {/* Execution Controls */}
                <ExecutionControls organizationId={organizationId} />
              </div>

              {/* Call Detail View - When Call Selected */}
              <div id="call-detail-container" className="mt-8">
                <CallDetailView
                  callId={selectedCallId}
                  organizationId={organizationId}
                  onModulationChange={handleModulationChange}
                />
              </div>
            </div>
          </main>

          {/* Right Rail - Activity Feed (25%) */}
          <aside className="w-1/4 border-l border-[#E5E5E5] overflow-y-auto p-4 bg-white">
            <ActivityFeedEmbed organizationId={organizationId} limit={20} />
          </aside>
        </div>

        {/* Booking Modal */}
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          onSuccess={(booking) => {
            // Booking created successfully - modal will close
            setShowBookingModal(false)
          }}
        />
      </div>
    </VoiceConfigProvider>
  )
}

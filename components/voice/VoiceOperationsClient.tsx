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

// Mobile tab type
type MobileTab = 'dial' | 'calls' | 'activity'

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
  
  // Mobile navigation state
  const [mobileTab, setMobileTab] = useState<MobileTab>('dial')
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  // Listen for call selection events from activity feed
  useEffect(() => {
    function handleCallSelect(e: CustomEvent) {
      const callId = e.detail?.callId
      if (callId) {
        setSelectedCallId(callId)
        setMobileTab('dial') // Switch to dial tab to show call details
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

        {/* ========== DESKTOP LAYOUT (lg and up) ========== */}
        <div className="hidden lg:flex flex-1 overflow-hidden">
          {/* Left Rail - Call List + Bookings (25%) */}
          <aside className="w-1/4 min-w-[280px] max-w-[360px] border-r border-[#E5E5E5] flex flex-col overflow-hidden bg-white">
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

          {/* Main Area - Call Detail & Controls */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Target & Campaign Selector */}
              <TargetCampaignSelector organizationId={organizationId} />

              {/* Call Features (Modulations) */}
              <section aria-labelledby="call-features" className="p-4 bg-white rounded-lg border border-[#E5E5E5] shadow-sm">
                <div className="mb-4">
                  <h2 id="call-features" className="text-lg font-semibold text-[#333333] mb-1">
                    Call Features
                  </h2>
                  <p className="text-sm text-[#666666]">
                    Configure recording, transcription, translation, and survey settings.
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
          <aside className="w-1/4 min-w-[280px] max-w-[360px] border-l border-[#E5E5E5] overflow-y-auto p-4 bg-white">
            <ActivityFeedEmbed organizationId={organizationId} limit={20} />
          </aside>
        </div>

        {/* ========== MOBILE/TABLET LAYOUT (below lg) ========== */}
        <div className="flex lg:hidden flex-col flex-1 overflow-hidden">
          {/* Mobile Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Dial Tab - Main Controls */}
            {mobileTab === 'dial' && (
              <div className="p-4 space-y-4">
                {/* Target & Campaign Selector */}
                <TargetCampaignSelector organizationId={organizationId} />

                {/* Call Features - Collapsed by default on mobile */}
                <details className="bg-white rounded-lg border border-[#E5E5E5] shadow-sm">
                  <summary className="p-4 cursor-pointer font-semibold text-[#333333] flex items-center justify-between">
                    <span>⚙️ Call Features</span>
                    <span className="text-sm text-[#666666]">Tap to expand</span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-[#E5E5E5]">
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
                  </div>
                </details>

                {/* Execution Controls - Always visible */}
                <ExecutionControls organizationId={organizationId} />

                {/* Upcoming Bookings - Collapsed */}
                <details className="bg-white rounded-lg border border-[#E5E5E5] shadow-sm">
                  <summary className="p-4 cursor-pointer font-semibold text-[#333333] flex items-center justify-between">
                    <span>📅 Scheduled Calls</span>
                    <span className="text-sm text-[#666666]">Tap to view</span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-[#E5E5E5]">
                    <BookingsList
                      onBookingClick={(booking) => {}}
                      onNewBooking={() => setShowBookingModal(true)}
                      limit={5}
                    />
                  </div>
                </details>

                {/* Call Detail View - When Call Selected */}
                {selectedCallId && (
                  <div id="call-detail-container">
                    <CallDetailView
                      callId={selectedCallId}
                      organizationId={organizationId}
                      onModulationChange={handleModulationChange}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Calls Tab - Call History */}
            {mobileTab === 'calls' && (
              <CallList
                calls={initialCalls}
                selectedCallId={selectedCallId}
                organizationId={organizationId}
                onSelect={(id) => {
                  setSelectedCallId(id)
                  setMobileTab('dial') // Switch to dial tab to show details
                }}
              />
            )}

            {/* Activity Tab - Activity Feed */}
            {mobileTab === 'activity' && (
              <div className="p-4">
                <ActivityFeedEmbed organizationId={organizationId} limit={30} />
              </div>
            )}
          </div>

          {/* Mobile Bottom Navigation */}
          <nav className="flex border-t border-[#E5E5E5] bg-white safe-area-bottom">
            <button
              onClick={() => setMobileTab('dial')}
              className={`flex-1 flex flex-col items-center py-3 px-2 min-h-[60px] transition-colors ${
                mobileTab === 'dial' 
                  ? 'text-[#C4001A] bg-red-50' 
                  : 'text-[#666666] hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              <span className="text-2xl mb-1">📞</span>
              <span className="text-xs font-medium">Dial</span>
            </button>
            <button
              onClick={() => setMobileTab('calls')}
              className={`flex-1 flex flex-col items-center py-3 px-2 min-h-[60px] transition-colors ${
                mobileTab === 'calls' 
                  ? 'text-[#C4001A] bg-red-50' 
                  : 'text-[#666666] hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              <span className="text-2xl mb-1">📋</span>
              <span className="text-xs font-medium">Calls</span>
              {initialCalls.length > 0 && (
                <span className="absolute top-1 right-1/4 bg-[#C4001A] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {initialCalls.length > 9 ? '9+' : initialCalls.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setMobileTab('activity')}
              className={`flex-1 flex flex-col items-center py-3 px-2 min-h-[60px] transition-colors ${
                mobileTab === 'activity' 
                  ? 'text-[#C4001A] bg-red-50' 
                  : 'text-[#666666] hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              <span className="text-2xl mb-1">🔔</span>
              <span className="text-xs font-medium">Activity</span>
            </button>
            <button
              onClick={() => setShowBookingModal(true)}
              className="flex-1 flex flex-col items-center py-3 px-2 min-h-[60px] text-[#666666] hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <span className="text-2xl mb-1">➕</span>
              <span className="text-xs font-medium">Schedule</span>
            </button>
          </nav>
        </div>

        {/* Booking Modal */}
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          onSuccess={(booking) => {
            setShowBookingModal(false)
          }}
        />
      </div>
    </VoiceConfigProvider>
  )
}

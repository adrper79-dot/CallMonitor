"use client"

import React, { useState, useEffect } from 'react'
import type { Call } from '@/app/voice/page'
import VoiceHeader from './VoiceHeader'
import CallList from './CallList'
import CallDetailView from './CallDetailView'
import TargetCampaignSelector from './TargetCampaignSelector'
import ExecutionControls from './ExecutionControls'
import ActivityFeedEmbed from './ActivityFeedEmbed'
import CallModulations from './CallModulations'
import { BookingsList } from './BookingsList'
import { BookingModal } from './BookingModal'

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
  const [activeTab, setActiveTab] = useState<'calls' | 'settings'>('calls')

  // Listen for call selection events from activity feed
  useEffect(() => {
    function handleCallSelect(e: CustomEvent) {
      const callId = e.detail?.callId
      if (callId) {
        setSelectedCallId(callId)
        setActiveTab('calls')
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
    console.log('Modulation change:', mods)
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <VoiceHeader organizationId={organizationId} organizationName={organizationName} />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail - Call List + Bookings (25%) */}
        <aside className="w-1/4 border-r border-slate-800 flex flex-col overflow-hidden">
          {/* Scheduled Calls (Bookings) */}
          <div className="border-b border-slate-800 p-3 bg-slate-900/50">
            <BookingsList
              onBookingClick={(booking) => {
                console.log('Booking clicked:', booking)
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
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('calls')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === 'calls'
                    ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                📞 Calls
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                ⚙️ Call Settings (Survey, Recording, Translation)
              </button>
            </div>

            {activeTab === 'calls' && (
              <>
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
              </>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="p-4 bg-slate-900 rounded-lg border border-slate-800">
                  <h2 className="text-xl font-semibold text-slate-100 mb-2">
                    📋 Call Configuration
                  </h2>
                  <p className="text-sm text-slate-400 mb-4">
                    Configure recording, transcription, translation, and survey settings for all calls.
                    These settings apply organization-wide.
                  </p>
                  
                  {/* Organization-wide Modulations */}
                  <CallModulations
                    callId="org-settings"
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

                <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-400 mb-2">💡 Tips</h3>
                  <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                    <li><strong>Recording:</strong> Captures call audio for playback and analysis</li>
                    <li><strong>Transcribe:</strong> Generates text transcripts from recordings</li>
                    <li><strong>Translate:</strong> Translates transcripts to other languages</li>
                    <li><strong>After-call Survey:</strong> AI bot asks survey questions after the call</li>
                    <li><strong>Secret Shopper:</strong> Uses AI to simulate customer calls for quality testing</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Rail - Activity Feed (25%) */}
        <aside className="w-1/4 border-l border-slate-800 overflow-y-auto p-4">
          <ActivityFeedEmbed organizationId={organizationId} limit={20} />
        </aside>
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onSuccess={(booking) => {
          console.log('Booking created:', booking)
          setShowBookingModal(false)
        }}
      />
    </div>
  )
}

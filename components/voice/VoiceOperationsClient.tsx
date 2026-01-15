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

/**
 * VoiceOperationsClient - Professional Design System v3.0
 * 
 * Single-page voice operations interface.
 * Clean, minimal, data-focused design.
 */
export default function VoiceOperationsClient({
  initialCalls,
  organizationId,
  organizationName,
}: VoiceOperationsClientProps) {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  
  // Mobile navigation state
  const [mobileTab, setMobileTab] = useState<MobileTab>('dial')

  // Listen for call selection events from activity feed
  useEffect(() => {
    function handleCallSelect(e: CustomEvent) {
      const callId = e.detail?.callId
      if (callId) {
        setSelectedCallId(callId)
        setMobileTab('dial')
        document.getElementById('call-detail-container')?.scrollIntoView({ behavior: 'smooth' })
      }
    }

    window.addEventListener('call:select', handleCallSelect as EventListener)
    return () => {
      window.removeEventListener('call:select', handleCallSelect as EventListener)
    }
  }, [])

  async function handleModulationChange(mods: Record<string, boolean>) {
    // Modulation changes are handled by CallModulations component directly
  }

  return (
    <VoiceConfigProvider organizationId={organizationId}>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <VoiceHeader organizationId={organizationId} organizationName={organizationName} />

        {/* ========== DESKTOP LAYOUT (lg and up) ========== */}
        <div className="hidden lg:flex flex-1 overflow-hidden">
          {/* Left Rail - Call List (280px) */}
          <aside className="w-72 border-r border-gray-200 flex flex-col overflow-hidden bg-white">
            {/* Scheduled Calls */}
            <div className="border-b border-gray-200 p-4">
              <BookingsList
                onBookingClick={(booking) => {}}
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

          {/* Main Area - Call Controls & Detail */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Target & Campaign Selector */}
              <TargetCampaignSelector organizationId={organizationId} />

              {/* Call Options */}
              <section className="bg-white rounded-md border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">
                  Call Options
                </h2>
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

              {/* Execution Controls - Primary Action */}
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

          {/* Right Rail - Activity Feed (280px) */}
          <aside className="w-72 border-l border-gray-200 overflow-y-auto p-4 bg-white">
            <ActivityFeedEmbed organizationId={organizationId} limit={20} />
          </aside>
        </div>

        {/* ========== MOBILE/TABLET LAYOUT (below lg) ========== */}
        <div className="flex lg:hidden flex-col flex-1 overflow-hidden">
          {/* Mobile Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Dial Tab */}
            {mobileTab === 'dial' && (
              <div className="p-4 space-y-4">
                <TargetCampaignSelector organizationId={organizationId} />

                {/* Call Options - Collapsible */}
                <details className="bg-white rounded-md border border-gray-200">
                  <summary className="p-4 cursor-pointer font-medium text-gray-900 flex items-center justify-between">
                    <span>Call Options</span>
                    <span className="text-sm text-gray-500">Tap to expand</span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-gray-200">
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

                <ExecutionControls organizationId={organizationId} />

                {/* Scheduled Calls - Collapsible */}
                <details className="bg-white rounded-md border border-gray-200">
                  <summary className="p-4 cursor-pointer font-medium text-gray-900 flex items-center justify-between">
                    <span>Scheduled Calls</span>
                    <span className="text-sm text-gray-500">Tap to view</span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-gray-200">
                    <BookingsList
                      onBookingClick={(booking) => {}}
                      onNewBooking={() => setShowBookingModal(true)}
                      limit={5}
                    />
                  </div>
                </details>

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

            {/* Calls Tab */}
            {mobileTab === 'calls' && (
              <CallList
                calls={initialCalls}
                selectedCallId={selectedCallId}
                organizationId={organizationId}
                onSelect={(id) => {
                  setSelectedCallId(id)
                  setMobileTab('dial')
                }}
              />
            )}

            {/* Activity Tab */}
            {mobileTab === 'activity' && (
              <div className="p-4">
                <ActivityFeedEmbed organizationId={organizationId} limit={30} />
              </div>
            )}
          </div>

          {/* Mobile Bottom Navigation */}
          <nav className="flex border-t border-gray-200 bg-white safe-area-bottom">
            <button
              onClick={() => setMobileTab('dial')}
              className={`flex-1 flex flex-col items-center py-3 px-2 min-h-[56px] transition-colors ${
                mobileTab === 'dial' 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-xs font-medium">Dial</span>
            </button>
            <button
              onClick={() => setMobileTab('calls')}
              className={`flex-1 flex flex-col items-center py-3 px-2 min-h-[56px] transition-colors relative ${
                mobileTab === 'calls' 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-xs font-medium">Calls</span>
              {initialCalls.length > 0 && (
                <span className="absolute top-2 right-1/4 bg-primary-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {initialCalls.length > 9 ? '9+' : initialCalls.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setMobileTab('activity')}
              className={`flex-1 flex flex-col items-center py-3 px-2 min-h-[56px] transition-colors ${
                mobileTab === 'activity' 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-xs font-medium">Activity</span>
            </button>
            <button
              onClick={() => setShowBookingModal(true)}
              className="flex-1 flex flex-col items-center py-3 px-2 min-h-[56px] text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
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

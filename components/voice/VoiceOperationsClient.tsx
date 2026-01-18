"use client"

import React, { useState, useEffect, useCallback } from 'react'
import type { Call } from '@/app/voice/page'
import { VoiceConfigProvider, useVoiceConfig } from '@/hooks/useVoiceConfig'
import VoiceHeader from './VoiceHeader'
import CallList from './CallList'
import CallDetailView from './CallDetailView'
import TargetCampaignSelector from './TargetCampaignSelector'
import ExecutionControls from './ExecutionControls'
import ActivityFeedEmbed from './ActivityFeedEmbed'
import CallModulations from './CallModulations'
import { BookingsList } from './BookingsList'
import { BookingModal } from './BookingModal'
import { OnboardingWizard, OnboardingConfig } from './OnboardingWizard'
import { RecentTargets } from './RecentTargets'
import { ActiveCallPanel } from './ActiveCallPanel'
import { useRealtime } from '@/hooks/useRealtime'
import { ProductTour, VOICE_TOUR } from '@/components/tour'

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
 * Single-page voice operations interface with:
 * - First-time user onboarding
 * - Recent targets quick access
 * - Progressive disclosure for options
 * - Active call status panel
 */
export default function VoiceOperationsClient({
  initialCalls,
  organizationId,
  organizationName,
}: VoiceOperationsClientProps) {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [optionsExpanded, setOptionsExpanded] = useState(false)
  
  // Active call tracking
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [activeCallStatus, setActiveCallStatus] = useState<string | null>(null)
  const [activeCallDuration, setActiveCallDuration] = useState(0)
  
  // Mobile navigation state
  const [mobileTab, setMobileTab] = useState<MobileTab>('dial')

  // Real-time updates for active call
  const { updates } = useRealtime(organizationId)

  // Check if first-time user (no calls, no targets configured)
  useEffect(() => {
    if (initialCalls.length === 0) {
      // Could check for targets too, but for now just show if no calls
      setShowOnboarding(true)
    }
  }, [initialCalls.length])

  // Monitor real-time updates for active call
  useEffect(() => {
    if (!activeCallId || !updates.length) return

    updates.forEach((update) => {
      if (update.table === 'calls' && update.new?.id === activeCallId) {
        const status = update.new.status
        setActiveCallStatus(status)
        
        if (status === 'completed' || status === 'failed' || status === 'no-answer' || status === 'busy') {
          // Call ended - keep panel visible but stop timer
        }
      }
    })
  }, [updates, activeCallId])

  // Polling fallback for active call status (when real-time doesn't work)
  useEffect(() => {
    if (!activeCallId) return
    
    // Don't poll if call is already in a terminal state
    const terminalStates = ['completed', 'failed', 'no-answer', 'busy']
    if (activeCallStatus && terminalStates.includes(activeCallStatus)) return

    let mounted = true
    
    async function pollCallStatus() {
      try {
        const res = await fetch(`/api/calls/${encodeURIComponent(activeCallId!)}`, {
          credentials: 'include'
        })
        if (res.ok && mounted) {
          const data = await res.json()
          const serverStatus = data.call?.status
          if (serverStatus && serverStatus !== activeCallStatus) {
            setActiveCallStatus(serverStatus)
          }
        }
      } catch {
        // Ignore polling errors
      }
    }

    // Poll every 3 seconds while call is active
    const pollInterval = setInterval(pollCallStatus, 3000)
    
    // Initial poll after 2 seconds (give SignalWire time to update)
    const initialTimeout = setTimeout(pollCallStatus, 2000)

    return () => {
      mounted = false
      clearInterval(pollInterval)
      clearTimeout(initialTimeout)
    }
  }, [activeCallId, activeCallStatus])

  // Timer for active calls
  useEffect(() => {
    if (!activeCallId || activeCallStatus !== 'in_progress') return

    const interval = setInterval(() => {
      setActiveCallDuration((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [activeCallId, activeCallStatus])

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

  const handleCallPlaced = (callId: string) => {
    setActiveCallId(callId)
    setActiveCallStatus('initiating')
    setActiveCallDuration(0)
    setSelectedCallId(callId)
  }

  const handleOnboardingComplete = async (config: OnboardingConfig) => {
    setShowOnboarding(false)
    // The onboarding wizard will trigger the call placement
    // For now, just close the wizard - user can place call normally
  }

  const handleTargetSelect = (number: string, name?: string) => {
    // This will be handled by TargetCampaignSelector through the config context
    // We can close the recent targets panel or highlight the selection
  }

  const handleNewCall = () => {
    setActiveCallId(null)
    setActiveCallStatus(null)
    setActiveCallDuration(0)
  }

  async function handleModulationChange(mods: Record<string, boolean>) {
    // Modulation changes are handled by CallModulations component directly
  }

  // Show onboarding for first-time users
  if (showOnboarding && initialCalls.length === 0) {
    return (
      <VoiceConfigProvider organizationId={organizationId}>
        <div className="min-h-screen bg-gray-50">
          <VoiceHeader organizationId={organizationId} organizationName={organizationName} />
          <div className="py-12 px-4">
            <OnboardingWizard
              organizationId={organizationId}
              onComplete={handleOnboardingComplete}
              onSkip={() => setShowOnboarding(false)}
            />
          </div>
        </div>
      </VoiceConfigProvider>
    )
  }

  return (
    <VoiceConfigProvider organizationId={organizationId}>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <VoiceHeader organizationId={organizationId} organizationName={organizationName} />

        {/* ========== DESKTOP LAYOUT (lg and up) ========== */}
        <div className="hidden lg:flex flex-1 overflow-hidden">
          {/* Left Rail - Call List (280px) */}
          <aside className="w-72 border-r border-gray-200 flex flex-col overflow-hidden bg-white" data-tour="call-list">
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
              {/* Active Call Panel - Shows when call is active */}
              {activeCallId && activeCallStatus && (
                <ActiveCallPanel
                  callId={activeCallId}
                  organizationId={organizationId || undefined}
                  status={activeCallStatus}
                  duration={activeCallDuration}
                  onViewDetails={() => setSelectedCallId(activeCallId)}
                  onNewCall={handleNewCall}
                  showConfirmations={true}
                />
              )}

              {/* Target & Campaign Selector with Recent Targets */}
              <div className="space-y-4" data-tour="target-selector">
                <TargetCampaignSelector organizationId={organizationId} />
                
                {/* Recent Targets - Quick Access */}
                <div className="bg-white rounded-md border border-gray-200 p-4">
                  <RecentTargets
                    organizationId={organizationId}
                    onSelect={handleTargetSelect}
                    limit={3}
                  />
                </div>
              </div>

              {/* Call Options - Progressive Disclosure */}
              <section className="bg-white rounded-md border border-gray-200" data-tour="call-options">
                <button
                  onClick={() => setOptionsExpanded(!optionsExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      Call Options
                    </h2>
                    <p className="text-xs text-gray-500">
                      Recording, transcription, and more
                    </p>
                  </div>
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform ${optionsExpanded ? 'rotate-180' : ''}`}
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {optionsExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
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
                )}
              </section>

              {/* Execution Controls - Primary Action */}
              <div data-tour="place-call">
                {!activeCallId && (
                  <ExecutionControls 
                    organizationId={organizationId} 
                    onCallPlaced={handleCallPlaced}
                  />
                )}
              </div>

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
          <aside className="w-72 border-l border-gray-200 overflow-y-auto p-4 bg-white" data-tour="activity-feed">
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
                {/* Active Call Panel */}
                {activeCallId && activeCallStatus && (
                  <ActiveCallPanel
                    callId={activeCallId}
                    organizationId={organizationId || undefined}
                    status={activeCallStatus}
                    duration={activeCallDuration}
                    onViewDetails={() => setSelectedCallId(activeCallId)}
                    onNewCall={handleNewCall}
                    showConfirmations={true}
                  />
                )}

                <TargetCampaignSelector organizationId={organizationId} />

                {/* Recent Targets */}
                <div className="bg-white rounded-md border border-gray-200 p-4">
                  <RecentTargets
                    organizationId={organizationId}
                    onSelect={handleTargetSelect}
                    limit={3}
                  />
                </div>

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

                {!activeCallId && (
                  <ExecutionControls 
                    organizationId={organizationId}
                    onCallPlaced={handleCallPlaced}
                  />
                )}

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

        {/* Tutorial Tour - Auto-starts for new users */}
        <ProductTour tourId="voice" steps={VOICE_TOUR} />
      </div>
    </VoiceConfigProvider>
  )
}

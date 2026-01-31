"use client"

import React, { useState, useEffect, useCallback } from 'react'
import type { Call } from '@/app/voice/page'
import { VoiceConfigProvider } from '@/hooks/useVoiceConfig'
import { WebRTCProvider, useWebRTCContext } from '@/hooks/WebRTCProvider'
import { TargetNumberProvider } from '@/hooks/TargetNumberProvider'
import { SignalWireProvider } from '@/contexts/SignalWireContext'
import VoiceHeader from './VoiceHeader'
import CallList from './CallList'
import CallDetailView from './CallDetailView'
import TargetCampaignSelector from './TargetCampaignSelector'
import ExecutionControls from './ExecutionControls'
import WebRTCCallControls from './WebRTCCallControls'
import { CallingModeSelector, CallingMode } from './CallingModeSelector'
import ActivityFeedEmbed from './ActivityFeedEmbed'
import CallModulations from './CallModulations'
import { BookingsList } from './BookingsList'
import { BookingModal } from './BookingModal'
import { OnboardingWizard, OnboardingConfig } from './OnboardingWizard'
import { RecentTargets } from './RecentTargets'
import { ActiveCallPanel } from './ActiveCallPanel'
import { useRealtime } from '@/hooks/useRealtime'
import { ProductTour, VOICE_TOUR } from '@/components/tour'
import { MobileBottomNav, MobileTab } from './MobileBottomNav' // Componentized Nav
import { useActiveCall } from '@/hooks/useActiveCall' // Logic Extraction
import { ChevronDown, ChevronUp } from 'lucide-react' // Standardized Icons

export interface VoiceOperationsClientProps {
  initialCalls: Call[]
  organizationId: string | null
  organizationName?: string
}

// Helper component that has access to WebRTC context for CallingModeSelector
function CallingModeSelectorWithWebRTC({
  mode,
  onModeChange,
  disabled,
}: {
  mode: CallingMode
  onModeChange: (mode: CallingMode) => void
  disabled?: boolean
}) {
  const webrtc = useWebRTCContext()
  return (
    <CallingModeSelector
      mode={mode}
      onModeChange={onModeChange}
      webrtcStatus={webrtc.status}
      disabled={disabled}
    />
  )
}

/**
 * VoiceOperationsClient - Professional Design System v3.0
 * 
 * Single-page voice operations interface with:
 * - First-time user onboarding
 * - Recent targets quick access
 * - Progressive disclosure for options
 * - Active call status panel
 * - WebRTC browser calling support
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

  // Calling mode: phone (traditional) or browser (WebRTC)
  const [callingMode, setCallingMode] = useState<CallingMode>('phone')

  // Active call tracking (ID State + Hook Logic)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const activeCall = useActiveCall(activeCallId) // Replaces manual polling effects

  // Mobile navigation state
  const [mobileTab, setMobileTab] = useState<MobileTab>('dial')

  // Real-time updates for active call
  const { updates } = useRealtime(organizationId)

  // Check if first-time user (no calls, no targets configured)
  useEffect(() => {
    if (initialCalls.length === 0) {
      setShowOnboarding(true)
    }
  }, [initialCalls.length])

  // Monitor real-time updates for active call
  useEffect(() => {
    if (!activeCallId || !updates.length) return

    updates.forEach((update) => {
      if (update.table === 'calls' && update.new?.id === activeCallId) {
        const status = update.new.status
        activeCall.setStatus(status) // Delegate to hook
      }
    })
  }, [updates, activeCallId, activeCall])

  // Listen for call selection events from activity feed
  useEffect(() => {
    function handleCallSelect(e: CustomEvent) {
      const callId = e.detail?.callId
      if (callId) {
        setSelectedCallId(callId)
        setMobileTab('dial')
        // Use ref instead of getElementById if possible, but keeping for now as minimal change
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
    // Hook will handle status updates, but we set initial state
    activeCall.setStatus('initiating') // Optional: Hook might default to polling 
    activeCall.reset() // Reset duration
    setSelectedCallId(callId)
  }

  const handleOnboardingComplete = async (config: OnboardingConfig) => {
    setShowOnboarding(false)

    const callEvent = new CustomEvent('onboarding:complete', {
      detail: {
        targetNumber: config.targetNumber,
        targetName: config.targetName,
        fromNumber: config.fromNumber,
        record: config.record,
        transcribe: config.transcribe,
      }
    })
    window.dispatchEvent(callEvent)
  }

  const handleTargetSelect = (number: string, name?: string) => {
    // Handled by TargetCampaignSelector through config context
  }

  const handleNewCall = () => {
    setActiveCallId(null)
    activeCall.reset()
  }

  async function handleModulationChange(mods: Record<string, boolean>) {
    // Handled by CallModulations component directly
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
      <SignalWireProvider>
        <WebRTCProvider organizationId={organizationId}>
          <TargetNumberProvider>
            <div className="flex flex-col h-screen bg-gray-50">
              {/* Header */}
              <VoiceHeader organizationId={organizationId} organizationName={organizationName} />

              {/* ========== DESKTOP LAYOUT (lg and up) ========== */}
              <div className="hidden lg:flex flex-1 overflow-hidden">
                {/* Left Rail - Call List (280px) */}
                <aside className="w-72 border-r border-gray-200 flex flex-col overflow-hidden bg-white" data-tour="call-list">
                  <div className="border-b border-gray-200 p-4">
                    <BookingsList
                      onBookingClick={(booking) => { }}
                      onNewBooking={() => setShowBookingModal(true)}
                      limit={3}
                    />
                  </div>

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
                    {/* Active Call Panel */}
                    {activeCallId && activeCall.status && (
                      <ActiveCallPanel
                        callId={activeCallId}
                        organizationId={organizationId || undefined}
                        status={activeCall.status}
                        duration={activeCall.duration}
                        onViewDetails={() => setSelectedCallId(activeCallId)}
                        onNewCall={handleNewCall}
                        showConfirmations={true}
                      />
                    )}

                    {/* Target & Campaign Selector */}
                    <div className="space-y-4" data-tour="target-selector">
                      <TargetCampaignSelector organizationId={organizationId} />
                    </div>

                    {/* Calling Mode Toggle - Phone vs Browser */}
                    <div className="bg-white rounded-md border border-gray-200 p-4">
                      <CallingModeSelectorWithWebRTC
                        mode={callingMode}
                        onModeChange={setCallingMode}
                        disabled={!!activeCallId}
                      />
                    </div>

                    {/* PRIMARY ACTION: Call Controls - Mode dependent */}
                    <div data-tour="place-call">
                      {callingMode === 'phone' && !activeCallId && (
                        <ExecutionControls
                          organizationId={organizationId}
                          onCallPlaced={handleCallPlaced}
                        />
                      )}
                      {callingMode === 'browser' && (
                        <WebRTCCallControls
                          organizationId={organizationId}
                          onCallPlaced={handleCallPlaced}
                        />
                      )}
                    </div>

                    {/* Recent Targets */}
                    <div className="bg-white rounded-md border border-gray-200 p-4">
                      <RecentTargets
                        organizationId={organizationId}
                        onSelect={handleTargetSelect}
                        limit={3}
                      />
                    </div>

                    {/* Call Options - Progressive Disclosure */}
                    <section className="bg-white rounded-md border border-gray-200" data-tour="call-options">
                      <button
                        onClick={() => setOptionsExpanded(!optionsExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <h2 className="text-sm font-semibold text-gray-900">Call Options</h2>
                          <p className="text-xs text-gray-500">Recording, transcription, and more</p>
                        </div>
                        {optionsExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
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
                <div className="flex-1 overflow-y-auto">
                  {/* Dial Tab */}
                  {mobileTab === 'dial' && (
                    <div className="p-4 space-y-4">
                      {activeCallId && activeCall.status && (
                        <ActiveCallPanel
                          callId={activeCallId}
                          organizationId={organizationId || undefined}
                          status={activeCall.status}
                          duration={activeCall.duration}
                          onViewDetails={() => setSelectedCallId(activeCallId)}
                          onNewCall={handleNewCall}
                          showConfirmations={true}
                        />
                      )}

                      <TargetCampaignSelector organizationId={organizationId} />

                      {/* Calling Mode Toggle */}
                      <div className="bg-white rounded-md border border-gray-200 p-4">
                        <CallingModeSelectorWithWebRTC
                          mode={callingMode}
                          onModeChange={setCallingMode}
                          disabled={!!activeCallId}
                        />
                      </div>

                      {/* Call Controls - Mode dependent */}
                      {callingMode === 'phone' && !activeCallId && (
                        <ExecutionControls
                          organizationId={organizationId}
                          onCallPlaced={handleCallPlaced}
                        />
                      )}
                      {callingMode === 'browser' && (
                        <WebRTCCallControls
                          organizationId={organizationId}
                          onCallPlaced={handleCallPlaced}
                        />
                      )}

                      {/* Recent Targets */}
                      <div className="bg-white rounded-md border border-gray-200 p-4">
                        <RecentTargets
                          organizationId={organizationId}
                          onSelect={handleTargetSelect}
                          limit={3}
                        />
                      </div>

                      {/* Call Options - Collapsible */}
                      <details className="bg-white rounded-md border border-gray-200 group">
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

                      {/* Scheduled Calls - Collapsible */}
                      <details className="bg-white rounded-md border border-gray-200">
                        <summary className="p-4 cursor-pointer font-medium text-gray-900 flex items-center justify-between">
                          <span>Scheduled Calls</span>
                          <span className="text-sm text-gray-500">Tap to view</span>
                        </summary>
                        <div className="p-4 pt-0 border-t border-gray-200">
                          <BookingsList
                            onBookingClick={(booking) => { }}
                            onNewBooking={() => setShowBookingModal(true)}
                            limit={5}
                          />
                        </div>
                      </details>

                      {/* Call Detail View */}
                      <div id="call-detail-container">
                        <CallDetailView
                          callId={selectedCallId}
                          organizationId={organizationId}
                          onModulationChange={handleModulationChange}
                        />
                      </div>
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

                {/* Mobile Bottom Navigation - Componentized */}
                <MobileBottomNav
                  currentTab={mobileTab}
                  onTabChange={setMobileTab}
                  callsCount={initialCalls.length}
                  onScheduleClick={() => setShowBookingModal(true)}
                />
              </div>

              {/* Booking Modal */}
              <BookingModal
                isOpen={showBookingModal}
                onClose={() => setShowBookingModal(false)}
                onSuccess={(booking) => {
                  setShowBookingModal(false)
                }}
              />

              {/* Tutorial Tour */}
              <ProductTour tourId="voice" steps={VOICE_TOUR} />
            </div>
          </TargetNumberProvider>
        </WebRTCProvider>
      </SignalWireProvider>
    </VoiceConfigProvider>
  )
}

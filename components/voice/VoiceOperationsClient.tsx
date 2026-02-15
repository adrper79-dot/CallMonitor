'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { Call } from '@/app/voice-operations/page'
import { VoiceConfigProvider, useVoiceConfig } from '@/hooks/useVoiceConfig'
import { WebRTCProvider, useWebRTCContext } from '@/hooks/WebRTCProvider'
import { TargetNumberProvider, useTargetNumber } from '@/hooks/TargetNumberProvider'
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
import { RecentTargets } from './RecentTargets'
import { ActiveCallPanel } from './ActiveCallPanel'
import { LiveTranslationPanel } from './LiveTranslationPanel'
import PaymentCalculator from './PaymentCalculator'
import { useRealtime } from '@/hooks/useRealtime'
import { ProductTour, VOICE_TOUR, REVIEW_TOUR } from '@/components/tour'
import { MobileBottomNav, MobileTab } from './MobileBottomNav' // Componentized Nav
import { useActiveCall } from '@/hooks/useActiveCall' // Logic Extraction
import { ChevronDown, ChevronUp } from 'lucide-react' // Standardized Icons
import { OnboardingWizard, OnboardingConfig } from './OnboardingWizard'
import { QuickDisposition, DispositionCode } from './QuickDisposition'
import { TodayQueue } from './TodayQueue'
import { useRBAC } from '@/hooks/useRBAC'

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
 * LiveTranslationFeed — Reads voice config to conditionally show LiveTranslationPanel.
 * Must be rendered inside VoiceConfigProvider.
 */
function LiveTranslationFeed({
  callId,
  organizationId,
}: {
  callId: string
  organizationId: string | null
}) {
  const { config } = useVoiceConfig(organizationId)

  // Only show when translate is enabled AND mode is 'live'
  if (!config?.translate || config.translate_mode !== 'live') return null
  if (!organizationId) return null

  return (
    <LiveTranslationPanel
      callId={callId}
      organizationId={organizationId}
      sourceLanguage={config.translate_from || 'en'}
      targetLanguage={config.translate_to || 'es'}
      isActive={true}
    />
  )
}

/**
 * VoiceOperationsClient - Professional Design System v3.0
 *
 * Single-page calls interface with:
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
  const [optionsExpanded, setOptionsExpanded] = useState(false)
  
  // Check if user completed standalone onboarding 
  const [standaloneOnboardingDone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('wib-onboarding-completed') === 'true'
  })
  
  const rbac = useRBAC(organizationId)
  const [showOnboarding, setShowOnboarding] = useState(initialCalls.length === 0 && !standaloneOnboardingDone)
  const [importStatus, setImportStatus] = useState<'idle' | 'running' | 'completed'>('idle')
  const [dismissedImportStatus, setDismissedImportStatus] = useState(false)

  // Post-call disposition state
  const [lastCompletedCallId, setLastCompletedCallId] = useState<string | null>(null)
  const [dispositioned, setDispositioned] = useState(false)

  // First run detection for UI layout decisions
  const isFirstRun = initialCalls.length === 0

  // Responsive layout: true when viewport >= lg (1024px)

  // Calling mode: phone (traditional) or browser (WebRTC)
  const [callingMode, setCallingMode] = useState<CallingMode>('phone')

  // Active call tracking (ID State + Hook Logic)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const activeCall = useActiveCall(activeCallId) // Replaces manual polling effects

  // Track terminal call states for disposition flow
  const isCallTerminal = activeCall.status && ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(activeCall.status)

  // When a call reaches terminal state, capture it for disposition
  useEffect(() => {
    if (isCallTerminal && activeCallId && activeCallId !== lastCompletedCallId) {
      setLastCompletedCallId(activeCallId)
      setDispositioned(false)
    }
  }, [isCallTerminal, activeCallId, lastCompletedCallId])

  // Mobile navigation state
  const [mobileTab, setMobileTab] = useState<MobileTab>('dial')

  const hideRightRail = isFirstRun && !activeCallId

  // Real-time updates for active call
  const { updates } = useRealtime(organizationId)

  // Monitor real-time updates for active call
  useEffect(() => {
    if (!activeCallId || !updates.length) return

    updates.forEach((update) => {
      const row = update.data as any
      if (update.table === 'calls' && row?.id === activeCallId) {
        const status = row.status
        activeCall.setStatus(status) // Delegate to hook
      }
    })
  }, [updates, activeCallId, activeCall])

  useEffect(() => {
    const status = localStorage.getItem('wib-import-status') as
      | 'idle'
      | 'running'
      | 'completed'
      | null
    if (status) {
      setImportStatus(status)
      if (status === 'running') {
        setDismissedImportStatus(false)
      }
    }

    function handleStorage(e: StorageEvent) {
      if (e.key === 'wib-import-status' && e.newValue) {
        const next = e.newValue as 'idle' | 'running' | 'completed'
        setImportStatus(next)
        if (next === 'running') setDismissedImportStatus(false)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    if (initialCalls.length > 0 && showOnboarding) {
      setShowOnboarding(false)
    }
  }, [initialCalls.length, showOnboarding])

  // Listen for call selection events from activity feed
  useEffect(() => {
    function handleCallSelect(e: CustomEvent) {
      const callId = e.detail?.call_id
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

  const handleTargetSelect = (number: string, name?: string) => {
    // Handled by TargetCampaignSelector through config context
  }

  const handleNewCall = () => {
    setActiveCallId(null)
    activeCall.reset()
    setDispositioned(false)
    setLastCompletedCallId(null)
  }

  const handleDisposition = (code: DispositionCode, notes?: string) => {
    setDispositioned(true)
    // Fire event for API persistence (handled by the voice-operations page or a listener)
    window.dispatchEvent(
      new CustomEvent('call:disposition', {
        detail: {
          callId: lastCompletedCallId,
          dispositionCode: code,
          notes,
        },
      })
    )
  }

  const handleDialNext = () => {
    // Reset call state and advance — the queue will pick up the next entry
    setActiveCallId(null)
    activeCall.reset()
    setDispositioned(false)
    setLastCompletedCallId(null)
  }

  async function handleModulationChange(mods: Record<string, boolean>) {
    // Handled by CallModulations component directly
  }

  return (
    <VoiceConfigProvider organizationId={organizationId}>
      <WebRTCProvider organizationId={organizationId}>
        <TargetNumberProvider>
          <VoiceOperationsInner
            initialCalls={initialCalls}
            organizationId={organizationId}
            organizationName={organizationName}
            selectedCallId={selectedCallId}
            setSelectedCallId={setSelectedCallId}
            showBookingModal={showBookingModal}
            setShowBookingModal={setShowBookingModal}
            optionsExpanded={optionsExpanded}
            setOptionsExpanded={setOptionsExpanded}
            callingMode={callingMode}
            setCallingMode={setCallingMode}
            activeCallId={activeCallId}
            activeCall={activeCall}
            mobileTab={mobileTab}
            setMobileTab={setMobileTab}
            showOnboarding={showOnboarding}
            setShowOnboarding={setShowOnboarding}
            isFirstRun={initialCalls.length === 0}
            handleCallPlaced={handleCallPlaced}
            handleTargetSelect={handleTargetSelect}
            handleNewCall={handleNewCall}
            handleModulationChange={handleModulationChange}
            importStatus={importStatus}
            setImportStatus={setImportStatus}
            dismissedImportStatus={dismissedImportStatus}
            setDismissedImportStatus={setDismissedImportStatus}
            hideRightRail={hideRightRail}
            lastCompletedCallId={lastCompletedCallId}
            dispositioned={dispositioned}
            isCallTerminal={!!isCallTerminal}
            handleDisposition={handleDisposition}
            handleDialNext={handleDialNext}
          />
        </TargetNumberProvider>
      </WebRTCProvider>
    </VoiceConfigProvider>
  )
}

/**
 * Inner component that renders inside TargetNumberProvider
 * so it can access setTargetNumber for booking → dial flow.
 */
function VoiceOperationsInner({
  initialCalls,
  organizationId,
  organizationName,
  selectedCallId,
  setSelectedCallId,
  showBookingModal,
  setShowBookingModal,
  optionsExpanded,
  setOptionsExpanded,
  callingMode,
  setCallingMode,
  activeCallId,
  activeCall,
  mobileTab,
  setMobileTab,
  showOnboarding,
  setShowOnboarding,
  isFirstRun,
  handleCallPlaced,
  handleTargetSelect,
  handleNewCall,
  handleModulationChange,
  importStatus,
  setImportStatus,
  dismissedImportStatus,
  setDismissedImportStatus,
  hideRightRail,
  lastCompletedCallId,
  dispositioned,
  isCallTerminal,
  handleDisposition,
  handleDialNext,
}: {
  initialCalls: Call[]
  organizationId: string | null
  organizationName?: string
  selectedCallId: string | null
  setSelectedCallId: (id: string | null) => void
  showBookingModal: boolean
  setShowBookingModal: (show: boolean) => void
  optionsExpanded: boolean
  setOptionsExpanded: (expanded: boolean) => void
  callingMode: CallingMode
  setCallingMode: (mode: CallingMode) => void
  activeCallId: string | null
  activeCall: ReturnType<typeof useActiveCall>
  mobileTab: MobileTab
  setMobileTab: (tab: MobileTab) => void
  showOnboarding: boolean
  setShowOnboarding: (show: boolean) => void
  isFirstRun: boolean
  handleCallPlaced: (callId: string) => void
  handleTargetSelect: (number: string, name?: string) => void
  handleNewCall: () => void
  handleModulationChange: (mods: Record<string, boolean>) => Promise<void>
  importStatus: 'idle' | 'running' | 'completed'
  setImportStatus: (status: 'idle' | 'running' | 'completed') => void
  dismissedImportStatus: boolean
  setDismissedImportStatus: (dismissed: boolean) => void
  hideRightRail: boolean
  lastCompletedCallId: string | null
  dispositioned: boolean
  isCallTerminal: boolean
  handleDisposition: (code: DispositionCode, notes?: string) => void
  handleDialNext: () => void
}) {
  const { setTargetNumber } = useTargetNumber()

  const showImportBanner = importStatus !== 'idle' && !dismissedImportStatus

  /** Pre-fill the dialer with booking's phone number and switch to Dial tab */
  const handleBookingClick = useCallback(
    (booking: { attendee_phone: string; title?: string }) => {
      if (booking.attendee_phone) {
        setTargetNumber(booking.attendee_phone)
        setMobileTab('dial')
      }
    },
    [setTargetNumber, setMobileTab]
  )

  const handleOnboardingComplete = useCallback(
    (config: OnboardingConfig) => {
      window.dispatchEvent(new CustomEvent('onboarding:complete', { detail: config }))
      setShowOnboarding(false)
    },
    [setShowOnboarding]
  )

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false)
  }, [setShowOnboarding])

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen bg-gray-50">
      <VoiceHeader organizationId={organizationId} organizationName={organizationName} />

      {/* ========== DESKTOP LAYOUT (lg and up) ========== */}
      <div className="hidden lg:flex flex-1 min-h-0">
        {/* Left Rail - Call List (280px) */}
        <aside
          className="w-72 shrink-0 border-r border-gray-200 flex flex-col bg-white"
          data-tour="call-list"
        >
          <div className="border-b border-gray-200 p-4 shrink-0">
            <BookingsList
              onBookingClick={handleBookingClick}
              onNewBooking={() => setShowBookingModal(true)}
              limit={3}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            <CallList
              calls={initialCalls}
              selectedCallId={selectedCallId}
              organizationId={organizationId}
              onSelect={setSelectedCallId}
            />
          </div>
        </aside>

        {/* Main Area - Call Controls & Detail */}
        <main className="flex-1 min-w-0 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {isFirstRun && showOnboarding && !activeCallId && (
              <OnboardingWizard
                organizationId={organizationId}
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingSkip}
              />
            )}

            {showImportBanner && (
              <section
                className={`rounded-md border px-4 py-3 ${
                  importStatus === 'running'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-green-200 bg-green-50 text-green-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {importStatus === 'running'
                        ? 'Import running in the background'
                        : 'Import completed'}
                    </p>
                    <p className="text-xs mt-1">
                      {importStatus === 'running'
                        ? 'You can start calling now while contacts finish importing.'
                        : 'Your contacts are ready. Start a call or review the import.'}
                    </p>
                    <Link
                      href="/voice-operations/accounts?tab=import&history=1"
                      className="text-xs font-medium text-current hover:underline"
                    >
                      View import history
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissedImportStatus(true)
                      localStorage.setItem('wib-import-status', 'idle')
                      setImportStatus('idle')
                    }}
                    className="text-xs font-medium text-current hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </section>
            )}

            {/* First run quick start temporarily disabled - TypeScript build worker variable recognition issue */}
            {isFirstRun && !showOnboarding && !showImportBanner && (
              <section className="bg-white rounded-md border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900">Quick Start</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Complete these steps to finish your first call.
                </p>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li>1. Add a target or enter a number</li>
                  <li>2. Place your first call</li>
                  <li>3. Review evidence after completion</li>
                </ul>
                <div className="mt-3">
                  <Link href="/onboarding" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                    Start onboarding
                  </Link>
                </div>
              </section>
            )}

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

            {/* Quick Disposition — shown when call reaches terminal state */}
            {isCallTerminal && lastCompletedCallId && (
              <QuickDisposition
                callId={lastCompletedCallId}
                onDisposition={handleDisposition}
                onDialNext={handleDialNext}
                showDialNext={dispositioned}
                disabled={false}
              />
            )}

            {/* Today's Queue — shown when idle (no active call, not first run) */}
            {!activeCallId && !isFirstRun && !isCallTerminal && (
              <TodayQueue
                entries={[]}
                currentIndex={0}
                completedCount={0}
                onSelectEntry={() => {}}
                onStartQueue={() => {}}
                isIdle={true}
              />
            )}

            {/* Live Translation Panel — shown during active calls when translate mode is 'live' */}
            {activeCallId &&
              activeCall.status &&
              ['initiating', 'ringing', 'in_progress'].includes(activeCall.status) && (
                <LiveTranslationFeed callId={activeCallId} organizationId={organizationId} />
              )}

            {/* Target & Campaign Selector */}
            <div className="space-y-4" data-tour="target-selector">
              <TargetCampaignSelector organizationId={organizationId} />
            </div>

            {/* PRIMARY ACTION: Call Controls - Desktop */}
            <section className="bg-white rounded-md border border-gray-200 p-4 space-y-4" data-tour="place-call">
              <CallingModeSelectorWithWebRTC
                mode={callingMode}
                onModeChange={setCallingMode}
                disabled={!!activeCallId}
              />
              {callingMode === 'phone' && (
                <ExecutionControls
                  organizationId={organizationId}
                  onCallPlaced={handleCallPlaced}
                  embedded={true}
                />
              )}
              {callingMode === 'browser' && (
                <WebRTCCallControls
                  organizationId={organizationId}
                  onCallPlaced={handleCallPlaced}
                />
              )}
            </section>

            {/* Call Options - Progressive Disclosure */}
            <section
              className="bg-white rounded-md border border-gray-200"
              data-tour="call-options"
            >
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
                      record: true,
                      transcribe: true,
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
        {!hideRightRail && (
          <aside
            className="w-72 shrink-0 border-l border-gray-200 overflow-hidden flex flex-col p-4 bg-white"
            data-tour="activity-feed"
          >
            <div className="space-y-4">
              {activeCallId &&
                activeCall.status &&
                ['initiating', 'ringing', 'in_progress'].includes(activeCall.status) && (
                  <div className="bg-gray-50 rounded-md border border-gray-200 p-3">
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">Live Translation</h3>
                    <LiveTranslationFeed callId={activeCallId} organizationId={organizationId} />
                  </div>
                )}

              {activeCallId &&
                activeCall.status &&
                ['initiating', 'ringing', 'in_progress'].includes(activeCall.status) && (
                  <div className="bg-gray-50 rounded-md border border-gray-200 p-3">
                    <PaymentCalculator />
                  </div>
                )}

              <div className="bg-gray-50 rounded-md border border-gray-200 p-3">
                <h3 className="text-xs font-semibold text-gray-700 mb-2">Recent Targets</h3>
                <RecentTargets
                  organizationId={organizationId}
                  onSelect={handleTargetSelect}
                  limit={5}
                />
              </div>
            </div>

            <div className="flex-1 overflow-hidden mt-4">
              <ActivityFeedEmbed organizationId={organizationId} limit={20} />
            </div>
          </aside>
        )}
      </div>

      {/* ========== MOBILE/TABLET LAYOUT (below lg) ========== */}
      <div className="hidden max-lg:flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {/* Dial Tab */}
          {mobileTab === 'dial' && (
            <div className="p-4 space-y-4">
              {showImportBanner && (
                <section
                  className={`rounded-md border px-4 py-3 ${
                    importStatus === 'running'
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-green-200 bg-green-50 text-green-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {importStatus === 'running'
                          ? 'Import running in the background'
                          : 'Import completed'}
                      </p>
                      <p className="text-xs mt-1">
                        {importStatus === 'running'
                          ? 'You can start calling now while contacts finish importing.'
                          : 'Your contacts are ready. Start a call or review the import.'}
                      </p>
                      <Link
                        href="/voice-operations/accounts?tab=import&history=1"
                        className="text-xs font-medium text-current hover:underline"
                      >
                        View import history
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDismissedImportStatus(true)
                        localStorage.setItem('wib-import-status', 'idle')
                        setImportStatus('idle')
                      }}
                      className="text-xs font-medium text-current hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </section>
              )}

              {isFirstRun && showOnboarding && !activeCallId && (
                <OnboardingWizard
                  organizationId={organizationId}
                  onComplete={handleOnboardingComplete}
                  onSkip={handleOnboardingSkip}
                />
              )}

              {isFirstRun && !showOnboarding && !showImportBanner && (
                <section className="bg-white rounded-md border border-gray-200 p-4">
                  {/* commented out for debugging
                  {standaloneOnboardingDone ? (
                    <>
                      <h2 className="text-sm font-semibold text-gray-900">Welcome Back</h2>
                      <p className="text-xs text-gray-500 mt-1">
                        Your workspace is ready. Enter a number or select an account to begin.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => document.querySelector<HTMLInputElement>('[data-target-input]')?.focus()} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                          Start dialing
                        </button>
                        <Link href="/voice-operations/accounts" className="text-xs font-medium text-gray-500 hover:text-gray-700">
                          Manage accounts
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-sm font-semibold text-gray-900">Quick Start</h2>
                      <p className="text-xs text-gray-500 mt-1">
                        Complete these steps to finish your first call.
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-gray-600">
                        <li>1. Add a target or enter a number</li>
                        <li>2. Place your first call</li>
                        <li>3. Review evidence after completion</li>
                      </ul>
                      <div className="mt-3">
                        <Link href="/onboarding" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                          Start onboarding
                        </Link>
                      </div>
                    </>
                  )}
                  */}
                </section>
              )}

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

              {/* Quick Disposition — Mobile */}
              {isCallTerminal && lastCompletedCallId && (
                <QuickDisposition
                  callId={lastCompletedCallId}
                  onDisposition={handleDisposition}
                  onDialNext={handleDialNext}
                  showDialNext={dispositioned}
                  disabled={false}
                />
              )}

              {/* Today's Queue — Mobile idle state */}
              {!activeCallId && !isFirstRun && !isCallTerminal && (
                <TodayQueue
                  entries={[]}
                  currentIndex={0}
                  completedCount={0}
                  onSelectEntry={() => {}}
                  onStartQueue={() => {}}
                  isIdle={true}
                />
              )}

              <div className="lg:hidden p-4">
                <TargetCampaignSelector organizationId={organizationId} />
              </div>

              {/* Call Controls - Mobile */}
              <section className="lg:hidden bg-white rounded-md border border-gray-200 p-4 space-y-4">
                <CallingModeSelectorWithWebRTC
                  mode={callingMode}
                  onModeChange={setCallingMode}
                  disabled={!!activeCallId}
                />
                {callingMode === 'phone' && !activeCallId && (
                  <ExecutionControls
                    organizationId={organizationId}
                    onCallPlaced={handleCallPlaced}
                    embedded={true}
                  />
                )}
                {callingMode === 'browser' && (
                  <WebRTCCallControls
                    organizationId={organizationId}
                    onCallPlaced={handleCallPlaced}
                  />
                )}
              </section>

              {/* Quick Targets - Collapsible */}
              <details className="bg-white rounded-md border border-gray-200">
                <summary className="p-4 cursor-pointer font-medium text-gray-900 flex items-center justify-between">
                  <span>Quick Targets</span>
                  <span className="text-sm text-gray-500">Tap to view</span>
                </summary>
                <div className="p-4 pt-0 border-t border-gray-200">
                  <RecentTargets
                    organizationId={organizationId}
                    onSelect={handleTargetSelect}
                    limit={3}
                  />
                </div>
              </details>

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
                      record: true,
                      transcribe: true,
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
                    onBookingClick={handleBookingClick}
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
          {mobileTab === 'updates' && (
            <div className="p-4">
              <ActivityFeedEmbed organizationId={organizationId} limit={30} />
            </div>
          )}
        </div>

        {/* Supervisor Mobile Tabs - Navigate to full pages */}
          {mobileTab === 'dashboard' && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-600 mb-3">Redirecting to dashboard&hellip;</p>
              <a href="/dashboard" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Open Dashboard
              </a>
            </div>
          )}
          {mobileTab === 'analytics' && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-600 mb-3">Redirecting to analytics&hellip;</p>
              <a href="/analytics" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Open Analytics
              </a>
            </div>
          )}
          {mobileTab === 'teams' && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-600 mb-3">Redirecting to teams&hellip;</p>
              <a href="/teams" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Open Teams
              </a>
            </div>
          )}
          {mobileTab === 'queue' && (
            <div className="px-4 py-4">
              <TodayQueue
                entries={[]}
                currentIndex={0}
                completedCount={0}
                onSelectEntry={() => {}}
                onStartQueue={() => setMobileTab('dial')}
                isIdle={true}
              />
            </div>
          )}

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
      <ProductTour tourId="voice" steps={selectedCallId ? REVIEW_TOUR : VOICE_TOUR} />
    </div>
  )
}

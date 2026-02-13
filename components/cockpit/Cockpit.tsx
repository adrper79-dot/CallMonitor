'use client'

/**
 * Cockpit — The 3-Column Agent Workspace
 *
 * This is the single most important screen. Agents spend 90% of their time here.
 *
 * Layout:
 * ┌──────────────┬──────────────────────────┬──────────────────┐
 * │  WORK QUEUE   │     CALL CENTER          │  CONTEXT PANEL   │
 * │  (Left Rail)  │     (Center Stage)       │  (Right Rail)    │
 * │  AI-priority  │  Controls + Transcript   │  Account + Comp  │
 * │  accounts     │  + AI Assist + Dispose   │  + Payment Tools │
 * └──────────────┴──────────────────────────┴──────────────────┘
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useActiveCall } from '@/hooks/useActiveCall'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts'
import { apiGet, apiPost, apiPut } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Phone, PhoneOff, Pause, Play, Mic, MicOff, ArrowRight,
  CreditCard, FileText, CalendarClock, AlertTriangle, PhoneForwarded,
  ChevronLeft, ChevronRight, Maximize2, Minimize2,
  CheckCircle2, XCircle, Shield, ShieldAlert, ShieldCheck,
  Clock, Zap, MessageSquare, Bot, Volume2,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface QueueAccount {
  id: string
  name: string
  primary_phone: string
  balance_due: number
  days_past_due: number
  status: string
  likelihood_score: number | null
  last_contacted_at: string | null
  contact_count_7day: number
  priority: 'critical' | 'high' | 'medium' | 'low'
}

interface ComplianceCheck {
  dnc: boolean
  consent: boolean
  time_ok: boolean
  frequency_ok: boolean
  legal_hold: boolean
  bankruptcy: boolean
  mini_miranda: boolean
}

interface CockpitProps {
  organizationId: string | null
  organizationName?: string
}

type CockpitPanel = 'queue' | 'context'

// ─────────────────────────────────────────────
// Left Rail: Work Queue
// ─────────────────────────────────────────────

function WorkQueueRail({
  accounts,
  loading,
  selectedId,
  onSelect,
  onRefresh,
}: {
  accounts: QueueAccount[]
  loading: boolean
  selectedId: string | null
  onSelect: (account: QueueAccount) => void
  onRefresh: () => void
}) {
  const priorityColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-400',
    medium: 'bg-yellow-400',
    low: 'bg-gray-300',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Queue header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Work Queue
          </h3>
          <button
            onClick={onRefresh}
            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
          >
            Refresh
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {accounts.length} accounts · AI-prioritized
        </p>
      </div>

      {/* Account list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-md animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            <p className="font-medium">Queue empty</p>
            <p className="text-xs mt-1">All accounts worked today</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {accounts.map((account, idx) => (
              <button
                key={account.id}
                onClick={() => onSelect(account)}
                className={`
                  w-full text-left px-2.5 py-2 rounded-md transition-all text-sm
                  ${selectedId === account.id
                    ? 'bg-primary-50 border border-primary-200 dark:bg-primary-900/20 dark:border-primary-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'}
                `}
              >
                <div className="flex items-start gap-2">
                  {/* Priority dot */}
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${priorityColors[account.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate text-[13px]">
                        {account.name}
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 ml-2">
                        ${account.balance_due.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-500">
                        {account.days_past_due}d overdue
                      </span>
                      {account.likelihood_score !== null && (
                        <span className="flex items-center gap-0.5 text-[11px]">
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span className={
                            account.likelihood_score >= 70
                              ? 'text-green-600 dark:text-green-400 font-medium'
                              : account.likelihood_score >= 40
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-gray-400'
                          }>
                            {account.likelihood_score}%
                          </span>
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {account.contact_count_7day}/7
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Center Stage: Call Interface
// ─────────────────────────────────────────────

function CallCenter({
  selectedAccount,
  organizationId,
  onDisposition,
  onDialNext,
  onCallStarted,
}: {
  selectedAccount: QueueAccount | null
  organizationId: string | null
  onDisposition: (code: string, notes?: string) => void
  onDialNext: () => void
  onCallStarted?: (callId: string | null) => void
}) {
  const [callState, setCallState] = useState<'idle' | 'dialing' | 'connected' | 'ended'>('idle')
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [held, setHeld] = useState(false)
  const [transcript, setTranscript] = useState<string[]>([])
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)

  // Timer for call duration
  useEffect(() => {
    if (callState !== 'connected') return
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000)
    return () => clearInterval(interval)
  }, [callState])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleDial = async () => {
    if (!selectedAccount || !organizationId) return
    setCallState('dialing')
    setCallDuration(0)
    setTranscript([])
    setAiSuggestion(null)
    try {
      // Pre-dial compliance check
      const compliance = await apiGet(
        `/api/compliance/pre-dial?accountId=${selectedAccount.id}`
      )
      if (!compliance.allowed) {
        setCallState('idle')
        logger.warn('Pre-dial check failed', { reason: compliance.reason })
        return
      }
      // Initiate call via Telnyx
      const callRes = await apiPost('/api/calls/start', {
        phone_number: selectedAccount.primary_phone,
        system_id: selectedAccount.id,
      })
      const newCallId = callRes.call?.id || null
      setActiveCallId(newCallId)
      onCallStarted?.(newCallId)
      setCallState('connected')
    } catch (err: any) {
      logger.error('Dial failed', { error: err?.message })
      setCallState('idle')
    }
  }

  const handleHangUp = async () => {
    setCallState('ended')
  }

  const DISPOSITIONS = [
    { code: 'promise_to_pay', label: 'Promise to Pay', shortcut: '1', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' },
    { code: 'refused', label: 'Refused', shortcut: '2', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
    { code: 'no_answer', label: 'No Answer', shortcut: '3', color: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
    { code: 'left_voicemail', label: 'Left VM', shortcut: '4', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
    { code: 'wrong_number', label: 'Wrong #', shortcut: '5', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' },
    { code: 'disputed', label: 'Disputed', shortcut: '6', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' },
    { code: 'callback', label: 'Callback', shortcut: '7', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' },
  ]

  // ─── Idle state: show instruction ───
  if (!selectedAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <Phone className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select an account</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Choose an account from the queue on the left to start collecting.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ─── Call Controls Bar ─── */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {selectedAccount.name}
            </h3>
            <p className="text-xs text-gray-500">{selectedAccount.primary_phone}</p>
          </div>

          <div className="flex items-center gap-2">
            {callState === 'connected' && (
              <>
                <Badge variant="secondary" className="text-xs font-mono">
                  {formatDuration(callDuration)}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMuted(!muted)}
                  className={muted ? 'text-red-600 border-red-200' : ''}
                >
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHeld(!held)}
                  className={held ? 'text-amber-600 border-amber-200' : ''}
                >
                  {held ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" title="Transfer">
                  <PhoneForwarded className="w-4 h-4" />
                </Button>
              </>
            )}

            {/* Primary call action */}
            {callState === 'idle' || callState === 'ended' ? (
              <Button
                onClick={handleDial}
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                size="sm"
              >
                <Phone className="w-4 h-4" />
                Dial
              </Button>
            ) : callState === 'dialing' ? (
              <Button disabled size="sm" className="gap-1.5">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Dialing...
              </Button>
            ) : (
              <Button
                onClick={handleHangUp}
                variant="destructive"
                size="sm"
                className="gap-1.5"
              >
                <PhoneOff className="w-4 h-4" />
                Hang Up
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main call area ─── */}
      <div className="flex-1 overflow-y-auto">
        {/* Live Transcript */}
        {callState === 'connected' && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">
                Live Transcript
              </span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 min-h-[200px] max-h-[300px] overflow-y-auto text-sm space-y-2">
              {transcript.length === 0 ? (
                <p className="text-gray-400 italic text-xs">Waiting for speech...</p>
              ) : (
                transcript.map((line, i) => (
                  <p key={i} className="text-gray-700 dark:text-gray-300">{line}</p>
                ))
              )}
            </div>
          </div>
        )}

        {/* AI Script Assistant */}
        {callState === 'connected' && aiSuggestion && (
          <div className="px-4 pb-3">
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">AI Suggests</p>
                    <p className="text-sm text-blue-900 dark:text-blue-200">{aiSuggestion}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Call ended → show empty state or disposition */}
        {callState === 'idle' && (
          <div className="p-4">
            <Card>
              <CardContent className="p-6 text-center">
                <Phone className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Ready to call <span className="font-medium text-gray-900 dark:text-gray-100">{selectedAccount.name}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Balance: ${selectedAccount.balance_due.toLocaleString()} · {selectedAccount.days_past_due} days overdue
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ─── Disposition Bar (always visible when call ended) ─── */}
      {(callState === 'ended' || callState === 'connected') && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {callState === 'ended' ? 'Disposition' : 'Quick Dispose'}
            </span>
            <span className="text-[10px] text-gray-400">(press 1-7)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DISPOSITIONS.map((d) => (
              <button
                key={d.code}
                onClick={() => onDisposition(d.code)}
                className={`
                  px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors
                  ${d.color}
                `}
              >
                <span className="opacity-50 mr-1">{d.shortcut}</span>
                {d.label}
              </button>
            ))}
          </div>
          {callState === 'ended' && (
            <Button
              onClick={onDialNext}
              className="w-full mt-2 bg-primary-600 hover:bg-primary-700 text-white gap-1.5"
              size="sm"
            >
              <ArrowRight className="w-4 h-4" />
              Dial Next Account
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Right Rail: Context Panel
// ─────────────────────────────────────────────

function ContextPanel({
  selectedAccount,
  organizationId,
  onSendPaymentLink,
  onScheduleCallback,
  onAddNote,
  onFileDispute,
}: {
  selectedAccount: QueueAccount | null
  organizationId: string | null
  onSendPaymentLink: () => void
  onScheduleCallback: () => void
  onAddNote: () => void
  onFileDispute: () => void
}) {
  const [compliance, setCompliance] = useState<ComplianceCheck | null>(null)
  const [loadingCompliance, setLoadingCompliance] = useState(false)

  // Fetch compliance status when account changes
  useEffect(() => {
    if (!selectedAccount || !organizationId) {
      setCompliance(null)
      return
    }
    setLoadingCompliance(true)
    apiGet(`/api/compliance/pre-dial?accountId=${selectedAccount.id}`)
      .then((data: any) => {
        setCompliance(data.checks || null)
      })
      .catch(() => setCompliance(null))
      .finally(() => setLoadingCompliance(false))
  }, [selectedAccount?.id, organizationId])

  if (!selectedAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-xs text-gray-500">Select an account to view details</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Account Info Card */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Account
        </h4>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Name</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{selectedAccount.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Balance</span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              ${selectedAccount.balance_due.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Days Overdue</span>
            <span className="text-gray-900 dark:text-gray-100">{selectedAccount.days_past_due}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Status</span>
            <Badge variant="secondary" className="text-[10px]">{selectedAccount.status}</Badge>
          </div>
          {selectedAccount.likelihood_score !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">AI Score</span>
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="font-medium">{selectedAccount.likelihood_score}%</span>
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Contacts (7d)</span>
            <span className={`font-medium ${selectedAccount.contact_count_7day >= 6 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {selectedAccount.contact_count_7day}/7
            </span>
          </div>
        </div>
      </div>

      {/* Compliance Status — ALWAYS VISIBLE */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Compliance
        </h4>
        {loadingCompliance ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : compliance ? (
          <div className="space-y-1">
            {[
              { key: 'time_ok', label: 'Time of Day', ok: compliance.time_ok },
              { key: 'frequency_ok', label: '7-in-7 Limit', ok: compliance.frequency_ok },
              { key: 'consent', label: 'Consent', ok: compliance.consent },
              { key: 'dnc', label: 'Not on DNC', ok: compliance.dnc },
              { key: 'legal_hold', label: 'No Legal Hold', ok: !compliance.legal_hold },
              { key: 'bankruptcy', label: 'No Bankruptcy', ok: !compliance.bankruptcy },
              { key: 'mini_miranda', label: 'Mini-Miranda', ok: compliance.mini_miranda },
            ].map((check) => (
              <div key={check.key} className="flex items-center gap-2 text-xs">
                {check.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                )}
                <span className={check.ok ? 'text-gray-600 dark:text-gray-400' : 'text-red-600 dark:text-red-400 font-medium'}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No compliance data</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-3">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Quick Actions
        </h4>
        <div className="space-y-1.5">
          <button
            onClick={onSendPaymentLink}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5 text-green-600" />
            Send Payment Link
            <span className="ml-auto text-[10px] text-gray-400">⌘P</span>
          </button>
          <button
            onClick={onAddNote}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            Add Note
            <span className="ml-auto text-[10px] text-gray-400">⌘N</span>
          </button>
          <button
            onClick={onScheduleCallback}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
            Schedule Callback
            <span className="ml-auto text-[10px] text-gray-400">⌘B</span>
          </button>
          <button
            onClick={onFileDispute}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            File Dispute
            <span className="ml-auto text-[10px] text-gray-400">⌘D</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Export: Cockpit
// ─────────────────────────────────────────────

export default function Cockpit({ organizationId, organizationName }: CockpitProps) {
  const [queueAccounts, setQueueAccounts] = useState<QueueAccount[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<QueueAccount | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  // Responsive: which panel to show on mobile
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [mobilePanel, setMobilePanel] = useState<'queue' | 'call' | 'context'>('call')
  // Desktop: collapsible left/right panels
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // ─── Fetch queue ───
  const fetchQueue = useCallback(async () => {
    if (!organizationId) return
    setQueueLoading(true)
    try {
      const data = await apiGet(`/api/collections?limit=25&sort=priority`)
      const accounts: QueueAccount[] = (data.data || data.accounts || []).map((a: any) => ({
        id: a.id,
        name: a.name || a.account_name || 'Unknown',
        primary_phone: a.primary_phone || a.phone || '',
        balance_due: parseFloat(a.balance_due || a.balance || 0),
        days_past_due: a.days_past_due || a.overdue_days || 0,
        status: a.status || 'active',
        likelihood_score: a.likelihood_score ?? null,
        last_contacted_at: a.last_contacted_at || null,
        contact_count_7day: a.contact_count_7day || 0,
        priority: a.likelihood_score >= 70 ? 'critical'
          : a.likelihood_score >= 50 ? 'high'
          : a.likelihood_score >= 30 ? 'medium'
          : 'low',
      }))
      setQueueAccounts(accounts)
      if (accounts.length > 0 && !selectedAccount) {
        setSelectedAccount(accounts[0])
        setSelectedIndex(0)
      }
    } catch (err: any) {
      logger.error('Failed to load queue', { error: err?.message })
    } finally {
      setQueueLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // ─── Advance to next account ───
  const dialNext = useCallback(() => {
    const nextIdx = selectedIndex + 1
    if (nextIdx < queueAccounts.length) {
      setSelectedAccount(queueAccounts[nextIdx])
      setSelectedIndex(nextIdx)
    }
  }, [selectedIndex, queueAccounts])

  // ─── Disposition handler ───
  const handleDisposition = useCallback(async (code: string, notes?: string) => {
    if (!selectedAccount || !organizationId) return
    try {
      if (activeCallId) {
        await apiPut(`/api/calls/${activeCallId}/disposition`, {
          disposition: code,
          disposition_notes: notes || null,
        })
      }
      logger.info('Disposition saved', { code, account: selectedAccount.id, callId: activeCallId })
    } catch (err: any) {
      logger.error('Disposition failed', { error: err?.message })
    }
  }, [selectedAccount, organizationId, activeCallId])

  // ─── Quick action stubs ───
  const handlePaymentLink = useCallback(() => {
    // TODO: open payment link modal
    logger.info('Payment link requested', { account: selectedAccount?.id })
  }, [selectedAccount])

  const handleCallback = useCallback(() => {
    logger.info('Callback requested', { account: selectedAccount?.id })
  }, [selectedAccount])

  const handleNote = useCallback(() => {
    logger.info('Note requested', { account: selectedAccount?.id })
  }, [selectedAccount])

  const handleDispute = useCallback(() => {
    logger.info('Dispute requested', { account: selectedAccount?.id })
  }, [selectedAccount])

  // ─── Keyboard shortcuts ───
  const shortcuts: KeyboardShortcut[] = [
    { key: 'p', ctrl: true, action: handlePaymentLink, description: 'Send payment link', category: 'call' },
    { key: 'n', ctrl: true, action: handleNote, description: 'Add note', category: 'call' },
    { key: 'b', ctrl: true, action: handleCallback, description: 'Schedule callback', category: 'call' },
    { key: 'd', ctrl: true, action: handleDispute, description: 'File dispute', category: 'call' },
    { key: 's', ctrl: true, action: dialNext, description: 'Save & next account', category: 'navigation' },
    { key: 'e', ctrl: true, action: () => { setLeftCollapsed((p) => !p); setRightCollapsed((p) => !p) }, description: 'Toggle panels', category: 'navigation' },
  ]
  useKeyboardShortcuts(shortcuts)

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row bg-white dark:bg-gray-900">
      {/* ═══ Left Rail: Work Queue ═══ */}
      <div
        className={`
          ${leftCollapsed ? 'w-0 overflow-hidden' : 'w-full lg:w-64 xl:w-72'}
          ${mobilePanel === 'queue' ? 'block' : 'hidden lg:block'}
          border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-all duration-200
          flex-shrink-0
        `}
      >
        <WorkQueueRail
          accounts={queueAccounts}
          loading={queueLoading}
          selectedId={selectedAccount?.id || null}
          onSelect={(account) => {
            setSelectedAccount(account)
            setSelectedIndex(queueAccounts.findIndex((a) => a.id === account.id))
            setMobilePanel('call')
          }}
          onRefresh={fetchQueue}
        />
      </div>

      {/* Collapse toggle (desktop) */}
      <button
        onClick={() => setLeftCollapsed((p) => !p)}
        className="hidden lg:flex items-center justify-center w-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-r border-gray-200 dark:border-gray-700"
        title={leftCollapsed ? 'Show queue' : 'Hide queue'}
      >
        {leftCollapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronLeft className="w-3 h-3 text-gray-400" />}
      </button>

      {/* ═══ Center: Call Interface ═══ */}
      <div
        className={`
          flex-1 min-w-0
          ${mobilePanel === 'call' ? 'block' : 'hidden lg:block'}
        `}
      >
        <CallCenter
          selectedAccount={selectedAccount}
          organizationId={organizationId}
          onDisposition={handleDisposition}
          onDialNext={dialNext}
          onCallStarted={setActiveCallId}
        />
      </div>

      {/* Collapse toggle (desktop) */}
      <button
        onClick={() => setRightCollapsed((p) => !p)}
        className="hidden lg:flex items-center justify-center w-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-l border-gray-200 dark:border-gray-700"
        title={rightCollapsed ? 'Show context' : 'Hide context'}
      >
        {rightCollapsed ? <ChevronLeft className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
      </button>

      {/* ═══ Right Rail: Context Panel ═══ */}
      <div
        className={`
          ${rightCollapsed ? 'w-0 overflow-hidden' : 'w-full lg:w-64 xl:w-72'}
          ${mobilePanel === 'context' ? 'block' : 'hidden lg:block'}
          border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-all duration-200
          flex-shrink-0
        `}
      >
        <ContextPanel
          selectedAccount={selectedAccount}
          organizationId={organizationId}
          onSendPaymentLink={handlePaymentLink}
          onScheduleCallback={handleCallback}
          onAddNote={handleNote}
          onFileDispute={handleDispute}
        />
      </div>

      {/* ═══ Mobile Panel Switcher ═══ */}
      <div className="lg:hidden fixed bottom-14 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-30">
        <div className="flex items-center justify-around h-10">
          {[
            { key: 'queue' as const, label: 'Queue', icon: '📋' },
            { key: 'call' as const, label: 'Call', icon: '📞' },
            { key: 'context' as const, label: 'Info', icon: '📊' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMobilePanel(tab.key)}
              className={`
                flex items-center gap-1 px-4 py-1.5 text-xs font-medium rounded-md transition-colors
                ${mobilePanel === tab.key
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

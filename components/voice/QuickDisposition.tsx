'use client'

import React from 'react'
import { useToast } from '@/components/ui/use-toast'
import { apiGet, apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

export type DispositionCode =
  | 'promise_to_pay'
  | 'refused'
  | 'no_answer'
  | 'left_voicemail'
  | 'wrong_number'
  | 'disputed'
  | 'callback_requested'

interface QuickDispositionProps {
  callId: string
  onDisposition: (code: DispositionCode, notes?: string) => void
  onDialNext?: () => void
  showDialNext?: boolean
  nextContactName?: string
  nextContactBalance?: string
  disabled?: boolean
  /** Campaign ID for auto-advance queue fetching */
  campaignId?: string
  /** Callback when auto-advance completes successfully */
  onAutoAdvanceComplete?: (nextAccount: any) => void
}

const DISPOSITIONS: { code: DispositionCode; label: string; shortcut: string; color: string }[] = [
  { code: 'promise_to_pay', label: 'Promise to Pay', shortcut: '1', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
  { code: 'refused', label: 'Refused', shortcut: '2', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  { code: 'no_answer', label: 'No Answer', shortcut: '3', color: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100' },
  { code: 'left_voicemail', label: 'Left VM', shortcut: '4', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { code: 'wrong_number', label: 'Wrong Number', shortcut: '5', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
  { code: 'disputed', label: 'Disputed', shortcut: '6', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { code: 'callback_requested', label: 'Callback', shortcut: '7', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' },
]

// LocalStorage keys for auto-advance preferences
const AUTO_ADVANCE_ENABLED_KEY = 'wb-auto-advance-enabled'
const AUTO_ADVANCE_DELAY_KEY = 'wb-auto-advance-delay'

/**
 * Get auto-advance preferences from localStorage
 */
function getAutoAdvancePrefs(): { enabled: boolean; delay: number } {
  if (typeof window === 'undefined') return { enabled: false, delay: 2 }
  
  const enabled = localStorage.getItem(AUTO_ADVANCE_ENABLED_KEY) === 'true'
  const delay = parseInt(localStorage.getItem(AUTO_ADVANCE_DELAY_KEY) || '2', 10)
  
  return { enabled, delay: Math.min(Math.max(delay, 1), 5) } // Clamp 1-5 seconds
}

/**
 * Save auto-advance preferences to localStorage
 */
export function setAutoAdvancePrefs(enabled: boolean, delay: number) {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(AUTO_ADVANCE_ENABLED_KEY, enabled.toString())
  localStorage.setItem(AUTO_ADVANCE_DELAY_KEY, delay.toString())
}

/**
 * QuickDisposition — Post-call rapid disposition with keyboard shortcuts.
 * 
 * Design: Apple HIG — ONE primary action (Dial Next), supporting actions (dispositions).
 * Norman: Match mental model — collectors disposition then advance. Make it instant.
 * 
 * v3.0 Features:
 * - Auto-advance after disposition with configurable delay
 * - Countdown timer with cancel option
 * - Compliance checks before auto-dial
 * - User preferences saved to localStorage
 * - Fetches next account from dialer queue
 * - Auto-dials via POST /api/calls
 */
export function QuickDisposition({
  callId,
  onDisposition,
  onDialNext,
  showDialNext = false,
  nextContactName,
  nextContactBalance,
  disabled = false,
  campaignId,
  onAutoAdvanceComplete,
}: QuickDispositionProps) {
  const [selected, setSelected] = React.useState<DispositionCode | null>(null)
  const [showNotes, setShowNotes] = React.useState(false)
  const [notes, setNotes] = React.useState('')
  const { toast } = useToast()
  
  // Auto-advance state
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = React.useState(() => 
    getAutoAdvancePrefs().enabled
  )
  const [autoAdvanceDelay, setAutoAdvanceDelay] = React.useState(() => 
    getAutoAdvancePrefs().delay
  )
  const [countdown, setCountdown] = React.useState<number | null>(null)
  const [isAutoDialing, setIsAutoDialing] = React.useState(false)
  const [nextAccount, setNextAccount] = React.useState<any>(null)
  const [isFetchingNext, setIsFetchingNext] = React.useState(false)
  const countdownTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const autoDialTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Sync localStorage when preferences change
  React.useEffect(() => {
    setAutoAdvancePrefs(autoAdvanceEnabled, autoAdvanceDelay)
  }, [autoAdvanceEnabled, autoAdvanceDelay])

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
      if (autoDialTimeoutRef.current) clearTimeout(autoDialTimeoutRef.current)
    }
  }, [])

  /**
   * Cancel auto-advance countdown
   */
  const cancelAutoAdvance = React.useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    if (autoDialTimeoutRef.current) {
      clearTimeout(autoDialTimeoutRef.current)
      autoDialTimeoutRef.current = null
    }
    setCountdown(null)
    setIsAutoDialing(false)
    setIsFetchingNext(false)
  }, [])

  /**
   * Fetch next account from dialer queue
   */
  const fetchNextAccount = React.useCallback(async () => {
    if (!campaignId && !showDialNext) {
      logger.debug('No campaign ID or showDialNext flag - skipping fetch')
      return null
    }

    setIsFetchingNext(true)
    try {
      const params = campaignId ? `?campaign_id=${campaignId}` : ''
      const response = await apiGet(`/api/dialer/next${params}`)
      
      if (response.success && response.account) {
        setNextAccount(response.account)
        return response.account
      } else {
        // Queue empty or no compliant accounts
        toast({
          title: 'Queue empty',
          description: response.message || 'No more accounts to dial',
          variant: 'default',
        })
        return null
      }
    } catch (error: any) {
      // 404 = queue empty or no campaign (not an error)
      if (error?.message?.includes('404') || error?.message?.includes('Queue') || error?.message?.includes('campaign')) {
        toast({
          title: 'Queue complete',
          description: 'No more accounts in dialer queue',
          variant: 'default',
        })
        return null
      }

      logger.error('Failed to fetch next account', { error: error?.message })
      toast({
        title: 'Auto-advance failed',
        description: 'Could not fetch next account from queue',
        variant: 'destructive',
      })
      return null
    } finally {
      setIsFetchingNext(false)
    }
  }, [campaignId, showDialNext, toast])

  /**
   * Trigger auto-dial with next account from queue
   */
  const triggerAutoDial = React.useCallback(async () => {
    setIsAutoDialing(true)
    
    try {
      // Fetch next account if we don't have one
      let accountToCall = nextAccount
      if (!accountToCall) {
        accountToCall = await fetchNextAccount()
      }

      if (!accountToCall) {
        // No account available - cancel auto-advance
        cancelAutoAdvance()
        return
      }

      // Originate call via POST /api/calls
      const callPayload = {
        to: accountToCall.phone,
        campaign_id: accountToCall.campaign_id || campaignId,
        campaign_call_id: accountToCall.campaign_call_id,
        enable_amd: true,
        metadata: {
          auto_advance: true,
          account_id: accountToCall.account_id,
        },
      }

      const callResponse = await apiPost('/api/calls', callPayload)

      if (callResponse.success || callResponse.data) {
        toast({
          title: 'Auto-dialing',
          description: `Calling ${accountToCall.name || accountToCall.phone}`,
          variant: 'default',
        })

        // Notify parent component if callback provided
        if (onAutoAdvanceComplete) {
          onAutoAdvanceComplete(accountToCall)
        }

        // Call legacy onDialNext if provided (backwards compatibility)
        if (onDialNext) {
          onDialNext()
        }

        // Clear next account so we fetch fresh on next disposition
        setNextAccount(null)
        cancelAutoAdvance()
      } else {
        throw new Error('Call creation failed')
      }
    } catch (error: any) {
      logger.error('Auto-dial failed', { error: error?.message })
      toast({
        title: 'Auto-dial failed',
        description: error?.message || 'Could not initiate next call',
        variant: 'destructive',
      })
      cancelAutoAdvance()
    }
  }, [nextAccount, fetchNextAccount, campaignId, toast, onAutoAdvanceComplete, onDialNext, cancelAutoAdvance])

  /**
   * Start auto-advance countdown after disposition
   */
  const startAutoAdvance = React.useCallback(() => {
    if (!autoAdvanceEnabled) return

    // Pre-fetch next account so we can show name during countdown
    fetchNextAccount().then((account) => {
      if (!account) {
        // Queue empty - don't start countdown
        return
      }

      // Start countdown
      setCountdown(autoAdvanceDelay)

      // Update countdown every second
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
            return null
          }
          return prev - 1
        })
      }, 1000)

      // Trigger auto-dial after delay
      autoDialTimeoutRef.current = setTimeout(() => {
        triggerAutoDial()
      }, autoAdvanceDelay * 1000)
    }).catch(() => {
      // Error fetching next account - don't start countdown
    })
  }, [autoAdvanceEnabled, autoAdvanceDelay, fetchNextAccount, triggerAutoDial])

  // Keyboard shortcuts for rapid disposition
  React.useEffect(() => {
    if (disabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const key = e.key

      // ESC cancels auto-advance countdown
      if (key === 'Escape' && countdown !== null) {
        e.preventDefault()
        cancelAutoAdvance()
        toast({
          title: 'Auto-advance cancelled',
          variant: 'default',
        })
        return
      }

      const disposition = DISPOSITIONS.find(d => d.shortcut === key)
      if (disposition) {
        e.preventDefault()
        handleDisposition(disposition.code)
      }

      // N = Dial Next (manual trigger)
      if (key === 'n' || key === 'N') {
        if (showDialNext && onDialNext && selected) {
          e.preventDefault()
          cancelAutoAdvance() // Cancel countdown if manually triggered
          onDialNext()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [disabled, selected, showDialNext, onDialNext, countdown, cancelAutoAdvance, toast])

  function handleDisposition(code: DispositionCode) {
    setSelected(code)
    onDisposition(code, notes || undefined)
    
    // Start auto-advance countdown after disposition
    startAutoAdvance()
  }

  return (
    <div className="bg-white rounded-md border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Call Outcome</h3>
        <span className="text-xs text-gray-400">Press 1-7 for quick disposition</span>
      </div>

      {/* Disposition Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DISPOSITIONS.map((d) => (
          <button
            key={d.code}
            onClick={() => handleDisposition(d.code)}
            disabled={disabled || countdown !== null}
            className={`
              relative px-3 py-2.5 rounded-md border text-sm font-medium transition-all
              ${selected === d.code ? 'ring-2 ring-primary-500 ring-offset-1' : ''}
              ${d.color}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <span className="absolute top-1 right-1.5 text-[10px] opacity-40 font-mono">{d.shortcut}</span>
            {d.label}
          </button>
        ))}
      </div>

      {/* Optional Notes */}
      <div>
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          disabled={countdown !== null}
        >
          {showNotes ? 'Hide notes' : 'Add notes (optional)'}
        </button>
        {showNotes && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Quick note about this call..."
            className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={2}
            disabled={countdown !== null}
          />
        )}
      </div>

      {/* Auto-Advance Countdown */}
      {countdown !== null && (
        <div className="border-t border-orange-100 pt-4">
          <div className="bg-orange-50 border border-orange-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isFetchingNext ? (
                  <svg className="w-4 h-4 text-orange-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-orange-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="text-sm font-medium text-orange-900">
                  {isFetchingNext ? 'Fetching next account...' : (
                    <>Auto-dialing in <span className="font-bold text-lg">{countdown}</span>s</>
                  )}
                </span>
              </div>
              <button
                onClick={cancelAutoAdvance}
                className="px-3 py-1 text-xs font-medium text-orange-700 hover:text-orange-900 hover:bg-orange-100 rounded transition-colors"
              >
                Cancel (ESC)
              </button>
            </div>
            {nextAccount && (
              <div className="text-xs text-orange-700">
                Next: {nextAccount.name || nextAccount.phone}
                {nextAccount.balance && ` ($${parseFloat(nextAccount.balance).toLocaleString()})`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dial Next CTA */}
      {showDialNext && selected && countdown === null && (
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => {
              cancelAutoAdvance()
              if (onDialNext) {
                onDialNext()
              } else {
                // Trigger auto-dial logic
                triggerAutoDial()
              }
            }}
            disabled={isAutoDialing || isFetchingNext}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(isAutoDialing || isFetchingNext) ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{isFetchingNext ? 'Fetching...' : 'Dialing...'}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>
                  Dial Next
                  {(nextAccount?.name || nextContactName) && (
                    <span className="font-normal opacity-80"> — {nextAccount?.name || nextContactName}</span>
                  )}
                  {(nextAccount?.balance || nextContactBalance) && (
                    <span className="font-normal opacity-60 text-sm"> (${parseFloat(nextAccount?.balance || nextContactBalance).toLocaleString()})</span>
                  )}
                </span>
                <kbd className="ml-auto px-1.5 py-0.5 bg-primary-700 rounded text-xs font-mono">N</kbd>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default QuickDisposition

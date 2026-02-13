'use client'

/**
 * DispositionBar — Standalone disposition buttons + keyboard shortcuts
 *
 * Used in the Cockpit after a call ends. Maps 7 RPC disposition codes
 * to numbered keyboard shortcuts (1-7). Calls PUT /api/calls/:id/disposition.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { apiPut } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle, XCircle, Clock, PhoneOff, CalendarClock,
  CreditCard, AlertTriangle,
} from 'lucide-react'

export interface DispositionCode {
  key: string
  label: string
  shortcut: number
  icon: React.ReactNode
  color: string
  category: 'positive' | 'negative' | 'neutral' | 'compliance'
}

export const DISPOSITION_CODES: DispositionCode[] = [
  {
    key: 'promise_to_pay',
    label: 'Promise to Pay',
    shortcut: 1,
    icon: <CreditCard className="w-4 h-4" />,
    color: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300',
    category: 'positive',
  },
  {
    key: 'payment_made',
    label: 'Payment Made',
    shortcut: 2,
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-300',
    category: 'positive',
  },
  {
    key: 'callback_requested',
    label: 'Callback',
    shortcut: 3,
    icon: <CalendarClock className="w-4 h-4" />,
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300',
    category: 'neutral',
  },
  {
    key: 'no_answer',
    label: 'No Answer',
    shortcut: 4,
    icon: <PhoneOff className="w-4 h-4" />,
    color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300',
    category: 'neutral',
  },
  {
    key: 'wrong_number',
    label: 'Wrong #',
    shortcut: 5,
    icon: <XCircle className="w-4 h-4" />,
    color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300',
    category: 'negative',
  },
  {
    key: 'refused_to_pay',
    label: 'Refused',
    shortcut: 6,
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300',
    category: 'negative',
  },
  {
    key: 'dispute',
    label: 'Dispute',
    shortcut: 7,
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300',
    category: 'compliance',
  },
]

interface DispositionBarProps {
  callId: string | null
  accountId: string | null
  onDisposition?: (code: string) => void
  disabled?: boolean
  /** When true, show in compact horizontal layout */
  compact?: boolean
}

export default function DispositionBar({
  callId,
  accountId,
  onDisposition,
  disabled = false,
  compact = false,
}: DispositionBarProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)

  const handleDisposition = useCallback(
    async (code: DispositionCode) => {
      if (disabled || submitting || submitted) return

      setSubmitting(true)
      try {
        if (callId) {
          await apiPut(`/api/calls/${callId}/disposition`, {
            disposition: code.key,
            disposition_notes: `Disposition set at ${new Date().toISOString()}`,
          })
        }
        setSubmitted(code.key)
        onDisposition?.(code.key)
        logger.info('Disposition recorded', { callId, code: code.key })
      } catch (err: any) {
        logger.error('Disposition failed', { error: err?.message, callId, code: code.key })
      } finally {
        setSubmitting(false)
      }
    },
    [callId, accountId, disabled, submitting, submitted, onDisposition]
  )

  // Keyboard shortcuts: 1-7 maps to dispositions
  useEffect(() => {
    if (disabled || submitted) return

    const handler = (e: KeyboardEvent) => {
      // Don't fire if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const num = parseInt(e.key)
      if (num >= 1 && num <= 7) {
        e.preventDefault()
        handleDisposition(DISPOSITION_CODES[num - 1])
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [disabled, submitted, handleDisposition])

  // Reset when call changes
  useEffect(() => {
    setSubmitted(null)
  }, [callId])

  if (submitted) {
    const code = DISPOSITION_CODES.find((c) => c.key === submitted)
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="text-sm font-medium text-green-700 dark:text-green-300">
          Disposition: {code?.label || submitted}
        </span>
      </div>
    )
  }

  return (
    <div className={compact ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'}>
      {!compact && (
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
          Disposition (press 1-7)
        </p>
      )}
      {DISPOSITION_CODES.map((code) => (
        <button
          key={code.key}
          onClick={() => handleDisposition(code)}
          disabled={disabled || submitting}
          className={`
            ${compact ? 'px-2 py-1' : 'w-full flex items-center gap-2 px-3 py-2'}
            rounded-md text-xs font-medium transition-colors
            ${code.color}
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        >
          {code.icon}
          <span className={compact ? 'hidden sm:inline' : ''}>
            {code.label}
          </span>
          <kbd className={`${compact ? 'ml-0.5' : 'ml-auto'} text-[9px] opacity-60 font-mono`}>
            {code.shortcut}
          </kbd>
        </button>
      ))}
    </div>
  )
}

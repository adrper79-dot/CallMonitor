'use client'

import React from 'react'

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

/**
 * QuickDisposition — Post-call rapid disposition with keyboard shortcuts.
 * 
 * Design: Apple HIG — ONE primary action (Dial Next), supporting actions (dispositions).
 * Norman: Match mental model — collectors disposition then advance. Make it instant.
 */
export function QuickDisposition({
  callId,
  onDisposition,
  onDialNext,
  showDialNext = false,
  nextContactName,
  nextContactBalance,
  disabled = false,
}: QuickDispositionProps) {
  const [selected, setSelected] = React.useState<DispositionCode | null>(null)
  const [showNotes, setShowNotes] = React.useState(false)
  const [notes, setNotes] = React.useState('')

  // Keyboard shortcuts for rapid disposition
  React.useEffect(() => {
    if (disabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const key = e.key
      const disposition = DISPOSITIONS.find(d => d.shortcut === key)
      if (disposition) {
        e.preventDefault()
        handleDisposition(disposition.code)
      }

      // N = Dial Next
      if (key === 'n' || key === 'N') {
        if (showDialNext && onDialNext && selected) {
          e.preventDefault()
          onDialNext()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [disabled, selected, showDialNext, onDialNext])

  function handleDisposition(code: DispositionCode) {
    setSelected(code)
    onDisposition(code, notes || undefined)
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
            disabled={disabled}
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
          />
        )}
      </div>

      {/* Dial Next CTA */}
      {showDialNext && selected && (
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={onDialNext}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>
              Dial Next
              {nextContactName && (
                <span className="font-normal opacity-80"> — {nextContactName}</span>
              )}
              {nextContactBalance && (
                <span className="font-normal opacity-60 text-sm"> (${nextContactBalance})</span>
              )}
            </span>
            <kbd className="ml-auto px-1.5 py-0.5 bg-primary-700 rounded text-xs font-mono">N</kbd>
          </button>
        </div>
      )}
    </div>
  )
}

export default QuickDisposition

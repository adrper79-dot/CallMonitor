'use client'

import React from 'react'

interface QueueEntry {
  id: string
  name: string
  phone: string
  balance: string
  daysPastDue?: number
  priority: 'high' | 'medium' | 'low'
  lastContactedAt?: string
  accountId?: string
}

interface TodayQueueProps {
  entries: QueueEntry[]
  currentIndex: number
  completedCount: number
  onSelectEntry: (entry: QueueEntry) => void
  onStartQueue: () => void
  isIdle: boolean
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-400',
  low: 'bg-gray-300',
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Hot lead',
  medium: 'Priority',
  low: 'Standard',
}

/**
 * TodayQueue — Replaces the empty idle state in VoiceOps cockpit.
 * 
 * Design philosophy:
 * - Dieter Rams: Remove noise. Show only what the worker needs right now.
 * - Don Norman: Match the mental model — collectors work through a stack.
 * - Apple HIG: One primary action (Start Queue / Resume).
 */
export function TodayQueue({
  entries,
  currentIndex,
  completedCount,
  onSelectEntry,
  onStartQueue,
  isIdle,
}: TodayQueueProps) {
  const remaining = entries.length - completedCount
  const progressPct = entries.length > 0 ? Math.round((completedCount / entries.length) * 100) : 0

  // Show the next 5 entries from current position
  const upcoming = entries.slice(currentIndex, currentIndex + 5)

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      {/* Header with progress */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Today&apos;s Queue</h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{completedCount}</span>
            <span>/</span>
            <span>{entries.length}</span>
            <span>completed</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 mb-1">No accounts queued for today</p>
          <p className="text-xs text-gray-400">Import accounts or run a campaign to populate your queue.</p>
        </div>
      ) : (
        <>
          {/* Start Queue CTA (idle state) */}
          {isIdle && remaining > 0 && (
            <div className="px-4 py-4 border-b border-gray-100 bg-primary-50">
              <button
                onClick={onStartQueue}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                {completedCount > 0 ? 'Resume Queue' : 'Start Queue'}
                <span className="font-normal opacity-75">({remaining} remaining)</span>
              </button>
            </div>
          )}

          {/* Queue entries */}
          <div className="divide-y divide-gray-50">
            {upcoming.map((entry, i) => (
              <button
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left group"
              >
                {/* Priority indicator */}
                <div className="flex flex-col items-center gap-0.5 min-w-[20px]">
                  <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[entry.priority]}`} />
                  <span className="text-[9px] text-gray-400">{PRIORITY_LABEL[entry.priority]?.split(' ')[0]}</span>
                </div>

                {/* Contact info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.name}</p>
                  <p className="text-xs text-gray-500">
                    {entry.phone}
                    {entry.daysPastDue !== undefined && (
                      <span className={`ml-2 ${entry.daysPastDue > 60 ? 'text-red-500' : 'text-gray-400'}`}>
                        {entry.daysPastDue}d past due
                      </span>
                    )}
                  </p>
                </div>

                {/* Balance */}
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">${entry.balance}</p>
                  {entry.lastContactedAt && (
                    <p className="text-[10px] text-gray-400">{entry.lastContactedAt}</p>
                  )}
                </div>

                {/* Hover arrow */}
                <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>

          {/* Queue footer with count */}
          {entries.length > 5 && (
            <div className="px-4 py-2 bg-gray-50 text-center">
              <span className="text-xs text-gray-400">
                +{entries.length - upcoming.length - completedCount} more in queue
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default TodayQueue

'use client'

import React from 'react'
import { WEBHOOK_EVENT_TYPES, WebhookEventType } from '@/types/tier1-features'

interface WebhookEventFilterProps {
  onFilterChange: (selectedEvents: string[]) => void
  selectedEvents: string[]
}

/**
 * WebhookEventFilter Component — Chip-based event type filter bar
 *
 * Shows all available webhook event types as toggleable chips.
 * Filters the WebhookList by selected event types.
 */
export function WebhookEventFilter({ onFilterChange, selectedEvents }: WebhookEventFilterProps) {
  function toggleEvent(event: WebhookEventType) {
    if (selectedEvents.includes(event)) {
      onFilterChange(selectedEvents.filter((e) => e !== event))
    } else {
      onFilterChange([...selectedEvents, event])
    }
  }

  function selectAll() {
    onFilterChange([...WEBHOOK_EVENT_TYPES])
  }

  function clearAll() {
    onFilterChange([])
  }

  const isAllSelected = selectedEvents.length === WEBHOOK_EVENT_TYPES.length
  const hasSelection = selectedEvents.length > 0

  // Group events by domain prefix for visual clarity
  function getEventDomain(event: string) {
    return event.split('.')[0]
  }

  // Get a color for each domain
  function getDomainColor(domain: string): { selected: string; unselected: string } {
    const colors: Record<string, { selected: string; unselected: string }> = {
      call: {
        selected: 'bg-blue-600 text-white border-blue-600',
        unselected: 'bg-white text-blue-700 border-blue-200 hover:border-blue-400',
      },
      recording: {
        selected: 'bg-purple-600 text-white border-purple-600',
        unselected: 'bg-white text-purple-700 border-purple-200 hover:border-purple-400',
      },
      transcript: {
        selected: 'bg-indigo-600 text-white border-indigo-600',
        unselected: 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-400',
      },
      translation: {
        selected: 'bg-teal-600 text-white border-teal-600',
        unselected: 'bg-white text-teal-700 border-teal-200 hover:border-teal-400',
      },
      survey: {
        selected: 'bg-amber-600 text-white border-amber-600',
        unselected: 'bg-white text-amber-700 border-amber-200 hover:border-amber-400',
      },
      scorecard: {
        selected: 'bg-green-600 text-white border-green-600',
        unselected: 'bg-white text-green-700 border-green-200 hover:border-green-400',
      },
      evidence: {
        selected: 'bg-rose-600 text-white border-rose-600',
        unselected: 'bg-white text-rose-700 border-rose-200 hover:border-rose-400',
      },
    }
    return (
      colors[domain] || {
        selected: 'bg-gray-600 text-white border-gray-600',
        unselected: 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
      }
    )
  }

  return (
    <div
      className="border border-gray-200 rounded-lg p-4"
      role="group"
      aria-label="Filter webhooks by event type"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Filter by Event Type
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            disabled={isAllSelected}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Select all event types"
          >
            All Events
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={clearAll}
            disabled={!hasSelection}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Clear all event type filters"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {WEBHOOK_EVENT_TYPES.map((event) => {
          const domain = getEventDomain(event)
          const colors = getDomainColor(domain)
          const isSelected = selectedEvents.includes(event)

          return (
            <button
              key={event}
              onClick={() => toggleEvent(event)}
              className={`
                inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium
                border transition-all cursor-pointer
                ${isSelected ? colors.selected : colors.unselected}
              `}
              aria-pressed={isSelected}
              aria-label={`${isSelected ? 'Remove' : 'Add'} ${event} filter`}
            >
              {event}
            </button>
          )
        })}
      </div>

      {hasSelection && (
        <p className="mt-3 text-xs text-gray-500">
          {selectedEvents.length} event type{selectedEvents.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}

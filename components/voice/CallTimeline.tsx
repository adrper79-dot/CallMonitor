"use client"

/**
 * Call Timeline Component
 * 
 * Displays a chronological view of all events for a call:
 * - Call lifecycle (started, answered, completed)
 * - Recording events
 * - Transcription events
 * - Translation events
 * - Survey events
 * - Notes and disposition
 * 
 * Per MASTER_ARCHITECTURE: Call is root object, all artifacts attach to it
 */

import React, { useState, useEffect } from 'react'
import { TimelineEvent, TimelineEventType, CallTimeline as CallTimelineType } from '@/types/tier1-features'
import { Badge } from '@/components/ui/badge'
import { ClientDate } from '@/components/ui/ClientDate'

interface CallTimelineProps {
  callId: string
  organizationId: string
}

// Event type configurations
const EVENT_CONFIG: Record<TimelineEventType, {
  icon: string
  label: string
  color: string
}> = {
  call_started: { icon: '📞', label: 'Call Started', color: 'bg-blue-100 text-blue-800' },
  call_answered: { icon: '✅', label: 'Call Answered', color: 'bg-green-100 text-green-800' },
  call_completed: { icon: '🏁', label: 'Call Completed', color: 'bg-gray-100 text-gray-800' },
  recording_started: { icon: '🔴', label: 'Recording Started', color: 'bg-red-100 text-red-800' },
  recording_completed: { icon: '⏹️', label: 'Recording Completed', color: 'bg-red-100 text-red-800' },
  transcript_started: { icon: '📝', label: 'Transcription Started', color: 'bg-purple-100 text-purple-800' },
  transcript_completed: { icon: '✍️', label: 'Transcript Ready', color: 'bg-purple-100 text-purple-800' },
  translation_completed: { icon: '🌐', label: 'Translation Ready', color: 'bg-cyan-100 text-cyan-800' },
  survey_started: { icon: '📋', label: 'Survey Started', color: 'bg-orange-100 text-orange-800' },
  survey_completed: { icon: '📊', label: 'Survey Completed', color: 'bg-orange-100 text-orange-800' },
  scorecard_generated: { icon: '⭐', label: 'Scorecard Generated', color: 'bg-yellow-100 text-yellow-800' },
  note_added: { icon: '📌', label: 'Note Added', color: 'bg-indigo-100 text-indigo-800' },
  disposition_set: { icon: '🏷️', label: 'Disposition Set', color: 'bg-teal-100 text-teal-800' },
  evidence_exported: { icon: '📤', label: 'Evidence Exported', color: 'bg-emerald-100 text-emerald-800' },
  consent_captured: { icon: '🔒', label: 'Consent Captured', color: 'bg-lime-100 text-lime-800' }
}

export default function CallTimeline({ callId, organizationId }: CallTimelineProps) {
  const [timeline, setTimeline] = useState<CallTimelineType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTimeline() {
      if (!callId) return
      
      setLoading(true)
      setError(null)
      
      try {
        const res = await fetch(`/api/calls/${callId}/timeline`, {
          credentials: 'include'
        })
        
        if (!res.ok) {
          throw new Error('Failed to load timeline')
        }
        
        const data = await res.json()
        setTimeline(data.timeline)
      } catch (err: any) {
        setError(err.message || 'Failed to load timeline')
      } finally {
        setLoading(false)
      }
    }
    
    fetchTimeline()
  }, [callId])

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg border border-[#E5E5E5]">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  if (!timeline || timeline.events.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg border border-[#E5E5E5]">
        <p className="text-[#666666] text-sm text-center">No timeline events yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E5E5] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#FAFAFA] border-b border-[#E5E5E5]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#333333]">📅 Call Timeline</h3>
          <div className="flex items-center space-x-2">
            {timeline.summary.has_recording && (
              <Badge variant="outline" className="text-xs">🎙️ Recorded</Badge>
            )}
            {timeline.summary.has_transcript && (
              <Badge variant="outline" className="text-xs">📝 Transcribed</Badge>
            )}
            {timeline.summary.has_translation && (
              <Badge variant="outline" className="text-xs">🌐 Translated</Badge>
            )}
            {timeline.summary.has_survey && (
              <Badge variant="outline" className="text-xs">📊 Survey</Badge>
            )}
            {timeline.summary.has_scorecard && (
              <Badge variant="outline" className="text-xs">⭐ Scored</Badge>
            )}
          </div>
        </div>
        {timeline.summary.duration_ms > 0 && (
          <p className="text-xs text-[#666666] mt-1">
            Duration: {formatDuration(timeline.summary.duration_ms)}
          </p>
        )}
      </div>

      {/* Timeline Events */}
      <div className="p-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[#E5E5E5]" />
          
          {/* Events */}
          <div className="space-y-4">
            {timeline.events.map((event, index) => (
              <TimelineEventItem 
                key={event.id} 
                event={event} 
                isLast={index === timeline.events.length - 1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      {timeline.summary.disposition && (
        <div className="px-4 py-3 bg-[#FAFAFA] border-t border-[#E5E5E5]">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-[#666666]">Disposition:</span>
            <Badge variant="secondary" className="capitalize">
              {timeline.summary.disposition.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Individual timeline event item
 */
function TimelineEventItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const config = EVENT_CONFIG[event.event_type] || {
    icon: '📍',
    label: event.event_type,
    color: 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="relative flex items-start pl-10">
      {/* Event dot */}
      <div className="absolute left-2 w-5 h-5 rounded-full bg-white border-2 border-[#E5E5E5] flex items-center justify-center text-xs">
        {config.icon}
      </div>

      {/* Event content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <Badge className={`${config.color} text-xs font-normal`}>
            {config.label}
          </Badge>
          <ClientDate 
            date={event.timestamp} 
            format="short"
            className="text-xs text-[#999999]"
          />
        </div>
        
        {/* Event details */}
        {event.actor_name && (
          <p className="text-xs text-[#666666] mt-1">
            by {event.actor_name}
          </p>
        )}
        
        {/* Additional metadata */}
        {event.metadata?.duration_ms && (
          <p className="text-xs text-[#666666] mt-1">
            Duration: {formatDuration(event.metadata.duration_ms)}
          </p>
        )}
        
        {event.metadata?.status && (
          <p className="text-xs text-[#666666] mt-1">
            Status: {event.metadata.status}
          </p>
        )}
        
        {/* Event-specific details */}
        {event.details && Object.keys(event.details).length > 0 && (
          <div className="mt-2 p-2 bg-[#FAFAFA] rounded text-xs">
            {Object.entries(event.details).slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2">
                <span className="text-[#666666] capitalize">{key.replace('_', ' ')}:</span>
                <span className="text-[#333333]">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s` 
      : `${minutes}m`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  return remainingMinutes > 0 
    ? `${hours}h ${remainingMinutes}m` 
    : `${hours}h`
}

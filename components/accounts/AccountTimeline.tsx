'use client'

import React, { useState, useEffect } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { format, parseISO, isToday, isYesterday } from 'date-fns'

interface TimelineMessage {
  id: string
  direction: 'inbound' | 'outbound'
  channel: 'sms' | 'email' | 'call'
  message_body: string
  subject?: string
  status: string
  created_at: string
  sent_at?: string
  delivered_at?: string
}

interface AccountTimelineProps {
  accountId: string
  showFilters?: boolean
  limit?: number
}

const CHANNEL_ICONS = {
  sms: '💬',
  email: '📧',
  call: '☎️',
}

const CHANNEL_COLORS = {
  sms: 'border-blue-400 bg-blue-50',
  email: 'border-purple-400 bg-purple-50',
  call: 'border-green-400 bg-green-50',
}

const DIRECTION_LABELS = {
  inbound: 'Received',
  outbound: 'Sent',
}

export function AccountTimeline({ accountId, showFilters = true, limit = 50 }: AccountTimelineProps) {
  const [messages, setMessages] = useState<TimelineMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState<'all' | 'sms' | 'email' | 'call'>('all')

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoading(true)
        const data = await apiGet(`/api/messages/threads/${accountId}`)
        setMessages(data.messages || [])
      } catch (error) {
        logger.error('Failed to fetch account timeline', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTimeline()
  }, [accountId])

  const formatTime = (timestamp: string) => {
    try {
      const date = parseISO(timestamp)
      if (isToday(date)) {
        return `Today ${format(date, 'h:mm a')}`
      } else if (isYesterday(date)) {
        return `Yesterday ${format(date, 'h:mm a')}`
      } else {
        return format(date, 'MMM d, yyyy h:mm a')
      }
    } catch {
      return 'Unknown time'
    }
  }

  const filteredMessages =
    channelFilter === 'all'
      ? messages
      : messages.filter((m) => m.channel === channelFilter)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-navy-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="flex gap-2">
          <button
            onClick={() => setChannelFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              channelFilter === 'all'
                ? 'bg-navy-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setChannelFilter('sms')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              channelFilter === 'sms'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            💬 SMS
          </button>
          <button
            onClick={() => setChannelFilter('email')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              channelFilter === 'email'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📧 Email
          </button>
          <button
            onClick={() => setChannelFilter('call')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              channelFilter === 'call'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ☎️ Calls
          </button>
        </div>
      )}

      {/* Timeline */}
      {filteredMessages.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">No activity</h3>
          <p className="mt-1 text-sm text-gray-500">
            No {channelFilter !== 'all' ? channelFilter : ''} messages found for this account
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Timeline items */}
          <div className="space-y-6">
            {filteredMessages.map((message) => (
              <div key={message.id} className="relative flex gap-4">
                {/* Icon */}
                <div
                  className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-4 ${CHANNEL_COLORS[message.channel]} flex items-center justify-center text-xl`}
                >
                  {CHANNEL_ICONS[message.channel]}
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {message.channel.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-500">
                          {DIRECTION_LABELS[message.direction]}
                        </span>
                      </div>
                      {message.subject && (
                        <p className="text-sm font-medium text-gray-700 mt-1">{message.subject}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatTime(message.created_at)}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {message.message_body || '(no content)'}
                  </div>

                  {/* Status */}
                  {message.status && message.direction === 'outbound' && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        Status: <span className="font-medium">{message.status}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { MessageThread } from './MessageThread'
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { formatDistanceToNow } from 'date-fns'

interface Message {
  id: string
  account_id: string
  account_name: string
  account_phone: string
  account_email: string
  direction: 'inbound' | 'outbound'
  channel: 'sms' | 'email' | 'call'
  from_number?: string
  to_number?: string
  from_email?: string
  to_email?: string
  message_body: string
  subject?: string
  status: string
  read_at: string | null
  created_at: string
  sent_at?: string
  delivered_at?: string
}

interface UnifiedInboxProps {
  organizationId: string
  defaultFilter?: 'all' | 'sms' | 'email' | 'call'
  accountId?: string
  onMessageSelect?: (messageId: string) => void
}

const CHANNEL_ICONS = {
  sms: '💬',
  email: '📧',
  call: '☎️',
}

const CHANNEL_COLORS = {
  sms: 'bg-blue-50 text-blue-600 border-blue-200',
  email: 'bg-purple-50 text-purple-600 border-purple-200',
  call: 'bg-green-50 text-green-600 border-green-200',
}

export function UnifiedInbox({ 
  organizationId, 
  defaultFilter = 'all', 
  accountId,
  onMessageSelect 
}: UnifiedInboxProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState<'all' | 'sms' | 'email' | 'call'>(defaultFilter)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 50

  // Fetch messages
  const fetchMessages = useCallback(async (reset = false) => {
    try {
      setLoading(true)
      const currentOffset = reset ? 0 : offset

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString(),
      })

      if (channelFilter !== 'all') params.append('channel', channelFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (accountId) params.append('account_id', accountId)
      if (searchQuery) params.append('search', searchQuery)

      const data = await apiGet(`/api/messages/inbox?${params.toString()}`)
      
      if (reset) {
        setMessages(data.messages || [])
        setSelectedMessage(null)
      } else {
        setMessages(prev => [...prev, ...(data.messages || [])])
      }
      
      setTotal(data.total || 0)
      setHasMore(data.has_more || false)
      setOffset(currentOffset + (data.messages?.length || 0))
    } catch (error) {
      logger.error('Failed to fetch inbox messages', error)
    } finally {
      setLoading(false)
    }
  }, [channelFilter, statusFilter, accountId, searchQuery, offset, limit])

  // Initial fetch
  useEffect(() => {
    fetchMessages(true)
  }, [channelFilter, statusFilter, searchQuery, accountId])

  // Real-time polling (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchMessages])

  // Mark message as read
  const markAsRead = async (messageId: string) => {
    try {
      await apiPatch(`/api/messages/${messageId}/read`, {})
      
      // Optimistic update
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, read_at: new Date().toISOString() } : msg
        )
      )

      if (selectedMessage?.id === messageId) {
        setSelectedMessage(prev => prev ? { ...prev, read_at: new Date().toISOString() } : null)
      }
    } catch (error) {
      logger.error('Failed to mark message as read', error)
    }
  }

  // Select message
  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message)
    if (onMessageSelect) onMessageSelect(message.id)
    
    // Mark as read if unread
    if (!message.read_at) {
      markAsRead(message.id)
    }
  }

  // Reply to message
  const handleReply = async (body: string, channel: 'sms' | 'email') => {
    if (!selectedMessage) return

    try {
      await apiPost(`/api/messages/${selectedMessage.id}/reply`, {
        message_body: body,
        channel,
      })

      // Refresh messages
      fetchMessages(true)
    } catch (error) {
      logger.error('Failed to send reply', error)
      throw error
    }
  }

  // Get initials from name
  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Format relative time
  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-gray-200" style={{ minHeight: '600px' }}>
        {/* Left Panel: Filters & Message List */}
        <div className="lg:col-span-1 flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            {/* Channel Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setChannelFilter('all')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  channelFilter === 'all'
                    ? 'bg-navy-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setChannelFilter('sms')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  channelFilter === 'sms'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                💬 SMS
              </button>
              <button
                onClick={() => setChannelFilter('email')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  channelFilter === 'email'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📧 Email
              </button>
              <button
                onClick={() => setChannelFilter('call')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  channelFilter === 'call'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ☎️ Calls
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-navy-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('unread')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === 'unread'
                    ? 'bg-navy-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setStatusFilter('read')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === 'read'
                    ? 'bg-navy-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Read
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />

            {/* Count */}
            <div className="text-sm text-gray-600">
              {total} message{total !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-4 border-navy-600 border-t-transparent rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <svg
                  className="w-16 h-16 text-gray-300 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">No messages</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery
                    ? 'No messages match your search'
                    : statusFilter === 'unread'
                    ? 'All caught up! No unread messages.'
                    : 'Messages will appear here'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {messages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => handleSelectMessage(message)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedMessage?.id === message.id ? 'bg-navy-50' : ''
                    } ${!message.read_at ? 'font-semibold' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center text-sm font-semibold">
                          {getInitials(message.account_name || 'Unknown')}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {message.account_name || message.account_phone || message.account_email || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatTime(message.created_at)}
                          </span>
                        </div>

                        {/* Channel & Direction */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${CHANNEL_COLORS[message.channel]}`}>
                            {CHANNEL_ICONS[message.channel]} {message.channel.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {message.direction === 'inbound' ? '↓' : '↑'}
                          </span>
                        </div>

                        {/* Preview */}
                        <p className="mt-1 text-sm text-gray-600 truncate">
                          {message.subject && <span className="font-medium">{message.subject}: </span>}
                          {message.message_body?.substring(0, 100) || '(no content)'}
                        </p>

                        {/* Unread indicator */}
                        {!message.read_at && (
                          <div className="mt-2">
                            <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {/* Load More */}
                {hasMore && (
                  <div className="p-4">
                    <button
                      onClick={() => fetchMessages(false)}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Message Thread */}
        <div className="lg:col-span-2 flex flex-col">
          {selectedMessage ? (
            <MessageThread
              accountId={selectedMessage.account_id}
              accountName={selectedMessage.account_name}
              messages={messages.filter(m => m.account_id === selectedMessage.account_id)}
              onReply={handleReply}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4"
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
                <p className="text-lg font-medium">Select a message</p>
                <p className="mt-1 text-sm">Choose a conversation to view the full thread</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

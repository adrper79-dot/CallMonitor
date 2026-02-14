'use client'

import React, { useState, useEffect, useRef } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { logger } from '@/lib/logger'

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  channel: 'sms' | 'email' | 'call'
  from_number?: string
  to_number?: string
  from_email?: string
  to_email?: string
  message_body: string
  subject?: string
  status: string
  created_at: string
  sent_at?: string
  delivered_at?: string
}

interface MessageThreadProps {
  accountId: string
  accountName: string
  messages: Message[]
  onReply: (body: string, channel: 'sms' | 'email') => Promise<void>
}

const CHANNEL_ICONS = {
  sms: '💬',
  email: '📧',
  call: '☎️',
}

const CHANNEL_COLORS = {
  sms: 'bg-blue-50 border-blue-200',
  email: 'bg-purple-50 border-purple-200',
  call: 'bg-green-50 border-green-200',
}

export function MessageThread({ accountId, accountName, messages, onReply }: MessageThreadProps) {
  const [replyText, setReplyText] = useState('')
  const [replyChannel, setReplyChannel] = useState<'sms' | 'email'>('sms')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-detect reply channel from most recent message
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.channel === 'sms' || lastMessage.channel === 'email') {
        setReplyChannel(lastMessage.channel)
      }
    }
  }, [messages])

  const handleSendReply = async () => {
    if (!replyText.trim()) return

    try {
      setSending(true)
      await onReply(replyText, replyChannel)
      setReplyText('')
    } catch (error) {
      logger.error('Failed to send reply', error)
      alert('Failed to send reply. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const formatMessageTime = (timestamp: string) => {
    try {
      const date = parseISO(timestamp)
      if (isToday(date)) {
        return format(date, 'h:mm a')
      } else if (isYesterday(date)) {
        return `Yesterday ${format(date, 'h:mm a')}`
      } else {
        return format(date, 'MMM d, h:mm a')
      }
    } catch {
      return 'Unknown time'
    }
  }

  const formatDate = (timestamp: string) => {
    try {
      const date = parseISO(timestamp)
      if (isToday(date)) return 'Today'
      if (isYesterday(date)) return 'Yesterday'
      return format(date, 'MMMM d, yyyy')
    } catch {
      return 'Unknown date'
    }
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  let currentDate = ''
  let currentGroup: Message[] = []

  messages.forEach((message) => {
    const messageDate = formatDate(message.created_at)
    if (messageDate !== currentDate) {
      if (currentGroup.length > 0) {
        groupedMessages.push({ date: currentDate, messages: currentGroup })
      }
      currentDate = messageDate
      currentGroup = [message]
    } else {
      currentGroup.push(message)
    }
  })

  if (currentGroup.length > 0) {
    groupedMessages.push({ date: currentDate, messages: currentGroup })
  }

  // Determine if we can reply (can't reply to calls)
  const canReply = messages.some(m => m.channel === 'sms' || m.channel === 'email')

  return (
    <div className="flex flex-col h-full">
      {/* Thread Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{accountName || 'Unknown Account'}</h2>
            <p className="text-sm text-gray-500">{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
          </div>
          <a
            href={`/accounts/${accountId}`}
            className="px-3 py-1.5 text-sm font-medium text-navy-600 hover:text-navy-700 border border-navy-300 rounded-md hover:bg-navy-50 transition-colors"
          >
            View Account
          </a>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-medium text-gray-500 uppercase">{group.date}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Messages for this date */}
            <div className="space-y-4">
              {group.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-3 ${
                      message.direction === 'outbound'
                        ? 'bg-navy-600 text-white'
                        : CHANNEL_COLORS[message.channel] || 'bg-gray-100'
                    }`}
                  >
                    {/* Channel Badge & Direction */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          message.direction === 'outbound'
                            ? 'bg-navy-500 text-navy-100'
                            : 'bg-white border border-gray-200 text-gray-700'
                        }`}
                      >
                        {CHANNEL_ICONS[message.channel]} {message.channel.toUpperCase()}
                      </span>
                      <span
                        className={`text-xs ${
                          message.direction === 'outbound' ? 'text-navy-200' : 'text-gray-500'
                        }`}
                      >
                        {message.direction === 'inbound' ? 'Received' : 'Sent'}
                      </span>
                    </div>

                    {/* Subject (for emails) */}
                    {message.subject && (
                      <div
                        className={`mb-2 pb-2 border-b ${
                          message.direction === 'outbound' ? 'border-navy-500' : 'border-gray-200'
                        }`}
                      >
                        <p
                          className={`text-sm font-semibold ${
                            message.direction === 'outbound' ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {message.subject}
                        </p>
                      </div>
                    )}

                    {/* Message Body */}
                    <div
                      className={`text-sm whitespace-pre-wrap break-words ${
                        message.direction === 'outbound' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {message.message_body || '(no content)'}
                    </div>

                    {/* Timestamp */}
                    <div
                      className={`mt-2 text-xs ${
                        message.direction === 'outbound' ? 'text-navy-200' : 'text-gray-500'
                      }`}
                    >
                      {formatMessageTime(message.created_at)}
                      {message.status === 'delivered' && message.direction === 'outbound' && (
                        <span className="ml-2">✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Box */}
      {canReply && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="space-y-3">
            {/* Channel Selector */}
            <div className="flex gap-2">
              {messages.some(m => m.channel === 'sms') && (
                <button
                  onClick={() => setReplyChannel('sms')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    replyChannel === 'sms'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  💬 Reply via SMS
                </button>
              )}
              {messages.some(m => m.channel === 'email') && (
                <button
                  onClick={() => setReplyChannel('email')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    replyChannel === 'email'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📧 Reply via Email
                </button>
              )}
            </div>

            {/* Reply Input */}
            <div className="flex gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Type your ${replyChannel} reply...`}
                rows={3}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSendReply()
                  }
                }}
              />
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim() || sending}
                className="px-4 py-2 bg-navy-600 text-white rounded-md hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-start"
              >
                {sending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Sending...
                  </div>
                ) : (
                  'Send'
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + Enter to send
            </p>
          </div>
        </div>
      )}

      {!canReply && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500 text-center">
            Cannot reply to call messages. Use the dialer to call back.
          </p>
        </div>
      )}
    </div>
  )
}

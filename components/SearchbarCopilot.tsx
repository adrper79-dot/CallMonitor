'use client'

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/apiClient'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  latency_ms?: number
}

interface Conversation {
  id: string
  title: string
  context_type?: string
  context_id?: string
  message_count: number
  last_message_at?: string
}

/**
 * SearchbarCopilot - Comprehensive AI Assistant
 *
 * Integrated into navigation for application and artifact assistance.
 * Provides contextual help, feature guidance, and artifact management.
 *
 * ARCH_DOCS Design Standards:
 * - Professional UI without emojis
 * - Clean, data-first approach
 * - Navy primary (#1E3A5F) with gold/cyan accents
 * - Floating capsule design language
 */
const SearchbarCopilot = forwardRef<{ openSearch: () => void }>((props, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Expose openSearch method via ref
  useImperativeHandle(ref, () => ({
    openSearch: () => setIsOpen(true)
  }), [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load conversations on open
  useEffect(() => {
    if (isOpen) {
      loadConversations()
    }
  }, [isOpen])

  const loadConversations = async () => {
    try {
      const data = await apiGet('/api/bond-ai/conversations')
      setConversations(data.conversations || [])
    } catch {
      /* ignore */
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const data = await apiGet(`/api/bond-ai/conversations/${conversationId}/messages`)
      setMessages(data.messages || [])
      setActiveConversation(conversationId)
      setShowHistory(false)
    } catch {
      /* ignore */
    }
  }

  const startNewConversation = () => {
    setActiveConversation(null)
    setMessages([])
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async () => {
    const msg = input.trim()
    if (!msg || loading) return

    setInput('')
    setLoading(true)

    // Optimistically add user message
    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'user',
        content: msg,
        created_at: new Date().toISOString(),
      },
    ])

    try {
      const data = await apiPost('/api/bond-ai/chat', {
        message: msg,
        conversation_id: activeConversation,
        context_type: 'general',
      })

      if (data.success) {
        if (!activeConversation) {
          setActiveConversation(data.conversation_id)
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: data.response.content,
            created_at: new Date().toISOString(),
            latency_ms: data.response.latency_ms,
          },
        ])
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `I'm sorry, I couldn't process that request. ${err.message || 'Please try again.'}`,
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await apiDelete(`/api/bond-ai/conversations/${id}`)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConversation === id) {
        startNewConversation()
      }
    } catch {
      /* ignore */
    }
  }

  // Quick action suggestions
  const quickActions = [
    "How do I create a new campaign?",
    "Show me today's call analytics",
    "Help me schedule a call",
    "What compliance rules apply?",
    "Generate a performance report",
    "Review my scorecard results",
    "Connect my CRM",
    "Set up Slack alerts",
    "Configure integrations",
  ]

  return (
    <>
      {/* Searchbar Trigger */}
      <div className="relative flex-1 max-w-md mx-4">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 group"
          style={{
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
          }}
        >
          <svg
            className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 text-left">
            Ask Bond AI for help...
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded border">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div
            className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Bond AI Assistant</h3>
                  <p className="text-xs text-blue-100">Application & Artifact Assistance</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  title="Chat history"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-96">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                  Recent Conversations
                </h4>
                {conversations.length === 0 ? (
                  <p className="text-sm text-gray-400 px-1">No conversations yet</p>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadMessages(conv.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group ${
                        activeConversation === conv.id
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium">{conv.title}</span>
                        <button
                          onClick={(e) => deleteConversation(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                          title="Delete"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        {conv.context_type && (
                          <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {conv.context_type}
                          </span>
                        )}
                        <span>{conv.message_count} msgs</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <>
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        How can I help you?
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[280px] mx-auto">
                        Ask me about features, analytics, compliance, scheduling, or any aspect of the platform.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        {quickActions.map((q) => (
                          <button
                            key={q}
                            onClick={() => {
                              setInput(q)
                              setTimeout(sendMessage, 50)
                            }}
                            className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        {msg.latency_ms && (
                          <div className="text-[10px] mt-1 opacity-50">{msg.latency_ms}ms</div>
                        )}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: '0ms' }}
                          />
                          <div
                            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: '150ms' }}
                          />
                          <div
                            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything about the platform..."
                      className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || loading}
                      className="px-4 py-3 rounded-xl bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span>Press Enter to send, Esc to close</span>
                    <button
                      onClick={startNewConversation}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      New conversation
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
})

SearchbarCopilot.displayName = 'SearchbarCopilot'

export default SearchbarCopilot
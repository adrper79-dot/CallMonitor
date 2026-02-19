'use client'

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react'
import { apiPost } from '@/lib/apiClient'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatUIProps {
  /** Context type passed to Bond AI (e.g. 'general', 'call') */
  contextType?: string
  /** Optional context ID */
  contextId?: string
}

export function ChatUI({ contextType = 'general', contextId }: ChatUIProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault()
    const msg = input.trim()
    if (!msg || isLoading) return

    setInput('')
    setIsLoading(true)

    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msg,
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const data = await apiPost('/api/bond-ai/chat', {
        message: msg,
        conversation_id: conversationId ?? undefined,
        context_type: contextType,
        context_id: contextId,
      })

      if (data.success) {
        if (!conversationId) {
          setConversationId(data.conversation_id)
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: data.response.content,
          },
        ])
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Unable to process request. ${err.message || 'Please try again.'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20 text-sm">
            <p>Connected to Bond AI Assistant.</p>
            <p>Ask about your stack, calls, or troubleshoot issues.</p>
            <p className="mt-2 text-xs">
              Try: &quot;Check system health&quot; or &quot;Why did the last call fail?&quot;
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 text-xs text-gray-500 animate-pulse">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Bond AI..."
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-[#0f172a] text-white px-4 py-2 rounded text-sm font-medium hover:bg-opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

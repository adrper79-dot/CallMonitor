'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useMemo, useRef } from 'react'

interface ChatUIProps {
  endpoint: string
  orgId: string
}

export function ChatUI({ endpoint, orgId }: ChatUIProps) {
  const chat: any = useChat({
    api: endpoint,
    body: { orgId },
  } as any)
  const stableMessages = useMemo(() => chat.messages ?? [], [chat.messages])
  const messages = stableMessages
  const handleSubmit = chat.handleSubmit ?? (() => {})
  const input = chat.input ?? ''
  const handleInputChange = chat.handleInputChange ?? (() => {})
  const isLoading = chat.status === 'streaming' || chat.status === 'submitted' || chat.isLoading

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [stableMessages])

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20 text-sm">
            <p>Connected to Stack Troubleshoot.</p>
            <p>Analyzing Neon + Workers + Telnyx checks...</p>
            <p className="mt-2 text-xs">
              Try: &quot;Fix my DB connection&quot; or &quot;Why did the last call fail?&quot;
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
              }`}
            >
              {m.role === 'assistant' ? (
                // Simple rendering for YAML/Code. In production, use markdown renderer.
                <code className="font-mono text-xs block bg-gray-50 p-2 rounded border border-gray-100 mt-1">
                  {m.content}
                </code>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-2 text-xs text-gray-500 animate-pulse">
              Analyzing stack...
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
            value={input}
            onChange={handleInputChange}
            placeholder="Describe the error..."
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

'use client'

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react'
import { apiPost } from '@/lib/apiClient'
import { MessageSquare, ChevronDown, ChevronUp, Sparkles, Send, X } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// Step-aware quick questions for the onboarding wizard
const STEP_HINTS: Record<string, { tip: string; questions: string[] }> = {
  plan: {
    tip: 'Your 14-day free trial includes all Pro features — calls, AI scoring, CRM sync, and compliance tools.',
    questions: [
      'What features are included in the trial?',
      'How does billing work after the trial?',
      'What plan is best for my team size?',
    ],
  },
  number: {
    tip: 'We\'ll provision a local phone number powered by Telnyx for your outbound and inbound calls.',
    questions: [
      'Can I port my existing number?',
      'What area codes are available?',
      'How does call recording work?',
    ],
  },
  compliance: {
    tip: 'Set your calling hours and compliance settings to stay within TCPA/FDCPA regulations.',
    questions: [
      'What are TCPA calling hour rules for my state?',
      'Do I need consent to record calls?',
      'What is a DNC list and how does it work?',
    ],
  },
  import: {
    tip: 'Import your contacts via CSV or connect your CRM to sync automatically.',
    questions: [
      'What CSV format should I use?',
      'How do I map custom fields?',
      'Can I deduplicate contacts on import?',
    ],
  },
  call: {
    tip: 'Make a test call to verify your number, audio quality, and recording setup.',
    questions: [
      'What should I test on my first call?',
      'Why is my call not connecting?',
      'How do I check call recording quality?',
    ],
  },
  team: {
    tip: 'Invite your team members and assign roles — Admin, Manager, Supervisor, or Agent.',
    questions: [
      'What permissions does each role have?',
      'How many team members can I add?',
      'Can I change roles later?',
    ],
  },
  tour: {
    tip: 'You\'re all set! Choose your path — run campaigns to start calling, or explore analytics.',
    questions: [
      'How do I create my first campaign?',
      'What analytics should I track first?',
      'How does AI scoring work on calls?',
    ],
  },
}

interface OnboardingAIAdvisorProps {
  /** Current onboarding step */
  currentStep: string
}

export function OnboardingAIAdvisor({ currentStep }: OnboardingAIAdvisorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hints = STEP_HINTS[currentStep] || STEP_HINTS.plan

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Reset conversation when step changes
  useEffect(() => {
    setMessages([])
    setConversationId(null)
  }, [currentStep])

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || isLoading) return
    if (!text) setInput('')
    setIsLoading(true)

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msg,
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const data = await apiPost('/api/bond-ai/chat', {
        message: msg,
        conversation_id: conversationId,
        context_type: 'onboarding',
        context_id: currentStep,
      })

      if (data.success) {
        if (!conversationId) setConversationId(data.conversation_id)
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
          content: `Unable to get help right now. ${err.message || 'Please try again.'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    sendMessage()
  }

  if (!isOpen) {
    return (
      <div className="mt-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-950/30">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between p-3 text-left group"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Bond AI Advisor
            </span>
            <span className="text-xs text-blue-500/80 dark:text-blue-400/60">
              — {hints.tip.slice(0, 60)}...
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-blue-400 group-hover:text-blue-600 transition-transform" />
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Bond AI Advisor
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-blue-400 hover:text-blue-600 transition-colors"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      {/* Tip Banner */}
      <div className="px-3 py-2 bg-blue-100/50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-600 dark:text-blue-400">
          <strong>Tip:</strong> {hints.tip}
        </p>
      </div>

      {/* Quick Questions */}
      {messages.length === 0 && (
        <div className="p-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Quick questions:</p>
          {hints.questions.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                sendMessage(q)
              }}
              disabled={isLoading}
              className="block w-full text-left text-xs px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors text-gray-700 dark:text-gray-300"
            >
              <MessageSquare className="inline h-3 w-3 mr-1.5 text-blue-400" />
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Chat Messages */}
      {messages.length > 0 && (
        <div className="max-h-64 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg p-2.5 text-xs whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100'
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
      )}

      {/* Input */}
      <div className="p-2 border-t border-blue-200 dark:border-blue-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this step..."
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="h-3 w-3" />
          </button>
        </form>
      </div>
    </div>
  )
}

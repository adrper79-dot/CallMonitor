'use client'

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react'
import { apiPost } from '@/lib/apiClient'
import { Sparkles, Send, ChevronDown, ChevronUp, MessageSquare, Plug } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// Provider-specific quick questions
const PROVIDER_HINTS: Record<string, string[]> = {
  hubspot: [
    'What HubSpot API permissions do I need?',
    'How does contact sync work with HubSpot?',
    'My HubSpot API key isn\'t connecting — help!',
  ],
  salesforce: [
    'What Salesforce user permissions are required?',
    'How do I find my Salesforce instance URL?',
    'How does field mapping work with Salesforce?',
  ],
  pipedrive: [
    'Where do I find my Pipedrive API token?',
    'What Pipedrive data gets synced?',
    'Can I map custom fields from Pipedrive?',
  ],
  zoho: [
    'How do I generate a Zoho CRM API key?',
    'What Zoho modules are supported?',
    'Where do I find my Zoho API domain URL?',
  ],
  slack: [
    'How do I set up Slack notifications?',
    'What events trigger Slack alerts?',
    'Can I send alerts to multiple Slack channels?',
  ],
  teams: [
    'How do I configure Microsoft Teams alerts?',
    'What webhook format does Teams use?',
    'Can I customize Teams notification cards?',
  ],
  quickbooks: [
    'How does QuickBooks billing sync work?',
    'What QuickBooks data gets synced?',
    'How do I set up OAuth for QuickBooks?',
  ],
  google_workspace: [
    'How does Google Calendar integration work?',
    'What Google Workspace scopes are needed?',
    'How do I authorize Google Workspace access?',
  ],
  zendesk: [
    'How does Zendesk ticket sync work?',
    'What Zendesk API permissions do I need?',
    'Can I auto-create tickets from calls?',
  ],
  freshdesk: [
    'How do I connect Freshdesk?',
    'What Freshdesk features are supported?',
    'Can call transcripts push to Freshdesk tickets?',
  ],
}

// Category-level quick questions (fallback when no provider selected)
const CATEGORY_HINTS: Record<string, { tip: string; questions: string[] }> = {
  crm: {
    tip: 'Connect your CRM to automatically sync contacts, calls, and notes. Delta sync runs every 15 minutes.',
    questions: [
      'Which CRM should I use with Word Is Bond?',
      'How does two-way CRM sync work?',
      'What data gets synced to my CRM?',
    ],
  },
  notifications: {
    tip: 'Set up Slack or Teams to get real-time alerts for missed calls, sentiment flags, and campaign results.',
    questions: [
      'How do I set up call alerts in Slack?',
      'What notification events are available?',
      'Can I filter which alerts I receive?',
    ],
  },
  billing: {
    tip: 'Connect QuickBooks to sync invoices and payment tracking with your call center operations.',
    questions: [
      'How does billing integration work?',
      'Can I auto-generate invoices from calls?',
      'What billing data is synced?',
    ],
  },
  calendar: {
    tip: 'Sync Google Calendar to manage agent schedules, appointments, and follow-up reminders.',
    questions: [
      'How does calendar booking work?',
      'Can agents see their schedule in the app?',
      'How do follow-up reminders get created?',
    ],
  },
  helpdesk: {
    tip: 'Connect Zendesk or Freshdesk to turn calls into support tickets with full transcription.',
    questions: [
      'How does call-to-ticket creation work?',
      'Which helpdesk should I choose?',
      'Can I attach call recordings to tickets?',
    ],
  },
  webhooks: {
    tip: 'Send call events to Zapier, Make.com, or custom endpoints for advanced automation workflows.',
    questions: [
      'What webhook events are available?',
      'How do I test my webhook endpoint?',
      'Can I use webhooks with Zapier or Make?',
    ],
  },
}

interface IntegrationAIAdvisorProps {
  /** Current tab/category in the integration hub */
  activeCategory: string
  /** Specific provider being configured (optional) */
  activeProvider?: string
}

export function IntegrationAIAdvisor({ activeCategory, activeProvider }: IntegrationAIAdvisorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Get appropriate hints
  const categoryHints = CATEGORY_HINTS[activeCategory] || CATEGORY_HINTS.crm
  const providerQuestions = activeProvider ? PROVIDER_HINTS[activeProvider] : null
  const questions = providerQuestions || categoryHints.questions
  const tip = categoryHints.tip

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Reset when category or provider changes
  useEffect(() => {
    setMessages([])
    setConversationId(null)
  }, [activeCategory, activeProvider])

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
        context_type: 'integration',
        context_id: activeProvider || activeCategory,
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
      <div className="border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50/50 dark:bg-purple-950/30">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between p-3 text-left group"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Bond AI Integration Advisor
            </span>
            <span className="text-xs text-purple-500/80 dark:text-purple-400/60 hidden sm:inline">
              — Need help connecting?
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-purple-400 group-hover:text-purple-600 transition-transform" />
        </button>
      </div>
    )
  }

  return (
    <div className="border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            Bond AI Integration Advisor
          </span>
          {activeProvider && (
            <span className="text-xs bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full capitalize">
              {activeProvider.replace('_', ' ')}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-purple-400 hover:text-purple-600 transition-colors"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      {/* Tip Banner */}
      <div className="px-3 py-2 bg-purple-100/50 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-800">
        <p className="text-xs text-purple-600 dark:text-purple-400">
          <Plug className="inline h-3 w-3 mr-1" />
          <strong>Tip:</strong> {tip}
        </p>
      </div>

      {/* Quick Questions */}
      {messages.length === 0 && (
        <div className="p-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Ask me about:</p>
          {questions.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              className="block w-full text-left text-xs px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors text-gray-700 dark:text-gray-300"
            >
              <MessageSquare className="inline h-3 w-3 mr-1.5 text-purple-400" />
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
                    ? 'bg-purple-600 text-white'
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
      <div className="p-2 border-t border-purple-200 dark:border-purple-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 placeholder:text-gray-400"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeProvider ? `Ask about ${activeProvider.replace('_', ' ')}...` : 'Ask about integrations...'}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <Send className="h-3 w-3" />
          </button>
        </form>
      </div>
    </div>
  )
}

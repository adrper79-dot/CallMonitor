/**
 * useSSE Hook
 * 
 * Server-Sent Events (SSE) hook for real-time streaming data.
 * Handles connection lifecycle, message parsing, and automatic cleanup.
 * 
 * @example
 * ```tsx
 * const { messages, connected, error, clear } = useSSE<TranslationSegment>(
 *   `/api/voice/translate/stream?callId=${callId}`,
 *   isCallActive
 * );
 * 
 * return (
 *   <div>
 *     <Badge>{connected ? 'Connected' : 'Disconnected'}</Badge>
 *     {messages.map(msg => <div key={msg.id}>{msg.content}</div>)}
 *   </div>
 * );
 * ```
 * 
 * Features:
 * - Automatic EventSource management
 * - Bearer token authentication
 * - Connection status tracking
 * - JSON message parsing with error handling
 * - Manual message clearing
 * - Conditional enabling
 */

import { useState, useEffect } from 'react'

export interface UseSSEResult<T> {
  /** Array of received messages */
  messages: T[]
  /** Connection status */
  connected: boolean
  /** Error state (null if no error) */
  error: Error | null
  /** Clear all messages */
  clear: () => void
}

/**
 * Connect to a Server-Sent Events stream
 * 
 * @param url - SSE endpoint URL (relative or absolute)
 * @param enabled - Enable/disable the connection (default: true)
 * @returns Object containing messages, connection status, error, and clear function
 */
export function useSSE<T = any>(
  url: string,
  enabled: boolean = true
): UseSSEResult<T> {
  const [messages, setMessages] = useState<T[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled || !url) {
      setConnected(false)
      return
    }

    let eventSource: EventSource | null = null

    const connect = () => {
      try {
        // Get auth token from localStorage (must match AuthProvider)
        const token = typeof window !== 'undefined' 
          ? localStorage.getItem('wb-session-token') 
          : null

        // Construct URL with token query parameter
        const separator = url.includes('?') ? '&' : '?'
        const authenticatedUrl = token 
          ? `${url}${separator}token=${encodeURIComponent(token)}`
          : url

        eventSource = new EventSource(authenticatedUrl)

        eventSource.onopen = () => {
          setConnected(true)
          setError(null)
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as T
            setMessages((prev) => [...prev, data])
          } catch (parseErr) {
            // Skip malformed JSON messages silently in production
            void parseErr
          }
        }

        eventSource.onerror = (err) => {
          setError(new Error('SSE connection error'))
          setConnected(false)
          eventSource?.close()
        }
      } catch (err) {
        setError(err as Error)
        setConnected(false)
      }
    }

    connect()

    // Cleanup on unmount or when enabled changes
    return () => {
      eventSource?.close()
      setConnected(false)
    }
  }, [url, enabled])

  const clear = () => setMessages([])

  return { messages, connected, error, clear }
}

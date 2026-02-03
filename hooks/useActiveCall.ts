import { useState, useEffect, useRef, useCallback } from 'react'

export type CallStatus = 'queued' | 'initiating' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer' | 'canceled' | null

interface UseActiveCallResult {
    status: CallStatus
    duration: number
    setStatus: (status: CallStatus) => void
    reset: () => void
    isActive: boolean
}

/**
 * useActiveCall Hook
 * 
 * Manages the state of an active call, including:
 * - Status polling (fallback for when realtime fails)
 * - Duration counting (local timer)
 * - Terminal state detection
 */
export function useActiveCall(callId: string | null): UseActiveCallResult {
    const [status, setStatus] = useState<CallStatus>(null)
    const [duration, setDuration] = useState(0)

    // Terminal states stop polling and timing
    const isTerminal = status && ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)

    // 1. Polling Logic
    useEffect(() => {
        if (!callId || isTerminal) return

        let mounted = true
        const poll = async () => {
            try {
                const res = await fetch(`/api/calls/${encodeURIComponent(callId)}`, {
                    credentials: 'include'
                })
                if (res.ok && mounted) {
                    const data = await res.json()
                    const serverStatus = data.call?.status
                    if (serverStatus && serverStatus !== status) {
                        setStatus(serverStatus)
                    }
                }
            } catch (err) {
                // Silent failure for polling
            }
        }

        // Initial check
        poll()

        // Poll every 3s
        const interval = setInterval(poll, 3000)
        return () => {
            mounted = false
            clearInterval(interval)
        }
    }, [callId, status, isTerminal])

    // 2. Duration Timer
    useEffect(() => {
        if (!callId || isTerminal) return

        // Only count duration if we are actually connecting or connected
        // (Optional: could restrict to 'in-progress' only, but 'initiating' usually counts to UX)
        const timer = setInterval(() => {
            setDuration(prev => prev + 1)
        }, 1000)

        return () => clearInterval(timer)
    }, [callId, isTerminal])

    // Reset helper
    const reset = useCallback(() => {
        setStatus(null)
        setDuration(0)
    }, [])

    return {
        status,
        duration,
        setStatus,
        reset,
        isActive: !!callId && !isTerminal
    }
}

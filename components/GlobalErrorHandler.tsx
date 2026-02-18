'use client'

import { useEffect } from 'react'

/**
 * GlobalErrorHandler — catches unhandled promise rejections (e.g. missed ApiError catches)
 * and logs them silently instead of letting them crash the console as "Uncaught (in promise)".
 *
 * For 401 errors, the apiClient already handles token clearance + auth-change dispatch.
 * This component is a safety net for any API errors that slip past try/catch blocks.
 */
export default function GlobalErrorHandler() {
  useEffect(() => {
    function handleRejection(event: PromiseRejectionEvent) {
      const error = event.reason

      // Only intercept ApiError instances — let other rejections propagate normally
      if (error && error.name === 'ApiError') {
        event.preventDefault() // Suppress "Uncaught (in promise)" console noise

        // 401 is already handled by apiClient (token clear + auth-change event).
        // Other statuses: log at warn level so they're visible without being alarming.
        if (error.status !== 401) {
          console.warn(
            `[API] ${error.status} — ${error.message}`,
            // Include minimal stack for debugging without flooding the console
          )
        }
      }
    }

    window.addEventListener('unhandledrejection', handleRejection)
    return () => window.removeEventListener('unhandledrejection', handleRejection)
  }, [])

  return null
}

'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Root Error Boundary
 *
 * Catches unhandled errors in any route that doesn't have its own error.tsx.
 * Next.js automatically wraps each route segment in a React error boundary.
 *
 * This is the global fallback — route-specific error.tsx files
 * (e.g., dashboard/error.tsx, settings/error.tsx) take precedence
 * when they exist.
 *
 * Design System v3.0 — clean, accessible, recovery-focused.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Structured error log for monitoring (Cloudflare Logpush, etc.)
    console.error(
      JSON.stringify({
        level: 'ERROR',
        msg: 'Unhandled client error',
        error: error.message,
        digest: error.digest,
        ts: new Date().toISOString(),
      })
    )
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
          {/* Error icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">
            An unexpected error occurred. This has been logged automatically.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-colors block"
            >
              Go to home
            </Link>
          </div>

          {error.digest && <p className="mt-4 text-xs text-gray-400">Error ID: {error.digest}</p>}
        </div>
      </div>
    </div>
  )
}

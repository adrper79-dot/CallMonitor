'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'
/**
 * Calls Error Boundary
 *
 * Catches errors in the calls route and provides recovery options.
 */
export default function VoiceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to monitoring service
    logger.error('Calls error', { error, digest: error.digest })
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
            We encountered an error loading calls. This has been logged and we&apos;re working on it.
          </p>

          {/* Error details (in development) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left mb-6">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 mb-2">
                Error details
              </summary>
              <pre className="text-xs text-left bg-gray-100 p-3 rounded overflow-auto max-h-40">
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </details>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              Try again
            </button>

            <Link
              href="/dashboard"
              className="block w-full bg-white hover:bg-gray-50 text-gray-900 font-medium py-2 px-4 rounded border border-gray-300 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

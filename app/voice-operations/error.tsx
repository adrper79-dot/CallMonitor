"use client"

import { useEffect } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'

/**
 * Calls Error Boundary
 * 
 * Catches errors in the voice route and provides recovery options.
 * Professional Design System v3.0
 */
export default function VoiceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Calls error', { error, digest: error.digest })
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
          {/* Phone error icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Unable to load Calls
          </h1>
          <p className="text-gray-600 mb-6">
            There was a problem loading the call interface. Please try again.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-colors block"
            >
              Back to Dashboard
            </Link>
          </div>

          {error.digest && (
            <p className="mt-4 text-xs text-gray-400">
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

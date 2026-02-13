'use client'

import React from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import { useSession } from '@/components/AuthProvider'
import { usePathname } from 'next/navigation'
import { logger } from '@/lib/logger'

interface ProtectedGateProps {
  /** Page content — rendered only when authenticated */
  children?: React.ReactNode
  title?: string
  description?: string
  redirectUrl?: string
}

/**
 * ProtectedGate - Auth wrapper + sign-in screen
 *
 * When used as a wrapper (`<ProtectedGate>{children}</ProtectedGate>`):
 *   - Shows loading spinner while session resolves
 *   - Renders children when authenticated
 *   - Shows branded sign-in screen when unauthenticated
 *
 * When used standalone (`<ProtectedGate />`):
 *   - Always shows the sign-in screen (legacy behavior)
 */
export function ProtectedGate({
  children,
  title = 'Sign in required',
  description = 'Please sign in to access this secure area.',
  redirectUrl,
}: ProtectedGateProps) {
  const { status } = useSession()
  const pathname = usePathname()
  const callbackUrl = redirectUrl || pathname || '/dashboard'

  // Wrapper mode: check auth and render children when authenticated
  if (children !== undefined) {
    if (status === 'loading') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      )
    }

    if (status === 'authenticated') {
      return <>{children}</>
    }

    // Unauthenticated — fall through to sign-in screen
    logger.info('Auth gate: unauthenticated access blocked', { pathname: callbackUrl })
  }

  // Sign-in screen (standalone mode OR unauthenticated wrapper mode)
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon Circle */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
          <Lock className="h-8 w-8 text-primary-600 dark:text-primary-400" strokeWidth={1.5} />
        </div>

        {/* Content */}
        <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h2>
        <p className="mb-8 text-gray-500 dark:text-gray-400 text-base leading-relaxed">{description}</p>

        {/* Actions */}
        <div className="space-y-4">
          <a
            href={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Sign In with Email
          </a>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

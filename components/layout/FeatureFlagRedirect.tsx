'use client'

/**
 * FeatureFlagRedirect — Redirects old routes to new routes when flag is enabled
 *
 * Drop this component into old pages (dashboard, voice-operations) to
 * auto-redirect users to the new /work routes when NEXT_PUBLIC_NEW_NAV=true.
 *
 * Usage:
 *   <FeatureFlagRedirect from="/voice-operations" to="/work" />
 */

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getRouteRedirect, isFeatureEnabled } from '@/lib/feature-flags'

interface FeatureFlagRedirectProps {
  /** Explicit target route. If omitted, uses the route map from feature-flags.ts */
  to?: string
}

export function FeatureFlagRedirect({ to }: FeatureFlagRedirectProps) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isFeatureEnabled('newNav')) return

    const target = to || getRouteRedirect(pathname)
    if (target && target !== pathname) {
      router.replace(target)
    }
  }, [router, pathname, to])

  return null
}

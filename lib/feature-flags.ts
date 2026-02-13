/**
 * Feature Flags — Client-side feature flag system
 *
 * Controls gradual rollout of the new role-based navigation.
 * Since this is a static export (no middleware), flags are evaluated client-side.
 *
 * Set NEXT_PUBLIC_NEW_NAV=true to enable the new navigation for all users.
 * Or use localStorage override: localStorage.setItem('wb-new-nav', 'true')
 */

export interface FeatureFlags {
  /** Enable new role-based navigation (RoleShell + /work routes) */
  newNav: boolean
  /** Enable Cockpit 3-column workspace */
  cockpit: boolean
  /** Enable payment link generator */
  paymentLinks: boolean
  /** Enable pre-dial compliance checker */
  preDialChecker: boolean
}

/**
 * Get all feature flags. Checked in order:
 * 1. localStorage override (for testing)
 * 2. Environment variable
 * 3. Default (false)
 */
export function getFeatureFlags(): FeatureFlags {
  const envNewNav = process.env.NEXT_PUBLIC_NEW_NAV === 'true'

  // localStorage overrides for testing (only in browser)
  const lsOverride = typeof window !== 'undefined'
    ? localStorage.getItem('wb-new-nav')
    : null

  const newNav = lsOverride === 'true' ? true :
    lsOverride === 'false' ? false : envNewNav

  return {
    newNav,
    cockpit: newNav, // Cockpit requires new nav
    paymentLinks: newNav,
    preDialChecker: newNav,
  }
}

/**
 * Check a single feature flag
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag]
}

/**
 * Route mapping: old routes → new routes
 * Used by the redirect component to auto-navigate users.
 */
export const ROUTE_REDIRECTS: Record<string, string> = {
  '/dashboard': '/work',
  '/voice-operations': '/work/call',
  '/voice-operations/accounts': '/accounts',
  '/verticals/collections': '/accounts',
  '/bookings': '/schedule',
  '/manager': '/command',
  '/voice': '/admin/voice',
  '/admin/metrics': '/admin',
  '/review': '/work/call',
  '/teams': '/settings/team',
}

/**
 * Get the new route for an old route, or null if no redirect needed
 */
export function getRouteRedirect(pathname: string): string | null {
  if (!getFeatureFlags().newNav) return null
  return ROUTE_REDIRECTS[pathname] || null
}

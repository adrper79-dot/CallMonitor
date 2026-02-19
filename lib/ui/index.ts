/**
 * UI module barrel
 *
 * Re-exports navigation structure, RBAC types/helpers, feature flags, formatting
 * utilities, and the Cloudflare image loader for all UI/component layer imports.
 *
 * @example
 * ```ts
 * import { getNavGroups, UserRole, isFeatureEnabled, cn, formatCurrency } from '@/lib/ui'
 * import type { NavItem, NavGroup, Plan, PermissionCheck } from '@/lib/ui'
 * ```
 *
 * Included modules:
 *  - navigation      : NavItem, NavGroup, RoleShell, getRoleShell, getRoleLanding,
 *                      getNavGroups, getAllNavItems, isNavActive
 *  - rbac            : UserRole, ROLE_HIERARCHY, normalizeRole, Plan, PermissionCheck,
 *                      hasPermission, planSupportsFeature, getPlanFeatures,
 *                      canPerformAction, API_PERMISSIONS, checkApiPermission
 *  - feature-flags   : FeatureFlags, getFeatureFlags, isFeatureEnabled,
 *                      ROUTE_REDIRECTS, getRouteRedirect
 *  - utils           : cn, formatDate, formatCurrency, formatNumber,
 *                      formatDuration, getRelativeTime, truncate, sleep
 *  - cloudflare-image-loader : cloudflareLoader (named export)
 */

export * from '../navigation'
export * from '../rbac'
export * from '../feature-flags'
export * from '../utils'
export { cloudflareLoader } from '../cloudflare-image-loader'

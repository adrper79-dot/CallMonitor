'use client'

/**
 * Role-Based Navigation System
 *
 * Maps RBAC roles to flow-driven nav groups.
 * Replaces flat 9-item nav with role-specific, workflow-oriented navigation.
 *
 * Roles: owner, admin → Admin shell
 *        operator → Agent shell (collector)
 *        analyst → Manager shell
 *        viewer → Read-only agent shell
 */

import type { UserRole } from '@/hooks/useRBAC'

export interface NavItem {
  href: string
  label: string
  icon: string // lucide-react icon name
  badge?: string | number
  /** If true, only show when feature flag is active */
  featureFlag?: string
}

export interface NavGroup {
  id: string
  label: string
  icon: string
  items: NavItem[]
  /** Collapsed by default? */
  defaultCollapsed?: boolean
}

export type RoleShell = 'agent' | 'manager' | 'admin'

/**
 * Determine which shell to show based on RBAC role
 */
export function getRoleShell(role: UserRole | null): RoleShell {
  switch (role) {
    case 'owner':
    case 'admin':
      return 'admin'
    case 'analyst':
    case 'manager':
    case 'compliance':
      return 'manager'
    case 'operator':
    case 'agent':
    case 'viewer':
    case 'member':
    default:
      return 'agent'
  }
}

/**
 * Get the default landing page for a role
 */
export function getRoleLanding(role: UserRole | null): string {
  const shell = getRoleShell(role)
  switch (shell) {
    case 'agent':
      return '/work'
    case 'manager':
      return '/command'
    case 'admin':
      return '/command' // Admins land on command center too
  }
}

// ─────────────────────────────────────────────
// AGENT NAV — Workflow-first for collectors
// ─────────────────────────────────────────────

const AGENT_NAV: NavGroup[] = [
  {
    id: 'today',
    label: 'Today',
    icon: 'Home',
    items: [
      { href: '/work', label: 'Daily Planner', icon: 'CalendarCheck' },
    ],
  },
  {
    id: 'collect',
    label: 'Collect',
    icon: 'Phone',
    items: [
      { href: '/work/queue', label: 'Work Queue', icon: 'ListOrdered' },
      { href: '/work/dialer', label: 'Dialer', icon: 'PhoneOutgoing' },
      { href: '/work/call', label: 'Active Call', icon: 'PhoneCall' },
      { href: '/work/payments', label: 'Payment Links', icon: 'CreditCard' },
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: 'Users',
    items: [
      { href: '/accounts', label: 'All Accounts', icon: 'Users' },
      { href: '/accounts/import', label: 'Import', icon: 'Upload' },
      { href: '/accounts/disputes', label: 'Disputes', icon: 'AlertTriangle' },
    ],
  },
  {
    id: 'schedule',
    label: 'Schedules',
    icon: 'Calendar',
    items: [
      { href: '/schedule', label: 'Overview', icon: 'CalendarClock' },
      { href: '/schedule/callbacks', label: 'Callbacks', icon: 'PhoneCallback' },
      { href: '/schedule/follow-ups', label: 'Follow-ups', icon: 'Clock' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: 'Wrench',
    items: [
      { href: '/tools/templates', label: 'Note Templates', icon: 'FileText' },
      { href: '/tools/objections', label: 'Objection Library', icon: 'BookOpen' },
      { href: '/tools/scripts', label: 'Scripts', icon: 'ScrollText' },
      { href: '/tools/calculator', label: 'Payment Calculator', icon: 'Calculator' },
    ],
    defaultCollapsed: true,
  },
  {
    id: 'performance',
    label: 'My Performance',
    icon: 'BarChart3',
    items: [
      { href: '/analytics/me', label: 'My Scorecard', icon: 'Trophy' },
    ],
  },
]

// ─────────────────────────────────────────────
// MANAGER NAV — Oversight + strategy
// ─────────────────────────────────────────────

const MANAGER_NAV: NavGroup[] = [
  {
    id: 'command',
    label: 'Command Center',
    icon: 'Monitor',
    items: [
      { href: '/command', label: 'Overview', icon: 'LayoutDashboard' },
      { href: '/command/live', label: 'Live Board', icon: 'Radio' },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    icon: 'Users',
    items: [
      { href: '/teams', label: 'Members', icon: 'UserCog' },
      { href: '/command/scorecards', label: 'Scorecards', icon: 'ClipboardCheck' },
      { href: '/command/coaching', label: 'Coaching', icon: 'GraduationCap' },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    icon: 'Shield',
    items: [
      { href: '/compliance', label: 'Dashboard', icon: 'ShieldCheck' },
      { href: '/compliance/violations', label: 'Violations', icon: 'ShieldAlert' },
      { href: '/compliance/audit', label: 'Audit Trail', icon: 'ScrollText' },
      { href: '/compliance/dnc', label: 'DNC List', icon: 'PhoneOff' },
      { href: '/compliance/disputes', label: 'Disputes', icon: 'Scale' },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: 'DollarSign',
    items: [
      { href: '/payments', label: 'Overview', icon: 'Wallet' },
      { href: '/payments/plans', label: 'Payment Plans', icon: 'CalendarRange' },
      { href: '/payments/reconciliation', label: 'Reconciliation', icon: 'ArrowLeftRight' },
      { href: '/payments/failed', label: 'Failed Payments', icon: 'XCircle' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'BarChart3',
    items: [
      { href: '/analytics', label: 'Overview', icon: 'TrendingUp' },
      { href: '/analytics/collections', label: 'Collections KPIs', icon: 'Target' },
      { href: '/analytics/agents', label: 'Agent Performance', icon: 'UserCheck' },
    ],
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: 'Megaphone',
    items: [
      { href: '/campaigns', label: 'Active', icon: 'Play' },
      { href: '/campaigns/sequences', label: 'Sequences', icon: 'GitBranch' },
      { href: '/campaigns/surveys', label: 'Surveys', icon: 'MessageSquare' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'FileBarChart',
    items: [
      { href: '/reports', label: 'Reports', icon: 'FileText' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'Settings',
    items: [
      { href: '/settings', label: 'Overview', icon: 'Building2' },
      { href: '/settings/call-config', label: 'Call Config', icon: 'Phone' },
      { href: '/settings/ai', label: 'AI & Intelligence', icon: 'Brain' },
      { href: '/settings/quality', label: 'Evidence Quality', icon: 'ClipboardCheck' },
      { href: '/settings/team', label: 'Team & Access', icon: 'Users' },
    ],
  },
]

// ─────────────────────────────────────────────
// ADMIN NAV — Manager + admin tools
// ─────────────────────────────────────────────

const ADMIN_EXTRA: NavGroup[] = [
  {
    id: 'admin',
    label: 'Admin',
    icon: 'ShieldCheck',
    items: [
      { href: '/admin', label: 'Platform Metrics', icon: 'Activity' },
      { href: '/admin/billing', label: 'Billing & Plans', icon: 'Receipt' },
      { href: '/admin/voice', label: 'Voice Config', icon: 'Mic' },
      { href: '/admin/ai', label: 'AI Config', icon: 'Brain' },
      { href: '/admin/retention', label: 'Data Retention', icon: 'Database' },
      { href: '/admin/api', label: 'API & Webhooks', icon: 'Webhook' },
    ],
  },
]

/**
 * Get navigation groups for a given role shell
 */
export function getNavGroups(shell: RoleShell): NavGroup[] {
  switch (shell) {
    case 'agent':
      return AGENT_NAV
    case 'manager':
      return MANAGER_NAV
    case 'admin':
      return [...MANAGER_NAV, ...ADMIN_EXTRA]
  }
}

/**
 * Get all flat nav items (for search/command palette)
 */
export function getAllNavItems(shell: RoleShell): NavItem[] {
  return getNavGroups(shell).flatMap((g) => g.items)
}

/**
 * Check if a path is active (exact or prefix match)
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/work' || href === '/command' || href === '/admin') {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(href + '/')
}

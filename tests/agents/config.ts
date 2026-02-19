/**
 * AI Agent Test Configuration — Word Is Bond Platform
 *
 * Tailored to production platform:
 * - Uses real auth flow (credentials → session token → Bearer auth)
 * - RBAC role hierarchy: owner > admin > manager > compliance > agent > viewer
 * - Shell assignment: admin(owner/admin), manager(manager/compliance/analyst), agent(agent/viewer)
 * - Routes mapped from lib/navigation.ts
 *
 * @see ARCH_DOCS/01-CORE/FLOW_CATALOG.md
 * @see docs/PERMISSION_MATRIX.md
 */

import * as path from 'node:path'

// ─── Test Users ──────────────────────────────────────────────────────────────
// These are provisioned via tests/setup-test-users.sql against production Neon.
// The primary user (adrper79@gmail.com) is the real owner account.
// For multi-role testing, use the test-user accounts in test-org-001.
// ─────────────────────────────────────────────────────────────────────────────

export interface TestUser {
  email: string
  name: string
  role: string
  password: string
  shell: 'admin' | 'manager' | 'agent'
  permissions: string[]
  landingPage: string
}

export const TEST_USERS: Record<string, TestUser> = {
  owner: {
    email: process.env.AGENT_TEST_OWNER_EMAIL || 'owner@sillysoft.test',
    name: 'Owner User',
    role: 'owner',
    password: process.env.AGENT_TEST_OWNER_PASSWORD || 'spacem@n0',
    shell: 'admin',
    permissions: ['all'],
    landingPage: '/command',
  },
  admin: {
    email: process.env.AGENT_TEST_ADMIN_EMAIL || 'admin@sillysoft.test',
    name: 'Admin User',
    role: 'admin',
    password: process.env.AGENT_TEST_ADMIN_PASSWORD || 'spacem@n0',
    shell: 'admin',
    permissions: ['manage_users', 'view_analytics', 'compliance_reports', 'billing_invoices', 'audit_logs'],
    landingPage: '/command',
  },
  manager: {
    email: process.env.AGENT_TEST_MANAGER_EMAIL || 'manager@sillysoft.test',
    name: 'Manager User',
    role: 'manager',
    password: process.env.AGENT_TEST_MANAGER_PASSWORD || 'spacem@n0',
    shell: 'manager',
    permissions: ['view_team', 'assign_accounts', 'listen_calls', 'campaigns', 'scorecards'],
    landingPage: '/command',
  },
  compliance: {
    email: process.env.AGENT_TEST_COMPLIANCE_EMAIL || 'compliance@sillysoft.test',
    name: 'Compliance User',
    role: 'compliance',
    password: process.env.AGENT_TEST_COMPLIANCE_PASSWORD || 'spacem@n0',
    shell: 'manager',
    permissions: ['view_compliance', 'audit_logs', 'dispute_management', 'retention', 'legal_holds'],
    landingPage: '/command',
  },
  agent: {
    email: process.env.AGENT_TEST_AGENT_EMAIL || 'agent@sillysoft.test',
    name: 'Agent User',
    role: 'agent',
    password: process.env.AGENT_TEST_AGENT_PASSWORD || 'spacem@n0',
    shell: 'agent',
    permissions: ['make_calls', 'view_accounts', 'send_payment_links', 'add_notes', 'schedule_callbacks'],
    landingPage: '/work',
  },
  viewer: {
    email: process.env.AGENT_TEST_VIEWER_EMAIL || 'viewer@sillysoft.test',
    name: 'Viewer User',
    role: 'viewer',
    password: process.env.AGENT_TEST_VIEWER_PASSWORD || 'spacem@n0',
    shell: 'agent',
    permissions: ['view_only'],
    landingPage: '/work',
  },
}

// ─── Test Config ─────────────────────────────────────────────────────────────

export const TEST_CONFIG = {
  /** Base URL: production or local */
  baseUrl: process.env.AGENT_TEST_URL || process.env.BASE_URL || 'https://wordis-bond.com',

  /** API URL for health checks */
  apiUrl: process.env.WORKERS_API_URL || 'https://wordisbond-api.adrper79.workers.dev',

  /** Output directories */
  screenshotDir: path.resolve(process.cwd(), 'test-results', 'agent-screenshots'),
  reportDir: path.resolve(process.cwd(), 'test-results', 'agent-reports'),
  videoDir: path.resolve(process.cwd(), 'test-results', 'agent-videos'),

  /** ms delay between AI agent actions — keeps it visible & realistic */
  slowMo: parseInt(process.env.AGENT_SLOW_MO || '300', 10),

  /** headless mode — false for watching, true for CI */
  headless: process.env.AGENT_HEADLESS === 'true' || process.env.CI === 'true',

  /** Max time per single action */
  actionTimeout: 15_000,

  /** Max time waiting for page navigation after login */
  loginTimeout: 20_000,

  /** Max time for an entire scenario */
  scenarioTimeout: 120_000,

  /** Viewport — 1920×1080 for full desktop experience */
  viewport: { width: 1920, height: 1080 },
}

// ─── Route Maps per Shell ────────────────────────────────────────────────────
// Derived from lib/navigation.ts — these are the actual routes agents should visit

// ─── Shell Routes ──────────────────────────────────────────────────────────────
// Derived from components/layout/AppShell.tsx getNavSections().
// Keep in sync with the nav sections for each role shell.
// Last updated: matches AppShell.tsx agent/manager/admin nav sections.

export const SHELL_ROUTES = {
  /** Agent shell — /work, /accounts, /schedule, /tools, /bond-ai, /inbox, /analytics/me */
  agent: [
    '/dashboard',
    '/work',
    '/work/queue',
    '/work/dialer',
    '/work/call',
    '/work/payments',
    '/voice-operations',
    '/inbox',
    '/accounts',
    '/accounts/import',
    '/accounts/disputes',
    '/schedule',
    '/schedule/callbacks',
    '/schedule/follow-ups',
    '/bookings',
    '/tools/templates',
    '/tools/objections',
    '/tools/scripts',
    '/tools/calculator',
    '/bond-ai/alerts',
    '/analytics/me',
  ],
  /** Manager shell — all agent routes + command, teams, compliance, payments, analytics, campaigns */
  manager: [
    '/dashboard',
    '/command',
    '/command/live',
    '/teams',
    '/command/scorecards',
    '/command/coaching',
    '/manager',
    '/review',
    '/inbox',
    '/voice-operations',
    '/accounts',
    '/accounts/import',
    '/accounts/disputes',
    '/analytics',
    '/analytics/collections',
    '/analytics/agents',
    '/analytics/sentiment',
    '/reports',
    '/compliance',
    '/compliance/violations',
    '/compliance/audit',
    '/compliance/dnc',
    '/compliance/disputes',
    '/payments',
    '/payments/plans',
    '/payments/reconciliation',
    '/payments/failed',
    '/campaigns',
    '/campaigns/new',
    '/campaigns/sequences',
    '/campaigns/surveys',
    '/schedule',
    '/bookings',
    '/bond-ai/alerts',
    '/settings',
  ],
  /** Admin shell — all manager routes + admin-specific config & platform management */
  admin: [
    '/dashboard',
    '/command',
    '/command/live',
    '/teams',
    '/command/scorecards',
    '/command/coaching',
    '/manager',
    '/review',
    '/inbox',
    '/voice-operations',
    '/accounts',
    '/accounts/import',
    '/accounts/disputes',
    '/analytics',
    '/analytics/collections',
    '/analytics/agents',
    '/analytics/sentiment',
    '/reports',
    '/compliance',
    '/compliance/violations',
    '/compliance/audit',
    '/compliance/dnc',
    '/compliance/disputes',
    '/payments',
    '/payments/plans',
    '/payments/reconciliation',
    '/payments/failed',
    '/campaigns',
    '/campaigns/new',
    '/campaigns/sequences',
    '/campaigns/surveys',
    '/schedule',
    '/bookings',
    '/bond-ai/alerts',
    '/admin/metrics',
    '/admin/billing',
    '/admin/voice',
    '/admin/ai',
    '/admin/retention',
    '/admin/api',
    '/admin/feature-flags',
    '/settings',
    '/settings/call-config',
    '/settings/ai',
    '/settings/quality',
    '/settings/team',
    '/settings/integrations',
    '/settings/dialer',
  ],
  /** Viewer shell — read-only subset */
  viewer: [
    '/dashboard',
    '/analytics',
    '/reports',
  ],
}

// ─── Test Customer Data ──────────────────────────────────────────────────────

export const TEST_CUSTOMER = {
  name: 'APs TESTING',
  email: 'stepdadstrong@gmail.com',
  phone: '+12392027345',
  balance: '500',
}

/**
 * Permission Matrix Generator
 *
 * Generates a Markdown permission matrix mapping RBAC roles
 * to API routes. Reads from the live RBAC configuration
 * in rbac-v2.ts and the Workers route files.
 *
 * Usage:  npx tsx tools/generate-permission-matrix.ts
 * Output: docs/PERMISSION_MATRIX.md
 *
 * @see ARCH_DOCS/MASTER_ARCHITECTURE.md — RBAC section
 * @see workers/src/routes/rbac-v2.ts — Role hierarchy
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Role hierarchy (mirrors rbac-v2.ts) ──────────────────────────────────────
const ROLES = [
  'viewer',
  'agent',
  'operator',
  'analyst',
  'manager',
  'compliance',
  'admin',
  'owner',
] as const
type Role = (typeof ROLES)[number]

const ROLE_INHERITANCE: Record<string, string[]> = {
  viewer: ['viewer'],
  agent: ['viewer', 'agent'],
  operator: ['viewer', 'agent', 'operator'],
  analyst: ['viewer', 'analyst'],
  manager: ['viewer', 'agent', 'operator', 'manager'],
  compliance: ['viewer', 'compliance'],
  admin: ['viewer', 'agent', 'operator', 'analyst', 'manager', 'compliance', 'admin'],
  owner: ['viewer', 'agent', 'operator', 'analyst', 'manager', 'compliance', 'admin', 'owner'],
}

// ─── Route permission map ─────────────────────────────────────────────────────
// Minimum role required for each route group
interface RouteGroup {
  name: string
  routes: { method: string; path: string; minRole: Role; description: string }[]
}

const ROUTE_GROUPS: RouteGroup[] = [
  {
    name: 'Authentication',
    routes: [
      {
        method: 'GET',
        path: '/auth/session',
        minRole: 'viewer',
        description: 'Get current session',
      },
      {
        method: 'POST',
        path: '/auth/signup',
        minRole: 'viewer',
        description: 'Create account (public)',
      },
      {
        method: 'POST',
        path: '/auth/callback/credentials',
        minRole: 'viewer',
        description: 'Login',
      },
      {
        method: 'POST',
        path: '/auth/forgot-password',
        minRole: 'viewer',
        description: 'Password reset',
      },
    ],
  },
  {
    name: 'Calls',
    routes: [
      { method: 'GET', path: '/calls', minRole: 'viewer', description: 'List calls' },
      { method: 'GET', path: '/calls/:id', minRole: 'viewer', description: 'Get call detail' },
      { method: 'POST', path: '/calls/start', minRole: 'agent', description: 'Start a call' },
      { method: 'POST', path: '/calls/:id/end', minRole: 'agent', description: 'End a call' },
      { method: 'POST', path: '/calls/:id/outcome', minRole: 'agent', description: 'Set outcome' },
      {
        method: 'PUT',
        path: '/calls/:id/disposition',
        minRole: 'agent',
        description: 'Set disposition',
      },
      { method: 'POST', path: '/calls/:id/notes', minRole: 'agent', description: 'Add note' },
      {
        method: 'POST',
        path: '/calls/:id/email',
        minRole: 'operator',
        description: 'Email summary',
      },
    ],
  },
  {
    name: 'Voice',
    routes: [
      { method: 'GET', path: '/voice/targets', minRole: 'viewer', description: 'List targets' },
      { method: 'GET', path: '/voice/config', minRole: 'viewer', description: 'Get config' },
      { method: 'PUT', path: '/voice/config', minRole: 'admin', description: 'Update config' },
      { method: 'POST', path: '/voice/call', minRole: 'agent', description: 'Place call' },
      { method: 'POST', path: '/voice/targets', minRole: 'manager', description: 'Add target' },
      {
        method: 'DELETE',
        path: '/voice/targets/:id',
        minRole: 'manager',
        description: 'Remove target',
      },
    ],
  },
  {
    name: 'Recordings',
    routes: [
      { method: 'GET', path: '/recordings', minRole: 'viewer', description: 'List recordings' },
      { method: 'GET', path: '/recordings/:id', minRole: 'viewer', description: 'Get recording' },
      {
        method: 'DELETE',
        path: '/recordings/:id',
        minRole: 'admin',
        description: 'Delete recording',
      },
    ],
  },
  {
    name: 'Bookings',
    routes: [
      { method: 'GET', path: '/bookings', minRole: 'viewer', description: 'List bookings' },
      { method: 'POST', path: '/bookings', minRole: 'agent', description: 'Create booking' },
      { method: 'PATCH', path: '/bookings/:id', minRole: 'agent', description: 'Update booking' },
      {
        method: 'DELETE',
        path: '/bookings/:id',
        minRole: 'manager',
        description: 'Delete booking',
      },
    ],
  },
  {
    name: 'Team',
    routes: [
      { method: 'GET', path: '/team/members', minRole: 'viewer', description: 'List members' },
      { method: 'GET', path: '/team/invites', minRole: 'manager', description: 'List invites' },
      { method: 'POST', path: '/team/invites', minRole: 'admin', description: 'Send invite' },
      {
        method: 'DELETE',
        path: '/team/invites/:id',
        minRole: 'admin',
        description: 'Cancel invite',
      },
      {
        method: 'DELETE',
        path: '/team/members/:id',
        minRole: 'admin',
        description: 'Remove member',
      },
    ],
  },
  {
    name: 'Billing',
    routes: [
      { method: 'GET', path: '/billing', minRole: 'viewer', description: 'Billing overview' },
      {
        method: 'GET',
        path: '/billing/invoices',
        minRole: 'admin',
        description: 'Invoice history',
      },
      {
        method: 'POST',
        path: '/billing/checkout',
        minRole: 'owner',
        description: 'Create checkout',
      },
      { method: 'POST', path: '/billing/portal', minRole: 'owner', description: 'Billing portal' },
      {
        method: 'POST',
        path: '/billing/cancel',
        minRole: 'owner',
        description: 'Cancel subscription',
      },
      {
        method: 'DELETE',
        path: '/billing/payment-methods/:id',
        minRole: 'owner',
        description: 'Remove payment',
      },
    ],
  },
  {
    name: 'Campaigns',
    routes: [
      { method: 'GET', path: '/campaigns', minRole: 'viewer', description: 'List campaigns' },
      { method: 'POST', path: '/campaigns', minRole: 'manager', description: 'Create campaign' },
      {
        method: 'PATCH',
        path: '/campaigns/:id',
        minRole: 'manager',
        description: 'Update campaign',
      },
      {
        method: 'POST',
        path: '/campaigns/:id/execute',
        minRole: 'manager',
        description: 'Execute campaign',
      },
      {
        method: 'DELETE',
        path: '/campaigns/:id',
        minRole: 'admin',
        description: 'Delete campaign',
      },
    ],
  },
  {
    name: 'Analytics & Reports',
    routes: [
      { method: 'GET', path: '/analytics', minRole: 'analyst', description: 'Dashboard metrics' },
      { method: 'GET', path: '/reports', minRole: 'analyst', description: 'List reports' },
      { method: 'POST', path: '/reports', minRole: 'analyst', description: 'Generate report' },
    ],
  },
  {
    name: 'Compliance',
    routes: [
      {
        method: 'GET',
        path: '/retention',
        minRole: 'compliance',
        description: 'Retention policies',
      },
      { method: 'POST', path: '/retention', minRole: 'compliance', description: 'Set policy' },
      {
        method: 'GET',
        path: '/retention/legal-holds',
        minRole: 'compliance',
        description: 'Legal holds',
      },
      {
        method: 'POST',
        path: '/retention/legal-holds',
        minRole: 'compliance',
        description: 'Create hold',
      },
    ],
  },
  {
    name: 'Audit',
    routes: [{ method: 'GET', path: '/audit', minRole: 'admin', description: 'View audit logs' }],
  },
  {
    name: 'Bond AI',
    routes: [
      { method: 'POST', path: '/bond-ai/chat', minRole: 'agent', description: 'AI chat' },
      { method: 'POST', path: '/bond-ai/copilot', minRole: 'agent', description: 'Call co-pilot' },
      {
        method: 'GET',
        path: '/bond-ai/conversations',
        minRole: 'viewer',
        description: 'List conversations',
      },
      { method: 'GET', path: '/bond-ai/insights', minRole: 'manager', description: 'Org insights' },
    ],
  },
  {
    name: 'Scorecards',
    routes: [
      { method: 'GET', path: '/scorecards', minRole: 'viewer', description: 'List scorecards' },
      { method: 'POST', path: '/scorecards', minRole: 'manager', description: 'Create scorecard' },
      { method: 'GET', path: '/scorecards/:id', minRole: 'viewer', description: 'Get scorecard' },
    ],
  },
  {
    name: 'Webhooks',
    routes: [
      {
        method: 'GET',
        path: '/webhooks/subscriptions',
        minRole: 'admin',
        description: 'List webhooks',
      },
      {
        method: 'POST',
        path: '/webhooks/subscriptions',
        minRole: 'admin',
        description: 'Create webhook',
      },
      {
        method: 'PATCH',
        path: '/webhooks/subscriptions/:id',
        minRole: 'admin',
        description: 'Update webhook',
      },
      {
        method: 'DELETE',
        path: '/webhooks/subscriptions/:id',
        minRole: 'admin',
        description: 'Delete webhook',
      },
    ],
  },
  {
    name: 'Admin',
    routes: [
      {
        method: 'GET',
        path: '/admin/auth-providers',
        minRole: 'admin',
        description: 'List auth providers',
      },
      {
        method: 'POST',
        path: '/admin/auth-providers',
        minRole: 'admin',
        description: 'Toggle provider',
      },
    ],
  },
  {
    name: 'Usage',
    routes: [{ method: 'GET', path: '/usage', minRole: 'viewer', description: 'Account usage' }],
  },
  {
    name: 'RBAC',
    routes: [
      {
        method: 'GET',
        path: '/rbac/context',
        minRole: 'viewer',
        description: 'Permission context',
      },
      { method: 'GET', path: '/rbac/check', minRole: 'viewer', description: 'Check permission' },
      { method: 'GET', path: '/rbac/roles', minRole: 'admin', description: 'List all roles' },
    ],
  },
]

// ─── Utility: Check if role meets minimum ─────────────────────────────────────
function roleHasAccess(role: string, minRole: Role): boolean {
  const inherit = ROLE_INHERITANCE[role] || []
  return inherit.includes(minRole)
}

// ─── Generate Markdown ────────────────────────────────────────────────────────
function generateMatrix(): string {
  const displayRoles = ['viewer', 'agent', 'analyst', 'manager', 'compliance', 'admin', 'owner']
  const now = new Date().toISOString().split('T')[0]

  let md = `# Permission Matrix\n\n`
  md += `> Auto-generated by \`tools/generate-permission-matrix.ts\`  \n`
  md += `> Last updated: ${now}  \n`
  md += `> Run: \`npx tsx tools/generate-permission-matrix.ts\`\n\n`
  md += `## Legend\n\n`
  md += `| Symbol | Meaning |\n|--------|--------|\n`
  md += `| ✅ | Allowed | \n| ❌ | Denied |\n\n`
  md += `## Role Hierarchy\n\n`
  md += `\`\`\`\nowner → admin → manager → agent → viewer\n                compliance ↗\n                analyst ↗\n\`\`\`\n\n`

  let totalRoutes = 0

  for (const group of ROUTE_GROUPS) {
    md += `### ${group.name}\n\n`
    md += `| Method | Path | ${displayRoles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' | ')} |\n`
    md += `|--------|------|${displayRoles.map(() => '---').join('|')}|\n`

    for (const route of group.routes) {
      const cells = displayRoles.map((role) => (roleHasAccess(role, route.minRole) ? '✅' : '❌'))
      md += `| \`${route.method}\` | \`${route.path}\` | ${cells.join(' | ')} |\n`
      totalRoutes++
    }

    md += `\n`
  }

  md += `---\n\n`
  md += `**Total routes**: ${totalRoutes}  \n`
  md += `**Roles**: ${displayRoles.length}  \n`
  md += `**Route groups**: ${ROUTE_GROUPS.length}\n`

  return md
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const output = generateMatrix()
const outPath = path.resolve(__dirname, '..', 'docs', 'PERMISSION_MATRIX.md')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, output, 'utf-8')
console.log(`✅ Permission matrix written to ${outPath}`)
console.log(
  `   ${ROUTE_GROUPS.reduce((s, g) => s + g.routes.length, 0)} routes × ${ROLES.length} roles`
)

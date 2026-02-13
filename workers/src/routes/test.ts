/**
 * Live Test Runner Routes — Real integration tests executed on Workers
 *
 * NO MOCKS. Every test hits real infrastructure and real external services.
 * Tests distinguish between:
 *   - SERVICE DOWN: The service is unreachable (network/config issue)
 *   - TEST FAILURE: The service is reachable but returned unexpected results
 *   - DEGRADED: Service is slow but functional
 *
 * Supports individual test execution and full suite runs.
 */

import { Hono } from 'hono'
import type { AppEnv, Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import {
  probeDatabase,
  probeDatabaseTables,
  probeKV,
  probeR2,
  probeTelnyx,
  probeOpenAI,
  probeStripe,
  probeAssemblyAI,
  probeAll,
  type ProbeResult,
  type ServiceStatus,
} from '../lib/health-probes'
import { generateCorrelationId } from '../lib/errors'
import { logger } from '../lib/logger'

export const testRoutes = new Hono<AppEnv>()

// ─── Types ──────────────────────────────────────────────────────────────────

interface TestResult {
  test_id: string
  test_name: string
  category: string
  passed: boolean
  warning: boolean
  service_down: boolean
  duration_ms: number
  details: string
  error?: string
  output: string[]
  differential?: {
    expected: string
    actual: string
  }
}

type TestFunction = (env: Env, session: any) => Promise<TestResult>

// ─── Test Registry ──────────────────────────────────────────────────────────

const TEST_REGISTRY: Record<string, Record<string, TestFunction>> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  infrastructure: {
    'db-connection': async (env) => {
      const probe = await probeDatabase(env)
      return probeToResult('db-connection', 'Database Connection', 'infrastructure', probe)
    },
    'db-schema': async (env) => {
      const probe = await probeDatabaseTables(env)
      return probeToResult('db-schema', 'Database Schema Integrity', 'infrastructure', probe)
    },
    'kv-store': async (env) => {
      const probe = await probeKV(env)
      return probeToResult('kv-store', 'KV Namespace', 'infrastructure', probe)
    },
    'r2-storage': async (env) => {
      const probe = await probeR2(env)
      return probeToResult('r2-storage', 'R2 Object Storage', 'infrastructure', probe)
    },
    hyperdrive: async (env) => {
      const start = Date.now()
      try {
        if (!env.HYPERDRIVE) {
          return fail(
            'hyperdrive',
            'Hyperdrive Binding',
            'infrastructure',
            'HYPERDRIVE binding not available',
            Date.now() - start
          )
        }
        const connStr = env.HYPERDRIVE.connectionString
        return pass(
          'hyperdrive',
          'Hyperdrive Binding',
          'infrastructure',
          `Hyperdrive connected (host: ${new URL(connStr).hostname.substring(0, 20)}...)`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'hyperdrive',
          'Hyperdrive Binding',
          'infrastructure',
          err.message,
          Date.now() - start
        )
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  auth: {
    'session-valid': async (env, session) => {
      const start = Date.now()
      if (!session)
        return fail(
          'session-valid',
          'Session Validation',
          'auth',
          'No valid session — test runner must be authenticated',
          Date.now() - start
        )
      return pass(
        'session-valid',
        'Session Validation',
        'auth',
        `Authenticated as ${session.email} (role: ${session.role})`,
        Date.now() - start,
        [`User ID: ${session.user_id}`, `Org: ${session.organization_id}`, `Role: ${session.role}`]
      )
    },
    'session-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(
          `SELECT COUNT(*) as count FROM public.sessions WHERE expires > NOW()`
        )
        const count = parseInt(result.rows[0]?.count || '0')
        return pass(
          'session-table',
          'Sessions Table',
          'auth',
          `${count} active sessions in database`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'session-table',
          'Sessions Table',
          'auth',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'user-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM public.users`)
        const count = parseInt(result.rows[0]?.count || '0')
        return pass(
          'user-table',
          'Users Table',
          'auth',
          `${count} users in database`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown('user-table', 'Users Table', 'auth', err.message, Date.now() - start)
      } finally {
        await db.end()
      }
    },
    'password-security': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN password_hash LIKE 'pbkdf2:%' THEN 1 END) as pbkdf2_count,
            COUNT(CASE WHEN password_hash IS NOT NULL AND password_hash NOT LIKE 'pbkdf2:%' THEN 1 END) as legacy_count
          FROM public.users WHERE password_hash IS NOT NULL
        `)
        const row = result.rows[0]
        const total = parseInt(row?.total || '0')
        const pbkdf2 = parseInt(row?.pbkdf2_count || '0')
        const legacy = parseInt(row?.legacy_count || '0')
        if (legacy > 0) {
          return warn(
            'password-security',
            'Password Security (PBKDF2)',
            'auth',
            `${legacy} users still on legacy SHA-256 hashing (will migrate on next login)`,
            Date.now() - start,
            [`Total with passwords: ${total}`, `PBKDF2: ${pbkdf2}`, `Legacy SHA-256: ${legacy}`]
          )
        }
        return pass(
          'password-security',
          'Password Security (PBKDF2)',
          'auth',
          `All ${total} users on PBKDF2-SHA256`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'password-security',
          'Password Security (PBKDF2)',
          'auth',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTERNAL SERVICES
  // ═══════════════════════════════════════════════════════════════════════════
  services: {
    telnyx: async (env) => {
      const probe = await probeTelnyx(env)
      return probeToResult('telnyx', 'Telnyx Telephony API', 'services', probe)
    },
    openai: async (env) => {
      const probe = await probeOpenAI(env)
      return probeToResult('openai', 'OpenAI API', 'services', probe)
    },
    stripe: async (env) => {
      const probe = await probeStripe(env)
      return probeToResult('stripe', 'Stripe Billing API', 'services', probe)
    },
    assemblyai: async (env) => {
      const probe = await probeAssemblyAI(env)
      return probeToResult('assemblyai', 'AssemblyAI Transcription API', 'services', probe)
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BOND AI TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  bond_ai: {
    'conversations-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM bond_ai_conversations`)
        return pass(
          'conversations-table',
          'Bond AI Conversations Table',
          'bond_ai',
          `${result.rows[0]?.count || 0} conversations`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'conversations-table',
          'Bond AI Conversations Table',
          'bond_ai',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'messages-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM bond_ai_messages`)
        return pass(
          'messages-table',
          'Bond AI Messages Table',
          'bond_ai',
          `${result.rows[0]?.count || 0} messages`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'messages-table',
          'Bond AI Messages Table',
          'bond_ai',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'alerts-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT COUNT(*) as total,
                 COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                 COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical
          FROM bond_ai_alerts
        `)
        const r = result.rows[0]
        return pass(
          'alerts-table',
          'Bond AI Alerts Table',
          'bond_ai',
          `${r?.total || 0} alerts (${r?.active || 0} active, ${r?.critical || 0} critical)`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'alerts-table',
          'Bond AI Alerts Table',
          'bond_ai',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'alert-rules-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(
          `SELECT COUNT(*) as count FROM bond_ai_alert_rules WHERE is_enabled = true`
        )
        return pass(
          'alert-rules-table',
          'Bond AI Alert Rules',
          'bond_ai',
          `${result.rows[0]?.count || 0} active alert rules`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'alert-rules-table',
          'Bond AI Alert Rules',
          'bond_ai',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'openai-chat': async (env) => {
      const start = Date.now()
      if (!env.OPENAI_API_KEY)
        return fail(
          'openai-chat',
          'Bond AI Chat (OpenAI)',
          'bond_ai',
          'OPENAI_API_KEY not configured',
          0
        )
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Respond with only the word OK' }],
            max_tokens: 5,
          }),
        })
        const ms = Date.now() - start
        if (resp.status === 200) {
          const data: any = await resp.json()
          const reply = data.choices?.[0]?.message?.content || ''
          return pass(
            'openai-chat',
            'Bond AI Chat (OpenAI)',
            'bond_ai',
            `Model responded in ${ms}ms: "${reply.trim()}"`,
            ms
          )
        }
        return fail(
          'openai-chat',
          'Bond AI Chat (OpenAI)',
          'bond_ai',
          `OpenAI returned ${resp.status}`,
          ms
        )
      } catch (err: any) {
        return serviceDown(
          'openai-chat',
          'Bond AI Chat (OpenAI)',
          'bond_ai',
          err.message,
          Date.now() - start
        )
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAM MANAGEMENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  teams: {
    'teams-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM teams WHERE is_active = true`)
        return pass(
          'teams-table',
          'Teams Table',
          'teams',
          `${result.rows[0]?.count || 0} active teams`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown('teams-table', 'Teams Table', 'teams', err.message, Date.now() - start)
      } finally {
        await db.end()
      }
    },
    'team-members-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM team_members`)
        return pass(
          'team-members-table',
          'Team Members Table',
          'teams',
          `${result.rows[0]?.count || 0} team memberships`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'team-members-table',
          'Team Members Table',
          'teams',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'rbac-permissions': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT role, COUNT(*) as perm_count 
          FROM rbac_permissions 
          GROUP BY role ORDER BY role
        `)
        const roleMap = result.rows.map((r: any) => `${r.role}: ${r.perm_count}`).join(', ')
        const total = result.rows.reduce((sum: number, r: any) => sum + parseInt(r.perm_count), 0)
        return pass(
          'rbac-permissions',
          'RBAC Permissions',
          'teams',
          `${total} permissions across ${result.rows.length} roles (${roleMap})`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'rbac-permissions',
          'RBAC Permissions',
          'teams',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'org-members': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT role, COUNT(*) as count 
          FROM org_members 
          GROUP BY role ORDER BY role
        `)
        const roleMap = result.rows.map((r: any) => `${r.role}: ${r.count}`).join(', ')
        return pass(
          'org-members',
          'Organization Members',
          'teams',
          `${roleMap}`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'org-members',
          'Organization Members',
          'teams',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VOICE & CALLS TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  voice: {
    'calls-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN created_at > NOW() - interval '24 hours' THEN 1 END) as last_24h
          FROM calls
        `)
        const r = result.rows[0]
        return pass(
          'calls-table',
          'Calls Table',
          'voice',
          `${r?.total || 0} total calls (${r?.completed || 0} completed, ${r?.last_24h || 0} in last 24h)`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown('calls-table', 'Calls Table', 'voice', err.message, Date.now() - start)
      } finally {
        await db.end()
      }
    },
    'voice-configs': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT COUNT(*) as total,
                 COUNT(CASE WHEN record = true THEN 1 END) as recording_enabled,
                 COUNT(CASE WHEN transcribe = true THEN 1 END) as transcription_enabled
          FROM voice_configs
        `)
        const r = result.rows[0]
        return pass(
          'voice-configs',
          'Voice Configurations',
          'voice',
          `${r?.total || 0} configs (${r?.recording_enabled || 0} with recording, ${r?.transcription_enabled || 0} with transcription)`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'voice-configs',
          'Voice Configurations',
          'voice',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'recordings-table': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM recordings`)
        return pass(
          'recordings-table',
          'Recordings Table',
          'voice',
          `${result.rows[0]?.count || 0} recordings stored`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'recordings-table',
          'Recordings Table',
          'voice',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'telnyx-connection': async (env) => {
      const start = Date.now()
      if (!env.TELNYX_API_KEY)
        return fail(
          'telnyx-connection',
          'Telnyx Connection ID',
          'voice',
          'TELNYX_API_KEY not configured',
          0
        )
      try {
        if (!env.TELNYX_CONNECTION_ID)
          return fail(
            'telnyx-connection',
            'Telnyx Connection ID',
            'voice',
            'TELNYX_CONNECTION_ID not configured',
            0
          )
        const resp = await fetch(
          `https://api.telnyx.com/v2/credential_connections/${env.TELNYX_CONNECTION_ID}`,
          {
            headers: { Authorization: `Bearer ${env.TELNYX_API_KEY}` },
          }
        )
        const ms = Date.now() - start
        if (resp.status === 200) {
          const data: any = await resp.json()
          return pass(
            'telnyx-connection',
            'Telnyx Credential Connection',
            'voice',
            `Connection "${data?.data?.connection_name || 'unknown'}" is active`,
            ms
          )
        }
        return fail(
          'telnyx-connection',
          'Telnyx Credential Connection',
          'voice',
          `Telnyx returned ${resp.status} for connection ID`,
          ms
        )
      } catch (err: any) {
        return serviceDown(
          'telnyx-connection',
          'Telnyx Credential Connection',
          'voice',
          err.message,
          Date.now() - start
        )
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS & REPORTING
  // ═══════════════════════════════════════════════════════════════════════════
  analytics: {
    'audit-logs': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT COUNT(*) as total,
                 COUNT(CASE WHEN created_at > NOW() - interval '24 hours' THEN 1 END) as last_24h
          FROM audit_logs
        `)
        const r = result.rows[0]
        return pass(
          'audit-logs',
          'Audit Logs',
          'analytics',
          `${r?.total || 0} total entries (${r?.last_24h || 0} in last 24h)`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown('audit-logs', 'Audit Logs', 'analytics', err.message, Date.now() - start)
      } finally {
        await db.end()
      }
    },
    organizations: async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT COUNT(*) as count, 
                 COUNT(CASE WHEN plan = 'enterprise' THEN 1 END) as enterprise
          FROM organizations
        `)
        const r = result.rows[0]
        return pass(
          'organizations',
          'Organizations',
          'analytics',
          `${r?.count || 0} organizations (${r?.enterprise || 0} enterprise)`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'organizations',
          'Organizations',
          'analytics',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    scorecards: async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM scorecards`)
        return pass(
          'scorecards',
          'Scorecards Table',
          'analytics',
          `${result.rows[0]?.count || 0} scorecards`,
          Date.now() - start
        )
      } catch (err: any) {
        // Table might not exist — that's a valid finding, not a service-down
        if (err.message?.includes('does not exist')) {
          return fail(
            'scorecards',
            'Scorecards Table',
            'analytics',
            'Table "scorecards" does not exist',
            Date.now() - start
          )
        }
        return serviceDown(
          'scorecards',
          'Scorecards Table',
          'analytics',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA INTEGRITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  integrity: {
    'fk-constraints': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.table_constraints 
          WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
        `)
        const count = parseInt(result.rows[0]?.count || '0')
        return pass(
          'fk-constraints',
          'Foreign Key Constraints',
          'integrity',
          `${count} foreign key constraints enforced`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'fk-constraints',
          'Foreign Key Constraints',
          'integrity',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'rls-policies': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT tablename, policyname 
          FROM pg_policies 
          WHERE schemaname = 'public'
        `)
        const count = result.rows.length
        const tables = [...new Set(result.rows.map((r: any) => r.tablename))]
        return count > 0
          ? pass(
              'rls-policies',
              'Row-Level Security Policies',
              'integrity',
              `${count} RLS policies on ${tables.length} tables`,
              Date.now() - start
            )
          : warn(
              'rls-policies',
              'Row-Level Security Policies',
              'integrity',
              'No RLS policies found — data isolation not enforced',
              Date.now() - start
            )
      } catch (err: any) {
        return serviceDown(
          'rls-policies',
          'Row-Level Security Policies',
          'integrity',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
    'orphaned-sessions': async (env) => {
      const start = Date.now()
      const db = getDb(env)
      try {
        const result = await db.query(`
          SELECT COUNT(*) as count FROM public.sessions WHERE expires < NOW()
        `)
        const expired = parseInt(result.rows[0]?.count || '0')
        if (expired > 100) {
          return warn(
            'orphaned-sessions',
            'Expired Sessions Cleanup',
            'integrity',
            `${expired} expired sessions need cleanup`,
            Date.now() - start
          )
        }
        return pass(
          'orphaned-sessions',
          'Expired Sessions Cleanup',
          'integrity',
          `${expired} expired sessions (acceptable)`,
          Date.now() - start
        )
      } catch (err: any) {
        return serviceDown(
          'orphaned-sessions',
          'Expired Sessions Cleanup',
          'integrity',
          err.message,
          Date.now() - start
        )
      } finally {
        await db.end()
      }
    },
  },
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function pass(
  id: string,
  name: string,
  category: string,
  details: string,
  duration_ms: number,
  output: string[] = []
): TestResult {
  return {
    test_id: id,
    test_name: name,
    category,
    passed: true,
    warning: false,
    service_down: false,
    duration_ms,
    details,
    output,
  }
}

function fail(
  id: string,
  name: string,
  category: string,
  details: string,
  duration_ms: number,
  output: string[] = []
): TestResult {
  return {
    test_id: id,
    test_name: name,
    category,
    passed: false,
    warning: false,
    service_down: false,
    duration_ms,
    details,
    error: details,
    output,
    differential: { expected: `${name} to be operational`, actual: details },
  }
}

function warn(
  id: string,
  name: string,
  category: string,
  details: string,
  duration_ms: number,
  output: string[] = []
): TestResult {
  return {
    test_id: id,
    test_name: name,
    category,
    passed: true,
    warning: true,
    service_down: false,
    duration_ms,
    details,
    output,
  }
}

function serviceDown(
  id: string,
  name: string,
  category: string,
  error: string,
  duration_ms: number
): TestResult {
  return {
    test_id: id,
    test_name: name,
    category,
    passed: false,
    warning: false,
    service_down: true,
    duration_ms,
    details: `SERVICE DOWN: ${error}`,
    error,
    output: [`⛔ ${name} is unreachable — this is an infrastructure issue, not a test failure`],
    differential: { expected: `${name} to be reachable`, actual: `Service unreachable: ${error}` },
  }
}

function probeToResult(id: string, name: string, category: string, probe: ProbeResult): TestResult {
  if (probe.status === 'down')
    return serviceDown(id, name, category, probe.error || probe.details, probe.latency_ms)
  if (probe.status === 'error')
    return fail(id, name, category, probe.error || probe.details, probe.latency_ms)
  if (probe.status === 'degraded')
    return warn(
      id,
      name,
      category,
      `DEGRADED: ${probe.details} (${probe.latency_ms}ms)`,
      probe.latency_ms
    )
  return pass(id, name, category, probe.details, probe.latency_ms)
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/test/catalog — List all available tests
// H-2 fix: Auth-gated — requires admin/owner to prevent test infrastructure leak
testRoutes.get('/catalog', async (c) => {
  let session: any = null
  try {
    session = await requireAuth(c)
    if (session.role !== 'owner' && session.role !== 'admin') {
      return c.json({ error: 'Forbidden — admin role required' }, 403)
    }
  } catch (_) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const catalog = Object.entries(TEST_REGISTRY).map(([categoryId, tests]) => ({
    id: categoryId,
    name: categoryId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Human-readable name
    tests: Object.entries(tests).map(([testId, _fn]) => ({
      id: testId,
      category: categoryId,
    })),
  }))
  return c.json({
    success: true,
    catalog,
    total_tests: catalog.reduce((sum, cat) => sum + cat.tests.length, 0),
  })
})

// POST /api/test/run — Run a single test
testRoutes.post('/run', async (c) => {
  const correlation_id = generateCorrelationId()
  let session: any = null

  try {
    session = await requireAuth(c)
    // L-1: Gate test execution behind admin/owner role in production
    if (session.role !== 'owner' && session.role !== 'admin') {
      return c.json({ passed: false, error: 'Forbidden — admin role required', correlation_id }, 403)
    }
  } catch (_) {
    return c.json({ passed: false, error: 'Authentication required', correlation_id }, 401)
  }

  try {
    const body = await c.req.json()
    const { categoryId, testId } = body

    if (!categoryId || !testId) {
      return c.json({ passed: false, error: 'Missing categoryId or testId', correlation_id }, 400)
    }

    const category = TEST_REGISTRY[categoryId]
    if (!category) {
      return c.json(
        { passed: false, error: `Unknown category: ${categoryId}`, correlation_id },
        404
      )
    }

    const testFn = category[testId]
    if (!testFn) {
      return c.json(
        { passed: false, error: `Unknown test: ${testId} in ${categoryId}`, correlation_id },
        404
      )
    }

    const result = await testFn(c.env, session)
    return c.json({ ...result, correlation_id })
  } catch (err: any) {
    logger.error('Test runner error', {
      correlation_id,
      path: '/api/test/run',
      error: err.message,
      stack: err.stack,
    })
    return c.json(
      {
        passed: false,
        warning: false,
        service_down: false,
        error: err.message,
        details: 'Test runner crashed',
        correlation_id,
        differential: { expected: 'Test to execute', actual: `Runner error: ${err.message}` },
      },
      500
    )
  }
})

// POST /api/test/run-all — Run entire test suite
testRoutes.post('/run-all', async (c) => {
  const correlation_id = generateCorrelationId()
  const suite_start = Date.now()
  let session: any = null

  try {
    session = await requireAuth(c)
  } catch (_) {}

  const results: TestResult[] = []
  const category_results: Record<
    string,
    { passed: number; failed: number; warnings: number; down: number; tests: TestResult[] }
  > = {}

  for (const [categoryId, tests] of Object.entries(TEST_REGISTRY)) {
    category_results[categoryId] = { passed: 0, failed: 0, warnings: 0, down: 0, tests: [] }

    for (const [testId, testFn] of Object.entries(tests)) {
      try {
        const result = await testFn(c.env, session)
        results.push(result)
        category_results[categoryId].tests.push(result)

        if (result.service_down) category_results[categoryId].down++
        else if (!result.passed) category_results[categoryId].failed++
        else if (result.warning) category_results[categoryId].warnings++
        else category_results[categoryId].passed++
      } catch (err: any) {
        const crashResult = fail(testId, testId, categoryId, `Test crashed: ${err.message}`, 0)
        results.push(crashResult)
        category_results[categoryId].tests.push(crashResult)
        category_results[categoryId].failed++
      }
    }
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed && !r.warning).length,
    warnings: results.filter((r) => r.warning).length,
    failed: results.filter((r) => !r.passed && !r.service_down).length,
    services_down: results.filter((r) => r.service_down).length,
    suite_duration_ms: Date.now() - suite_start,
  }

  // Log full suite result for monitoring
  logger.info('Test suite complete', {
    event: 'test_suite_complete',
    correlation_id,
    ...summary,
    timestamp: new Date().toISOString(),
  })

  return c.json({
    success: true,
    correlation_id,
    timestamp: new Date().toISOString(),
    summary,
    categories: category_results,
    results,
  })
})

// GET /api/test/health — Quick infrastructure health (no auth required)
testRoutes.get('/health', async (c) => {
  const healthData = await probeAll(c.env)
  return c.json(healthData, healthData.overall === 'down' ? 503 : 200)
})


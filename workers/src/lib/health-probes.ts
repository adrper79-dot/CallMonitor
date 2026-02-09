/**
 * Service Health Probe Library
 *
 * Tests actual reachability of every service the platform depends on.
 * Each probe returns a typed result with:
 *  - status: healthy | degraded | down | error
 *  - latency_ms: response time
 *  - details: diagnostic information
 *  - error: raw error if failed
 *
 * Used by both the /api/test/run endpoint and the /api/health endpoint.
 */

import type { Env } from '../index'
import { getDb } from './db'

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'error'

export interface ProbeResult {
  service: string
  status: ServiceStatus
  latency_ms: number
  details: string
  error?: string
  metadata?: Record<string, unknown>
}

// Thresholds (ms) — above these a service is "degraded"
const LATENCY_THRESHOLDS: Record<string, number> = {
  database: 500,
  kv: 100,
  r2: 300,
  telnyx: 2000,
  openai: 3000,
  stripe: 2000,
  assemblyai: 2000,
  api_self: 1000,
}

function statusFromLatency(service: string, ms: number): ServiceStatus {
  const threshold = LATENCY_THRESHOLDS[service] || 1000
  return ms > threshold ? 'degraded' : 'healthy'
}

// ─── Individual Probes ──────────────────────────────────────────────────────

export async function probeDatabase(env: Env): Promise<ProbeResult> {
  const start = Date.now()
  try {
    const db = getDb(env)
    const result = await db.query('SELECT version() as version, NOW() as time')
    const ms = Date.now() - start
    return {
      service: 'database',
      status: statusFromLatency('database', ms),
      latency_ms: ms,
      details: `Neon PostgreSQL connected`,
      metadata: {
        version: result.rows[0]?.version?.split(' ').slice(0, 2).join(' '),
        server_time: result.rows[0]?.time,
      },
    }
  } catch (err: any) {
    return {
      service: 'database',
      status: 'down',
      latency_ms: Date.now() - start,
      details: 'Database unreachable',
      error: err.message,
    }
  }
}

export async function probeDatabaseTables(env: Env): Promise<ProbeResult> {
  const start = Date.now()
  try {
    const db = getDb(env)
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    const ms = Date.now() - start
    const tableNames = result.rows.map((r: any) => r.table_name)

    // Core tables that MUST exist
    const required = [
      'users',
      'organizations',
      'org_members',
      'sessions',
      'calls',
      'voice_configs',
      'recordings',
      'audit_logs',
      'teams',
      'team_members',
      'bond_ai_conversations',
      'bond_ai_messages',
      'bond_ai_alerts',
      'bond_ai_alert_rules',
      'rbac_permissions',
    ]
    const missing = required.filter((t) => !tableNames.includes(t))

    return {
      service: 'database_schema',
      status: missing.length > 0 ? 'error' : 'healthy',
      latency_ms: ms,
      details:
        missing.length > 0
          ? `Missing ${missing.length} required tables: ${missing.join(', ')}`
          : `All ${required.length} required tables present (${tableNames.length} total)`,
      metadata: {
        total_tables: tableNames.length,
        missing_tables: missing,
        all_tables: tableNames,
      },
    }
  } catch (err: any) {
    return {
      service: 'database_schema',
      status: 'down',
      latency_ms: Date.now() - start,
      details: 'Cannot query schema',
      error: err.message,
    }
  }
}

export async function probeKV(env: Env): Promise<ProbeResult> {
  const start = Date.now()
  try {
    const testKey = `health-probe-${Date.now()}`
    await env.KV.put(testKey, 'ok', { expirationTtl: 60 })
    const value = await env.KV.get(testKey)
    await env.KV.delete(testKey)
    const ms = Date.now() - start
    return {
      service: 'kv',
      status: value === 'ok' ? statusFromLatency('kv', ms) : 'error',
      latency_ms: ms,
      details: value === 'ok' ? 'KV read/write OK' : 'KV write succeeded but read failed',
    }
  } catch (err: any) {
    return {
      service: 'kv',
      status: 'down',
      latency_ms: Date.now() - start,
      details: 'KV namespace unreachable',
      error: err.message,
    }
  }
}

export async function probeR2(env: Env): Promise<ProbeResult> {
  const start = Date.now()
  try {
    // List with limit 1 — cheapest R2 operation
    const listed = await env.R2.list({ limit: 1 })
    const ms = Date.now() - start
    return {
      service: 'r2',
      status: statusFromLatency('r2', ms),
      latency_ms: ms,
      details: `R2 bucket accessible (${listed.truncated ? '1000+' : listed.objects.length} objects)`,
    }
  } catch (err: any) {
    return {
      service: 'r2',
      status: 'down',
      latency_ms: Date.now() - start,
      details: 'R2 bucket unreachable',
      error: err.message,
    }
  }
}

export async function probeTelnyx(env: Env): Promise<ProbeResult> {
  const start = Date.now()
  if (!env.TELNYX_API_KEY) {
    return {
      service: 'telnyx',
      status: 'error',
      latency_ms: 0,
      details: 'TELNYX_API_KEY not configured',
    }
  }
  try {
    const resp = await fetch('https://api.telnyx.com/v2/phone_numbers?page[size]=1', {
      headers: { Authorization: `Bearer ${env.TELNYX_API_KEY}` },
    })
    const ms = Date.now() - start
    if (resp.status === 200) {
      const data: any = await resp.json()
      const count = data?.data?.length || 0
      return {
        service: 'telnyx',
        status: statusFromLatency('telnyx', ms),
        latency_ms: ms,
        details: `Telnyx API connected (${count} numbers)`,
        metadata: { phone_numbers: data?.data?.map((n: any) => n.phone_number) },
      }
    }
    return {
      service: 'telnyx',
      status: resp.status === 401 ? 'error' : 'degraded',
      latency_ms: ms,
      details: `Telnyx returned ${resp.status}`,
      error: resp.status === 401 ? 'Invalid API key' : `HTTP ${resp.status}`,
    }
  } catch (err: any) {
    return {
      service: 'telnyx',
      status: 'down',
      latency_ms: Date.now() - start,
      details: 'Telnyx API unreachable',
      error: err.message,
    }
  }
}

export async function probeOpenAI(env: Env): Promise<ProbeResult> {
  const start = Date.now()
  if (!env.OPENAI_API_KEY) {
    return {
      service: 'openai',
      status: 'error',
      latency_ms: 0,
      details: 'OPENAI_API_KEY not configured',
    }
  }
  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    })
    const ms = Date.now() - start
    if (resp.status === 200) {
      return {
        service: 'openai',
        status: statusFromLatency('openai', ms),
        latency_ms: ms,
        details: 'OpenAI API connected',
      }
    }
    return {
      service: 'openai',
      status: resp.status === 401 ? 'error' : 'degraded',
      latency_ms: ms,
      details: `OpenAI returned ${resp.status}`,
      error: resp.status === 401 ? 'Invalid API key' : `HTTP ${resp.status}`,
    }
  } catch (err: any) {
    return {
      service: 'openai',
      status: 'down',
      latency_ms: Date.now() - start,
      details: 'OpenAI API unreachable',
      error: err.message,
    }
  }
}

export async function probeStripe(env: Env): Promise<ProbeResult> {
  const start = Date.now()
  if (!env.STRIPE_SECRET_KEY) {
    return {
      service: 'stripe',
      status: 'error',
      latency_ms: 0,
      details: 'STRIPE_SECRET_KEY not configured',
    }
  }
  try {
    const resp = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    })
    const ms = Date.now() - start
    return {
      service: 'stripe',
      status: resp.status === 200 ? statusFromLatency('stripe', ms) : 'error',
      latency_ms: ms,
      details: resp.status === 200 ? 'Stripe API connected' : `Stripe returned ${resp.status}`,
      error: resp.status !== 200 ? `HTTP ${resp.status}` : undefined,
    }
  } catch (err: any) {
    return {
      service: 'stripe',
      status: 'down',
      latency_ms: Date.now() - start,
      details: 'Stripe API unreachable',
      error: err.message,
    }
  }
}

export async function probeAssemblyAI(env: Env): Promise<ProbeResult> {
  const start = Date.now()
  if (!env.ASSEMBLYAI_API_KEY) {
    return {
      service: 'assemblyai',
      status: 'error',
      latency_ms: 0,
      details: 'ASSEMBLYAI_API_KEY not configured',
    }
  }
  try {
    // Use a lightweight endpoint to test connectivity
    const resp = await fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
      headers: { Authorization: env.ASSEMBLYAI_API_KEY },
    })
    const ms = Date.now() - start
    return {
      service: 'assemblyai',
      status: resp.status === 200 ? statusFromLatency('assemblyai', ms) : 'error',
      latency_ms: ms,
      details:
        resp.status === 200 ? 'AssemblyAI API connected' : `AssemblyAI returned ${resp.status}`,
      error: resp.status !== 200 ? `HTTP ${resp.status}` : undefined,
    }
  } catch (err: any) {
    return {
      service: 'assemblyai',
      status: 'down',
      latency_ms: Date.now() - start,
      details: 'AssemblyAI API unreachable',
      error: err.message,
    }
  }
}

// ─── Composite Probes ───────────────────────────────────────────────────────

/**
 * Run all infrastructure probes (database, KV, R2).
 */
export async function probeInfrastructure(env: Env): Promise<ProbeResult[]> {
  return Promise.all([probeDatabase(env), probeDatabaseTables(env), probeKV(env), probeR2(env)])
}

/**
 * Run all external service probes (Telnyx, OpenAI, Stripe, AssemblyAI).
 */
export async function probeExternalServices(env: Env): Promise<ProbeResult[]> {
  return Promise.all([probeTelnyx(env), probeOpenAI(env), probeStripe(env), probeAssemblyAI(env)])
}

/**
 * Run ALL probes — full system health picture.
 */
export async function probeAll(env: Env): Promise<{
  overall: ServiceStatus
  timestamp: string
  total_latency_ms: number
  results: ProbeResult[]
  summary: { healthy: number; degraded: number; down: number; error: number }
}> {
  const start = Date.now()
  const results = await Promise.all([
    ...(await probeInfrastructure(env)),
    ...(await probeExternalServices(env)),
  ])

  const summary = {
    healthy: results.filter((r) => r.status === 'healthy').length,
    degraded: results.filter((r) => r.status === 'degraded').length,
    down: results.filter((r) => r.status === 'down').length,
    error: results.filter((r) => r.status === 'error').length,
  }

  let overall: ServiceStatus = 'healthy'
  if (summary.down > 0) overall = 'down'
  else if (summary.error > 0) overall = 'error'
  else if (summary.degraded > 0) overall = 'degraded'

  return {
    overall,
    timestamp: new Date().toISOString(),
    total_latency_ms: Date.now() - start,
    results,
    summary,
  }
}


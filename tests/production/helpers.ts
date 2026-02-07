/**
 * Production Integration Test Helpers — LIVE SYSTEMS ONLY
 *
 * Provides helpers that hit REAL APIs and databases.
 * Every function detects and reports service-down conditions.
 */

import { config } from 'dotenv'

config({ path: './tests/.env.production' })

// ─── Configuration ──────────────────────────────────────────────────────────

export const API_URL = process.env.WORKERS_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
export const TEST_ORG_ID = process.env.TEST_ORG_ID || ''
export const TEST_USER_ID = process.env.TEST_USER_ID || ''
export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || ''

// Feature flags
export const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1' || !!process.env.DATABASE_URL
export const RUN_API_TESTS = true // API tests always run (they hit Workers)
export const RUN_VOICE_TESTS = process.env.RUN_VOICE_TESTS === '1'
export const RUN_AI_TESTS = process.env.RUN_AI_TESTS === '1'

// ─── Service Status Types ───────────────────────────────────────────────────

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'error'

export interface ServiceCheckResult {
  service: string
  status: ServiceStatus
  latency_ms: number
  details: string
  error?: string
}

// ─── API Call Helper ────────────────────────────────────────────────────────

export async function apiCall(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  options?: {
    body?: any
    headers?: Record<string, string>
    sessionToken?: string
    timeoutMs?: number
  }
): Promise<{
  status: number
  data: any
  headers: Headers
  latency_ms: number
  service_reachable: boolean
}> {
  const url = `${API_URL}${path}`
  const start = Date.now()
  const timeout = options?.timeoutMs || 15000

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  if (options?.sessionToken) {
    headers['Authorization'] = `Bearer ${options.sessionToken}`
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timer)
    const latency_ms = Date.now() - start

    let data: any
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    return {
      status: response.status,
      data,
      headers: response.headers,
      latency_ms,
      service_reachable: true,
    }
  } catch (err: any) {
    return {
      status: 0,
      data: null,
      headers: new Headers(),
      latency_ms: Date.now() - start,
      service_reachable: false,
    }
  }
}

// ─── Service Health Check ───────────────────────────────────────────────────

/**
 * Check if the Workers API is reachable at all.
 * This MUST be called before other API tests.
 */
export async function checkApiReachable(): Promise<ServiceCheckResult> {
  const start = Date.now()
  try {
    const resp = await fetch(`${API_URL}/api/health`, {
      signal: AbortSignal.timeout(10000),
    })
    const ms = Date.now() - start
    if (resp.ok) {
      return {
        service: 'workers_api',
        status: ms > 2000 ? 'degraded' : 'healthy',
        latency_ms: ms,
        details: 'API is reachable',
      }
    }
    return {
      service: 'workers_api',
      status: 'error',
      latency_ms: ms,
      details: `Health returned ${resp.status}`,
      error: `HTTP ${resp.status}`,
    }
  } catch (err: any) {
    return {
      service: 'workers_api',
      status: 'down',
      latency_ms: Date.now() - start,
      details: 'API unreachable',
      error: err.message,
    }
  }
}

// ─── Database Helper (optional — only if DATABASE_URL provided) ────────────

let dbPool: any = null

export async function getDbPool() {
  if (!process.env.DATABASE_URL) return null
  if (dbPool) return dbPool

  try {
    const { Pool } = await import('pg')
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    })
    return dbPool
  } catch {
    return null
  }
}

export async function dbQuery<T = any>(
  sql: string,
  params?: any[]
): Promise<{ rows: T[]; service_reachable: boolean; error?: string }> {
  const pool = await getDbPool()
  if (!pool) {
    return { rows: [], service_reachable: false, error: 'DATABASE_URL not configured' }
  }

  try {
    const result = await pool.query(sql, params)
    return { rows: result.rows, service_reachable: true }
  } catch (err: any) {
    const isDown =
      err.message?.includes('ECONNREFUSED') ||
      err.message?.includes('timeout') ||
      err.message?.includes('getaddrinfo')
    return {
      rows: [],
      service_reachable: !isDown,
      error: err.message,
    }
  }
}

export async function cleanupDbPool() {
  if (dbPool) {
    await dbPool.end().catch(() => {})
    dbPool = null
  }
}

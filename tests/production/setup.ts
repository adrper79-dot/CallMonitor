/**
 * Production Integration Test Setup
 * 
 * NO MOCKS - All tests hit real production systems:
 * - Neon PostgreSQL database
 * - Cloudflare Workers API
 * - Telnyx telephony (when enabled)
 * - AssemblyAI transcription (when enabled)
 * 
 * Run with: npm run test:production
 */

import { config } from 'dotenv'
import { Pool } from 'pg'

// Load production test environment
config({ path: './tests/.env.production' })

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'WORKERS_API_URL', 'TEST_ORG_ID', 'TEST_USER_ID']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
}

// Real PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

// API base URL
export const API_URL = process.env.WORKERS_API_URL!

// Test organization and user
export const TEST_ORG_ID = process.env.TEST_ORG_ID!
export const TEST_USER_ID = process.env.TEST_USER_ID!
export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL!

// Feature flags for conditional test suites
export const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1'
export const RUN_API_TESTS = process.env.RUN_API_TESTS === '1'
export const RUN_VOICE_TESTS = process.env.RUN_VOICE_TESTS === '1'
export const RUN_AI_TESTS = process.env.RUN_AI_TESTS === '1'

/**
 * Execute a query against production database
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(sql, params)
    return result.rows as T[]
  } finally {
    client.release()
  }
}

/**
 * HTTP helper for API calls
 */
export async function apiCall(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: {
    body?: any
    headers?: Record<string, string>
    sessionToken?: string
  }
): Promise<{ status: number; data: any; headers: Headers }> {
  const url = `${API_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  if (options?.sessionToken) {
    headers['Cookie'] = `authjs.session-token=${options.sessionToken}`
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  let data: any
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  return { status: response.status, data, headers: response.headers }
}

/**
 * Create a test session token for authenticated API calls
 * Returns a session token that can be used in API requests
 */
export async function createTestSession(): Promise<string | null> {
  // AuthJS uses camelCase columns: sessionToken, userId
  // First check for existing authjs user
  const authUsers = await query(`
    SELECT id FROM "authjs"."users" LIMIT 1
  `)

  if (authUsers.length === 0) {
    console.log('⚠️ No AuthJS users, cannot create session')
    return null
  }

  const authUserId = authUsers[0].id

  // Check if user has a valid session
  const sessions = await query(`
    SELECT "sessionToken", expires 
    FROM "authjs"."sessions" 
    WHERE "userId" = $1 
    AND expires > NOW()
    ORDER BY expires DESC 
    LIMIT 1
  `, [authUserId])

  if (sessions.length > 0) {
    return sessions[0].sessionToken
  }

  // Create new session for test user
  const sessionToken = `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await query(`
    INSERT INTO "authjs"."sessions" ("sessionToken", "userId", "expires")
    VALUES ($1, $2, $3)
    ON CONFLICT ("sessionToken") DO UPDATE SET expires = $3
  `, [sessionToken, authUserId, expires.toISOString()])

  return sessionToken
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(): Promise<void> {
  // Soft-delete test calls by marking is_deleted = true
  // (calls table has a soft_delete trigger that would fail on hard delete)
  await query(`
    UPDATE calls 
    SET is_deleted = true, deleted_at = NOW()
    WHERE organization_id = $1 
    AND call_sid LIKE 'test-%'
    AND created_at > NOW() - INTERVAL '1 hour'
    AND is_deleted = false
  `, [TEST_ORG_ID])

  // Clean up old test sessions (older than 24 hours)
  // AuthJS uses camelCase columns and its own UUID user IDs
  // Only cleanup sessions that start with 'test-session-'
  await query(`
    DELETE FROM "authjs"."sessions" 
    WHERE "sessionToken" LIKE 'test-session-%'
    AND expires < NOW() - INTERVAL '24 hours'
  `)
}

/**
 * Verify test account exists and is properly configured
 */
export async function verifyTestAccount(): Promise<{
  userExists: boolean
  orgExists: boolean
  voiceConfigExists: boolean
  membershipValid: boolean
}> {
  const [users] = await query(`SELECT id FROM users WHERE id = $1`, [TEST_USER_ID])
  const [orgs] = await query(`SELECT id FROM organizations WHERE id = $1`, [TEST_ORG_ID])
  const [configs] = await query(`SELECT id FROM voice_configs WHERE organization_id = $1`, [TEST_ORG_ID])
  const [members] = await query(`
    SELECT id FROM org_members 
    WHERE user_id = $1 AND organization_id = $2 AND role IN ('owner', 'admin')
  `, [TEST_USER_ID, TEST_ORG_ID])

  return {
    userExists: !!users,
    orgExists: !!orgs,
    voiceConfigExists: !!configs,
    membershipValid: !!members,
  }
}

// Global teardown
export async function globalTeardown(): Promise<void> {
  await pool.end()
}

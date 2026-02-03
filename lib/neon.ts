/**
 * Neon Database Client
 *
 * Direct pg client for Neon Postgres, replacing Supabase.
 * Includes RLS session management and audit logging.
 */

import { Pool } from 'pg'
import { logger } from './logger'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NEON_CONNECTION_STRING,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// Set RLS session vars
export async function setRLSSession(orgId: string, userId?: string) {
  await pool.query('SET LOCAL current_organization_id = $1', [orgId])
  if (userId) {
    await pool.query('SET LOCAL current_user_id = $1', [userId])
  }
}

// Audit logging
export async function logAudit(action: string, table: string, recordId: string, orgId: string, userId?: string, details?: any) {
  await pool.query(
    'INSERT INTO audit_logs (action, table_name, record_id, organization_id, user_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
    [action, table, recordId, orgId, userId, JSON.stringify(details)]
  )
}

// Query with audit
export async function queryWithAudit(sql: string, params: any[], action: string, table: string, orgId: string, userId?: string) {
  const result = await pool.query(sql, params)
  await logAudit(action, table, params[0] || 'unknown', orgId, userId)
  return result
}

export { pool }
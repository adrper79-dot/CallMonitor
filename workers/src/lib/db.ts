/**
 * Database Client for Cloudflare Workers
 * Uses @neondatabase/serverless for edge-compatible Postgres
 *
 * Per Neon docs: Use Pool for parameterized queries with dynamic SQL.
 * The neon() function only supports tagged template literals.
 *
 * Hardening:
 *  - max: 5 connections per pool (Workers are single-request, keep small)
 *  - idleTimeoutMillis: 10s — release idle connections quickly at the edge
 *  - connectionTimeoutMillis: 10s — fail fast on unreachable DB
 *  - statement_timeout: 30s — prevent runaway queries from holding connections
 *  - Pool is closed after every request via ctx.waitUntil (see closeDb)
 */

import { Pool } from '@neondatabase/serverless'
import type { Env } from '../index'

/** Pool configuration constants */
const POOL_MAX = 5
const IDLE_TIMEOUT_MS = 10_000
const CONNECTION_TIMEOUT_MS = 10_000
const STATEMENT_TIMEOUT_MS = 30_000

export interface DbClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>
  /** End the pool — call via ctx.waitUntil(db.end()) in middleware or at request end */
  end: () => Promise<void>
}

/**
 * Get database client using Neon serverless Pool
 * Creates a new Pool per request (edge-compatible)
 *
 * Note: Per Neon docs for Cloudflare Workers, Pool must be created
 * and closed within the same request handler.
 * Note: Prefer NEON_PG_CONN direct connection over HYPERDRIVE for compatibility.
 *
 * @example
 * ```ts
 * const db = getDb(c.env)
 * const result = await db.query('SELECT * FROM users WHERE id = $1', [userId])
 * // Pool auto-closes at end of request via closeDb middleware
 * ```
 */
export function getDb(env: Env): DbClient {
  let connectionString: string

  // Prefer direct connection string for consistency
  if (env.NEON_PG_CONN) {
    connectionString = env.NEON_PG_CONN
  } else if (env.HYPERDRIVE) {
    connectionString = env.HYPERDRIVE.connectionString
  } else {
    throw new Error('No database connection string found in environment')
  }

  const pool = new Pool({
    connectionString,
    max: POOL_MAX,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    // Set statement_timeout via connection options string (avoids per-query SET round-trip)
    options: `-c statement_timeout=${STATEMENT_TIMEOUT_MS}`,
  })

  return {
    query: async (sqlString: string, params?: any[]) => {
      const result = await pool.query(sqlString, params)
      return { rows: result.rows || [] }
    },
    end: () => pool.end(),
  }
}

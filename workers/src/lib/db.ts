/**
 * Database Client for Cloudflare Workers
 * Uses @neondatabase/serverless for edge-compatible Postgres
 * 
 * Per Neon docs: Use Pool for parameterized queries with dynamic SQL.
 * The neon() function only supports tagged template literals.
 */

import { Pool } from '@neondatabase/serverless'
import type { Env } from '../index'

export interface DbClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>
}

/**
 * Get database client using Neon serverless Pool
 * Creates a new Pool per request (edge-compatible)
 * 
 * Note: Per Neon docs for Cloudflare Workers, Pool must be created
 * and closed within the same request handler.
 */
export function getDb(env: Env): DbClient {
  let connectionString: string

  if (env.HYPERDRIVE) {
    connectionString = env.HYPERDRIVE.connectionString
  } else if (env.NEON_PG_CONN) {
    connectionString = env.NEON_PG_CONN
  } else {
    throw new Error('No database connection string found in environment')
  }

  const pool = new Pool({ connectionString })

  return {
    query: async (sqlString: string, params?: any[]) => {
      try {
        const result = await pool.query(sqlString, params)
        return { rows: result.rows || [] }
      } catch (error) {
        console.error('[DB] Query error:', error)
        throw error
      }
    }
  }
}
/**
 * Database Client for Cloudflare Workers
 * Uses @neondatabase/serverless for edge-compatible Postgres
 */

import { neon } from '@neondatabase/serverless'
import type { Env } from '../index'

export interface DbClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>
}

/**
 * Get database client using Neon serverless
 * Creates a new connection per request (edge-compatible)
 */
export function getDb(env: Env): DbClient {
  let connectionString: string

  if (env.HYPERDRIVE) {
    connectionString = env.HYPERDRIVE.connectionString
  } else if (env.NEON_PG_CONN) {
    connectionString = env.NEON_PG_CONN
  } else {
    throw new Error('No database connection available (HYPERDRIVE or NEON_PG_CONN required)')
  }

  // Use Neon's serverless SQL function with fullResults for edge-compatible queries
  const sql = neon(connectionString, { fullResults: true })

  return {
    query: async (sqlString: string, params: any[] = []): Promise<{ rows: any[] }> => {
      try {
        // Use sql.call syntax for parameterized queries
        const result = await sql(sqlString, params)
        return { rows: result.rows as any[] }
      } catch (error: any) {
        console.error('Database query error:', {
          message: error.message,
          sql: sqlString.slice(0, 100),
          params: params?.slice(0, 3),
        })
        throw new Error(`Database query failed: ${error.message}`)
      }
    },
  }
}

/**
 * Transaction helper - for edge, we just run queries sequentially
 * True transaction support requires WebSocket connection which isn't always available
 */
export async function withTransaction<T>(
  env: Env,
  callback: (client: DbClient) => Promise<T>
): Promise<T> {
  // For edge workers, we just use the regular db client
  // True transactions would require websocket connection
  const db = getDb(env)
  return callback(db)
}

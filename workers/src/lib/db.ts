/**
 * Database Client for Cloudflare Workers
 * Uses Hyperdrive for connection pooling to Neon Postgres
 */

import type { Env } from '../index'

export interface DbClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>
}

/**
 * Get database client using Hyperdrive binding
 */
export function getDb(env: Env): DbClient {
  // Use Hyperdrive connection string for optimal edge performance
  const connectionString = env.HYPERDRIVE?.connectionString || env.NEON_PG_CONN

  if (!connectionString) {
    throw new Error('No database connection available (HYPERDRIVE or NEON_PG_CONN required)')
  }

  return {
    query: async (sql: string, params: any[] = []): Promise<{ rows: any[] }> => {
      // Use @neondatabase/serverless for HTTP-based queries
      // This works great with Cloudflare Workers
      const { neon } = await import('@neondatabase/serverless')
      const sql_fn = neon(connectionString)

      // Execute query
      const rows = await sql_fn(sql, params)
      return { rows: Array.isArray(rows) ? rows : [] }
    },
  }
}

/**
 * Transaction helper
 */
export async function withTransaction<T>(
  env: Env,
  callback: (client: DbClient) => Promise<T>
): Promise<T> {
  const db = getDb(env)

  // Start transaction
  await db.query('BEGIN')

  try {
    const result = await callback(db)
    await db.query('COMMIT')
    return result
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  }
}

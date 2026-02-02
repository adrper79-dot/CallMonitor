/**
 * Database Client for Cloudflare Workers
 * Uses Hyperdrive for connection pooling to Neon Postgres
 */

import { neon } from '@neondatabase/serverless'
import type { Env } from '../index'

export interface DbClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>
}

/**
 * Get database client using Hyperdrive binding
 */
export function getDb(env: Env): DbClient {
  // For Neon serverless driver, we need the HTTP connection string
  // Hyperdrive provides a Postgres connection string, but neon() expects HTTP
  // So we prefer NEON_PG_CONN secret if available
  let connectionString: string
  
  if (env.NEON_PG_CONN) {
    connectionString = env.NEON_PG_CONN
  } else if (env.HYPERDRIVE) {
    connectionString = env.HYPERDRIVE.connectionString
  } else {
    throw new Error('No database connection available (NEON_PG_CONN or HYPERDRIVE required)')
  }

  return {
    query: async (sql: string, params: any[] = []): Promise<{ rows: any[] }> => {
      try {
        // Use @neondatabase/serverless for HTTP-based queries
        const sqlClient = neon(connectionString)

        // neon client requires tagged template literals
        // We create a template strings array from our SQL string
        const strings = [sql] as unknown as TemplateStringsArray
        Object.defineProperty(strings, 'raw', { value: [sql] })
        
        // Call with template literal format
        const result = await sqlClient(strings, ...params)
        
        return { rows: Array.isArray(result) ? result : [result] }
      } catch (error: any) {
        console.error('Database query error:', {
          message: error.message,
          connectionHint: connectionString ? 'using ' + (connectionString.includes('neon.tech') ? 'NEON' : 'HYPERDRIVE') : 'no connection'
        })
        throw new Error(`Database query failed: ${error.message}`)
      }
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

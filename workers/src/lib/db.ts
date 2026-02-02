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

        // neon client requires proper template strings format
        // Split SQL on $1, $2, etc. placeholders to create template strings array
        if (params.length === 0) {
          // No parameters - simple query
          const result = await sqlClient`${sql}`
          return { rows: Array.isArray(result) ? result : [result] }
        }

        // For parameterized queries, we need to use sql() function
        // The neon client handles parameters differently
        // We need to convert $1, $2, ... to proper template literal interpolation
        
        // Split SQL on parameter placeholders
        const parts = sql.split(/\$\d+/)
        
        // Create template strings array with raw property
        const strings = parts as unknown as TemplateStringsArray
        Object.defineProperty(strings, 'raw', { value: parts })
        
        // Call neon with template literal format
        const result = await sqlClient(strings, ...params)
        
        return { rows: Array.isArray(result) ? result : [result] }
      } catch (error: any) {
        console.error('Database query error:', {
          message: error.message,
          sql: sql.slice(0, 100),
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

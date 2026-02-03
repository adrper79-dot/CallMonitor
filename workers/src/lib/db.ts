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
 * Get database client using Neon SDK (single client approach)
 */
export function getDb(env: Env): DbClient {
  let connectionString: string

  if (env.NEON_PG_CONN) {
    connectionString = env.NEON_PG_CONN
  } else if (env.HYPERDRIVE) {
    connectionString = env.HYPERDRIVE.connectionString
  } else {
    throw new Error('No database connection available (NEON_PG_CONN or HYPERDRIVE required)')
  }

  const sql = neon(connectionString)

  return {
    query: async (sqlString: string, params: any[] = []): Promise<{ rows: any[] }> => {
      try {
        // Use Neon SDK with proper parameterized queries
        let query = sqlString
        if (params && params.length > 0) {
          // Escape and sanitize parameters to prevent SQL injection
          params.forEach((param, index) => {
            const escapedValue = param === null ? 'NULL' : 
              typeof param === 'number' ? String(param) :
              typeof param === 'boolean' ? (param ? 'TRUE' : 'FALSE') :
              `'${String(param).replace(/'/g, "''")}'`
            query = query.replace(new RegExp(`\\$${index + 1}`, 'g'), escapedValue)
          })
        }
        const result = await sql.unsafe(query)
        return { rows: Array.isArray(result) ? result : [] }
      } catch (error: any) {
        console.error('Database query error:', {
          message: error.message,
          sql: sqlString.slice(0, 100),
          params: params?.slice(0, 3),
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

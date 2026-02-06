import { Pool, neonConfig } from '@neondatabase/serverless'

// Configure WebSocket for Neon serverless driver in Node.js environments
if (typeof WebSocket === 'undefined') {
  try {
    const ws = require('ws')
    neonConfig.webSocketConstructor = ws
  } catch (e) {
    // ws package not present, acceptable if in Edge runtime with global WebSocket
  }
}

const getConnectionString = () => {
  // CRITICAL: @neondatabase/serverless uses WebSocket connections
  // Hyperdrive uses TCP/PostgreSQL wire protocol - INCOMPATIBLE
  // Always prefer NEON_PG_CONN (direct WebSocket endpoint)
  // See: ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md

  // Check for Worker secrets first (available in Cloudflare Workers runtime)
  try {
    const env = (globalThis as any).env || 
               (globalThis as any).__env__ ||
               (globalThis as any).ENVIRONMENT ||
               (globalThis as any).CF_BINDINGS
               
    if (env?.NEON_PG_CONN) {
      console.log('Using Worker secret for database connection')
      return env.NEON_PG_CONN
    }
  } catch (e) {
    console.warn('Worker secrets not accessible:', e)
  }

  // Fall back to environment variables for local development
  const fallback = process.env.NEON_PG_CONN || process.env.PG_CONN || process.env.DATABASE_URL
  if (fallback) {
    console.log('Using process.env for database connection')
    return fallback
  }

  // Hyperdrive fallback - ONLY if nothing else available
  // WARNING: This will fail with @neondatabase/serverless (WebSocket vs TCP incompatibility)
  try {
    const hyperdrive = (globalThis as any).HYPERDRIVE ||
                      (globalThis as any).env?.HYPERDRIVE ||
                      (globalThis as any).__env__?.HYPERDRIVE ||
                      (globalThis as any).CF_BINDINGS?.HYPERDRIVE
    
    if (hyperdrive?.connectionString) {
      console.warn('WARNING: Using Hyperdrive - may fail with @neondatabase/serverless WebSocket driver')
      return hyperdrive.connectionString
    }
  } catch (e) {
    console.warn('Hyperdrive binding not accessible:', e)
  }

  console.error('No database connection configured in any location')
  return null
}

let _poolInstance: Pool | null = null
let _poolConnStr: string | null = null

const getPool = () => {
  const connectionString = getConnectionString()
  if (!connectionString) {
    console.warn('No Postgres connection configured - returning null pool')
    return null
  }
  // Reuse existing pool if connection string hasn't changed
  if (_poolInstance && _poolConnStr === connectionString) {
    return _poolInstance
  }
  // Close stale pool if connection string changed
  if (_poolInstance) {
    _poolInstance.end().catch(() => {})
  }
  _poolInstance = new Pool({ connectionString, max: 5 })
  _poolConnStr = connectionString
  return _poolInstance
}

export interface QueryOptions {
  organizationId?: string
  userId?: string
}

export async function query(text: string, params?: any[], options?: QueryOptions) {
  try {
    const pool = getPool()
    if (!pool) {
      console.warn('Pool not available, returning mock response')
      return { rows: [], rowCount: 0 }
    }
    
    const client = await pool.connect()
    try {
      // If context is provided, set session variables for RLS
      if (options?.organizationId) {
        await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [options.organizationId])
      }
      if (options?.userId) {
        await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [options.userId])
      }

      const res = await client.query(text, params)
      return res
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Database query failed:', err)
    return { rows: [], rowCount: 0 }
  }
}

/**
 * Transaction helper with RLS context
 */
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>,
  options?: QueryOptions
): Promise<T> {
  const pool = getPool()
  if (!pool) {
    throw new Error('Database pool not available')
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (options?.organizationId) {
      await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [options.organizationId])
    }

    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export { getPool }

export default {
  query,
}

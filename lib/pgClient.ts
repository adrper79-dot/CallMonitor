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
  // Check for Cloudflare Hyperdrive binding first
  try {
    // In OpenNext v3, bindings are available through globalThis
    const hyperdrive = (globalThis as any).HYPERDRIVE
    if (hyperdrive?.connectionString) {
      console.log('Using Hyperdrive connection')
      return hyperdrive.connectionString
    }
  } catch (e) {
    // Context might not be available during build or local dev
  }

  return process.env.NEON_PG_CONN || process.env.PG_CONN || process.env.DATABASE_URL
}

const connectionString = getConnectionString()

if (!connectionString) {
  // Defer error until used; export a null pool to allow imports during build
}

const pool = connectionString ? new Pool({ connectionString }) : null

if (pool && process.env.NODE_ENV === 'production' && !(globalThis as any).HYPERDRIVE) {
  // Console warning for direct connection without Hyperdrive
}

export interface QueryOptions {
  organizationId?: string
  userId?: string
}

export async function query(text: string, params?: any[], options?: QueryOptions) {
  if (!pool) throw new Error('No Postgres connection configured (set NEON_PG_CONN or configure Hyperdrive)')
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
}

/**
 * Transaction helper with RLS context
 */
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>,
  options?: QueryOptions
): Promise<T> {
  if (!pool) throw new Error('No Postgres connection')
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

export { pool }

export default {
  query,
}

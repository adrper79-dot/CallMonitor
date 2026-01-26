import { Pool } from 'pg'
import { getRequestContext } from '@cloudflare/next-on-pages'

const getConnectionString = () => {
  // Check for Cloudflare Hyperdrive binding first
  try {
    const ctx = getRequestContext()
    if (ctx?.env?.HYPERDRIVE?.connectionString) {
      console.log('Using Hyperdrive connection')
      return ctx.env.HYPERDRIVE.connectionString
    }
  } catch (e) {
    // Context might not be available during build or local dev without next-on-pages
  }

  return process.env.NEON_PG_CONN || process.env.PG_CONN || process.env.DATABASE_URL
}

const connectionString = getConnectionString()

if (!connectionString) {
  // Defer error until used; export a null pool to allow imports during build
}

const pool = connectionString ? new Pool({ connectionString }) : null

export async function query(text: string, params?: any[]) {
  if (!pool) throw new Error('No Postgres connection configured (set NEON_PG_CONN or configure Hyperdrive)')
  const client = await pool.connect()
  try {
    const res = await client.query(text, params)
    return res
  } finally {
    client.release()
  }
}

export { pool }

export default {
  query,
}

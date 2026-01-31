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

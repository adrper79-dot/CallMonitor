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
    connectionString
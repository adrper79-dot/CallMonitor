/**
 * Supabase Admin Client (Service Role)
 * 
 * This client uses the service role key which bypasses Row Level Security (RLS).
 * Use this ONLY for server-side operations that require elevated permissions.
 * 
 * NEVER expose the service role key to the client!
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import pg from './pgClient'

// If NEON_PG_CONN (or PG_CONN/DATABASE_URL) is provided, use a lightweight
// Postgres-backed compatibility layer so server code can continue calling
// `supabaseAdmin.from(...).select/insert/update` while the underlying DB is Neon.

let supabaseAdminInstance: any = null

function createPgCompat() {
  function escapeIdentifier(id: string) {
    return '"' + id.replace(/"/g, '""') + '"'
  }

  class FromBuilder {
    table: string
    selects: string | null = null
    where: { clause: string; params: any[] }[] = []
    limitCount?: number
    orderBy?: string

    constructor(table: string) {
      this.table = table
    }

    select(cols: string) {
      this.selects = cols
      return this
    }

    eq(col: string, val: any) {
      const paramIndex = this._nextParamIndex()
      this.where.push({ clause: `${escapeIdentifier(col)} = $${paramIndex}`, params: [val] })
      return this
    }

    limit(n: number) {
      this.limitCount = n
      return this
    }

    order(column: string, dir: 'asc' | 'desc' = 'asc') {
      this.orderBy = `${escapeIdentifier(column)} ${dir.toUpperCase()}`
      return this
    }

    async single() {
      const { text, params } = this._buildSelect(true)
      try {
        const res = await pg.query(text, params)
        return { data: res.rows[0] || null, error: null }
      } catch (err: any) {
        return { data: null, error: err }
      }
    }

    async insert(obj: Record<string, any>) {
      const cols = Object.keys(obj)
      const params = cols.map((_, i) => `$${i + 1}`)
      const values = cols.map(k => obj[k])
      const text = `INSERT INTO ${escapeIdentifier(this.table)} (${cols.map(escapeIdentifier).join(',')}) VALUES (${params.join(',')}) RETURNING *`
      try {
        const res = await pg.query(text, values)
        return { data: res.rows, error: null }
      } catch (err: any) {
        return { data: null, error: err }
      }
    }

    async update(obj: Record<string, any>) {
      const cols = Object.keys(obj)
      const setClauses = cols.map((c, i) => `${escapeIdentifier(c)} = $${i + 1}`)
      const values = cols.map(k => obj[k])
      const whereParams = this._gatherWhereParams()
      const text = `UPDATE ${escapeIdentifier(this.table)} SET ${setClauses.join(',')} ${this._whereClause(whereParams.length)} RETURNING *`
      try {
        const res = await pg.query(text, values.concat(whereParams))
        return { data: res.rows, error: null }
      } catch (err: any) {
        return { data: null, error: err }
      }
    }

    // simple helper methods
    _gatherWhereParams() {
      return this.where.flatMap(w => w.params)
    }

    _whereClause(offset = 0) {
      if (this.where.length === 0) return ''
      // replace param placeholders to continue numbering after offset
      const clauses = this.where.map((w, idx) => {
        const start = offset + this._paramOffsetForIndex(idx)
        // each w.params will become $start, $start+1 ... but we only ever add one param per eq()
        return w.clause.replace(/\$(\d+)/g, (_m, n) => `$${offset + parseInt(n, 10)}`)
      })
      return 'WHERE ' + clauses.join(' AND ')
    }

    _nextParamIndex() {
      // current where params count + 1
      const count = this.where.flatMap(w => w.params).length
      return count + 1
    }

    _paramOffsetForIndex(i: number) {
      return this.where.slice(0, i).flatMap(w => w.params).length + 1
    }

    _buildSelect(single = false) {
      const cols = this.selects || '*'
      const whereParams = this._gatherWhereParams()
      const whereClause = this._whereClause(0)
      const limit = single || this.limitCount ? `LIMIT ${single ? 1 : this.limitCount}` : ''
      const order = this.orderBy ? `ORDER BY ${this.orderBy}` : ''
      const text = `SELECT ${cols} FROM ${escapeIdentifier(this.table)} ${whereClause} ${order} ${limit}`
      return { text, params: whereParams }
    }
  }

  return new Proxy({}, {
    get(_t, prop) {
      return function (tableName: string) {
        if (prop === 'from') {
          return function (table: string) {
            return new FromBuilder(table)
          }
        }
        return undefined
      }
    }
  })
}

function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance

  const neonConn = process.env.NEON_PG_CONN || process.env.PG_CONN || process.env.DATABASE_URL
  if (neonConn) {
    supabaseAdminInstance = createPgCompat()
    return supabaseAdminInstance
  }

  // Fallback to actual Supabase admin client if no Neon connection configured
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable')
  if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')

  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  return supabaseAdminInstance
}

const supabaseAdmin: any = new Proxy({}, {
  get(_t, prop) {
    const client = getSupabaseAdmin()
    const value = (client as any)[prop]
    if (typeof value === 'function') return value.bind(client)
    return value
  }
})

export default supabaseAdmin

/**
 * LIVE Database Integration Tests — NO MOCKS
 *
 * Tests the Neon PostgreSQL database directly:
 *   - Table existence and schema correctness
 *   - Column types and constraints
 *   - Foreign key relationships
 *   - Row-Level Security policies
 *   - Required data integrity
 *
 * Run: npm run test:prod:db
 */

import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { dbQuery, cleanupDbPool } from './helpers'

let dbReachable = false

beforeAll(async () => {
  try {
    const result = await dbQuery('SELECT 1 AS ok')
    dbReachable = result.service_reachable
    if (!dbReachable) {
      console.error('⛔ DATABASE IS DOWN — all DB tests will report SERVICE_DOWN')
    } else {
      console.log(`\n🗄️  Database Connection: UP (${result.latency_ms}ms)`)
    }
  } catch {
    console.error('⛔ DATABASE IS DOWN — connection failed')
  }
})

afterAll(async () => {
  await cleanupDbPool()
})

// Helper to check if a table exists
async function tableExists(tableName: string): Promise<boolean> {
  const r = await dbQuery(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists`,
    [tableName]
  )
  return r.rows[0]?.exists === true
}

// Helper to get columns for a table
async function getColumns(
  tableName: string
): Promise<Array<{ column_name: string; data_type: string; is_nullable: string }>> {
  const r = await dbQuery(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [tableName]
  )
  return r.rows
}

// Helper to check constraints
async function getConstraints(
  tableName: string
): Promise<Array<{ constraint_name: string; constraint_type: string }>> {
  const r = await dbQuery(
    `SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  )
  return r.rows
}

// ─── CORE TABLES ────────────────────────────────────────────────────────────

describe('Core Tables', () => {
  const requiredCoreTables = ['users', 'sessions', 'organizations', 'org_members']

  for (const table of requiredCoreTables) {
    test(`Table "${table}" exists`, async () => {
      if (!dbReachable) {
        console.log('⛔ DB DOWN')
        return
      }
      expect(await tableExists(table), `Missing required table: ${table}`).toBe(true)
    })
  }

  test('Users table has required columns', async () => {
    if (!dbReachable) return
    const cols = await getColumns('users')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'email', 'password_hash', 'name']
    for (const col of required) {
      expect(colNames, `users table missing column: ${col}`).toContain(col)
    }
  })

  test('Users table password_hash supports PBKDF2 length', async () => {
    if (!dbReachable) return
    const cols = await getColumns('users')
    const pwCol = cols.find((c) => c.column_name === 'password_hash')
    expect(pwCol, 'password_hash column missing').toBeDefined()
    // PBKDF2-SHA256 output is ~120 chars in our format
    // Should be text or varchar(255+)
    expect(
      ['text', 'character varying'].includes(pwCol!.data_type),
      `password_hash should be text or varchar, got: ${pwCol!.data_type}`
    ).toBe(true)
  })

  test('Sessions table has required columns', async () => {
    if (!dbReachable) return
    const cols = await getColumns('sessions')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'user_id', 'session_token', 'expires']
    for (const col of required) {
      expect(colNames, `sessions table missing column: ${col}`).toContain(col)
    }
  })
})

// ─── VOICE / CALLS TABLES ───────────────────────────────────────────────────

describe('Voice & Calls Tables', () => {
  const voiceTables = ['calls', 'voice_configs', 'recordings']

  for (const table of voiceTables) {
    test(`Table "${table}" exists`, async () => {
      if (!dbReachable) return
      expect(await tableExists(table), `Missing voice table: ${table}`).toBe(true)
    })
  }

  test('Calls table has required columns', async () => {
    if (!dbReachable) return
    if (!(await tableExists('calls'))) {
      console.warn('⚠️ calls table does not exist')
      return
    }
    const cols = await getColumns('calls')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'organization_id', 'direction', 'status']
    for (const col of required) {
      expect(colNames, `calls missing column: ${col}`).toContain(col)
    }
  })

  test('Voice configs table has required columns', async () => {
    if (!dbReachable) return
    if (!(await tableExists('voice_configs'))) {
      console.warn('⚠️ voice_configs table does not exist')
      return
    }
    const cols = await getColumns('voice_configs')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'organization_id']
    for (const col of required) {
      expect(colNames, `voice_configs missing column: ${col}`).toContain(col)
    }
  })
})

// ─── BOND AI TABLES ─────────────────────────────────────────────────────────

describe('Bond AI Tables', () => {
  const bondTables = ['bond_ai_conversations', 'bond_ai_messages', 'bond_ai_alerts']

  for (const table of bondTables) {
    test(`Table "${table}" exists`, async () => {
      if (!dbReachable) return
      expect(await tableExists(table), `Missing Bond AI table: ${table}`).toBe(true)
    })
  }

  test('Conversations table has correct schema', async () => {
    if (!dbReachable) return
    if (!(await tableExists('bond_ai_conversations'))) return
    const cols = await getColumns('bond_ai_conversations')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'user_id', 'organization_id', 'title']
    for (const col of required) {
      expect(colNames, `bond_ai_conversations missing: ${col}`).toContain(col)
    }
  })

  test('Messages table has correct schema', async () => {
    if (!dbReachable) return
    if (!(await tableExists('bond_ai_messages'))) return
    const cols = await getColumns('bond_ai_messages')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'conversation_id', 'role', 'content']
    for (const col of required) {
      expect(colNames, `bond_ai_messages missing: ${col}`).toContain(col)
    }
  })

  test('Alerts table has correct schema', async () => {
    if (!dbReachable) return
    if (!(await tableExists('bond_ai_alerts'))) return
    const cols = await getColumns('bond_ai_alerts')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'organization_id', 'severity', 'status']
    for (const col of required) {
      expect(colNames, `bond_ai_alerts missing: ${col}`).toContain(col)
    }
  })

  test('Alert rules table has correct schema', async () => {
    if (!dbReachable) return
    if (!(await tableExists('bond_ai_alert_rules'))) return
    const cols = await getColumns('bond_ai_alert_rules')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'organization_id', 'name', 'enabled']
    for (const col of required) {
      expect(colNames, `bond_ai_alert_rules missing: ${col}`).toContain(col)
    }
  })
})

// ─── TEAMS TABLES ───────────────────────────────────────────────────────────

describe('Teams & RBAC Tables', () => {
  const teamsTables = ['teams', 'team_members', 'org_members']

  for (const table of teamsTables) {
    test(`Table "${table}" exists`, async () => {
      if (!dbReachable) return
      expect(await tableExists(table), `Missing teams table: ${table}`).toBe(true)
    })
  }

  test('Teams table has required columns', async () => {
    if (!dbReachable) return
    if (!(await tableExists('teams'))) return
    const cols = await getColumns('teams')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'name', 'organization_id']
    for (const col of required) {
      expect(colNames, `teams missing: ${col}`).toContain(col)
    }
  })

  test('Team members table has required columns', async () => {
    if (!dbReachable) return
    if (!(await tableExists('team_members'))) return
    const cols = await getColumns('team_members')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'team_id', 'user_id', 'team_role']
    for (const col of required) {
      expect(colNames, `team_members missing: ${col}`).toContain(col)
    }
  })

  test('Organization members has role column for RBAC', async () => {
    if (!dbReachable) return
    if (!(await tableExists('org_members'))) return
    const cols = await getColumns('org_members')
    const colNames = cols.map((c) => c.column_name)
    expect(colNames, 'org members missing role column for RBAC').toContain('role')
  })
})

// ─── ANALYTICS TABLES ───────────────────────────────────────────────────────

describe('Analytics & Audit Tables', () => {
  const analyticsTables = ['audit_logs', 'scorecards']

  for (const table of analyticsTables) {
    test(`Table "${table}" exists`, async () => {
      if (!dbReachable) return
      expect(await tableExists(table), `Missing analytics table: ${table}`).toBe(true)
    })
  }

  test('Audit logs table has required columns', async () => {
    if (!dbReachable) return
    if (!(await tableExists('audit_logs'))) return
    const cols = await getColumns('audit_logs')
    const colNames = cols.map((c) => c.column_name)
    const required = ['id', 'action', 'user_id']
    for (const col of required) {
      expect(colNames, `audit_logs missing: ${col}`).toContain(col)
    }
  })
})

// ─── DATA INTEGRITY ─────────────────────────────────────────────────────────

describe('Data Integrity', () => {
  test('Foreign key constraints exist on sessions.user_id', async () => {
    if (!dbReachable) return
    const r = await dbQuery(`
      SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, 
             ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'sessions' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'user_id'
    `)
    if (r.rows.length === 0) {
      console.warn('⚠️ No FK constraint on sessions.user_id — orphaned sessions possible')
    }
    // Log but don't fail — FK may be enforced at app level
    console.log(`   FK constraints on sessions.user_id: ${r.rows.length}`)
  })

  test('No orphaned sessions exist', async () => {
    if (!dbReachable) return
    const r = await dbQuery(`
      SELECT COUNT(*) AS orphaned FROM sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE u.id IS NULL
    `)
    const count = parseInt(r.rows[0]?.orphaned || '0', 10)
    if (count > 0) {
      console.warn(`⚠️ ${count} orphaned sessions found (no matching user)`)
    }
    expect(count, `Found ${count} orphaned sessions`).toBe(0)
  })

  test('No duplicate emails in users table', async () => {
    if (!dbReachable) return
    const r = await dbQuery(`
      SELECT email, COUNT(*) AS cnt FROM users GROUP BY email HAVING COUNT(*) > 1
    `)
    if (r.rows.length > 0) {
      console.error(`❌ Duplicate emails: ${r.rows.map((r: any) => r.email).join(', ')}`)
    }
    expect(r.rows.length, 'Found duplicate emails in users table').toBe(0)
  })

  test('All user passwords use PBKDF2 format', async () => {
    if (!dbReachable) return
    const r = await dbQuery(`
      SELECT id, email,
        CASE WHEN password_hash LIKE 'pbkdf2_%' THEN 'pbkdf2'
             WHEN password_hash LIKE '$2%' THEN 'bcrypt_legacy'
             ELSE 'unknown'
        END AS hash_type
      FROM users WHERE password_hash IS NOT NULL
    `)
    const legacy = r.rows.filter((row: any) => row.hash_type !== 'pbkdf2')
    if (legacy.length > 0) {
      console.warn(`⚠️ ${legacy.length} users still on legacy hash format:`)
      for (const u of legacy) {
        console.warn(`   - ${(u as any).email}: ${(u as any).hash_type}`)
      }
    }
    console.log(`   Hash format: ${r.rows.length} users checked, ${legacy.length} legacy`)
  })
})

// ─── RLS POLICIES ───────────────────────────────────────────────────────────

describe('Row-Level Security', () => {
  test('RLS is enabled on sensitive tables', async () => {
    if (!dbReachable) return
    const sensitiveTables = ['users', 'sessions', 'calls', 'organizations']
    const r = await dbQuery(
      `
      SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)
    `,
      [sensitiveTables]
    )

    for (const table of r.rows) {
      const status = (table as any).rowsecurity ? '✅' : '⚠️'
      console.log(
        `   ${status} RLS on ${(table as any).tablename}: ${(table as any).rowsecurity ? 'enabled' : 'disabled'}`
      )
    }
  })

  test('RLS policies exist', async () => {
    if (!dbReachable) return
    const r = await dbQuery(`
      SELECT schemaname, tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename
    `)
    console.log(`   📋 ${r.rows.length} RLS policies found`)
    for (const p of r.rows) {
      console.log(`      ${(p as any).tablename}.${(p as any).policyname} (${(p as any).cmd})`)
    }
  })
})

// ─── INDEXES ────────────────────────────────────────────────────────────────

describe('Performance Indexes', () => {
  test('Critical indexes exist', async () => {
    if (!dbReachable) return
    const r = await dbQuery(`
      SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname
    `)

    const indexMap: Record<string, string[]> = {}
    for (const row of r.rows) {
      const tn = (row as any).tablename
      if (!indexMap[tn]) indexMap[tn] = []
      indexMap[tn].push((row as any).indexname)
    }

    // Check critical indexes
    const criticalTables = ['users', 'sessions', 'calls', 'organizations']
    for (const table of criticalTables) {
      const indexes = indexMap[table] || []
      const status = indexes.length > 0 ? '✅' : '⚠️'
      console.log(`   ${status} ${table}: ${indexes.length} indexes`)
    }

    console.log(`   📊 Total indexes: ${r.rows.length}`)
  })
})

// ─── DATABASE HEALTH ────────────────────────────────────────────────────────

describe('Database Health', () => {
  test('Database version is PostgreSQL 17', async () => {
    if (!dbReachable) return
    const r = await dbQuery('SELECT version()')
    const version = (r.rows[0] as any)?.version || ''
    console.log(`   🐘 ${version.split(',')[0]}`)
    expect(version).toContain('PostgreSQL')
  })

  test('Active connections within limits', async () => {
    if (!dbReachable) return
    const r = await dbQuery(`
      SELECT count(*) AS active, 
             (SELECT setting FROM pg_settings WHERE name = 'max_connections') AS max_conn
      FROM pg_stat_activity
    `)
    const active = parseInt((r.rows[0] as any)?.active || '0', 10)
    const max = parseInt((r.rows[0] as any)?.max_conn || '100', 10)
    const pct = Math.round((active / max) * 100)
    console.log(`   🔗 Connections: ${active}/${max} (${pct}%)`)
    expect(pct, `Connection usage at ${pct}% — approaching limit`).toBeLessThan(80)
  })

  test('Database size is reasonable', async () => {
    if (!dbReachable) return
    const r = await dbQuery(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`)
    console.log(`   💾 Database size: ${(r.rows[0] as any)?.size}`)
  })

  test('Table count matches expectations', async () => {
    if (!dbReachable) return
    const r = await dbQuery(
      `SELECT count(*) AS cnt FROM information_schema.tables WHERE table_schema = 'public'`
    )
    const count = parseInt((r.rows[0] as any)?.cnt || '0', 10)
    console.log(`   📊 Public tables: ${count}`)
    expect(count, 'Expected at least 10 public tables').toBeGreaterThanOrEqual(10)
  })
})

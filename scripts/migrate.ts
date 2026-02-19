#!/usr/bin/env node
/**
 * scripts/migrate.ts — Word Is Bond Database Migration Runner
 *
 * Applies SQL migrations from the migrations/ directory to Neon PostgreSQL.
 * Tracks applied migrations in schema_migrations to ensure idempotency.
 *
 * Usage:
 *   npm run db:migrate              — apply all pending migrations
 *   npm run db:migrate:status       — show applied/pending status
 *   npm run db:migrate -- --dry-run — print pending SQL without applying
 *
 * Migration file naming convention (sort-stable):
 *   0000_schema_migrations.sql   ← tracking table (bootstrap)
 *   YYYY-MM-DD-description.sql   ← date-prefixed migrations
 *   NNN_description.sql          ← numbered migrations (legacy)
 *
 * Environment:
 *   NEON_PG_CONN — required; Neon PostgreSQL connection string
 */

import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { Client } from 'pg'

// ─── Config ─────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = resolve(import.meta.dirname ?? __dirname, '../migrations')
const DRY_RUN = process.argv.includes('--dry-run')
const STATUS_ONLY = process.argv.includes('--status')
const BOOTSTRAP_FILE = '0000_schema_migrations.sql'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

/**
 * Sort migration filenames in a stable, deterministic order:
 * 1. Bootstrap file always first
 * 2. Numbered files (NNN_*) sorted numerically
 * 3. Date-prefixed files (YYYY-MM-DD-*) sorted lexicographically
 * 4. All others alphabetically
 */
function sortMigrations(files: string[]): string[] {
  return [...files].sort((a, b) => {
    if (a === BOOTSTRAP_FILE) return -1
    if (b === BOOTSTRAP_FILE) return 1

    const numA = a.match(/^(\d{3,})_/)
    const numB = b.match(/^(\d{3,})_/)
    if (numA && numB) return parseInt(numA[1]) - parseInt(numB[1])
    if (numA) return -1
    if (numB) return 1

    return a.localeCompare(b)
  })
}

interface MigrationRow {
  version: string
  applied_at: Date
  checksum: string
  duration_ms: number
}

// ─── Core ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const connString = process.env.NEON_PG_CONN
  if (!connString) {
    console.error('❌  NEON_PG_CONN environment variable is required')
    process.exit(1)
  }

  const client = new Client({ connectionString: connString })
  await client.connect()

  try {
    // Step 1: Bootstrap — create schema_migrations if it doesn't exist
    const bootstrapPath = join(MIGRATIONS_DIR, BOOTSTRAP_FILE)
    const bootstrapSql = await readFile(bootstrapPath, 'utf8')
    await client.query(bootstrapSql)

    // Step 2: Load all already-applied versions
    const { rows: applied } = await client.query<MigrationRow>(
      'SELECT version, applied_at, checksum, duration_ms FROM schema_migrations ORDER BY version'
    )
    const appliedMap = new Map(applied.map(r => [r.version, r]))

    // Step 3: Discover migration files
    const allFiles = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql'))
    const sorted = sortMigrations(allFiles)

    // Step 4: Status report
    if (STATUS_ONLY) {
      console.log('\n📋  Migration Status\n')
      console.log('  Status    Version')
      console.log('  ────────  ──────────────────────────────────────────')
      for (const file of sorted) {
        const row = appliedMap.get(file)
        if (row) {
          const when = row.applied_at.toISOString().replace('T', ' ').substring(0, 19)
          console.log(`  ✅ applied  ${file}  (${when}, ${row.duration_ms}ms)`)
        } else {
          console.log(`  ⏳ pending  ${file}`)
        }
      }
      const pending = sorted.filter(f => !appliedMap.has(f))
      console.log(`\n  ${applied.length} applied, ${pending.length} pending\n`)
      return
    }

    // Step 5: Run pending migrations
    const pending = sorted.filter(f => !appliedMap.has(f))
    if (pending.length === 0) {
      console.log('✅  No pending migrations — database is up to date.')
      return
    }

    console.log(`\n🚀  Applying ${pending.length} migration(s)${DRY_RUN ? ' [DRY RUN]' : ''}...\n`)

    let applied_count = 0
    let failed = false

    for (const file of pending) {
      const filePath = join(MIGRATIONS_DIR, file)
      const content = await readFile(filePath, 'utf8')
      const checksum = sha256(content)

      if (DRY_RUN) {
        console.log(`  ── ${file} ──\n${content.trim()}\n`)
        continue
      }

      const start = Date.now()
      try {
        await client.query('BEGIN')
        await client.query(content)
        const duration_ms = Date.now() - start

        // Only record non-bootstrap migrations (bootstrap creates the table)
        if (file !== BOOTSTRAP_FILE) {
          await client.query(
            'INSERT INTO schema_migrations (version, checksum, duration_ms) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING',
            [file, checksum, duration_ms]
          )
        }

        await client.query('COMMIT')
        console.log(`  ✅  ${file}  (${duration_ms}ms)`)
        applied_count++
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        console.error(`  ❌  ${file} — FAILED:`, (err as Error).message)
        failed = true
        break
      }
    }

    if (!DRY_RUN) {
      console.log(`\n${failed ? '❌  Migration failed after' : '✅  Applied'} ${applied_count} migration(s).\n`)
      if (failed) process.exit(1)
    }
  } finally {
    await client.end()
  }
}

run().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

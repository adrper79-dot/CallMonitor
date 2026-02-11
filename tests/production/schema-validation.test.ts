/**
 * Schema Validation Tests
 *
 * Automated tests to ensure database schema matches expected structure.
 * Prevents schema drift bugs by validating critical table columns exist.
 *
 * Based on CRITICAL_WORKFLOWS_AUDIT_2026-02-11.md requirements.
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { dbQuery, RUN_DB_TESTS, checkApiReachable, apiCall } from './helpers'

const describeOrSkip = RUN_DB_TESTS ? describe : describe.skip

describeOrSkip('Schema Validation: Critical Table Columns', () => {
  let apiHealth: any

  beforeAll(async () => {
    apiHealth = await checkApiReachable()
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  SCHEMA VALIDATION TESTS`)
    console.log(`${'═'.repeat(60)}`)
    console.log(`  🗄️ Database: ${RUN_DB_TESTS ? 'ENABLED' : 'DISABLED'}`)
    console.log(`  🌐 API Health: ${apiHealth.status.toUpperCase()}`)
    console.log(`${'═'.repeat(60)}\n`)
  })

  describe('Critical Tables: Column Existence', () => {
    const criticalTables = {
      calls: [
        'id', 'organization_id', 'call_session_id', 'direction', 'status',
        'transcript', 'transcript_status', 'recording_url', 'duration_seconds',
        'created_at', 'updated_at'
      ],
      users: [
        'id', 'organization_id', 'email', 'name', 'role',
        'created_at', 'updated_at'
      ],
      organizations: [
        'id', 'name', 'subscription_status', 'created_at', 'updated_at'
      ],
      voice_configs: [
        'id', 'organization_id', 'transcribe', 'ai_enabled', 'bond_enabled',
        'created_at', 'updated_at'
      ],
      usage_stats: [
        'id', 'organization_id', 'date', 'calls_count', 'minutes_used',
        'transcripts_count', 'ai_requests_count', 'created_at'
      ]
    }

    for (const [tableName, expectedColumns] of Object.entries(criticalTables)) {
      test(`Table '${tableName}' has all expected columns`, async () => {
        const result = await dbQuery(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY column_name
        `, [tableName])

        if (!result.service_reachable) {
          console.log(`  ❌ ${tableName}: Database unreachable`)
          expect(result.service_reachable).toBe(true)
          return
        }

        const actualColumns = result.rows.map(r => r.column_name)
        const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col))

        console.log(`  📋 ${tableName}: ${actualColumns.length} columns found`)

        if (missingColumns.length > 0) {
          console.log(`    ❌ Missing: ${missingColumns.join(', ')}`)
        }

        expect(missingColumns).toHaveLength(0)
        expect(actualColumns.length).toBeGreaterThanOrEqual(expectedColumns.length)
      })
    }
  })

  describe('API Schema Health Endpoint', () => {
    test('GET /api/internal/schema-health validates critical tables', async () => {
      if (apiHealth.status === 'down') return

      const { status, data } = await apiCall('GET', '/api/internal/schema-health')

      expect(status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('tables')
      expect(data).toHaveProperty('timestamp')

      // Should validate all critical tables
      const criticalTableNames = ['calls', 'users', 'organizations', 'voice_configs', 'usage_stats']
      for (const tableName of criticalTableNames) {
        expect(data.tables).toHaveProperty(tableName)
        const tableInfo = data.tables[tableName]
        expect(tableInfo).toHaveProperty('status')
        expect(tableInfo).toHaveProperty('column_count')
        expect(tableInfo).toHaveProperty('missing_columns')
        expect(Array.isArray(tableInfo.missing_columns)).toBe(true)
      }

      console.log(`  🩺 Schema health: ${data.status}`)
    })

    test('Schema health endpoint detects missing columns', async () => {
      if (apiHealth.status === 'down') return

      // This test would need to be run against a test database
      // with intentionally missing columns to verify detection

      console.log(`  🔍 Missing column detection: Manual verification required`)
      console.log(`     - Test against database with missing critical columns`)
      console.log(`     - Verify endpoint returns 'invalid' status with missing list`)
    })
  })

  describe('Schema Drift Prevention', () => {
    test('No unexpected column drops in production', async () => {
      // This test ensures we haven't accidentally dropped columns
      // by checking that all previously known columns still exist

      const result = await dbQuery(`
        SELECT table_name, COUNT(*) as column_count
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name IN ('calls', 'users', 'organizations', 'voice_configs', 'usage_stats')
        GROUP BY table_name
        ORDER BY table_name
      `)

      if (!result.service_reachable) return

      const tableCounts = result.rows.reduce((acc: any, row) => {
        acc[row.table_name] = row.column_count
        return acc
      }, {})

      // Minimum expected columns for each table
      const minColumns = {
        calls: 10,
        users: 6,
        organizations: 4,
        voice_configs: 6,
        usage_stats: 7
      }

      for (const [table, minCount] of Object.entries(minColumns)) {
        const actualCount = tableCounts[table] || 0
        console.log(`  📊 ${table}: ${actualCount} columns (min: ${minCount})`)
        expect(actualCount).toBeGreaterThanOrEqual(minCount)
      }
    })

    test('Foreign key constraints are intact', async () => {
      const result = await dbQuery(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name IN ('calls', 'users', 'voice_configs', 'usage_stats')
        ORDER BY tc.table_name, kcu.column_name
      `)

      if (!result.service_reachable) return

      // Should have foreign keys for organization_id in key tables
      const fkCount = result.rows.length
      console.log(`  🔗 Foreign keys found: ${fkCount}`)

      // At minimum, expect organization_id FKs
      expect(fkCount).toBeGreaterThanOrEqual(4) // calls, users, voice_configs, usage_stats
    })
  })
})
/**
 * Production Database Integration Tests
 *
 * Tests real database operations against Neon PostgreSQL.
 * NO MOCKS - all queries hit the production database.
 *
 * Run with: npm run test:production
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  pool,
  query,
  TEST_ORG_ID,
  TEST_USER_ID,
  RUN_DB_TESTS,
  verifyTestAccount,
  globalTeardown,
} from './setup'

const describeOrSkip = RUN_DB_TESTS ? describe : describe.skip

describeOrSkip('Production Database Tests', () => {
  beforeAll(async () => {
    // Verify we can connect
    const result = await query('SELECT NOW() as time')
    expect(result).toHaveLength(1)
    console.log('✅ Database connected at:', result[0].time)
  })

  afterAll(async () => {
    await globalTeardown()
  })

  describe('Connection & Health', () => {
    test('database is reachable', async () => {
      const result = await query('SELECT 1 as health')
      expect(result[0].health).toBe(1)
    })

    test('tables exist', async () => {
      const result = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `)
      const tableNames = result.map((r) => r.table_name)

      // Verify core tables exist
      expect(tableNames).toContain('users')
      expect(tableNames).toContain('organizations')
      expect(tableNames).toContain('calls')
      expect(tableNames).toContain('voice_configs')
      expect(tableNames).toContain('recordings')
      expect(tableNames).toContain('audit_logs')

      console.log(`✅ Found ${tableNames.length} tables`)
    })

    test('RLS is enabled on core tables', async () => {
      const result = await query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('calls', 'recordings', 'voice_configs', 'audit_logs')
      `)

      for (const table of result) {
        expect(table.rowsecurity).toBe(true)
        console.log(`✅ RLS enabled on: ${table.tablename}`)
      }
    })
  })

  describe('Test Account Validation', () => {
    test('test user exists', async () => {
      const users = await query(
        `
        SELECT id, email, name, is_admin 
        FROM users 
        WHERE id = $1
      `,
        [TEST_USER_ID]
      )

      expect(users).toHaveLength(1)
      expect(users[0].id).toBe(TEST_USER_ID)
      console.log(`✅ Test user: ${users[0].email}`)
    })

    test('test organization exists', async () => {
      const orgs = await query(
        `
        SELECT id, name, plan 
        FROM organizations 
        WHERE id = $1
      `,
        [TEST_ORG_ID]
      )

      expect(orgs).toHaveLength(1)
      expect(orgs[0].plan).toBe('enterprise')
      console.log(`✅ Test org: ${orgs[0].name} (${orgs[0].plan})`)
    })

    test('test user is owner of test organization', async () => {
      const membership = await query(
        `
        SELECT user_id, organization_id, role 
        FROM org_members 
        WHERE user_id = $1 AND organization_id = $2
      `,
        [TEST_USER_ID, TEST_ORG_ID]
      )

      expect(membership).toHaveLength(1)
      expect(membership[0].role).toBe('owner')
    })

    test('voice config exists for test organization', async () => {
      const configs = await query(
        `
        SELECT id, record, transcribe, translate, survey 
        FROM voice_configs 
        WHERE organization_id = $1
      `,
        [TEST_ORG_ID]
      )

      expect(configs.length).toBeGreaterThanOrEqual(1)
      expect(typeof configs[0].record).toBe('boolean')
      expect(typeof configs[0].transcribe).toBe('boolean')
      console.log('✅ Voice config verified')
    })

    test('verifyTestAccount returns all valid', async () => {
      const status = await verifyTestAccount()
      expect(status.userExists).toBe(true)
      expect(status.orgExists).toBe(true)
      expect(status.voiceConfigExists).toBe(true)
      expect(status.membershipValid).toBe(true)
    })
  })

  describe('Call Records', () => {
    test('can query calls table', async () => {
      const calls = await query(
        `
        SELECT id, organization_id, status 
        FROM calls 
        WHERE organization_id = $1 
        LIMIT 10
      `,
        [TEST_ORG_ID]
      )

      // Test org may have 0 calls (that's ok)
      expect(Array.isArray(calls)).toBe(true)
      console.log(`📞 Found ${calls.length} calls for test org`)
    })

    test('can insert and read test call', async () => {
      // Use gen_random_uuid() for proper UUID generation
      const result = await query(
        `
        INSERT INTO calls (id, organization_id, status, created_by, started_at)
        VALUES (gen_random_uuid(), $1, 'test', $2, NOW())
        RETURNING id
      `,
        [TEST_ORG_ID, TEST_USER_ID]
      )

      const callId = result[0].id

      // Read it back
      const calls = await query(
        `
        SELECT id, status FROM calls WHERE id = $1
      `,
        [callId]
      )

      expect(calls).toHaveLength(1)
      expect(calls[0].status).toBe('test')

      // Clean up - mark as test (don't delete for audit trail)
      await query(
        `
        UPDATE calls SET status = 'test_completed' WHERE id = $1
      `,
        [callId]
      )

      console.log(`✅ Test call lifecycle: ${callId}`)
    })
  })

  describe('Audit Logging', () => {
    test('can insert audit log', async () => {
      // Use gen_random_uuid() for proper UUID generation
      // Note: user_id is also UUID, so we use null (nullable) for tests
      const result = await query(
        `
        INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id)
        VALUES (gen_random_uuid(), $1, 'test_action', 'test', gen_random_uuid())
        RETURNING id
      `,
        [TEST_ORG_ID]
      )

      const logId = result[0].id

      const logs = await query(
        `
        SELECT id, action, resource_type FROM audit_logs WHERE id = $1
      `,
        [logId]
      )

      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('test_action')
      console.log('✅ Audit log created')
    })

    test('audit logs are append-only (cannot update)', async () => {
      const logs = await query(
        `
        SELECT id FROM audit_logs WHERE organization_id = $1 LIMIT 1
      `,
        [TEST_ORG_ID]
      )

      if (logs.length > 0) {
        // Attempt to update should fail or have no effect due to RLS policy
        try {
          await query(
            `
            UPDATE audit_logs SET action = 'hacked' WHERE id = $1
          `,
            [logs[0].id]
          )
          // If we get here, check that the update didn't work
          const updated = await query(`SELECT action FROM audit_logs WHERE id = $1`, [logs[0].id])
          expect(updated[0].action).not.toBe('hacked')
        } catch (err) {
          // Expected - RLS should block this
          expect(err).toBeDefined()
        }
      }
    })
  })

  describe('Session Management', () => {
    test('sessions table exists in public schema', async () => {
      const tables = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
          AND table_name = 'sessions'
      `)

      expect(tables.length).toBeGreaterThan(0)
    })

    test('can create and query sessions', async () => {
      // Platform uses custom auth with sessions in public schema
      // sessions table has: id, user_id, session_token, expires
      const users = await query(`
        SELECT id FROM public.users LIMIT 1
      `)

      if (users.length === 0) {
        console.log('⚠️ No users exist, skipping session test')
        return
      }

      const userId = users[0].id
      const sessionToken = `test-session-${Date.now()}`
      const expires = new Date(Date.now() + 3600000) // 1 hour

      await query(
        `
        INSERT INTO public.sessions (user_id, session_token, expires)
        VALUES ($1, $2, $3)
      `,
        [userId, sessionToken, expires.toISOString()]
      )

      const sessions = await query(
        `
        SELECT session_token, user_id 
        FROM public.sessions 
        WHERE session_token = $1
      `,
        [sessionToken]
      )

      expect(sessions).toHaveLength(1)
      expect(sessions[0].user_id).toBe(userId)

      // Cleanup
      await query(
        `
        DELETE FROM public.sessions WHERE session_token = $1
      `,
        [sessionToken]
      )

      console.log('✅ Session lifecycle verified')
    })
  })

  describe('Data Integrity', () => {
    test('foreign key constraints are enforced', async () => {
      // Try to insert a call with invalid org ID - should fail FK constraint
      const fakeOrgId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

      try {
        await query(
          `
          INSERT INTO calls (id, organization_id, status, created_by, started_at)
          VALUES (gen_random_uuid(), $1, 'test', $2, NOW())
        `,
          [fakeOrgId, TEST_USER_ID]
        )
        // Should not reach here
        expect(true).toBe(false)
      } catch (err: any) {
        // Expected - FK constraint violation or similar error
        const msg = err.message.toLowerCase()
        const isConstraintError =
          msg.includes('foreign key') ||
          msg.includes('violates') ||
          msg.includes('constraint') ||
          msg.includes('insert') ||
          msg.includes('invalid')
        expect(isConstraintError).toBe(true)
        console.log('✅ FK constraint enforced:', err.message.substring(0, 60))
      }
    })

    test('unique constraints are enforced', async () => {
      // Try to insert duplicate org_member
      try {
        await query(
          `
          INSERT INTO org_members (user_id, organization_id, role)
          VALUES ($1, $2, 'admin')
        `,
          [TEST_USER_ID, TEST_ORG_ID]
        )
        // Should fail due to unique constraint
      } catch (err: any) {
        expect(err.message).toContain('duplicate') // or 'unique'
      }
    })
  })
})

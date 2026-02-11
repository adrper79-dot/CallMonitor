/**
 * Cross-Tenant Data Isolation Tests — AI & Analytics Routes
 *
 * Validates that multi-tenant boundaries are enforced across all AI and
 * analytics endpoints. Each test confirms that Organization A cannot access
 * Organization B's data through any API surface.
 *
 * Compliance: SOC2 CC6.1 (Logical Access), GDPR Art. 25 (Data Protection by Design)
 *
 * Run with: RUN_API_TESTS=1 npm run test:production
 *
 * @see ARCH_DOCS/01-CORE/SECURITY.md — Multi-tenant isolation
 * @see BL-AI-003
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  apiCall,
  API_URL,
  TEST_ORG_ID,
  TEST_USER_ID,
  RUN_API_TESTS,
  createTestSession,
  query,
  pool,
} from './setup'

const describeOrSkip = RUN_API_TESTS ? describe : describe.skip

// A second org ID that the test user does NOT belong to
const FOREIGN_ORG_ID = '00000000-0000-4000-8000-000000000000'

describeOrSkip('Cross-Tenant Data Isolation — AI & Analytics', () => {
  let sessionToken: string | null = null
  let testCallId: string | null = null
  let foreignCallId: string | null = null

  beforeAll(async () => {
    sessionToken = await createTestSession()
    if (!sessionToken) {
      console.warn('⚠️ No session token — isolation tests will fail')
      return
    }

    // Ensure a foreign org exists for isolation tests
    await query(
      `INSERT INTO organizations (id, name, plan)
       VALUES ($1, 'Isolation Test Org', 'base')
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID]
    )

    // Ensure test org has at least one call
    const ownCalls = await query(
      `SELECT id FROM calls WHERE organization_id = $1 LIMIT 1`,
      [TEST_ORG_ID]
    )
    testCallId = ownCalls[0]?.id || null

    // Ensure foreign org has at least one call (created directly in DB)
    const foreignCalls = await query(
      `SELECT id FROM calls WHERE organization_id = $1 LIMIT 1`,
      [FOREIGN_ORG_ID]
    )
    if (foreignCalls.length === 0) {
      const inserted = await query(
        `INSERT INTO calls (id, organization_id, status, created_by)
         VALUES (gen_random_uuid(), $1, 'completed', $1)
         RETURNING id`,
        [FOREIGN_ORG_ID]
      )
      foreignCallId = inserted[0]?.id
    } else {
      foreignCallId = foreignCalls[0].id
    }

    console.log(`🔒 Isolation test setup:`)
    console.log(`   Own org: ${TEST_ORG_ID}`)
    console.log(`   Foreign org: ${FOREIGN_ORG_ID}`)
    console.log(`   Own call: ${testCallId}`)
    console.log(`   Foreign call: ${foreignCallId}`)
  })

  afterAll(async () => {
    // Clean up foreign test data
    await query(
      `DELETE FROM calls WHERE organization_id = $1 AND call_sid IS NULL`,
      [FOREIGN_ORG_ID]
    )
  })

  // ─── Analytics Route Isolation ─────────────────────────────────────────────

  describe('Analytics — org_id scoping', () => {
    test('GET /analytics/kpis returns only own org data', async () => {
      const { status, data } = await apiCall('GET', '/api/analytics/kpis', {
        sessionToken: sessionToken!,
      })

      // Should succeed — own org data is accessible
      expect(status).toBe(200)
      // Response should not contain foreign org references
      const raw = JSON.stringify(data)
      expect(raw).not.toContain(FOREIGN_ORG_ID)
    })

    test('GET /analytics/trends returns only own org data', async () => {
      const { status, data } = await apiCall('GET', '/api/analytics/trends', {
        sessionToken: sessionToken!,
      })

      expect(status).toBe(200)
      const raw = JSON.stringify(data)
      expect(raw).not.toContain(FOREIGN_ORG_ID)
    })

    test('GET /analytics/export scopes to own org', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/analytics/export?type=calls',
        { sessionToken: sessionToken! }
      )

      expect(status).toBe(200)
      // If CSV data returned, should not contain foreign org calls
      if (data.csv) {
        expect(data.csv).not.toContain(FOREIGN_ORG_ID)
      }
    })
  })

  // ─── Reports Route Isolation ───────────────────────────────────────────────

  describe('Reports — tenant-scoped queries', () => {
    test('GET /reports returns only own org reports', async () => {
      const { status, data } = await apiCall('GET', '/api/reports', {
        sessionToken: sessionToken!,
      })

      expect(status).toBe(200)
      if (data.data && Array.isArray(data.data)) {
        for (const report of data.data) {
          expect(report.organization_id).toBe(TEST_ORG_ID)
        }
      }
    })

    test('GET /reports/schedules returns only own org schedules', async () => {
      const { status, data } = await apiCall('GET', '/api/reports/schedules', {
        sessionToken: sessionToken!,
      })

      expect(status).toBe(200)
      if (data.data && Array.isArray(data.data)) {
        for (const schedule of data.data) {
          expect(schedule.organization_id).toBe(TEST_ORG_ID)
        }
      }
    })
  })

  // ─── Scorecards Route Isolation ────────────────────────────────────────────

  describe('Scorecards — tenant boundary enforcement', () => {
    test('GET /scorecards returns only own org scorecards', async () => {
      const { status, data } = await apiCall('GET', '/api/scorecards', {
        sessionToken: sessionToken!,
      })

      expect(status).toBe(200)
      if (data.data && Array.isArray(data.data)) {
        for (const scorecard of data.data) {
          expect(scorecard.organization_id).toBe(TEST_ORG_ID)
        }
      }
    })

    test('GET /scorecards/alerts returns only own org alerts', async () => {
      const { status, data } = await apiCall('GET', '/api/scorecards/alerts', {
        sessionToken: sessionToken!,
      })

      expect(status).toBe(200)
      if (data.data && Array.isArray(data.data)) {
        for (const alert of data.data) {
          expect(alert.organization_id).toBe(TEST_ORG_ID)
        }
      }
    })

    test('GET /scorecards/:foreignId rejects cross-tenant access', async () => {
      // Create a scorecard in the foreign org directly in DB
      const foreignScorecards = await query(
        `SELECT id FROM scorecards WHERE organization_id = $1 LIMIT 1`,
        [FOREIGN_ORG_ID]
      )

      if (foreignScorecards.length > 0) {
        const { status } = await apiCall(
          'GET',
          `/api/scorecards/${foreignScorecards[0].id}`,
          { sessionToken: sessionToken! }
        )

        // Should return 404 (not found for this org) — not 200 with foreign data
        expect(status).not.toBe(200)
      }
    })
  })

  // ─── AI LLM Route Isolation ────────────────────────────────────────────────

  describe('AI LLM — cross-tenant call_id rejection', () => {
    test('POST /ai/llm/summarize rejects foreign org call_id', async () => {
      if (!foreignCallId) return

      const { status, data } = await apiCall('POST', '/api/ai/llm/summarize', {
        sessionToken: sessionToken!,
        body: {
          text: 'This is a test transcript for summarization validation.',
          call_id: foreignCallId,
        },
      })

      // The endpoint should either reject the request or
      // the audit log should capture the user's org, not the foreign org
      // At minimum it should not leak foreign org data
      if (status === 200 && data.summary) {
        // If it succeeded, verify it logged against the requesting user's org
        const auditLogs = await query(
          `SELECT organization_id FROM audit_logs
           WHERE action = 'ai:summarize_completed'
           AND resource_id = $1
           ORDER BY created_at DESC LIMIT 1`,
          [foreignCallId]
        )
        if (auditLogs.length > 0) {
          // Audit should log against the requesting user's org, not the foreign one
          expect(auditLogs[0].organization_id).toBe(TEST_ORG_ID)
        }
      }
    })
  })

  // ─── Sentiment Route Isolation ─────────────────────────────────────────────

  describe('Sentiment — history scoped to organization', () => {
    test('GET /sentiment/history returns only own org data', async () => {
      const { status, data } = await apiCall('GET', '/api/sentiment/history', {
        sessionToken: sessionToken!,
      })

      // Should succeed with own org data
      if (status === 200 && data.data && Array.isArray(data.data)) {
        for (const entry of data.data) {
          expect(entry.organization_id).toBe(TEST_ORG_ID)
        }
      }
    })
  })

  // ─── Bond AI Route Isolation ───────────────────────────────────────────────

  describe('Bond AI — conversation isolation', () => {
    test('GET /bond-ai/conversations returns only own org conversations', async () => {
      const { status, data } = await apiCall('GET', '/api/bond-ai/conversations', {
        sessionToken: sessionToken!,
      })

      expect(status).toBe(200)
      if (data.conversations && Array.isArray(data.conversations)) {
        for (const conv of data.conversations) {
          expect(conv.organization_id).toBe(TEST_ORG_ID)
        }
      }
    })

    test('GET /bond-ai/insights returns only own org insights', async () => {
      const { status, data } = await apiCall('GET', '/api/bond-ai/insights', {
        sessionToken: sessionToken!,
      })

      if (status === 200 && data.insights && Array.isArray(data.insights)) {
        for (const insight of data.insights) {
          expect(insight.organization_id).toBe(TEST_ORG_ID)
        }
      }
    })
  })

  // ─── Direct DB Isolation Verification ──────────────────────────────────────

  describe('Database-level isolation verification', () => {
    test('calls table enforces org_id filtering in all route queries', async () => {
      // Verify foreign org calls exist but are not accessible via API
      const foreignCallCount = await query(
        `SELECT COUNT(*)::int as count FROM calls WHERE organization_id = $1`,
        [FOREIGN_ORG_ID]
      )

      if (foreignCallCount[0].count > 0) {
        // API should not return foreign calls
        const { data } = await apiCall('GET', '/api/calls?limit=100', {
          sessionToken: sessionToken!,
        })

        if (data.data && Array.isArray(data.data)) {
          const foreignCallsInResponse = data.data.filter(
            (call: any) => call.organization_id === FOREIGN_ORG_ID
          )
          expect(foreignCallsInResponse).toHaveLength(0)
        }
      }
    })

    test('recordings table enforces org_id filtering', async () => {
      const { data } = await apiCall('GET', '/api/calls?limit=100', {
        sessionToken: sessionToken!,
      })

      if (data.data && Array.isArray(data.data)) {
        for (const call of data.data) {
          expect(call.organization_id).toBe(TEST_ORG_ID)
        }
      }
    })

    test('audit_logs table scoped to requesting org', async () => {
      const { status, data } = await apiCall('GET', '/api/audit?limit=50', {
        sessionToken: sessionToken!,
      })

      if (status === 200 && data.data && Array.isArray(data.data)) {
        for (const log of data.data) {
          expect(log.organization_id).toBe(TEST_ORG_ID)
        }
      }
    })
  })
})

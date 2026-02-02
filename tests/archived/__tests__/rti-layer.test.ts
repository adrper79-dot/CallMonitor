/**
 * Tests for Return-Traffic Intelligence Layer
 * 
 * Verifies LAW-RTI compliance:
 * 1. RTI tables are append-only (no UPDATE/DELETE)
 * 2. RTI cannot change canonical artifacts
 * 3. Side effects have audit log entries
 * 4. Decisions include provenance
 * 
 * @integration: Requires real DB connections
 * Run with: RUN_INTEGRATION=1 npm test
 */

import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest'
import { v4 as uuidv4 } from 'uuid'

const describeOrSkip = process.env.RUN_INTEGRATION ? describe : describe.skip

// Dynamic imports to avoid Pool construction when tests are skipped
let pool: any
let AttentionService: any

// These tests require real DB - imports are done in beforeAll when tests actually run

const TEST_ORG_ID = 'test-org-id'
const TEST_USER_ID = 'test-user-id'

describeOrSkip('Return-Traffic Intelligence Layer', () => {
    let attentionService: any
    let testEventId = 'test-event-id'
    let testPolicyId = 'test-policy-id'

    beforeAll(async () => {
        // Dynamic imports to avoid Pool construction when tests are skipped
        const neonModule = await import('@/lib/neon')
        pool = neonModule.pool
        const attentionModule = await import('@/lib/services/attentionService')
        AttentionService = attentionModule.AttentionService
        // Use real pool for integration tests
        attentionService = new AttentionService(pool)
    })

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Event Emission and Decisions', () => {
        test('emitEvent creates event and decision', async () => {
            const result = await attentionService.emitEvent(
                TEST_ORG_ID,
                'call_completed',
                'calls',
                'test-call-id',
                new Date(),
                { severity: 3, phone: '+15551234567' },
                [{ table: 'calls', id: 'test-call-id' }]
            )

            expect(result.success).toBe(true)
            expect(result.eventId).toBeDefined()
        })

        test('decisions exist for event', async () => {
            const decisionsResult = await pool.query('SELECT * FROM attention_decisions WHERE attention_event_id = $1', [testEventId])
            const decisions = decisionsResult.rows

            expect(decisions.length).toBeGreaterThan(0)
            expect(decisions[0].produced_by).toBe('system')
        })

        test('high severity event gets escalated', async () => {
            const result = await attentionService.emitEvent(
                TEST_ORG_ID,
                'alert_triggered',
                'alerts',
                uuidv4(),
                new Date(),
                { severity: 8, message: 'Critical alert' },
                [{ table: 'alerts', id: uuidv4() }]
            )

            expect(result.success).toBe(true)

            // Verify escalation
            const decisionsResult = await pool.query('SELECT * FROM attention_decisions WHERE attention_event_id = $1', [result.eventId])
            const decisions = decisionsResult.rows

            expect(decisions[0].decision).toBe('escalate')
            expect(decisions[0].reason).toContain('threshold')
        })

        test('decision includes input_refs (provenance)', async () => {
            const decisionResult = await pool.query('SELECT input_refs FROM attention_decisions WHERE attention_event_id = $1 LIMIT 1', [testEventId])
            const decision = decisionResult.rows[0]

            expect(decision?.input_refs).toBeInstanceOf(Array)
            expect(decision?.input_refs.length).toBeGreaterThan(0)
        })
    })

    describe('Immutability Enforcement (LAW RTI-03)', () => {
        test('cannot update attention_events', async () => {
            try {
                await pool.query('UPDATE attention_events SET event_type = $1 WHERE id = $2', ['system_error', testEventId])
                expect(true).toBe(false) // should not reach
            } catch (error) {
                expect((error as Error).message).toContain('append-only')
            }
        })

        test('cannot delete attention_events', async () => {
            try {
                await pool.query('DELETE FROM attention_events WHERE id = $1', [testEventId])
                expect(true).toBe(false) // should not reach
            } catch (error) {
                expect((error as Error).message).toContain('append-only')
            }
        })

        test('cannot update attention_decisions', async () => {
            const decisionResult = await pool.query('SELECT id FROM attention_decisions WHERE attention_event_id = $1 LIMIT 1', [testEventId])
            const decision = decisionResult.rows[0]

            try {
                await pool.query('UPDATE attention_decisions SET decision = $1 WHERE id = $2', ['suppress', decision.id])
                expect(true).toBe(false) // should not reach
            } catch (error) {
                expect((error as Error).message).toContain('append-only')
            }
        })

        test('cannot delete attention_decisions', async () => {
            const decisionResult = await pool.query('SELECT id FROM attention_decisions WHERE attention_event_id = $1 LIMIT 1', [testEventId])
            const decision = decisionResult.rows[0]

            try {
                await pool.query('DELETE FROM attention_decisions WHERE id = $1', [decision.id])
                expect(true).toBe(false) // should not reach
            } catch (error) {
                expect((error as Error).message).toContain('append-only')
            }
        })
    })

    describe('Human Override (LAW RTI-05)', () => {
        test('human override creates new decision (does not update)', async () => {
            // Get count before
            const beforeResult = await pool.query('SELECT id FROM attention_decisions WHERE attention_event_id = $1', [testEventId])
            const countBefore = beforeResult.rows.length

            // Human override
            const result = await attentionService.humanOverride(
                TEST_ORG_ID,
                testEventId,
                'suppress',
                'False alarm, ignoring',
                TEST_USER_ID
            )

            expect(result.success).toBe(true)

            // Get count after
            const afterResult = await pool.query('SELECT id FROM attention_decisions WHERE attention_event_id = $1', [testEventId])
            expect(afterResult.rows.length).toBe(countBefore + 1)
        })

        test('human override decision marked as produced_by: human', async () => {
            const decisionsResult = await pool.query('SELECT * FROM attention_decisions WHERE attention_event_id = $1 AND produced_by = $2', [testEventId, 'human'])
            const decisions = decisionsResult.rows

            expect(decisions.length).toBeGreaterThan(0)
            expect(decisions[0].produced_by_user_id).toBe(TEST_USER_ID)
        })
    })

    describe('Digest Generation', () => {
        test('generates digest with statistics', async () => {
            const periodEnd = new Date()
            const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000)

            const result = await attentionService.generateDigest(
                TEST_ORG_ID,
                'on_demand',
                periodStart,
                periodEnd,
                TEST_USER_ID
            )

            expect(result.success).toBe(true)
            expect(result.digestId).toBeDefined()

            // Verify digest contents
            const digestResult = await pool.query('SELECT * FROM digests WHERE id = $1', [result.digestId])
            const digest = digestResult.rows[0]

            expect(digest).not.toBeNull()
            expect(digest.total_events).toBeGreaterThan(0)
            expect(digest.summary_text).toBeDefined()
        })

        test('cannot update digest', async () => {
            const digestResult = await pool.query('SELECT id FROM digests WHERE organization_id = $1 LIMIT 1', [TEST_ORG_ID])
            const digest = digestResult.rows[0]

            try {
                await pool.query('UPDATE digests SET summary_text = $1 WHERE id = $2', ['Modified', digest.id])
                expect(true).toBe(false) // should not reach
            } catch (error) {
                expect((error as Error).message).toContain('append-only')
            }
        })
    })

    describe('Audit Logging (LAW RTI-05)', () => {
        test('escalation creates audit log entry', async () => {
            // Find an escalated decision
            const escalatedResult = await pool.query('SELECT id FROM attention_decisions WHERE organization_id = $1 AND decision = $2 LIMIT 1', [TEST_ORG_ID, 'escalate'])
            const escalated = escalatedResult.rows[0]

            if (escalated) {
                const auditResult = await pool.query('SELECT * FROM audit_logs WHERE resource_type = $1 AND resource_id = $2', ['attention_decision', escalated.id])
                const auditLogs = auditResult.rows

                expect(auditLogs.length).toBeGreaterThan(0)
            }
        })
    })

    describe('Policy Evaluation', () => {
        test('quiet hours policy suppresses during quiet time', async () => {
            // Create quiet hours policy (always active for test)
            const quietPolicyId = uuidv4()
            await pool.query(`
                INSERT INTO attention_policies (id, organization_id, name, policy_type, policy_config, priority, is_enabled, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [quietPolicyId, TEST_ORG_ID, 'Test Quiet Hours', 'quiet_hours', JSON.stringify({ start_hour: 0, end_hour: 24 }), 1, true, TEST_USER_ID])

            const result = await attentionService.emitEvent(
                TEST_ORG_ID,
                'call_completed',
                'calls',
                uuidv4(),
                new Date(),
                { foo: 'bar' },
                []
            )

            // Should be suppressed or in digest due to quiet hours
            const decisionsResult = await pool.query('SELECT decision, reason FROM attention_decisions WHERE attention_event_id = $1', [result.eventId])
            const decisions = decisionsResult.rows

            expect(['include_in_digest', 'suppress']).toContain(decisions[0].decision)
            expect(decisions[0].reason.toLowerCase()).toContain('quiet')

            // Cleanup
            await pool.query('UPDATE attention_policies SET is_enabled = $1 WHERE id = $2', [false, quietPolicyId])
        })
    })
})


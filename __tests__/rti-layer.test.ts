/**
 * Tests for Return-Traffic Intelligence Layer
 * 
 * Verifies LAW-RTI compliance:
 * 1. RTI tables are append-only (no UPDATE/DELETE)
 * 2. RTI cannot change canonical artifacts
 * 3. Side effects have audit log entries
 * 4. Decisions include provenance
 */

import { pool, setRLSSession } from '@/lib/neon'
import { v4 as uuidv4 } from 'uuid'
import { AttentionService } from '@/lib/services/attentionService'

const TEST_ORG_ID = process.env.TEST_ORG_ID || uuidv4()
const TEST_USER_ID = uuidv4()

describe('Return-Traffic Intelligence Layer', () => {
    let attentionService: AttentionService
    let testEventId: string
    let testPolicyId: string

    beforeAll(async () => {
        await setRLSSession(TEST_ORG_ID, TEST_USER_ID)
        attentionService = new AttentionService(pool)

        // Create test organization
        await pool.query(`
            INSERT INTO organizations (id, name, slug)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug
        `, [TEST_ORG_ID, 'Test Org for RTI', 'test-rti-org'])

        // Create test user
        await pool.query(`
            INSERT INTO users (id, email, name)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
        `, [TEST_USER_ID, 'rti-admin@test.com', 'RTI Test Admin'])

        await pool.query(`
            INSERT INTO org_members (id, organization_id, user_id, role)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role
        `, [uuidv4(), TEST_ORG_ID, TEST_USER_ID, 'admin'])

        // Create a test policy
        testPolicyId = uuidv4()
        await pool.query(`
            INSERT INTO attention_policies (id, organization_id, name, policy_type, policy_config, priority, is_enabled, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [testPolicyId, TEST_ORG_ID, 'Test Threshold Policy', 'threshold', JSON.stringify({ severity_minimum: 5 }), 10, true, TEST_USER_ID])

    describe('Event Emission and Decisions', () => {
        test('emitEvent creates event and decision', async () => {
            const result = await attentionService.emitEvent(
                TEST_ORG_ID,
                'call_completed',
                'calls',
                uuidv4(),
                new Date(),
                { severity: 3, phone: '+15551234567' },
                [{ table: 'calls', id: uuidv4() }]
            )

            expect(result.success).toBe(true)
            expect(result.eventId).toBeDefined()
            testEventId = result.eventId!

            // Verify decision was created
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


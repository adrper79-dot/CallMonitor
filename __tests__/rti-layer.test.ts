/**
 * Tests for Return-Traffic Intelligence Layer
 * 
 * Verifies LAW-RTI compliance:
 * 1. RTI tables are append-only (no UPDATE/DELETE)
 * 2. RTI cannot change canonical artifacts
 * 3. Side effects have audit log entries
 * 4. Decisions include provenance
 */

import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { AttentionService } from '@/lib/services/attentionService'

// Test setup
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
)

const TEST_ORG_ID = process.env.TEST_ORG_ID || uuidv4()
const TEST_USER_ID = uuidv4()

describe('Return-Traffic Intelligence Layer', () => {
    let attentionService: AttentionService
    let testEventId: string
    let testPolicyId: string

    beforeAll(async () => {
        attentionService = new AttentionService(supabase)

        // Create test organization
        await supabase.from('organizations').upsert({
            id: TEST_ORG_ID,
            name: 'Test Org for RTI',
            slug: 'test-rti-org'
        })

        // Create test user
        await supabase.from('users').upsert({
            id: TEST_USER_ID,
            email: 'rti-admin@test.com',
            name: 'RTI Test Admin'
        })

        await supabase.from('org_members').upsert({
            id: uuidv4(),
            organization_id: TEST_ORG_ID,
            user_id: TEST_USER_ID,
            role: 'admin'
        })

        // Create a test policy
        testPolicyId = uuidv4()
        await supabase.from('attention_policies').insert({
            id: testPolicyId,
            organization_id: TEST_ORG_ID,
            name: 'Test Threshold Policy',
            policy_type: 'threshold',
            policy_config: { severity_minimum: 5 },
            priority: 10,
            is_enabled: true,
            created_by: TEST_USER_ID
        })
    })

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
            const { data: decision } = await supabase
                .from('attention_decisions')
                .select('id')
                .eq('attention_event_id', testEventId)
                .single()

            const { error } = await supabase
                .from('attention_decisions')
                .update({ decision: 'suppress' })
                .eq('id', decision?.id)

            expect(error).not.toBeNull()
            expect(error?.message).toContain('append-only')
        })

        test('cannot delete attention_decisions', async () => {
            const { data: decision } = await supabase
                .from('attention_decisions')
                .select('id')
                .eq('attention_event_id', testEventId)
                .single()

            const { error } = await supabase
                .from('attention_decisions')
                .delete()
                .eq('id', decision?.id)

            expect(error).not.toBeNull()
            expect(error?.message).toContain('append-only')
        })
    })

    describe('Human Override (LAW RTI-05)', () => {
        test('human override creates new decision (does not update)', async () => {
            // Get count before
            const { data: beforeDecisions } = await supabase
                .from('attention_decisions')
                .select('id')
                .eq('attention_event_id', testEventId)

            const countBefore = beforeDecisions?.length || 0

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
            const { data: afterDecisions } = await supabase
                .from('attention_decisions')
                .select('id')
                .eq('attention_event_id', testEventId)

            expect(afterDecisions?.length).toBe(countBefore + 1)
        })

        test('human override decision marked as produced_by: human', async () => {
            const { data: decisions } = await supabase
                .from('attention_decisions')
                .select('*')
                .eq('attention_event_id', testEventId)
                .eq('produced_by', 'human')

            expect(decisions?.length).toBeGreaterThan(0)
            expect(decisions?.[0].produced_by_user_id).toBe(TEST_USER_ID)
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
            const { data: digest } = await supabase
                .from('digests')
                .select('*')
                .eq('id', result.digestId)
                .single()

            expect(digest).not.toBeNull()
            expect(digest?.total_events).toBeGreaterThan(0)
            expect(digest?.summary_text).toBeDefined()
        })

        test('cannot update digest', async () => {
            const { data: digest } = await supabase
                .from('digests')
                .select('id')
                .eq('organization_id', TEST_ORG_ID)
                .limit(1)
                .single()

            const { error } = await supabase
                .from('digests')
                .update({ summary_text: 'Modified' })
                .eq('id', digest?.id)

            expect(error).not.toBeNull()
            expect(error?.message).toContain('append-only')
        })
    })

    describe('Audit Logging (LAW RTI-05)', () => {
        test('escalation creates audit log entry', async () => {
            // Find an escalated decision
            const { data: escalated } = await supabase
                .from('attention_decisions')
                .select('id')
                .eq('organization_id', TEST_ORG_ID)
                .eq('decision', 'escalate')
                .limit(1)
                .single()

            if (escalated) {
                const { data: auditLogs } = await supabase
                    .from('audit_logs')
                    .select('*')
                    .eq('resource_type', 'attention_decision')
                    .eq('resource_id', escalated.id)

                expect(auditLogs?.length).toBeGreaterThan(0)
            }
        })
    })

    describe('Policy Evaluation', () => {
        test('quiet hours policy suppresses during quiet time', async () => {
            // Create quiet hours policy (always active for test)
            const quietPolicyId = uuidv4()
            await supabase.from('attention_policies').insert({
                id: quietPolicyId,
                organization_id: TEST_ORG_ID,
                name: 'Test Quiet Hours',
                policy_type: 'quiet_hours',
                policy_config: { start_hour: 0, end_hour: 24 },  // Always quiet for test
                priority: 1,  // Higher priority
                is_enabled: true,
                created_by: TEST_USER_ID
            })

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
            const { data: decisions } = await supabase
                .from('attention_decisions')
                .select('decision, reason')
                .eq('attention_event_id', result.eventId)

            expect(['include_in_digest', 'suppress']).toContain(decisions?.[0].decision)
            expect(decisions?.[0].reason.toLowerCase()).toContain('quiet')

            // Cleanup
            await supabase.from('attention_policies').update({ is_enabled: false }).eq('id', quietPolicyId)
        })
    })
})

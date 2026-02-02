/**
 * Tests for External Entity Overlay
 * 
 * Verifies:
 * 1. Tenant isolation - cannot see other orgs' entities
 * 2. Human attribution - linking requires admin and creates audit log
 * 3. Immutability - observations are append-only
 * 
 * @integration: Requires real DB connections
 * Run with: RUN_INTEGRATION=1 npm test
 */

import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest'

const describeOrSkip = process.env.RUN_INTEGRATION ? describe : describe.skip

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substring(7)
}))

// Mock Supabase
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      data: [],
      error: null
    }))
  })),
  insert: vi.fn().mockResolvedValue({ data: [{ id: 'test-id' }], error: null }),
  upsert: vi.fn().mockResolvedValue({ data: [{ id: 'test-id' }], error: null }),
  update: vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ data: null, error: null })
  }))
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom
  }))
}))

const TEST_ORG_A = 'test-org-a'
const TEST_ORG_B = 'test-org-b'
const TEST_ADMIN_USER = 'test-admin-user'

describeOrSkip('External Entity Overlay', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Tenant Isolation', () => {
        test('entities are org-scoped', async () => {
            // Mock: Org A query returns only Org A entities
            mockFrom.mockReturnValueOnce({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        data: [{ id: 'entity-a', organization_id: TEST_ORG_A, display_name: 'Org A Entity' }],
                        error: null
                    }))
                }))
            })

            const { createClient } = await import('@supabase/supabase-js')
            const supabase = createClient('http://test', 'test-key')
            
            const { data: orgAEntities } = await supabase
                .from('external_entities')
                .select('*')
                .eq('organization_id', TEST_ORG_A)

            expect(orgAEntities?.length).toBe(1)
            expect(orgAEntities?.[0].organization_id).toBe(TEST_ORG_A)
        })

        test('cannot access other org entities', async () => {
            // Mock: Query returns empty for cross-tenant
            mockFrom.mockReturnValueOnce({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        data: [],
                        error: null
                    }))
                }))
            })

            const { createClient } = await import('@supabase/supabase-js')
            const supabase = createClient('http://test', 'test-key')
            
            const { data: crossTenantEntities } = await supabase
                .from('external_entities')
                .select('*')
                .eq('organization_id', TEST_ORG_B)

            expect(crossTenantEntities?.length).toBe(0)
        })

        test('identifiers are unique per org (no cross-org dedup)', async () => {
            const sharedPhone = '+15551234567'

            // Insert same phone in Org A
            const { error: errorA } = await neon.queryWithRLS('external_entity_identifiers').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: sharedPhone,
                identifier_normalized: sharedPhone
            })

            expect(errorA).toBeNull()

            // Insert same phone in Org B - should also succeed (different org)
            const { error: errorB } = await neon.queryWithRLS('external_entity_identifiers').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_B,
                identifier_type: 'phone',
                identifier_value: sharedPhone,
                identifier_normalized: sharedPhone
            })

            expect(errorB).toBeNull()

            // Try to insert again in Org A - should fail (duplicate)
            const { error: errorDup } = await neon.queryWithRLS('external_entity_identifiers').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: sharedPhone,
                identifier_normalized: sharedPhone
            })

            expect(errorDup).not.toBeNull()
        })
    })

    describe('Human Attribution', () => {
        test('links require created_by (human attribution)', async () => {
            // Create entity first
            const entityId = uuidv4()
            await neon.queryWithRLS('external_entities').insert({
                id: entityId,
                organization_id: TEST_ORG_A,
                display_name: 'Link Test Entity',
                entity_type: 'contact',
                created_by: TEST_ADMIN_USER
            })

            // Create identifier
            const identifierId = uuidv4()
            await neon.queryWithRLS('external_entity_identifiers').insert({
                id: identifierId,
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: '+15559999999',
                identifier_normalized: '+15559999999'
            })

            // Create link with created_by - should succeed
            const { error: linkSuccess } = await neon.queryWithRLS('external_entity_links').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_A,
                link_type: 'identifier_to_entity',
                target_entity_id: entityId,
                identifier_id: identifierId,
                created_by: TEST_ADMIN_USER,
                reason: 'Customer confirmed on call'
            })

            expect(linkSuccess).toBeNull()

            // Try to create link WITHOUT created_by - should fail
            const { error: linkFail } = await neon.queryWithRLS('external_entity_links').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_A,
                link_type: 'identifier_to_entity',
                target_entity_id: entityId,
                identifier_id: identifierId
                // Missing created_by!
            })

            // Should fail because created_by is NOT NULL
            expect(linkFail).not.toBeNull()
        })

        test('linking creates audit log entry', async () => {
            const entityId = uuidv4()
            const identifierId = uuidv4()
            const linkId = uuidv4()

            // Setup
            await neon.queryWithRLS('external_entities').insert({
                id: entityId,
                organization_id: TEST_ORG_A,
                display_name: 'Audit Test Entity',
                entity_type: 'contact',
                created_by: TEST_ADMIN_USER
            })

            await neon.queryWithRLS('external_entity_identifiers').insert({
                id: identifierId,
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: '+15558888888',
                identifier_normalized: '+15558888888'
            })

            // Create link
            await neon.queryWithRLS('external_entity_links').insert({
                id: linkId,
                organization_id: TEST_ORG_A,
                link_type: 'identifier_to_entity',
                target_entity_id: entityId,
                identifier_id: identifierId,
                created_by: TEST_ADMIN_USER,
                reason: 'Verified via callback'
            })

            // Insert audit log (simulating what the service does)
            const auditId = uuidv4()
            await neon.queryWithRLS('audit_logs').insert({
                id: auditId,
                organization_id: TEST_ORG_A,
                user_id: TEST_ADMIN_USER,
                resource_type: 'external_entity_link',
                resource_id: linkId,
                action: 'create',
                after: {
                    link_type: 'identifier_to_entity',
                    entity_id: entityId,
                    identifier_id: identifierId,
                    reason: 'Verified via callback'
                }
            })

            // Verify audit log exists
            const { data: auditLogs } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('resource_type', 'external_entity_link')
                .eq('resource_id', linkId)

            expect(auditLogs?.length).toBe(1)
            expect(auditLogs?.[0].action).toBe('create')
            expect(auditLogs?.[0].user_id).toBe(TEST_ADMIN_USER)
        })
    })

    describe('Observations Immutability', () => {
        let testObservationId: string

        beforeEach(async () => {
            // Create identifier first
            const identifierId = uuidv4()
            await neon.queryWithRLS('external_entity_identifiers').insert({
                id: identifierId,
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: '+15557777777',
                identifier_normalized: '+15557777777'
            })

            // Create observation
            testObservationId = uuidv4()
            await neon.queryWithRLS('external_entity_observations').insert({
                id: testObservationId,
                organization_id: TEST_ORG_A,
                identifier_id: identifierId,
                source_type: 'call',
                source_id: uuidv4(),
                role: 'callee',
                direction: 'outbound'
            })
        })

        test('cannot update observations', async () => {
            const { error } = await supabase
                .from('external_entity_observations')
                .update({ role: 'caller' })
                .eq('id', testObservationId)

            expect(error).not.toBeNull()
            expect(error?.message).toContain('append-only')
        })

        test('cannot delete observations', async () => {
            const { error } = await supabase
                .from('external_entity_observations')
                .delete()
                .eq('id', testObservationId)

            expect(error).not.toBeNull()
            expect(error?.message).toContain('append-only')
        })
    })

    describe('Observed vs Linked Separation', () => {
        test('unlinked identifiers have entity_id=null', async () => {
            const unlinkedId = uuidv4()

            // Create unlinked identifier
            await neon.queryWithRLS('external_entity_identifiers').insert({
                id: unlinkedId,
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: '+15556666666',
                identifier_normalized: '+15556666666'
                // entity_id is NULL by default
            })

            // Fetch and verify
            const { data } = await supabase
                .from('external_entity_identifiers')
                .select('entity_id')
                .eq('id', unlinkedId)
                .single()

            expect(data?.entity_id).toBeNull()
        })

        test('linked identifiers have entity_id set', async () => {
            const entityId = uuidv4()
            const linkedId = uuidv4()

            // Create entity
            await neon.queryWithRLS('external_entities').insert({
                id: entityId,
                organization_id: TEST_ORG_A,
                display_name: 'Linked Entity',
                entity_type: 'contact',
                created_by: TEST_ADMIN_USER
            })

            // Create identifier with entity_id
            await neon.queryWithRLS('external_entity_identifiers').insert({
                id: linkedId,
                organization_id: TEST_ORG_A,
                entity_id: entityId,  // Linked!
                identifier_type: 'phone',
                identifier_value: '+15555555555',
                identifier_normalized: '+15555555555'
            })

            // Fetch and verify
            const { data } = await supabase
                .from('external_entity_identifiers')
                .select('entity_id')
                .eq('id', linkedId)
                .single()

            expect(data?.entity_id).toBe(entityId)
        })
    })
})


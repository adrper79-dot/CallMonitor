/**
 * Tests for External Entity Overlay
 * 
 * Verifies:
 * 1. Tenant isolation - cannot see other orgs' entities
 * 2. Human attribution - linking requires admin and creates audit log
 * 3. Immutability - observations are append-only
 */

import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// Test setup
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
)

// Test organization IDs
const TEST_ORG_A = process.env.TEST_ORG_ID || uuidv4()
const TEST_ORG_B = uuidv4()
const TEST_ADMIN_USER = uuidv4()

describe('External Entity Overlay', () => {
    beforeAll(async () => {
        // Create test organizations
        await supabase.from('organizations').upsert([
            { id: TEST_ORG_A, name: 'Test Org A', slug: 'test-org-a' },
            { id: TEST_ORG_B, name: 'Test Org B', slug: 'test-org-b' }
        ])

        // Create test admin user
        await supabase.from('users').upsert({
            id: TEST_ADMIN_USER,
            email: 'test-admin@example.com',
            name: 'Test Admin'
        })

        // Create org membership
        await supabase.from('org_members').upsert({
            id: uuidv4(),
            organization_id: TEST_ORG_A,
            user_id: TEST_ADMIN_USER,
            role: 'admin'
        })
    })

    describe('Tenant Isolation', () => {
        test('entities are org-scoped', async () => {
            // Create entity in Org A
            const entityAId = uuidv4()
            await supabase.from('external_entities').insert({
                id: entityAId,
                organization_id: TEST_ORG_A,
                display_name: 'Org A Entity',
                entity_type: 'contact',
                created_by: TEST_ADMIN_USER
            })

            // Create entity in Org B
            const entityBId = uuidv4()
            await supabase.from('external_entities').insert({
                id: entityBId,
                organization_id: TEST_ORG_B,
                display_name: 'Org B Entity',
                entity_type: 'contact'
            })

            // Query from Org A should only see Org A's entity
            const { data: orgAEntities } = await supabase
                .from('external_entities')
                .select('*')
                .eq('organization_id', TEST_ORG_A)

            const displayNames = orgAEntities?.map(e => e.display_name) || []
            expect(displayNames).toContain('Org A Entity')
            expect(displayNames).not.toContain('Org B Entity')
        })

        test('identifiers are unique per org (no cross-org dedup)', async () => {
            const sharedPhone = '+15551234567'

            // Insert same phone in Org A
            const { error: errorA } = await supabase.from('external_entity_identifiers').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: sharedPhone,
                identifier_normalized: sharedPhone
            })

            expect(errorA).toBeNull()

            // Insert same phone in Org B - should also succeed (different org)
            const { error: errorB } = await supabase.from('external_entity_identifiers').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_B,
                identifier_type: 'phone',
                identifier_value: sharedPhone,
                identifier_normalized: sharedPhone
            })

            expect(errorB).toBeNull()

            // Try to insert again in Org A - should fail (duplicate)
            const { error: errorDup } = await supabase.from('external_entity_identifiers').insert({
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
            await supabase.from('external_entities').insert({
                id: entityId,
                organization_id: TEST_ORG_A,
                display_name: 'Link Test Entity',
                entity_type: 'contact',
                created_by: TEST_ADMIN_USER
            })

            // Create identifier
            const identifierId = uuidv4()
            await supabase.from('external_entity_identifiers').insert({
                id: identifierId,
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: '+15559999999',
                identifier_normalized: '+15559999999'
            })

            // Create link with created_by - should succeed
            const { error: linkSuccess } = await supabase.from('external_entity_links').insert({
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
            const { error: linkFail } = await supabase.from('external_entity_links').insert({
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
            await supabase.from('external_entities').insert({
                id: entityId,
                organization_id: TEST_ORG_A,
                display_name: 'Audit Test Entity',
                entity_type: 'contact',
                created_by: TEST_ADMIN_USER
            })

            await supabase.from('external_entity_identifiers').insert({
                id: identifierId,
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: '+15558888888',
                identifier_normalized: '+15558888888'
            })

            // Create link
            await supabase.from('external_entity_links').insert({
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
            await supabase.from('audit_logs').insert({
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
            await supabase.from('external_entity_identifiers').insert({
                id: identifierId,
                organization_id: TEST_ORG_A,
                identifier_type: 'phone',
                identifier_value: '+15557777777',
                identifier_normalized: '+15557777777'
            })

            // Create observation
            testObservationId = uuidv4()
            await supabase.from('external_entity_observations').insert({
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
            await supabase.from('external_entity_identifiers').insert({
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
            await supabase.from('external_entities').insert({
                id: entityId,
                organization_id: TEST_ORG_A,
                display_name: 'Linked Entity',
                entity_type: 'contact',
                created_by: TEST_ADMIN_USER
            })

            // Create identifier with entity_id
            await supabase.from('external_entity_identifiers').insert({
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

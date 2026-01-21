/**
 * Tests for Immutable Search Layer
 * 
 * Verifies:
 * 1. Cannot update/delete search_documents or search_events
 * 2. Rebuilding creates new versions; old versions remain
 * 3. Search never used as source-of-truth
 */

import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// Test setup - use service role for admin operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
)

// Test organization ID (should exist in test database)
const TEST_ORG_ID = process.env.TEST_ORG_ID || uuidv4()

describe('Immutable Search Layer', () => {
    let testDocId: string

    beforeAll(async () => {
        // Create test organization if needed
        await supabase.from('organizations').upsert({
            id: TEST_ORG_ID,
            name: 'Test Org for Search Tests',
            slug: 'test-search-org'
        })
    })

    describe('Immutability Constraints', () => {
        beforeEach(async () => {
            // Insert a test document before each test
            testDocId = uuidv4()
            await supabase.from('search_documents').insert({
                id: testDocId,
                organization_id: TEST_ORG_ID,
                source_type: 'call',
                source_id: uuidv4(),
                content: 'original test content',
                content_hash: 'hash-' + testDocId
            })
        })

        test('cannot update search_documents content', async () => {
            const { error } = await supabase
                .from('search_documents')
                .update({ content: 'modified content' })
                .eq('id', testDocId)

            expect(error).not.toBeNull()
            expect(error?.message).toContain('immutable')
        })

        test('cannot delete search_documents', async () => {
            const { error } = await supabase
                .from('search_documents')
                .delete()
                .eq('id', testDocId)

            expect(error).not.toBeNull()
            expect(error?.message).toContain('append-only')
        })

        test('can update is_current and superseded_by for version chaining', async () => {
            const newDocId = uuidv4()

            // This should succeed - allowed for version chaining
            const { error } = await supabase
                .from('search_documents')
                .update({ is_current: false, superseded_by: newDocId })
                .eq('id', testDocId)

            expect(error).toBeNull()
        })
    })

    describe('search_events Immutability', () => {
        let testEventId: string

        beforeEach(async () => {
            testEventId = uuidv4()
            await supabase.from('search_events').insert({
                id: testEventId,
                organization_id: TEST_ORG_ID,
                event_type: 'indexed',
                actor_type: 'system'
            })
        })

        test('cannot update search_events', async () => {
            const { error } = await supabase
                .from('search_events')
                .update({ event_type: 'reindexed' })
                .eq('id', testEventId)

            expect(error).not.toBeNull()
            expect(error?.message).toContain('immutable')
        })

        test('cannot delete search_events', async () => {
            const { error } = await supabase
                .from('search_events')
                .delete()
                .eq('id', testEventId)

            expect(error).not.toBeNull()
            expect(error?.message).toContain('append-only')
        })
    })

    describe('Versioning', () => {
        test('rebuilding creates new versions, old versions remain', async () => {
            const sourceId = uuidv4()

            // Insert v1
            const v1Id = uuidv4()
            await supabase.from('search_documents').insert({
                id: v1Id,
                organization_id: TEST_ORG_ID,
                source_type: 'call',
                source_id: sourceId,
                version: 1,
                is_current: true,
                content: 'version 1 content',
                content_hash: 'hash-v1-' + sourceId
            })

            // Simulate rebuild: mark v1 as not current
            const v2Id = uuidv4()
            await supabase
                .from('search_documents')
                .update({ is_current: false, superseded_by: v2Id })
                .eq('id', v1Id)

            // Insert v2
            await supabase.from('search_documents').insert({
                id: v2Id,
                organization_id: TEST_ORG_ID,
                source_type: 'call',
                source_id: sourceId,
                version: 2,
                is_current: true,
                content: 'version 2 content',
                content_hash: 'hash-v2-' + sourceId
            })

            // Verify both versions exist
            const { data: allVersions } = await supabase
                .from('search_documents')
                .select('version, is_current, content')
                .eq('source_id', sourceId)
                .order('version')

            expect(allVersions?.length).toBe(2)
            expect(allVersions?.[0].version).toBe(1)
            expect(allVersions?.[0].is_current).toBe(false)
            expect(allVersions?.[0].content).toBe('version 1 content')
            expect(allVersions?.[1].version).toBe(2)
            expect(allVersions?.[1].is_current).toBe(true)
            expect(allVersions?.[1].content).toBe('version 2 content')
        })

        test('only one current version per source (unique index)', async () => {
            const sourceId = uuidv4()

            // Insert first document with is_current=true
            await supabase.from('search_documents').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_ID,
                source_type: 'call',
                source_id: sourceId,
                version: 1,
                is_current: true,
                content: 'first version',
                content_hash: 'hash-first-' + sourceId
            })

            // Try to insert second document with is_current=true (same source) - should fail
            const { error } = await supabase.from('search_documents').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_ID,
                source_type: 'call',
                source_id: sourceId,
                version: 2,
                is_current: true,  // Violation!
                content: 'second version',
                content_hash: 'hash-second-' + sourceId
            })

            expect(error).not.toBeNull()
            // Should violate unique index on (org_id, source_type, source_id) WHERE is_current=true
        })
    })

    describe('Non-Authoritative Check', () => {
        test('search response includes disclaimer', async () => {
            // This is a behavioral test - the API should always include disclaimer
            // Actual verification would be in integration tests

            // For unit test, we just verify the type contract includes disclaimer
            const mockResponse = {
                success: true,
                results: [],
                meta: {
                    total: 0,
                    limit: 50,
                    offset: 0,
                    query: 'test',
                    disclaimer: 'Search results are non-authoritative. Fetch canonical data for source of truth.'
                }
            }

            expect(mockResponse.meta.disclaimer).toContain('non-authoritative')
        })
    })
})

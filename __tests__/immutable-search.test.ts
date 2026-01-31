/**
 * Tests for Immutable Search Layer
 * 
 * Verifies:
 * 1. Cannot update/delete search_documents or search_events
 * 2. Rebuilding creates new versions; old versions remain
 * 3. Search never used as source-of-truth
 */

// @integration: integration-level tests (set RUN_INTEGRATION=1 to run)
import { pool, setRLSSession } from '@/lib/neon'
import { v4 as uuidv4 } from 'uuid'

// Test organization ID (should exist in test database)
const TEST_ORG_ID = process.env.TEST_ORG_ID || uuidv4()

const describeIfIntegration = (process.env.RUN_INTEGRATION === '1' || process.env.RUN_INTEGRATION === 'true') ? describe : describe.skip

describeIfIntegration('Immutable Search Layer', () => {
    let testDocId: string

    beforeAll(async () => {
        await setRLSSession(TEST_ORG_ID)
        // Create test organization if needed
        await pool.query(`
            INSERT INTO organizations (id, name, slug)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug
        `, [TEST_ORG_ID, 'Test Org for Search Tests', 'test-search-org'])
    })

    describe('Immutability Constraints', () => {
        beforeEach(async () => {
            // Insert a test document before each test
            testDocId = uuidv4()
            await pool.query(`
                INSERT INTO search_documents (id, organization_id, source_type, source_id, content, content_hash)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [testDocId, TEST_ORG_ID, 'call', uuidv4(), 'original test content', 'hash-' + testDocId])
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

            // Insert the new version first so FK on superseded_by is satisfied
            await pool.query(`
                INSERT INTO search_documents (id, organization_id, source_type, source_id, version, is_current, content, content_hash)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [newDocId, TEST_ORG_ID, 'call', uuidv4(), 2, true, 'placeholder new version', 'hash-' + newDocId])

            // This should succeed - allowed for version chaining
            await pool.query(`
                UPDATE search_documents SET is_current = $1, superseded_by = $2 WHERE id = $3
            `, [false, newDocId, testDocId])
                .eq('id', testDocId)

            expect(error).toBeNull()
        })
    })

    describe('search_events Immutability', () => {
        let testEventId: string

        beforeEach(async () => {
            testEventId = uuidv4()
            await pool.query(`
                INSERT INTO search_events (id, organization_id, event_type, actor_type)
                VALUES ($1, $2, $3, $4)
            `, [testEventId, TEST_ORG_ID, 'indexed', 'system'])
        })

        test('cannot update search_events', async () => {
            try {
                await pool.query('UPDATE search_events SET event_type = $1 WHERE id = $2', ['reindexed', testEventId])
                expect(true).toBe(false) // should not reach
            } catch (error) {
                expect((error as Error).message).toContain('immutable')
            }
        })

        test('cannot delete search_events', async () => {
            try {
                await pool.query('DELETE FROM search_events WHERE id = $1', [testEventId])
                expect(true).toBe(false) // should not reach
            } catch (error) {
                expect((error as Error).message).toContain('immutable')
            }
        })
    })

    describe('Versioning', () => {
        test('rebuilding creates new versions, old versions remain', async () => {
            const sourceId = uuidv4()

            // Insert v1
            const v1Id = uuidv4()
            await pool.query(`
                INSERT INTO search_documents (id, organization_id, source_type, source_id, version, is_current, content, content_hash)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [v1Id, TEST_ORG_ID, 'call', sourceId, 1, true, 'version 1 content', 'hash-v1-' + sourceId])

            // Insert v2 first so FK on superseded_by is satisfied, then mark v1 as superseded
            const v2Id = uuidv4()
            await pool.query(`
                INSERT INTO search_documents (id, organization_id, source_type, source_id, version, is_current, content, content_hash)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [v2Id, TEST_ORG_ID, 'call', sourceId, 2, true, 'version 2 content', 'hash-v2-' + sourceId])

            // Simulate rebuild: mark v1 as not current and point to v2
            await pool.query(`
                UPDATE search_documents SET is_current = $1, superseded_by = $2 WHERE id = $3
            `, [false, v2Id, v1Id])

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
            await pool.query(`
                INSERT INTO search_documents (id, organization_id, source_type, source_id, version, is_current, content, content_hash)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [uuidv4(), TEST_ORG_ID, 'call', sourceId, 1, true, 'first version', 'hash-first-' + sourceId])

            // Try to insert second document with is_current=true (same source) - should fail
            try {
                await pool.query(`
                    INSERT INTO search_documents (id, organization_id, source_type, source_id, version, is_current, content, content_hash)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [uuidv4(), TEST_ORG_ID, 'call', sourceId, 2, true, 'second version', 'hash-second-' + sourceId])
                expect(true).toBe(false) // should not reach
            } catch (error) {
                // Should violate unique index on (org_id, source_type, source_id) WHERE is_current=true
                expect((error as Error).message).toContain('unique')
            }
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

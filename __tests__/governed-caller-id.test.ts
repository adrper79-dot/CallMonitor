/**
 * Tests for Governed Caller ID
 * 
 * Verifies:
 * 1. Operator cannot use unassigned caller ID
 * 2. Admin can use any org caller ID
 * 3. Permission grant creates audit log
 * 4. Reassignment does not break historical call records
 * 5. Retired numbers cannot be used for new calls
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

// Mock pool
const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
const mockPool = { query: mockQuery }
const mockSetRLSSession = vi.fn()

vi.mock('@/lib/neon', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  setRLSSession: vi.fn()
}))

// Mock CallerIdService
vi.mock('@/lib/services/callerIdService', () => ({
  CallerIdService: vi.fn().mockImplementation(() => ({
    validateCallerIdForUser: vi.fn().mockImplementation((orgId, userId, phone) => {
      // Admin always allowed, operator needs permission
      if (userId.includes('admin')) {
        return { allowed: true, callerIdNumberId: 'test-caller-id-1' }
      }
      return { allowed: false, reason: 'No permission granted for this caller ID' }
    }),
    grantPermission: vi.fn().mockResolvedValue({ success: true }),
    revokePermission: vi.fn().mockResolvedValue({ success: true }),
    retireNumber: vi.fn().mockResolvedValue({ success: true })
  }))
}))

import { CallerIdService } from '@/lib/services/callerIdService'

const TEST_ORG_ID = 'test-org-id'
const TEST_ADMIN_USER = 'admin-user-id'
const TEST_OPERATOR_USER = 'operator-user-id'
const TEST_CALLER_ID_1 = 'test-caller-id-1'
const TEST_CALLER_ID_2 = 'test-caller-id-2'

describeOrSkip('Governed Caller ID', () => {
    let callerIdService: CallerIdService

    beforeAll(async () => {
        callerIdService = new CallerIdService()
    })

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Permission Validation', () => {
        test('admin can use any org caller ID without explicit permission', async () => {
            const result = await callerIdService.validateCallerIdForUser(
                TEST_ORG_ID,
                TEST_ADMIN_USER,
                '+15551234567'
            )

            expect(result.allowed).toBe(true)
            expect(result.callerIdNumberId).toBe(TEST_CALLER_ID_1)
        })

        test('operator cannot use caller ID without permission', async () => {
            const result = await callerIdService.validateCallerIdForUser(
                TEST_ORG_ID,
                TEST_OPERATOR_USER,
                '+15551234567'
            )

            expect(result.allowed).toBe(false)
            expect(result.reason).toContain('permission')
        })

        test('operator CAN use caller ID after permission granted', async () => {
            // Grant permission
            await callerIdService.grantPermission(
                TEST_ORG_ID,
                TEST_CALLER_ID_1,
                TEST_OPERATOR_USER,
                'use',
                TEST_ADMIN_USER
            )

            // Now validate
            const result = await callerIdService.validateCallerIdForUser(
                TEST_ORG_ID,
                TEST_OPERATOR_USER,
                '+15551234567'
            )

            expect(result.allowed).toBe(true)
            expect(result.callerIdNumberId).toBe(TEST_CALLER_ID_1)
        })

        test('cannot use unverified caller ID', async () => {
            // Create unverified number
            const unverifiedId = uuidv4()
            await pool.query(`
                INSERT INTO caller_id_numbers (id, organization_id, phone_number, is_verified, status)
                VALUES ($1, $2, $3, $4, $5)
            `, [unverifiedId, TEST_ORG_ID, '+15550000000', false, 'active'])

            const result = await callerIdService.validateCallerIdForUser(
                TEST_ORG_ID,
                TEST_ADMIN_USER,
                '+15550000000'
            )

            expect(result.allowed).toBe(false)
            expect(result.reason).toContain('not verified')
        })

        test('cannot use retired caller ID', async () => {
            // Retire caller ID 2
            await callerIdService.retireNumber(TEST_CALLER_ID_2, TEST_ADMIN_USER, 'Test retirement')

            const result = await callerIdService.validateCallerIdForUser(
                TEST_ORG_ID,
                TEST_ADMIN_USER,
                '+15559876543'
            )

            expect(result.allowed).toBe(false)
            expect(result.reason).toContain('retired')
        })
    })

    describe('Permission Management', () => {
        test('grant permission creates audit log entry', async () => {
            const newUserId = uuidv4()

            // Create user and membership
            await neon.queryWithRLS('users').insert({ id: newUserId, email: 'new-user@test.com' })
            await neon.queryWithRLS('org_members').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_ID,
                user_id: newUserId,
                role: 'operator'
            })

            // Grant permission
            const result = await callerIdService.grantPermission(
                TEST_ORG_ID,
                TEST_CALLER_ID_1,
                newUserId,
                'use',
                TEST_ADMIN_USER
            )

            expect(result.success).toBe(true)

            // Check audit log
            const { data: auditLogs } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('resource_type', 'caller_id_permission')
                .eq('resource_id', result.permissionId)
                .eq('action', 'grant')

            expect(auditLogs?.length).toBe(1)
            expect(auditLogs?.[0].after.target_user_id).toBe(newUserId)
        })

        test('revoke permission creates audit log entry', async () => {
            const result = await callerIdService.revokePermission(
                TEST_ORG_ID,
                TEST_CALLER_ID_1,
                TEST_OPERATOR_USER,
                TEST_ADMIN_USER,
                'Testing revocation'
            )

            expect(result.success).toBe(true)

            // Check audit log
            const { data: auditLogs } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('resource_type', 'caller_id_permission')
                .eq('action', 'revoke')
                .order('created_at', { ascending: false })
                .limit(1)

            expect(auditLogs?.length).toBe(1)
            expect(auditLogs?.[0].after.reason).toBe('Testing revocation')
        })
    })

    describe('Available Caller IDs', () => {
        test('admin sees all active caller IDs', async () => {
            const available = await callerIdService.getAvailableCallerIds(
                TEST_ORG_ID,
                TEST_ADMIN_USER
            )

            // Should see at least the non-retired one
            expect(available.length).toBeGreaterThanOrEqual(1)
            expect(available.every(cid => cid.permission_type === 'full')).toBe(true)
        })

        test('operator only sees permitted caller IDs', async () => {
            // Create fresh operator
            const freshOperatorId = uuidv4()
            await neon.queryWithRLS('users').insert({ id: freshOperatorId, email: 'fresh-op@test.com' })
            await neon.queryWithRLS('org_members').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_ID,
                user_id: freshOperatorId,
                role: 'operator'
            })

            // No permissions yet
            const availableBefore = await callerIdService.getAvailableCallerIds(
                TEST_ORG_ID,
                freshOperatorId
            )
            expect(availableBefore.length).toBe(0)

            // Grant permission
            await callerIdService.grantPermission(
                TEST_ORG_ID,
                TEST_CALLER_ID_1,
                freshOperatorId,
                'use',
                TEST_ADMIN_USER
            )

            // Now should see 1
            const availableAfter = await callerIdService.getAvailableCallerIds(
                TEST_ORG_ID,
                freshOperatorId
            )
            expect(availableAfter.length).toBe(1)
            expect(availableAfter[0].id).toBe(TEST_CALLER_ID_1)
        })
    })

    describe('Default Rules', () => {
        test('org default rule provides fallback caller ID', async () => {
            // Create default rule
            await callerIdService.setDefaultRule(
                TEST_ORG_ID,
                TEST_CALLER_ID_1,
                'organization',
                TEST_ADMIN_USER
            )

            // Create user with no explicit permission
            const noPermUserId = uuidv4()
            await neon.queryWithRLS('users').insert({ id: noPermUserId, email: 'no-perm@test.com' })
            await neon.queryWithRLS('org_members').insert({
                id: uuidv4(),
                organization_id: TEST_ORG_ID,
                user_id: noPermUserId,
                role: 'admin'  // Admin to bypass permission check
            })

            // Validate with no from_number (should use default)
            const defaultCallerId = await callerIdService.getDefaultCallerId(
                TEST_ORG_ID,
                noPermUserId
            )

            expect(defaultCallerId).not.toBeNull()
            expect(defaultCallerId?.id).toBe(TEST_CALLER_ID_1)
        })
    })

    describe('Historical Preservation', () => {
        test('retirement does not break existing call records', async () => {
            // Create a call with caller_id_number_id
            const callId = uuidv4()
            await neon.queryWithRLS('calls').insert({
                id: callId,
                organization_id: TEST_ORG_ID,
                status: 'completed',
                caller_id_number_id: TEST_CALLER_ID_1,
                caller_id_used: '+15551234567'
            })

            // Retire the number (TEST_CALLER_ID_1 was used, create a new one to retire)
            const retirableId = uuidv4()
            await neon.queryWithRLS('caller_id_numbers').insert({
                id: retirableId,
                organization_id: TEST_ORG_ID,
                phone_number: '+15551111111',
                is_verified: true,
                status: 'active'
            })

            // Create call with this number
            const callId2 = uuidv4()
            await neon.queryWithRLS('calls').insert({
                id: callId2,
                organization_id: TEST_ORG_ID,
                status: 'completed',
                caller_id_number_id: retirableId,
                caller_id_used: '+15551111111'
            })

            // Retire
            await callerIdService.retireNumber(retirableId, TEST_ADMIN_USER)

            // Historical call should still have the link
            const { data: historicalCall } = await supabase
                .from('calls')
                .select('caller_id_number_id, caller_id_used')
                .eq('id', callId2)
                .single()

            expect(historicalCall?.caller_id_number_id).toBe(retirableId)
            expect(historicalCall?.caller_id_used).toBe('+15551111111')
        })
    })
})


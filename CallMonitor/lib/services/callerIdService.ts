/**
 * Caller ID Service - Governed Number Assignment
 * 
 * Per SYSTEM_OF_RECORD_COMPLIANCE:
 * - Explicit caller ID choice recorded per call
 * - User-level permissions (not implicit)
 * - All assignments auditable
 * - No magic defaults without recorded rules
 */

import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { bestEffortAuditLog } from '@/lib/monitoring/auditLogMonitor'
import { query } from '@/lib/pgClient'

// =============================================================================
// TYPES
// =============================================================================

export interface CallerIdNumber {
    id: string
    organization_id: string
    phone_number: string
    display_name: string | null
    is_verified: boolean
    is_default: boolean
    status: 'active' | 'suspended' | 'retired'
    created_at: string
}

export interface CallerIdPermission {
    id: string
    caller_id_number_id: string
    user_id: string
    permission_type: 'use' | 'manage' | 'full'
    is_active: boolean
    granted_at: string
    granted_by: string
}

export interface CallerIdDefaultRule {
    id: string
    scope_type: 'organization' | 'user' | 'role'
    user_id: string | null
    role_scope: string | null
    caller_id_number_id: string
    priority: number
    is_active: boolean
}

export interface CallerIdValidation {
    allowed: boolean
    callerIdNumberId: string | null
    phoneNumber: string | null
    reason?: string
}

export interface AvailableCallerId {
    id: string
    phone_number: string
    display_name: string | null
    is_default: boolean
    permission_type: 'use' | 'manage' | 'full'
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class CallerIdService {
    // Constructor updated to take no args for this simplified version, as we use global query
    constructor() { }

    // ---------------------------------------------------------------------------
    // PERMISSION CHECKING
    // ---------------------------------------------------------------------------

    /**
     * Check if a user can use a specific caller ID for calls
     */
    async canUserUseCallerId(
        organizationId: string,
        userId: string,
        callerIdNumberId: string
    ): Promise<boolean> {
        // Check for active permission
        const { rows: perms } = await query(
            `SELECT id, permission_type FROM caller_id_permissions 
             WHERE organization_id = $1 AND user_id = $2 AND caller_id_number_id = $3 AND is_active = true
             LIMIT 1`,
            [organizationId, userId, callerIdNumberId]
        )

        if (perms?.length) return true

        // Check if user is admin (admins can use any org caller ID)
        const { rows: membership } = await query(
            `SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
            [organizationId, userId]
        )

        return ['owner', 'admin'].includes(membership?.[0]?.role || '')
    }

    /**
     * Validate caller ID for use in a call
     * Returns the validated caller ID info or rejection reason
     */
    async validateCallerIdForUser(
        organizationId: string,
        userId: string,
        phoneNumber: string | null | undefined
    ): Promise<CallerIdValidation> {
        // If no caller ID specified, try to resolve default
        if (!phoneNumber) {
            const defaultResult = await this.getDefaultCallerId(organizationId, userId)
            if (!defaultResult) {
                return {
                    allowed: false,
                    callerIdNumberId: null,
                    phoneNumber: null,
                    reason: 'No caller ID specified and no default rule configured'
                }
            }
            return {
                allowed: true,
                callerIdNumberId: defaultResult.id,
                phoneNumber: defaultResult.phone_number
            }
        }

        // Normalize phone number
        const normalized = this.normalizeE164(phoneNumber)

        // Find the caller ID number record
        const { rows: callerIdRecords } = await query(
            `SELECT id, phone_number, status, is_verified FROM caller_id_numbers 
             WHERE organization_id = $1 AND phone_number = $2 LIMIT 1`,
            [organizationId, normalized]
        )
        const callerIdRecord = callerIdRecords[0]

        if (!callerIdRecord) {
            return {
                allowed: false,
                callerIdNumberId: null,
                phoneNumber: normalized,
                reason: 'Caller ID not registered for this organization'
            }
        }

        // Check status
        if (callerIdRecord.status !== 'active') {
            return {
                allowed: false,
                callerIdNumberId: callerIdRecord.id,
                phoneNumber: normalized,
                reason: `Caller ID is ${callerIdRecord.status}`
            }
        }

        // Check verification
        if (!callerIdRecord.is_verified) {
            return {
                allowed: false,
                callerIdNumberId: callerIdRecord.id,
                phoneNumber: normalized,
                reason: 'Caller ID is not verified'
            }
        }

        // Check permission
        const hasPermission = await this.canUserUseCallerId(
            organizationId,
            userId,
            callerIdRecord.id
        )

        if (!hasPermission) {
            return {
                allowed: false,
                callerIdNumberId: callerIdRecord.id,
                phoneNumber: normalized,
                reason: 'User does not have permission to use this caller ID'
            }
        }

        return {
            allowed: true,
            callerIdNumberId: callerIdRecord.id,
            phoneNumber: normalized
        }
    }

    // ---------------------------------------------------------------------------
    // AVAILABLE CALLER IDs
    // ---------------------------------------------------------------------------

    /**
     * Get all caller IDs a user can use
     */
    async getAvailableCallerIds(
        organizationId: string,
        userId: string
    ): Promise<AvailableCallerId[]> {
        // Check if admin
        const { rows: membership } = await query(
            `SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
            [organizationId, userId]
        )

        const isAdmin = ['owner', 'admin'].includes(membership?.[0]?.role || '')

        if (isAdmin) {
            // Admins see all active caller IDs
            const { rows } = await query(
                `SELECT id, phone_number, display_name, is_default FROM caller_id_numbers 
                 WHERE organization_id = $1 AND status = 'active' AND is_verified = true 
                 ORDER BY is_default DESC`,
                [organizationId]
            )

            return (rows || []).map(cid => ({
                ...cid,
                permission_type: 'full' as const
            }))
        }

        // Non-admins see only permitted caller IDs
        const { rows: permissions } = await query(
            `SELECT p.permission_type, c.id, c.phone_number, c.display_name, c.is_default, c.status, c.is_verified
             FROM caller_id_permissions p
             JOIN caller_id_numbers c ON p.caller_id_number_id = c.id
             WHERE p.organization_id = $1 AND p.user_id = $2 AND p.is_active = true`,
            [organizationId, userId]
        )

        if (!permissions?.length) return []

        return permissions
            .filter((p: any) => {
                return p.status === 'active' && p.is_verified
            })
            .map((p: any) => {
                return {
                    id: p.id,
                    phone_number: p.phone_number,
                    display_name: p.display_name,
                    is_default: p.is_default,
                    permission_type: p.permission_type as 'use' | 'manage' | 'full'
                }
            })
    }

    // ---------------------------------------------------------------------------
    // DEFAULT RESOLUTION
    // ---------------------------------------------------------------------------

    /**
     * Get the default caller ID for a user
     * Resolution order: user-specific > role-based > org-wide (by priority)
     */
    async getDefaultCallerId(
        organizationId: string,
        userId: string
    ): Promise<{ id: string; phone_number: string } | null> {
        // Get user's role for role-based defaults
        const { rows: membership } = await query(
            `SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
            [organizationId, userId]
        )
        const userRole = membership?.[0]?.role

        // Query all applicable default rules, ordered by priority
        // Using explicit joins instead of nested Supabase syntax
        const { rows: rules } = await query(
            `SELECT r.id, r.scope_type, r.user_id, r.role_scope, r.priority, 
                    c.id as cid_id, c.phone_number, c.status, c.is_verified
             FROM caller_id_default_rules r
             JOIN caller_id_numbers c ON r.caller_id_number_id = c.id
             WHERE r.organization_id = $1 AND r.is_active = true
             AND (r.user_id = $2 OR r.user_id IS NULL)
             ORDER BY r.priority ASC`,
            [organizationId, userId]
        )

        if (!rules?.length) {
            // Fallback: check for legacy is_default flag
            const { rows: legacyDefault } = await query(
                `SELECT id, phone_number FROM caller_id_numbers 
                 WHERE organization_id = $1 AND is_default = true AND status = 'active' AND is_verified = true 
                 LIMIT 1`,
                [organizationId]
            )

            return legacyDefault?.[0] || null
        }

        // Find first applicable rule
        for (const rule of rules) {
            // Skip if caller ID not usable
            if (rule.status !== 'active' || !rule.is_verified) continue

            // Check scope applicability
            if (rule.scope_type === 'user' && rule.user_id === userId) {
                return { id: rule.cid_id, phone_number: rule.phone_number }
            }

            if (rule.scope_type === 'role' && rule.role_scope === userRole) {
                return { id: rule.cid_id, phone_number: rule.phone_number }
            }

            if (rule.scope_type === 'organization') {
                return { id: rule.cid_id, phone_number: rule.phone_number }
            }
        }

        return null
    }

    // ---------------------------------------------------------------------------
    // PERMISSION MANAGEMENT (Admin only)
    // ---------------------------------------------------------------------------

    /**
     * Grant caller ID permission to a user
     */
    async grantPermission(
        organizationId: string,
        callerIdNumberId: string,
        targetUserId: string,
        permissionType: 'use' | 'manage' | 'full',
        grantedByUserId: string
    ): Promise<{ success: boolean; permissionId?: string; error?: string }> {
        const permissionId = uuidv4()

        try {
            await query(
                `INSERT INTO caller_id_permissions (
                    id, organization_id, caller_id_number_id, user_id, permission_type, 
                    is_active, granted_by, granted_at
                 ) VALUES ($1, $2, $3, $4, $5, true, $6, NOW())
                 ON CONFLICT (organization_id, caller_id_number_id, user_id) 
                 DO UPDATE SET is_active = true, permission_type = $5, granted_at = NOW(), revoked_at = NULL`,
                [permissionId, organizationId, callerIdNumberId, targetUserId, permissionType, grantedByUserId]
            )
        } catch (error: any) {
            logger.error('Failed to grant caller ID permission', error)
            return { success: false, error: error.message }
        }

        // Audit log
        await bestEffortAuditLog(
            async () => await query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, after)
                 VALUES ($1, $2, $3, 'caller_id_permission', $4, 'grant', 'human', $5)`,
                [uuidv4(), organizationId, grantedByUserId, permissionId, JSON.stringify({ target_user_id: targetUserId, caller_id_number_id: callerIdNumberId, permission_type: permissionType })]
            ),
            { resource: 'caller_id_permission', resourceId: permissionId, action: 'grant' }
        )

        return { success: true, permissionId }
    }

    /**
     * Revoke caller ID permission from a user
     */
    async revokePermission(
        organizationId: string,
        callerIdNumberId: string,
        targetUserId: string,
        revokedByUserId: string,
        reason?: string
    ): Promise<{ success: boolean; error?: string }> {
        // Find the active permission
        const { rows: existing } = await query(
            `SELECT id FROM caller_id_permissions 
             WHERE organization_id = $1 AND caller_id_number_id = $2 AND user_id = $3 AND is_active = true LIMIT 1`,
            [organizationId, callerIdNumberId, targetUserId]
        )

        if (!existing.length) {
            return { success: false, error: 'No active permission found' }
        }
        const permId = existing[0].id

        // Soft revoke
        try {
            await query(
                `UPDATE caller_id_permissions SET is_active = false, revoked_at = NOW(), revoked_by = $1, revoked_reason = $2 WHERE id = $3`,
                [revokedByUserId, reason, permId]
            )
        } catch (error: any) {
            return { success: false, error: error.message }
        }

        // Audit log
        await bestEffortAuditLog(
            async () => await query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, after)
                 VALUES ($1, $2, $3, 'caller_id_permission', $4, 'revoke', 'human', $5)`,
                [uuidv4(), organizationId, revokedByUserId, permId, JSON.stringify({ target_user_id: targetUserId, caller_id_number_id: callerIdNumberId, reason })]
            ),
            { resource: 'caller_id_permission', resourceId: permId, action: 'revoke' }
        )

        return { success: true }
    }

    // ---------------------------------------------------------------------------
    // NUMBER LIFECYCLE (Admin only)
    // ---------------------------------------------------------------------------

    /**
     * Retire a caller ID number
     * Preserves historical call records via soft-delete
     */
    async retireNumber(
        callerIdNumberId: string,
        retiredByUserId: string,
        reason?: string
    ): Promise<{ success: boolean; error?: string }> {
        // Get the number first
        const { rows: numbers } = await query(
            `SELECT id, organization_id, phone_number, status FROM caller_id_numbers WHERE id = $1 LIMIT 1`,
            [callerIdNumberId]
        )
        const number = numbers[0]

        if (!number) {
            return { success: false, error: 'Caller ID number not found' }
        }

        if (number.status === 'retired') {
            return { success: false, error: 'Number is already retired' }
        }

        // Update status to retired
        try {
            await query(
                `UPDATE caller_id_numbers SET status = 'retired', retired_at = NOW(), retired_by = $1, notes = $2 WHERE id = $3`,
                [retiredByUserId, reason ? `Retired: ${reason}` : null, callerIdNumberId]
            )
        } catch (error: any) {
            return { success: false, error: error.message }
        }

        // Revoke all active permissions for this number
        await query(
            `UPDATE caller_id_permissions SET is_active = false, revoked_at = NOW(), revoked_by = $1, revoked_reason = 'Number retired' WHERE caller_id_number_id = $2 AND is_active = true`,
            [retiredByUserId, callerIdNumberId]
        )

        // Deactivate default rules using this number
        await query(
            `UPDATE caller_id_default_rules SET is_active = false WHERE caller_id_number_id = $1 AND is_active = true`,
            [callerIdNumberId]
        )

        // Audit log
        await bestEffortAuditLog(
            async () => await query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, before, after)
                 VALUES ($1, $2, $3, 'caller_id_number', $4, 'retire', 'human', $5, $6)`,
                [uuidv4(), number.organization_id, retiredByUserId, callerIdNumberId, JSON.stringify({ status: number.status }), JSON.stringify({ status: 'retired', reason })]
            ),
            { resource: 'caller_id_number', resourceId: callerIdNumberId, action: 'retire' }
        )

        return { success: true }
    }

    // ---------------------------------------------------------------------------
    // DEFAULT RULE MANAGEMENT
    // ---------------------------------------------------------------------------

    /**
     * Set default caller ID rule
     */
    async setDefaultRule(
        organizationId: string,
        callerIdNumberId: string,
        scopeType: 'organization' | 'user' | 'role',
        createdByUserId: string,
        options?: {
            userId?: string
            roleScope?: string
            priority?: number
        }
    ): Promise<{ success: boolean; ruleId?: string; error?: string }> {
        const ruleId = uuidv4()

        try {
            await query(
                `INSERT INTO caller_id_default_rules (
                    id, organization_id, scope_type, user_id, role_scope, caller_id_number_id, priority, is_active, created_by
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
                [ruleId, organizationId, scopeType, options?.userId, options?.roleScope, callerIdNumberId, options?.priority || 100, createdByUserId]
            )
        } catch (error: any) {
            logger.error('Failed to set default rule', error)
            return { success: false, error: error.message }
        }

        // Audit log
        await bestEffortAuditLog(
            async () => await query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, after)
                 VALUES ($1, $2, $3, 'caller_id_default_rule', $4, 'create', 'human', $5)`,
                [uuidv4(), organizationId, createdByUserId, ruleId, JSON.stringify({ scope_type: scopeType, caller_id_number_id: callerIdNumberId })]
            ),
            { resource: 'caller_id_default_rule', resourceId: ruleId, action: 'create' }
        )

        return { success: true, ruleId }
    }

    // ---------------------------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------------------------

    private normalizeE164(phone: string): string {
        const cleaned = phone.replace(/[^\d+]/g, '')
        return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
    }
}

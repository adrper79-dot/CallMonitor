/**
 * Caller ID Service - Governed Number Assignment
 * 
 * Per SYSTEM_OF_RECORD_COMPLIANCE:
 * - Explicit caller ID choice recorded per call
 * - User-level permissions (not implicit)
 * - All assignments auditable
 * - No magic defaults without recorded rules
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { bestEffortAuditLog } from '@/lib/monitoring/auditLogMonitor'

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
    constructor(private supabaseAdmin: SupabaseClient) { }

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
        const { data } = await this.supabaseAdmin
            .from('caller_id_permissions')
            .select('id, permission_type')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .eq('caller_id_number_id', callerIdNumberId)
            .eq('is_active', true)
            .limit(1)

        if (data?.length) return true

        // Check if user is admin (admins can use any org caller ID)
        const { data: membership } = await this.supabaseAdmin
            .from('org_members')
            .select('role')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .single()

        return ['owner', 'admin'].includes(membership?.role || '')
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
        const { data: callerIdRecord } = await this.supabaseAdmin
            .from('caller_id_numbers')
            .select('id, phone_number, status, is_verified')
            .eq('organization_id', organizationId)
            .eq('phone_number', normalized)
            .single()

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
        const { data: membership } = await this.supabaseAdmin
            .from('org_members')
            .select('role')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .single()

        const isAdmin = ['owner', 'admin'].includes(membership?.role || '')

        if (isAdmin) {
            // Admins see all active caller IDs
            const { data } = await this.supabaseAdmin
                .from('caller_id_numbers')
                .select('id, phone_number, display_name, is_default')
                .eq('organization_id', organizationId)
                .eq('status', 'active')
                .eq('is_verified', true)
                .order('is_default', { ascending: false })

            return (data || []).map(cid => ({
                ...cid,
                permission_type: 'full' as const
            }))
        }

        // Non-admins see only permitted caller IDs
        const { data: permissions } = await this.supabaseAdmin
            .from('caller_id_permissions')
            .select(`
        permission_type,
        caller_id_numbers!inner(id, phone_number, display_name, is_default, status, is_verified)
      `)
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .eq('is_active', true)

        if (!permissions?.length) return []

        return permissions
            .filter(p => {
                const cid = p.caller_id_numbers as unknown as CallerIdNumber
                return cid.status === 'active' && cid.is_verified
            })
            .map(p => {
                const cid = p.caller_id_numbers as unknown as CallerIdNumber
                return {
                    id: cid.id,
                    phone_number: cid.phone_number,
                    display_name: cid.display_name,
                    is_default: cid.is_default,
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
        const { data: membership } = await this.supabaseAdmin
            .from('org_members')
            .select('role')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .single()

        const userRole = membership?.role

        // Query all applicable default rules, ordered by priority
        const { data: rules } = await this.supabaseAdmin
            .from('caller_id_default_rules')
            .select(`
        id, scope_type, user_id, role_scope, priority,
        caller_id_numbers!inner(id, phone_number, status, is_verified)
      `)
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .or(`user_id.eq.${userId},user_id.is.null`)
            .order('priority', { ascending: true })

        if (!rules?.length) {
            // Fallback: check for legacy is_default flag
            const { data: legacyDefault } = await this.supabaseAdmin
                .from('caller_id_numbers')
                .select('id, phone_number')
                .eq('organization_id', organizationId)
                .eq('is_default', true)
                .eq('status', 'active')
                .eq('is_verified', true)
                .limit(1)

            return legacyDefault?.[0] || null
        }

        // Find first applicable rule
        for (const rule of rules) {
            const cid = rule.caller_id_numbers as unknown as CallerIdNumber

            // Skip if caller ID not usable
            if (cid.status !== 'active' || !cid.is_verified) continue

            // Check scope applicability
            if (rule.scope_type === 'user' && rule.user_id === userId) {
                return { id: cid.id, phone_number: cid.phone_number }
            }

            if (rule.scope_type === 'role' && rule.role_scope === userRole) {
                return { id: cid.id, phone_number: cid.phone_number }
            }

            if (rule.scope_type === 'organization') {
                return { id: cid.id, phone_number: cid.phone_number }
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

        const { error } = await this.supabaseAdmin
            .from('caller_id_permissions')
            .upsert({
                id: permissionId,
                organization_id: organizationId,
                caller_id_number_id: callerIdNumberId,
                user_id: targetUserId,
                permission_type: permissionType,
                is_active: true,
                granted_by: grantedByUserId,
                granted_at: new Date().toISOString(),
                revoked_at: null,
                revoked_by: null
            }, {
                onConflict: 'organization_id,caller_id_number_id,user_id'
            })

        if (error) {
            logger.error('Failed to grant caller ID permission', error)
            return { success: false, error: error.message }
        }

        // Audit log
        await bestEffortAuditLog(
            async () => await this.supabaseAdmin.from('audit_logs').insert({
                id: uuidv4(),
                organization_id: organizationId,
                user_id: grantedByUserId,
                resource_type: 'caller_id_permission',
                resource_id: permissionId,
                action: 'grant',
                actor_type: 'human',
                after: {
                    target_user_id: targetUserId,
                    caller_id_number_id: callerIdNumberId,
                    permission_type: permissionType
                }
            }),
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
        const { data: existing } = await this.supabaseAdmin
            .from('caller_id_permissions')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('caller_id_number_id', callerIdNumberId)
            .eq('user_id', targetUserId)
            .eq('is_active', true)
            .single()

        if (!existing) {
            return { success: false, error: 'No active permission found' }
        }

        // Soft revoke
        const { error } = await this.supabaseAdmin
            .from('caller_id_permissions')
            .update({
                is_active: false,
                revoked_at: new Date().toISOString(),
                revoked_by: revokedByUserId,
                revoke_reason: reason
            })
            .eq('id', existing.id)

        if (error) {
            return { success: false, error: error.message }
        }

        // Audit log
        await bestEffortAuditLog(
            async () => await this.supabaseAdmin.from('audit_logs').insert({
                id: uuidv4(),
                organization_id: organizationId,
                user_id: revokedByUserId,
                resource_type: 'caller_id_permission',
                resource_id: existing.id,
                action: 'revoke',
                actor_type: 'human',
                after: {
                    target_user_id: targetUserId,
                    caller_id_number_id: callerIdNumberId,
                    reason
                }
            }),
            { resource: 'caller_id_permission', resourceId: existing.id, action: 'revoke' }
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
        const { data: number } = await this.supabaseAdmin
            .from('caller_id_numbers')
            .select('id, organization_id, phone_number, status')
            .eq('id', callerIdNumberId)
            .single()

        if (!number) {
            return { success: false, error: 'Caller ID number not found' }
        }

        if (number.status === 'retired') {
            return { success: false, error: 'Number is already retired' }
        }

        // Update status to retired
        const { error } = await this.supabaseAdmin
            .from('caller_id_numbers')
            .update({
                status: 'retired',
                retired_at: new Date().toISOString(),
                retired_by: retiredByUserId,
                notes: reason ? `Retired: ${reason}` : undefined
            })
            .eq('id', callerIdNumberId)

        if (error) {
            return { success: false, error: error.message }
        }

        // Revoke all active permissions for this number
        await this.supabaseAdmin
            .from('caller_id_permissions')
            .update({
                is_active: false,
                revoked_at: new Date().toISOString(),
                revoked_by: retiredByUserId,
                revoke_reason: 'Number retired'
            })
            .eq('caller_id_number_id', callerIdNumberId)
            .eq('is_active', true)

        // Deactivate default rules using this number
        await this.supabaseAdmin
            .from('caller_id_default_rules')
            .update({
                is_active: false
            })
            .eq('caller_id_number_id', callerIdNumberId)
            .eq('is_active', true)

        // Audit log
        await bestEffortAuditLog(
            async () => await this.supabaseAdmin.from('audit_logs').insert({
                id: uuidv4(),
                organization_id: number.organization_id,
                user_id: retiredByUserId,
                resource_type: 'caller_id_number',
                resource_id: callerIdNumberId,
                action: 'retire',
                actor_type: 'human',
                before: { status: number.status },
                after: { status: 'retired', reason }
            }),
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

        const { error } = await this.supabaseAdmin
            .from('caller_id_default_rules')
            .insert({
                id: ruleId,
                organization_id: organizationId,
                scope_type: scopeType,
                user_id: options?.userId,
                role_scope: options?.roleScope,
                caller_id_number_id: callerIdNumberId,
                priority: options?.priority || 100,
                is_active: true,
                created_by: createdByUserId
            })

        if (error) {
            logger.error('Failed to set default rule', error)
            return { success: false, error: error.message }
        }

        // Audit log
        await bestEffortAuditLog(
            async () => await this.supabaseAdmin.from('audit_logs').insert({
                id: uuidv4(),
                organization_id: organizationId,
                user_id: createdByUserId,
                resource_type: 'caller_id_default_rule',
                resource_id: ruleId,
                action: 'create',
                actor_type: 'human',
                after: { scope_type: scopeType, caller_id_number_id: callerIdNumberId }
            }),
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

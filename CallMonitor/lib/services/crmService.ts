/**
 * CRM Service - Core OAuth and Sync Management
 * 
 * Per SYSTEM_OF_RECORD_COMPLIANCE:
 * - CRMs are NON-AUTHORITATIVE (read-only metadata, evidence bundle links only)
 * - Tokens encrypted at rest using CRM_ENCRYPTION_KEY
 * - All operations auditable via crm_sync_log
 * - Rate limiting with idempotency keys for retry safety
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { bestEffortAuditLog } from '@/lib/monitoring/auditLogMonitor'

// =============================================================================
// TYPES
// =============================================================================

export type CRMProvider = 'hubspot' | 'salesforce' | 'zoho' | 'pipedrive'
export type IntegrationStatus = 'pending' | 'active' | 'disconnected' | 'error' | 'expired'
export type SyncOperation =
    | 'oauth_connect' | 'oauth_disconnect' | 'oauth_refresh'
    | 'push_evidence' | 'push_note' | 'push_engagement'
    | 'pull_contact' | 'pull_company' | 'pull_deal'
    | 'link_object' | 'unlink_object'
    | 'error' | 'rate_limited'

export type SyncStatus = 'pending' | 'success' | 'failed' | 'rate_limited' | 'skipped'

export interface Integration {
    id: string
    organization_id: string
    provider: CRMProvider
    provider_account_id: string | null
    provider_account_name: string | null
    status: IntegrationStatus
    error_message: string | null
    settings: Record<string, unknown>
    sync_enabled: boolean
    connected_at: string | null
    connected_by: string | null
    created_at: string
}

export interface OAuthTokens {
    access_token: string
    refresh_token?: string
    expires_at?: Date
    token_type?: string
    scopes?: string[]
    instance_url?: string  // Salesforce-specific
}

export interface CRMObjectLink {
    id: string
    call_id: string
    crm_object_type: 'contact' | 'company' | 'deal' | 'lead' | 'account' | 'opportunity'
    crm_object_id: string
    crm_object_name: string | null
    crm_object_url: string | null
}

export interface SyncLogEntry {
    id: string
    operation: SyncOperation
    status: SyncStatus
    call_id?: string
    export_bundle_id?: string
    idempotency_key?: string
    error_details?: Record<string, unknown>
}

// =============================================================================
// ENCRYPTION (reusing SSO pattern with AES-256-GCM for production)
// =============================================================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get encryption key from environment
 * Returns a 32-byte key derived from CRM_ENCRYPTION_KEY
 */
function getEncryptionKey(): Buffer {
    const key = process.env.CRM_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'dev-key-min-32-chars-for-aes256!'
    return createHash('sha256').update(key).digest()
}

/**
 * Encrypt a token for storage
 * Format: v2:iv:authTag:ciphertext (all base64)
 */
export function encryptToken(plaintext: string): string {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    return `v2:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypt a stored token
 */
export function decryptToken(encrypted: string): string {
    // Handle legacy v1 format (base64 only, from SSO service)
    if (encrypted.startsWith('v1:')) {
        const parts = encrypted.split(':')
        if (parts.length >= 2) {
            return Buffer.from(parts[1], 'base64').toString('utf-8')
        }
    }

    // v2 format: v2:iv:authTag:ciphertext
    if (encrypted.startsWith('v2:')) {
        const parts = encrypted.split(':')
        if (parts.length !== 4) {
            throw new Error('Invalid encrypted token format')
        }

        const [, ivBase64, authTagBase64, ciphertext] = parts
        const key = getEncryptionKey()
        const iv = Buffer.from(ivBase64, 'base64')
        const authTag = Buffer.from(authTagBase64, 'base64')

        const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    }

    // Fallback: assume it's unencrypted (dev only)
    logger.warn('Unencrypted token detected, returning as-is')
    return encrypted
}

// =============================================================================
// CRM SERVICE CLASS
// =============================================================================

export class CRMService {
    private rateLimits: Map<string, { count: number; resetAt: number }> = new Map()

    constructor(private supabaseAdmin: SupabaseClient) { }

    // ---------------------------------------------------------------------------
    // INTEGRATION MANAGEMENT
    // ---------------------------------------------------------------------------

    /**
     * Get all integrations for an organization
     */
    async getIntegrations(organizationId: string): Promise<Integration[]> {
        const { data, error } = await this.supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })

        if (error) {
            logger.error('Failed to fetch integrations', error)
            return []
        }

        return data || []
    }

    /**
     * Get a specific integration
     */
    async getIntegration(integrationId: string): Promise<Integration | null> {
        const { data, error } = await this.supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('id', integrationId)
            .single()

        if (error) return null
        return data
    }

    /**
     * Get integration by provider for an org
     */
    async getIntegrationByProvider(
        organizationId: string,
        provider: CRMProvider
    ): Promise<Integration | null> {
        const { data } = await this.supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('provider', provider)
            .single()

        return data
    }

    /**
     * Create or update integration after OAuth callback
     */
    async createIntegration(
        organizationId: string,
        provider: CRMProvider,
        tokens: OAuthTokens,
        providerAccountId?: string,
        providerAccountName?: string,
        userId?: string
    ): Promise<{ success: boolean; integrationId?: string; error?: string }> {
        try {
            // Upsert integration
            const integrationId = uuidv4()
            const { data: integration, error: intError } = await this.supabaseAdmin
                .from('integrations')
                .upsert({
                    id: integrationId,
                    organization_id: organizationId,
                    provider,
                    provider_account_id: providerAccountId,
                    provider_account_name: providerAccountName,
                    status: 'active',
                    connected_at: new Date().toISOString(),
                    connected_by: userId,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'organization_id,provider'
                })
                .select()
                .single()

            if (intError || !integration) {
                logger.error('Failed to create integration', intError)
                return { success: false, error: intError?.message || 'Failed to create integration' }
            }

            // Store encrypted tokens
            const { error: tokenError } = await this.supabaseAdmin
                .from('oauth_tokens')
                .upsert({
                    integration_id: integration.id,
                    access_token_encrypted: encryptToken(tokens.access_token),
                    refresh_token_encrypted: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
                    token_type: tokens.token_type || 'Bearer',
                    expires_at: tokens.expires_at?.toISOString(),
                    scopes: tokens.scopes,
                    instance_url: tokens.instance_url,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'integration_id'
                })

            if (tokenError) {
                logger.error('Failed to store tokens', tokenError)
                return { success: false, error: 'Failed to store credentials' }
            }

            // Log the sync event
            await this.logSyncOperation({
                organizationId,
                integrationId: integration.id,
                operation: 'oauth_connect',
                status: 'success',
                triggeredBy: 'user',
                triggeredByUserId: userId,
                responseSummary: { provider, accountName: providerAccountName }
            })

            // Audit log
            await bestEffortAuditLog(
                async () => await this.supabaseAdmin.from('audit_logs').insert({
                    id: uuidv4(),
                    organization_id: organizationId,
                    user_id: userId,
                    resource_type: 'integration',
                    resource_id: integration.id,
                    action: 'connect',
                    actor_type: 'human',
                    after: { provider, account_name: providerAccountName }
                }),
                { resource: 'integration', resourceId: integration.id, action: 'connect' }
            )

            return { success: true, integrationId: integration.id }
        } catch (err) {
            logger.error('Integration creation failed', err as Error)
            return { success: false, error: 'Integration failed' }
        }
    }

    /**
     * Disconnect an integration
     */
    async disconnectIntegration(
        integrationId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        const integration = await this.getIntegration(integrationId)
        if (!integration) {
            return { success: false, error: 'Integration not found' }
        }

        // Delete tokens
        await this.supabaseAdmin
            .from('oauth_tokens')
            .delete()
            .eq('integration_id', integrationId)

        // Update status
        await this.supabaseAdmin
            .from('integrations')
            .update({
                status: 'disconnected',
                disconnected_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', integrationId)

        // Log
        await this.logSyncOperation({
            organizationId: integration.organization_id,
            integrationId,
            operation: 'oauth_disconnect',
            status: 'success',
            triggeredBy: 'user',
            triggeredByUserId: userId
        })

        return { success: true }
    }

    // ---------------------------------------------------------------------------
    // TOKEN MANAGEMENT
    // ---------------------------------------------------------------------------

    /**
     * Get decrypted tokens for an integration
     * Only use server-side, never expose to client
     */
    async getTokens(integrationId: string): Promise<OAuthTokens | null> {
        const { data, error } = await this.supabaseAdmin
            .from('oauth_tokens')
            .select('*')
            .eq('integration_id', integrationId)
            .single()

        if (error || !data) return null

        return {
            access_token: decryptToken(data.access_token_encrypted),
            refresh_token: data.refresh_token_encrypted ? decryptToken(data.refresh_token_encrypted) : undefined,
            expires_at: data.expires_at ? new Date(data.expires_at) : undefined,
            token_type: data.token_type,
            scopes: data.scopes,
            instance_url: data.instance_url
        }
    }

    /**
     * Check if token needs refresh (within 5 minutes of expiry)
     */
    async needsRefresh(integrationId: string): Promise<boolean> {
        const { data } = await this.supabaseAdmin
            .from('oauth_tokens')
            .select('expires_at')
            .eq('integration_id', integrationId)
            .single()

        if (!data?.expires_at) return false

        const expiresAt = new Date(data.expires_at)
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

        return expiresAt <= fiveMinutesFromNow
    }

    /**
     * Update tokens after refresh
     */
    async updateTokens(
        integrationId: string,
        tokens: OAuthTokens
    ): Promise<void> {
        await this.supabaseAdmin
            .from('oauth_tokens')
            .update({
                access_token_encrypted: encryptToken(tokens.access_token),
                refresh_token_encrypted: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
                expires_at: tokens.expires_at?.toISOString(),
                last_refreshed_at: new Date().toISOString(),
                refresh_count: this.supabaseAdmin.rpc('increment_refresh_count', { row_id: integrationId }),
                updated_at: new Date().toISOString()
            })
            .eq('integration_id', integrationId)

        const integration = await this.getIntegration(integrationId)
        if (integration) {
            await this.logSyncOperation({
                organizationId: integration.organization_id,
                integrationId,
                operation: 'oauth_refresh',
                status: 'success',
                triggeredBy: 'system'
            })
        }
    }

    // ---------------------------------------------------------------------------
    // SYNC LOGGING
    // ---------------------------------------------------------------------------

    /**
     * Log a sync operation (append-only)
     */
    async logSyncOperation(params: {
        organizationId: string
        integrationId: string
        operation: SyncOperation
        status: SyncStatus
        callId?: string
        exportBundleId?: string
        idempotencyKey?: string
        requestSummary?: Record<string, unknown>
        responseSummary?: Record<string, unknown>
        errorDetails?: Record<string, unknown>
        triggeredBy: 'user' | 'system' | 'webhook' | 'scheduler'
        triggeredByUserId?: string
    }): Promise<string> {
        const logId = uuidv4()

        await this.supabaseAdmin.from('crm_sync_log').insert({
            id: logId,
            organization_id: params.organizationId,
            integration_id: params.integrationId,
            operation: params.operation,
            status: params.status,
            call_id: params.callId,
            export_bundle_id: params.exportBundleId,
            idempotency_key: params.idempotencyKey,
            request_summary: params.requestSummary,
            response_summary: params.responseSummary,
            error_details: params.errorDetails,
            triggered_by: params.triggeredBy,
            triggered_by_user_id: params.triggeredByUserId,
            completed_at: params.status !== 'pending' ? new Date().toISOString() : null
        })

        return logId
    }

    /**
     * Update sync log status (only status and completed_at allowed per trigger)
     */
    async completeSyncOperation(
        logId: string,
        status: SyncStatus,
        responseSummary?: Record<string, unknown>,
        errorDetails?: Record<string, unknown>
    ): Promise<void> {
        await this.supabaseAdmin
            .from('crm_sync_log')
            .update({
                status,
                response_summary: responseSummary,
                error_details: errorDetails,
                completed_at: new Date().toISOString()
            })
            .eq('id', logId)
    }

    // ---------------------------------------------------------------------------
    // RATE LIMITING
    // ---------------------------------------------------------------------------

    /**
     * Check rate limit for a provider
     * HubSpot: 100 requests/10 seconds
     * Salesforce: varies by edition
     */
    checkRateLimit(provider: CRMProvider): boolean {
        const limits: Record<CRMProvider, { max: number; windowMs: number }> = {
            hubspot: { max: 100, windowMs: 10000 },
            salesforce: { max: 25, windowMs: 1000 },
            zoho: { max: 30, windowMs: 1000 },
            pipedrive: { max: 80, windowMs: 1000 }
        }

        const limit = limits[provider]
        const key = provider
        const now = Date.now()

        const current = this.rateLimits.get(key)
        if (!current || current.resetAt < now) {
            this.rateLimits.set(key, { count: 1, resetAt: now + limit.windowMs })
            return true
        }

        if (current.count >= limit.max) {
            return false
        }

        current.count++
        return true
    }

    /**
     * Generate idempotency key for an operation
     */
    generateIdempotencyKey(
        operation: SyncOperation,
        callId?: string,
        crmObjectId?: string
    ): string {
        const components = [operation, callId, crmObjectId, Date.now().toString()].filter(Boolean)
        return createHash('sha256').update(components.join(':')).digest('hex').substring(0, 32)
    }

    /**
     * Check if operation already completed (idempotency)
     */
    async isOperationCompleted(idempotencyKey: string): Promise<boolean> {
        const { data } = await this.supabaseAdmin
            .from('crm_sync_log')
            .select('status')
            .eq('idempotency_key', idempotencyKey)
            .in('status', ['success', 'skipped'])
            .limit(1)

        return (data?.length ?? 0) > 0
    }

    // ---------------------------------------------------------------------------
    // CRM OBJECT LINKS
    // ---------------------------------------------------------------------------

    /**
     * Link a call to a CRM object
     */
    async linkCallToObject(
        organizationId: string,
        integrationId: string,
        callId: string,
        crmObject: {
            type: CRMObjectLink['crm_object_type']
            id: string
            name?: string
            url?: string
        },
        direction: 'inbound' | 'outbound' = 'inbound'
    ): Promise<{ success: boolean; linkId?: string }> {
        const linkId = uuidv4()

        const { error } = await this.supabaseAdmin
            .from('crm_object_links')
            .upsert({
                id: linkId,
                organization_id: organizationId,
                integration_id: integrationId,
                call_id: callId,
                crm_object_type: crmObject.type,
                crm_object_id: crmObject.id,
                crm_object_name: crmObject.name,
                crm_object_url: crmObject.url,
                sync_direction: direction,
                synced_at: new Date().toISOString()
            }, {
                onConflict: 'integration_id,call_id,crm_object_type,crm_object_id'
            })

        if (error) {
            logger.error('Failed to link call to CRM object', error)
            return { success: false }
        }

        return { success: true, linkId }
    }

    /**
     * Get CRM links for a call
     */
    async getCallLinks(callId: string): Promise<CRMObjectLink[]> {
        const { data } = await this.supabaseAdmin
            .from('crm_object_links')
            .select('id, call_id, crm_object_type, crm_object_id, crm_object_name, crm_object_url')
            .eq('call_id', callId)

        return data || []
    }
}

/**
 * Salesforce CRM Provider
 * 
 * Implements OAuth flow and API interactions for Salesforce.
 * Per ARCH_DOCS: Push evidence bundle links only, pull minimal metadata.
 */

import { CRMService, OAuthTokens } from '../crmService'
import { logger } from '@/lib/logger'

// =============================================================================
// CONFIGURATION
// =============================================================================

const SALESFORCE_AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize'
const SALESFORCE_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token'

const DEFAULT_SCOPES = ['api', 'refresh_token', 'offline_access']

export interface SalesforceConfig {
    clientId: string
    clientSecret: string
    redirectUri: string
    scopes: string[]
}

function getConfig(): SalesforceConfig {
    const clientId = process.env.SALESFORCE_CLIENT_ID
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (!clientId || !clientSecret) {
        throw new Error('Salesforce OAuth credentials not configured')
    }

    return {
        clientId,
        clientSecret,
        redirectUri: `${appUrl}/api/integrations/salesforce/callback`,
        scopes: process.env.SALESFORCE_SCOPES?.split(',') || DEFAULT_SCOPES
    }
}

// =============================================================================
// OAUTH FLOW
// =============================================================================

/**
 * Generate Salesforce OAuth authorization URL
 */
export function getAuthorizationUrl(state: string): string {
    const config = getConfig()

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(' '),
        state
    })

    return `${SALESFORCE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
    success: boolean
    tokens?: OAuthTokens
    accountInfo?: { instanceUrl: string; orgId: string; userName: string }
    error?: string
}> {
    const config = getConfig()

    try {
        const response = await fetch(SALESFORCE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.redirectUri,
                code
            })
        })

        if (!response.ok) {
            const error = await response.text()
            logger.error('Salesforce token exchange failed', undefined, { error })
            return { success: false, error: 'Token exchange failed' }
        }

        const data = await response.json()

        const tokens: OAuthTokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            // Salesforce doesn't return expires_in for standard auth, assume 2 hours
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
            token_type: 'Bearer',
            scopes: config.scopes,
            instance_url: data.instance_url
        }

        // Get account info from identity
        const identity = await getIdentity(data.access_token, data.id)

        return {
            success: true,
            tokens,
            accountInfo: identity ? {
                instanceUrl: data.instance_url,
                orgId: identity.organization_id,
                userName: identity.username
            } : undefined
        }
    } catch (err) {
        logger.error('Salesforce OAuth error', err as Error)
        return { success: false, error: 'OAuth failed' }
    }
}

/**
 * Refresh access token
 */
export async function refreshTokens(
    refreshToken: string,
    instanceUrl?: string
): Promise<{
    success: boolean
    tokens?: OAuthTokens
    error?: string
}> {
    const config = getConfig()

    try {
        const response = await fetch(SALESFORCE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                refresh_token: refreshToken
            })
        })

        if (!response.ok) {
            return { success: false, error: 'Token refresh failed' }
        }

        const data = await response.json()

        return {
            success: true,
            tokens: {
                access_token: data.access_token,
                // Salesforce may or may not return new refresh token
                refresh_token: data.refresh_token || refreshToken,
                expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
                token_type: 'Bearer',
                instance_url: instanceUrl || data.instance_url
            }
        }
    } catch (err) {
        logger.error('Salesforce token refresh error', err as Error)
        return { success: false, error: 'Refresh failed' }
    }
}

// =============================================================================
// IDENTITY
// =============================================================================

async function getIdentity(accessToken: string, identityUrl: string): Promise<{
    organization_id: string
    username: string
    display_name: string
} | null> {
    try {
        const response = await fetch(identityUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        })

        if (!response.ok) return null

        const data = await response.json()
        return {
            organization_id: data.organization_id,
            username: data.username,
            display_name: data.display_name
        }
    } catch {
        return null
    }
}

// =============================================================================
// CONTACT/ACCOUNT LOOKUP
// =============================================================================

export interface SalesforceContact {
    id: string
    name: string
    email?: string
    phone?: string
    accountId?: string
    accountName?: string
}

/**
 * Search for a contact by phone number using SOQL
 */
export async function findContactByPhone(
    accessToken: string,
    instanceUrl: string,
    phoneNumber: string
): Promise<SalesforceContact | null> {
    try {
        const normalizedPhone = phoneNumber.replace(/[^\d]/g, '')
        const last10 = normalizedPhone.slice(-10)

        // SOQL query with phone pattern matching
        const query = encodeURIComponent(
            `SELECT Id, Name, Email, Phone, Account.Id, Account.Name 
       FROM Contact 
       WHERE Phone LIKE '%${last10}%' OR MobilePhone LIKE '%${last10}%'
       LIMIT 1`
        )

        const response = await fetch(
            `${instanceUrl}/services/data/v58.0/query?q=${query}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        )

        if (!response.ok) return null

        const data = await response.json()
        if (!data.records?.length) return null

        const contact = data.records[0]
        return {
            id: contact.Id,
            name: contact.Name,
            email: contact.Email,
            phone: contact.Phone,
            accountId: contact.Account?.Id,
            accountName: contact.Account?.Name
        }
    } catch (err) {
        logger.error('Salesforce contact search failed', err as Error)
        return null
    }
}

/**
 * Search for a Lead by phone number
 */
export async function findLeadByPhone(
    accessToken: string,
    instanceUrl: string,
    phoneNumber: string
): Promise<{ id: string; name: string; company: string } | null> {
    try {
        const normalizedPhone = phoneNumber.replace(/[^\d]/g, '')
        const last10 = normalizedPhone.slice(-10)

        const query = encodeURIComponent(
            `SELECT Id, Name, Company, Phone 
       FROM Lead 
       WHERE Phone LIKE '%${last10}%' OR MobilePhone LIKE '%${last10}%'
       LIMIT 1`
        )

        const response = await fetch(
            `${instanceUrl}/services/data/v58.0/query?q=${query}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        )

        if (!response.ok) return null

        const data = await response.json()
        if (!data.records?.length) return null

        const lead = data.records[0]
        return {
            id: lead.Id,
            name: lead.Name,
            company: lead.Company
        }
    } catch {
        return null
    }
}

// =============================================================================
// TASK/NOTE CREATION (Evidence Bundle Links)
// =============================================================================

export interface CreateTaskParams {
    accessToken: string
    instanceUrl: string
    contactId?: string
    accountId?: string
    leadId?: string
    subject: string
    description: string  // Should contain evidence bundle URL
    activityDate?: Date
}

/**
 * Create a Task with evidence bundle link
 * Per ARCH_DOCS: Only push immutable evidence bundle URLs, not raw content
 */
export async function createTask(params: CreateTaskParams): Promise<{
    success: boolean
    taskId?: string
    error?: string
}> {
    try {
        const taskData: Record<string, unknown> = {
            Subject: params.subject,
            Description: params.description,
            Status: 'Completed',
            Priority: 'Normal',
            ActivityDate: (params.activityDate || new Date()).toISOString().split('T')[0]
        }

        // Link to the appropriate record
        if (params.contactId) {
            taskData.WhoId = params.contactId
        }
        if (params.accountId) {
            taskData.WhatId = params.accountId
        }
        if (params.leadId && !params.contactId) {
            taskData.WhoId = params.leadId
        }

        const response = await fetch(
            `${params.instanceUrl}/services/data/v58.0/sobjects/Task`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${params.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            }
        )

        if (!response.ok) {
            const error = await response.text()
            logger.error('Salesforce task creation failed', undefined, { error })
            return { success: false, error: 'Failed to create task' }
        }

        const data = await response.json()
        return { success: true, taskId: data.id }
    } catch (err) {
        logger.error('Salesforce task error', err as Error)
        return { success: false, error: 'Task creation failed' }
    }
}

// =============================================================================
// SALESFORCE SERVICE CLASS
// =============================================================================

export class SalesforceService {
    private crmService: CRMService

    constructor() {
        this.crmService = new CRMService()
    }

    /**
     * Get valid access token and instance URL (refreshing if needed)
     */
    async getAccessInfo(integrationId: string): Promise<{
        accessToken: string
        instanceUrl: string
    } | null> {
        // Check if refresh needed
        if (await this.crmService.needsRefresh(integrationId)) {
            const tokens = await this.crmService.getTokens(integrationId)
            if (!tokens?.refresh_token) return null

            const refreshResult = await refreshTokens(tokens.refresh_token, tokens.instance_url)
            if (!refreshResult.success || !refreshResult.tokens) return null

            await this.crmService.updateTokens(integrationId, refreshResult.tokens)
            return {
                accessToken: refreshResult.tokens.access_token,
                instanceUrl: refreshResult.tokens.instance_url || ''
            }
        }

        const tokens = await this.crmService.getTokens(integrationId)
        if (!tokens?.access_token || !tokens.instance_url) return null

        return {
            accessToken: tokens.access_token,
            instanceUrl: tokens.instance_url
        }
    }

    /**
     * Push evidence bundle link to Salesforce
     * Creates a Task with the export bundle URL
     */
    async pushEvidenceBundle(
        integrationId: string,
        callId: string,
        exportBundleUrl: string,
        callPhoneNumber: string,
        callDate: Date,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        const integration = await this.crmService.getIntegration(integrationId)
        if (!integration) {
            return { success: false, error: 'Integration not found' }
        }

        // Rate limit check
        if (!this.crmService.checkRateLimit('salesforce')) {
            await this.crmService.logSyncOperation({
                organizationId: integration.organization_id,
                integrationId,
                operation: 'rate_limited',
                status: 'rate_limited',
                callId,
                triggeredBy: userId ? 'user' : 'system',
                triggeredByUserId: userId
            })
            return { success: false, error: 'Rate limited, please retry' }
        }

        // Idempotency check
        const idempotencyKey = this.crmService.generateIdempotencyKey('push_evidence', callId)
        if (await this.crmService.isOperationCompleted(idempotencyKey)) {
            return { success: true }  // Already completed
        }

        const accessInfo = await this.getAccessInfo(integrationId)
        if (!accessInfo) {
            return { success: false, error: 'Unable to get access token' }
        }

        // Find contact by phone
        let contact = await findContactByPhone(
            accessInfo.accessToken,
            accessInfo.instanceUrl,
            callPhoneNumber
        )

        // If no contact, try finding a lead
        let lead: { id: string; name: string; company: string } | null = null
        if (!contact) {
            lead = await findLeadByPhone(accessInfo.accessToken, accessInfo.instanceUrl, callPhoneNumber)
        }

        if (!contact && !lead) {
            logger.info('No Salesforce contact or lead found for phone', { phone: '[REDACTED]' })
            return { success: false, error: 'No matching contact or lead found' }
        }

        // Link call to CRM objects
        if (contact) {
            await this.crmService.linkCallToObject(
                integration.organization_id,
                integrationId,
                callId,
                { type: 'contact', id: contact.id, name: contact.name },
                'outbound'
            )

            if (contact.accountId) {
                await this.crmService.linkCallToObject(
                    integration.organization_id,
                    integrationId,
                    callId,
                    { type: 'account', id: contact.accountId, name: contact.accountName || undefined },
                    'outbound'
                )
            }
        } else if (lead) {
            await this.crmService.linkCallToObject(
                integration.organization_id,
                integrationId,
                callId,
                { type: 'lead', id: lead.id, name: lead.name },
                'outbound'
            )
        }

        // Create task with evidence bundle link
        const description = `📞 Call Recording & Transcript\n\nDate: ${callDate.toLocaleString()}\n\n📎 Access full call evidence:\n${exportBundleUrl}\n\n---\nSynced from Word Is Bond`

        const result = await createTask({
            accessToken: accessInfo.accessToken,
            instanceUrl: accessInfo.instanceUrl,
            contactId: contact?.id,
            accountId: contact?.accountId,
            leadId: lead?.id,
            subject: `Call on ${callDate.toLocaleDateString()}`,
            description,
            activityDate: callDate
        })

        // Log the operation
        await this.crmService.logSyncOperation({
            organizationId: integration.organization_id,
            integrationId,
            operation: 'push_evidence',
            status: result.success ? 'success' : 'failed',
            callId,
            idempotencyKey,
            requestSummary: {
                contactId: contact?.id,
                leadId: lead?.id,
                phone: '[REDACTED]'
            },
            responseSummary: result.success ? { taskId: result.taskId } : undefined,
            errorDetails: result.error ? { message: result.error } : undefined,
            triggeredBy: userId ? 'user' : 'system',
            triggeredByUserId: userId
        })

        return result
    }
}

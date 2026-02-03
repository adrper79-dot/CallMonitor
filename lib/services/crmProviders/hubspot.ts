/**
 * HubSpot CRM Provider
 * 
 * Implements OAuth flow and API interactions for HubSpot.
 * Per ARCH_DOCS: Push evidence bundle links only, pull minimal metadata.
 */

import { CRMService, OAuthTokens } from '../crmService'
import { logger } from '@/lib/logger'

// =============================================================================
// CONFIGURATION
// =============================================================================

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize'
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'
const HUBSPOT_API_BASE = 'https://api.hubapi.com'

const DEFAULT_SCOPES = [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.companies.read',
    'crm.objects.deals.read',
    'sales-email-read'
]

export interface HubSpotConfig {
    clientId: string
    clientSecret: string
    redirectUri: string
    scopes: string[]
}

function getConfig(): HubSpotConfig {
    const clientId = process.env.HUBSPOT_CLIENT_ID
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (!clientId || !clientSecret) {
        throw new Error('HubSpot OAuth credentials not configured')
    }

    return {
        clientId,
        clientSecret,
        redirectUri: `${appUrl}/api/integrations/hubspot/callback`,
        scopes: process.env.HUBSPOT_SCOPES?.split(',') || DEFAULT_SCOPES
    }
}

// =============================================================================
// OAUTH FLOW
// =============================================================================

/**
 * Generate HubSpot OAuth authorization URL
 */
export function getAuthorizationUrl(state: string): string {
    const config = getConfig()

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(' '),
        state
    })

    return `${HUBSPOT_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
    success: boolean
    tokens?: OAuthTokens
    accountInfo?: { portalId: string; hubDomain: string }
    error?: string
}> {
    const config = getConfig()

    try {
        const response = await fetch(HUBSPOT_TOKEN_URL, {
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
            logger.error('HubSpot token exchange failed', undefined, { error })
            return { success: false, error: 'Token exchange failed' }
        }

        const data = await response.json()

        const tokens: OAuthTokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: new Date(Date.now() + data.expires_in * 1000),
            token_type: 'Bearer',
            scopes: config.scopes
        }

        // Get account info
        const accountInfo = await getAccountInfo(tokens.access_token)

        return {
            success: true,
            tokens,
            accountInfo
        }
    } catch (err) {
        logger.error('HubSpot OAuth error', err as Error)
        return { success: false, error: 'OAuth failed' }
    }
}

/**
 * Refresh access token
 */
export async function refreshTokens(refreshToken: string): Promise<{
    success: boolean
    tokens?: OAuthTokens
    error?: string
}> {
    const config = getConfig()

    try {
        const response = await fetch(HUBSPOT_TOKEN_URL, {
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
                refresh_token: data.refresh_token,
                expires_at: new Date(Date.now() + data.expires_in * 1000),
                token_type: 'Bearer'
            }
        }
    } catch (err) {
        logger.error('HubSpot token refresh error', err as Error)
        return { success: false, error: 'Refresh failed' }
    }
}

// =============================================================================
// ACCOUNT INFO
// =============================================================================

async function getAccountInfo(accessToken: string): Promise<{ portalId: string; hubDomain: string } | undefined> {
    try {
        const response = await fetch(`${HUBSPOT_API_BASE}/account-info/v3/details`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })

        if (!response.ok) return undefined

        const data = await response.json()
        return {
            portalId: String(data.portalId),
            hubDomain: data.uiDomain || `app.hubspot.com/contacts/${data.portalId}`
        }
    } catch {
        return undefined
    }
}

// =============================================================================
// CONTACT/COMPANY LOOKUP
// =============================================================================

export interface HubSpotContact {
    id: string
    email?: string
    firstName?: string
    lastName?: string
    phone?: string
    company?: string
}

/**
 * Search for a contact by phone number
 */
export async function findContactByPhone(
    accessToken: string,
    phoneNumber: string
): Promise<HubSpotContact | null> {
    try {
        const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '')

        const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filterGroups: [{
                    filters: [{
                        propertyName: 'phone',
                        operator: 'CONTAINS_TOKEN',
                        value: normalizedPhone.slice(-10)  // Last 10 digits
                    }]
                }],
                properties: ['email', 'firstname', 'lastname', 'phone', 'company'],
                limit: 1
            })
        })

        if (!response.ok) return null

        const data = await response.json()
        if (!data.results?.length) return null

        const contact = data.results[0]
        return {
            id: contact.id,
            email: contact.properties.email,
            firstName: contact.properties.firstname,
            lastName: contact.properties.lastname,
            phone: contact.properties.phone,
            company: contact.properties.company
        }
    } catch (err) {
        logger.error('HubSpot contact search failed', err as Error)
        return null
    }
}

/**
 * Get associated company for a contact
 */
export async function getContactCompany(
    accessToken: string,
    contactId: string
): Promise<{ id: string; name: string } | null> {
    try {
        const response = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}/associations/companies`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        )

        if (!response.ok) return null

        const data = await response.json()
        if (!data.results?.length) return null

        const companyId = data.results[0].id

        // Get company details
        const companyResponse = await fetch(
            `${HUBSPOT_API_BASE}/crm/v3/objects/companies/${companyId}?properties=name`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        )

        if (!companyResponse.ok) return null

        const company = await companyResponse.json()
        return {
            id: company.id,
            name: company.properties.name
        }
    } catch {
        return null
    }
}

// =============================================================================
// ENGAGEMENT CREATION (Evidence Bundle Links)
// =============================================================================

export interface CreateEngagementParams {
    accessToken: string
    contactIds: string[]
    companyIds?: string[]
    dealIds?: string[]
    subject: string
    body: string  // Should contain evidence bundle URL
    timestamp?: Date
}

/**
 * Create a note engagement with evidence bundle link
 * Per ARCH_DOCS: Only push immutable evidence bundle URLs, not raw content
 */
export async function createNoteEngagement(params: CreateEngagementParams): Promise<{
    success: boolean
    engagementId?: string
    error?: string
}> {
    try {
        const response = await fetch(`${HUBSPOT_API_BASE}/engagements/v1/engagements`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${params.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                engagement: {
                    active: true,
                    type: 'NOTE',
                    timestamp: (params.timestamp || new Date()).getTime()
                },
                associations: {
                    contactIds: params.contactIds.map(id => parseInt(id, 10)),
                    companyIds: params.companyIds?.map(id => parseInt(id, 10)) || [],
                    dealIds: params.dealIds?.map(id => parseInt(id, 10)) || []
                },
                metadata: {
                    body: params.body
                }
            })
        })

        if (!response.ok) {
            const error = await response.text()
            logger.error('HubSpot engagement creation failed', undefined, { error })
            return { success: false, error: 'Failed to create note' }
        }

        const data = await response.json()
        return { success: true, engagementId: String(data.engagement.id) }
    } catch (err) {
        logger.error('HubSpot engagement error', err as Error)
        return { success: false, error: 'Engagement creation failed' }
    }
}

// =============================================================================
// HUBSPOT SERVICE CLASS
// =============================================================================

export class HubSpotService {
    private crmService: CRMService

    constructor() {
        this.crmService = new CRMService()
    }

    /**
     * Get valid access token (refreshing if needed)
     */
    async getAccessToken(integrationId: string): Promise<string | null> {
        // Check if refresh needed
        if (await this.crmService.needsRefresh(integrationId)) {
            const tokens = await this.crmService.getTokens(integrationId)
            if (!tokens?.refresh_token) return null

            const refreshResult = await refreshTokens(tokens.refresh_token)
            if (!refreshResult.success || !refreshResult.tokens) return null

            await this.crmService.updateTokens(integrationId, refreshResult.tokens)
            return refreshResult.tokens.access_token
        }

        const tokens = await this.crmService.getTokens(integrationId)
        return tokens?.access_token || null
    }

    /**
     * Push evidence bundle link to HubSpot
     * Creates a note engagement with the export bundle URL
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
        if (!this.crmService.checkRateLimit('hubspot')) {
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

        const accessToken = await this.getAccessToken(integrationId)
        if (!accessToken) {
            return { success: false, error: 'Unable to get access token' }
        }

        // Find contact by phone
        const contact = await findContactByPhone(accessToken, callPhoneNumber)
        if (!contact) {
            // Log but don't fail - contact may not exist
            logger.info('No HubSpot contact found for phone', { phone: '[REDACTED]' })
            return { success: false, error: 'No matching contact found' }
        }

        // Get company if associated
        const company = await getContactCompany(accessToken, contact.id)

        // Link call to CRM objects
        await this.crmService.linkCallToObject(
            integration.organization_id,
            integrationId,
            callId,
            { type: 'contact', id: contact.id, name: `${contact.firstName} ${contact.lastName}`.trim() },
            'outbound'
        )

        if (company) {
            await this.crmService.linkCallToObject(
                integration.organization_id,
                integrationId,
                callId,
                { type: 'company', id: company.id, name: company.name },
                'outbound'
            )
        }

        // Create engagement with evidence bundle link
        const noteBody = `📞 Call Recording & Transcript\n\nDate: ${callDate.toLocaleString()}\n\n📎 Access full call evidence:\n${exportBundleUrl}\n\n---\nSynced from Word Is Bond`

        const result = await createNoteEngagement({
            accessToken,
            contactIds: [contact.id],
            companyIds: company ? [company.id] : undefined,
            subject: `Call on ${callDate.toLocaleDateString()}`,
            body: noteBody,
            timestamp: callDate
        })

        // Log the operation
        await this.crmService.logSyncOperation({
            organizationId: integration.organization_id,
            integrationId,
            operation: 'push_evidence',
            status: result.success ? 'success' : 'failed',
            callId,
            idempotencyKey,
            requestSummary: { contactId: contact.id, phone: '[REDACTED]' },
            responseSummary: result.success ? { engagementId: result.engagementId } : undefined,
            errorDetails: result.error ? { message: result.error } : undefined,
            triggeredBy: userId ? 'user' : 'system',
            triggeredByUserId: userId
        })

        return result
    }
}

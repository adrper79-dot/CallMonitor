/**
 * CRM Integration Types - API Contract
 * 
 * Per ARCH_DOCS: CRMs are NON-AUTHORITATIVE
 */

export type CRMProvider = 'hubspot' | 'salesforce' | 'zoho' | 'pipedrive'
export type IntegrationStatus = 'pending' | 'active' | 'disconnected' | 'error' | 'expired'

export interface Integration {
    id: string
    provider: CRMProvider
    provider_account_name: string | null
    status: IntegrationStatus
    sync_enabled: boolean
    connected_at: string | null
    error_message: string | null
}

export interface IntegrationsListResponse {
    success: boolean
    integrations: Integration[]
}

export interface IntegrationActionResponse {
    success: boolean
    message?: string
    error?: string
}

// Sync request
export interface SyncCallRequest {
    callId: string
    exportBundleId?: string
}

// CRM Object Links
export type CRMObjectType = 'contact' | 'company' | 'deal' | 'lead' | 'account' | 'opportunity'

export interface CRMObjectLink {
    id: string
    crm_object_type: CRMObjectType
    crm_object_id: string
    crm_object_name: string | null
    crm_object_url: string | null
    synced_at: string | null
}

export interface CallCRMLinks {
    call_id: string
    links: CRMObjectLink[]
}

// Sync Log Entry (read-only for UI)
export interface SyncLogEntry {
    id: string
    operation: string
    status: 'pending' | 'success' | 'failed' | 'rate_limited' | 'skipped'
    call_id: string | null
    started_at: string
    completed_at: string | null
    error_details: Record<string, unknown> | null
}

// Environment configuration (for settings UI)
export interface CRMProviderConfig {
    provider: CRMProvider
    displayName: string
    logo: string
    description: string
    scopes: string[]
    isConfigured: boolean  // Are env vars set?
}

export const CRM_PROVIDERS: CRMProviderConfig[] = [
    {
        provider: 'hubspot',
        displayName: 'HubSpot',
        logo: '/logos/hubspot.svg',
        description: 'Sync call evidence to HubSpot contacts and companies',
        scopes: ['crm.objects.contacts.read', 'crm.objects.companies.read'],
        isConfigured: typeof process !== 'undefined' && !!process.env?.HUBSPOT_CLIENT_ID
    },
    {
        provider: 'salesforce',
        displayName: 'Salesforce',
        logo: '/logos/salesforce.svg',
        description: 'Sync call evidence to Salesforce contacts and accounts',
        scopes: ['api', 'refresh_token'],
        isConfigured: typeof process !== 'undefined' && !!process.env?.SALESFORCE_CLIENT_ID
    }
]

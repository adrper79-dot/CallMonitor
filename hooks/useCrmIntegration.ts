'use client'

import useSWR from 'swr'
import { apiGet, apiDelete, apiPut, apiPost } from '@/lib/apiClient'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CrmIntegration {
  id: string
  provider: 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho'
  status: 'connected' | 'disconnected' | 'error' | 'syncing'
  organization_id: string
  config: Record<string, unknown>
  field_mappings: FieldMapping[]
  last_sync_at: string | null
  last_sync_status: 'success' | 'partial' | 'failed' | null
  sync_frequency: 'realtime' | '15min' | '1hour' | '6hour' | 'daily' | 'manual'
  created_at: string
  updated_at: string
}

export interface FieldMapping {
  wib_field: string
  crm_field: string
  direction: 'to_crm' | 'from_crm' | 'bidirectional'
}

export interface CrmSyncLogEntry {
  id: string
  integration_id: string
  status: 'success' | 'partial' | 'failed'
  records_synced: number
  records_failed: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface CrmObjectLink {
  id: string
  integration_id: string
  wib_entity_type: string
  wib_entity_id: string
  crm_object_type: string
  crm_object_id: string
  last_synced_at: string
}

// ─── SWR Hooks ───────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiGet(url)

export function useCrmIntegrations() {
  const { data, error, isLoading, mutate } = useSWR<CrmIntegration[]>(
    '/api/crm/integrations',
    async (url) => {
      const res = await fetcher(url)
      const integrations = (res as any).integrations || []
      return integrations.map((item: any) => ({
        id: item.id,
        provider: item.provider,
        status:
          item.status === 'active'
            ? 'connected'
            : item.status === 'syncing'
              ? 'syncing'
              : item.status === 'error'
                ? 'error'
                : 'disconnected',
        organization_id: item.organization_id,
        config: item.settings || {},
        field_mappings: (item.settings?.field_mappings || []) as FieldMapping[],
        last_sync_at: item.last_sync_at || null,
        last_sync_status: item.last_sync_status || null,
        sync_frequency: item.sync_frequency || 'manual',
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))
    },
    { revalidateOnFocus: false }
  )

  return {
    integrations: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useCrmIntegration(id: string) {
  const { data, error, isLoading, mutate } = useSWR<CrmIntegration>(
    id ? `/api/crm/integrations/${id}` : null,
    async (url) => {
      const res = await fetcher(url)
      const item = (res as any).integration
      if (!item) return null as any
      return {
        id: item.id,
        provider: item.provider,
        status:
          item.status === 'active'
            ? 'connected'
            : item.status === 'syncing'
              ? 'syncing'
              : item.status === 'error'
                ? 'error'
                : 'disconnected',
        organization_id: item.organization_id,
        config: item.settings || {},
        field_mappings: (item.settings?.field_mappings || []) as FieldMapping[],
        last_sync_at: item.last_sync_at || null,
        last_sync_status: item.last_sync_status || null,
        sync_frequency: item.sync_frequency || 'manual',
        created_at: item.created_at,
        updated_at: item.updated_at,
      }
    },
    { revalidateOnFocus: false }
  )

  return {
    integration: data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useCrmSyncLog(integrationId?: string) {
  const key = integrationId ? `/api/crm/sync-log?integration_id=${integrationId}` : null

  const { data, error, isLoading, mutate } = useSWR<CrmSyncLogEntry[]>(
    key,
    async (url) => {
      const res = await fetcher(url)
      return (res as any).sync_log || []
    },
    { revalidateOnFocus: false, refreshInterval: 30_000 }
  )

  return {
    syncLog: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useCrmObjectLinks(integrationId: string) {
  const { data, error, isLoading, mutate } = useSWR<CrmObjectLink[]>(
    integrationId ? `/api/crm/objects?integration_id=${integrationId}` : null,
    async (url) => {
      const res = await fetcher(url)
      return (res as any).objects || []
    },
    { revalidateOnFocus: false }
  )

  return {
    objectLinks: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

// ─── Action Functions ────────────────────────────────────────────────────────

export async function connectCrm(
  provider: string,
  config: Record<string, unknown>
) {
  const res = await apiPost('/api/crm/integrations', { provider, settings: config })
  return (res as any).integration as CrmIntegration
}

export async function disconnectCrm(id: string) {
  await apiDelete(`/api/crm/integrations/${id}`)
}

export async function triggerSync(id: string) {
  if (id === 'quickbooks') {
    const res = await apiPost('/api/quickbooks/invoices/sync', {})
    return { status: 'accepted', message: (res as any).message || 'QuickBooks sync triggered' }
  }
  if (id === 'google_workspace') {
    const res = await apiPost('/api/google-workspace/contacts/sync', {})
    return { status: 'accepted', message: (res as any).message || 'Google Workspace sync triggered' }
  }
  return { status: 'not_supported', message: 'Manual CRM sync endpoint is not available for this provider' }
}

export async function updateFieldMappings(
  id: string,
  mappings: FieldMapping[]
) {
  const res = await apiPut(`/api/crm/integrations/${id}`, {
    settings: { field_mappings: mappings },
  })
  return (res as any).integration as CrmIntegration
}

export async function getCrmFields(provider: string, objectType?: string) {
  const params = objectType ? `?object_type=${objectType}` : ''
  const res = await apiGet(`/api/crm/objects${params}`)
  const objects = (res as any).objects || []
  const unique = new Map<string, { name: string; label: string; type: string }>()
  for (const item of objects) {
    const name = item.crm_object_type || 'object'
    if (!unique.has(name)) {
      unique.set(name, { name, label: name, type: provider })
    }
  }
  return [...unique.values()]
}

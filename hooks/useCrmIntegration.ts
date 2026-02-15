'use client'

import useSWR from 'swr'
import { apiGet, apiPost, apiDelete } from '@/lib/apiClient'

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

const fetcher = (url: string) => apiGet(url).then((res) => res.data)

export function useCrmIntegrations() {
  const { data, error, isLoading, mutate } = useSWR<CrmIntegration[]>(
    '/integrations/crm',
    fetcher,
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
    id ? `/integrations/crm/${id}` : null,
    fetcher,
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
  const key = integrationId
    ? `/integrations/crm/${integrationId}/sync-log`
    : null

  const { data, error, isLoading, mutate } = useSWR<CrmSyncLogEntry[]>(
    key,
    fetcher,
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
    integrationId ? `/integrations/crm/${integrationId}/object-links` : null,
    fetcher,
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
  const res = await apiPost('/integrations/crm', { provider, config })
  return res.data as CrmIntegration
}

export async function disconnectCrm(id: string) {
  await apiDelete(`/integrations/crm/${id}`)
}

export async function triggerSync(id: string) {
  const res = await apiPost(`/integrations/crm/${id}/sync`, {})
  return res.data as { status: string; message: string }
}

export async function updateFieldMappings(
  id: string,
  mappings: FieldMapping[]
) {
  const res = await apiPost(`/integrations/crm/${id}/field-mappings`, {
    mappings,
  })
  return res.data as CrmIntegration
}

export async function getCrmFields(provider: string, objectType?: string) {
  const params = objectType ? `?object_type=${objectType}` : ''
  const res = await apiGet(`/integrations/crm/fields/${provider}${params}`)
  return res.data as { name: string; label: string; type: string }[]
}

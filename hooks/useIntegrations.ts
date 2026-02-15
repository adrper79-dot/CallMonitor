'use client'

import useSWR from 'swr'
import { apiGet, apiPost, apiDelete } from '@/lib/apiClient'

// ─── Types ───────────────────────────────────────────────────────────────────

export type IntegrationCategory =
  | 'crm'
  | 'notifications'
  | 'billing'
  | 'calendar'
  | 'helpdesk'
  | 'webhooks'

export type IntegrationProvider =
  // CRM
  | 'hubspot'
  | 'salesforce'
  | 'pipedrive'
  | 'zoho'
  // Notifications
  | 'slack'
  | 'teams'
  // Billing
  | 'quickbooks'
  // Calendar
  | 'google_workspace'
  // Helpdesk
  | 'zendesk'
  | 'freshdesk'
  // Webhooks
  | 'zapier'
  | 'make'
  | 'custom_webhook'

export interface Integration {
  id: string
  provider: IntegrationProvider
  category: IntegrationCategory
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  display_name: string
  description: string
  icon_url: string | null
  config: Record<string, unknown>
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface NotificationChannel {
  id: string
  provider: 'slack' | 'teams'
  channel_name: string
  channel_id: string
  events: string[]
  enabled: boolean
  created_at: string
}

export interface WebhookSubscription {
  id: string
  name: string
  url: string
  events: string[]
  secret: string | null
  active: boolean
  last_triggered_at: string | null
  last_status_code: number | null
  created_at: string
  updated_at: string
}

// ─── SWR Hooks ───────────────────────────────────────────────────────────────

const fetcher = (url: string) => apiGet(url).then((res) => res.data)

export function useIntegrations(category?: IntegrationCategory) {
  const params = category ? `?category=${category}` : ''
  const { data, error, isLoading, mutate } = useSWR<Integration[]>(
    `/integrations${params}`,
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

export function useIntegrationStatus(provider: string) {
  const { data, error, isLoading, mutate } = useSWR<{
    provider: string
    status: 'connected' | 'disconnected' | 'error' | 'pending'
    last_sync_at: string | null
    details: Record<string, unknown>
  }>(
    provider ? `/integrations/status/${provider}` : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60_000 }
  )

  return {
    status: data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useNotificationChannels() {
  const { data, error, isLoading, mutate } = useSWR<NotificationChannel[]>(
    '/integrations/notification-channels',
    fetcher,
    { revalidateOnFocus: false }
  )

  return {
    channels: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useWebhookSubscriptions() {
  const { data, error, isLoading, mutate } = useSWR<WebhookSubscription[]>(
    '/integrations/webhooks',
    fetcher,
    { revalidateOnFocus: false }
  )

  return {
    webhooks: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

// ─── Action Functions ────────────────────────────────────────────────────────

export async function connectIntegration(
  provider: IntegrationProvider,
  config: Record<string, unknown>
) {
  const res = await apiPost('/integrations/connect', { provider, config })
  return res.data as Integration
}

export async function disconnectIntegration(id: string) {
  await apiDelete(`/integrations/${id}`)
}

export async function addNotificationChannel(channel: {
  provider: 'slack' | 'teams'
  channel_name: string
  channel_id: string
  events: string[]
}) {
  const res = await apiPost('/integrations/notification-channels', channel)
  return res.data as NotificationChannel
}

export async function removeNotificationChannel(id: string) {
  await apiDelete(`/integrations/notification-channels/${id}`)
}

export async function createWebhookSubscription(webhook: {
  name: string
  url: string
  events: string[]
}) {
  const res = await apiPost('/integrations/webhooks', webhook)
  return res.data as WebhookSubscription
}

export async function deleteWebhookSubscription(id: string) {
  await apiDelete(`/integrations/webhooks/${id}`)
}

export async function testWebhook(id: string) {
  const res = await apiPost(`/integrations/webhooks/${id}/test`, {})
  return res.data as { success: boolean; status_code: number }
}

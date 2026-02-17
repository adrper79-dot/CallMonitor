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
  | 'outlook'
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

async function fetchIntegrations(category?: IntegrationCategory): Promise<Integration[]> {
  if (category === 'notifications') {
    const res = await apiGet<{ channels?: Array<{ provider: 'slack' | 'teams'; created_at?: string; updated_at?: string }> }>(
      '/api/notifications/channels'
    )
    const channels = res.channels || []
    const byProvider = new Map<'slack' | 'teams', { created_at?: string; updated_at?: string }>()
    for (const ch of channels) {
      if (!byProvider.has(ch.provider)) {
        byProvider.set(ch.provider, { created_at: ch.created_at, updated_at: ch.updated_at })
      }
    }
    return ['slack', 'teams'].map((provider) => {
      const found = byProvider.get(provider as 'slack' | 'teams')
      return {
        id: provider,
        provider: provider as IntegrationProvider,
        category: 'notifications',
        status: found ? 'connected' : 'disconnected',
        display_name: provider === 'slack' ? 'Slack' : 'Microsoft Teams',
        description: 'Notification channel integration',
        icon_url: null,
        config: {},
        last_sync_at: null,
        created_at: found?.created_at || new Date(0).toISOString(),
        updated_at: found?.updated_at || new Date(0).toISOString(),
      }
    })
  }

  if (category === 'billing') {
    const res = await apiGet<{ connected?: boolean; integration?: { connected_at?: string; updated_at?: string } }>('/api/quickbooks/status')
    const connected = !!res.connected
    return [
      {
        id: 'quickbooks',
        provider: 'quickbooks',
        category: 'billing',
        status: connected ? 'connected' : 'disconnected',
        display_name: 'QuickBooks',
        description: 'Invoice sync and billing automation',
        icon_url: null,
        config: {},
        last_sync_at: null,
        created_at: res.integration?.connected_at || new Date(0).toISOString(),
        updated_at: res.integration?.updated_at || new Date(0).toISOString(),
      },
    ]
  }

  if (category === 'calendar') {
    const [googleRes, outlookRes] = await Promise.allSettled([
      apiGet<{ connected?: boolean; integration?: { connected_at?: string; updated_at?: string } }>('/api/google-workspace/status'),
      apiGet<{ connected?: boolean; integration?: { connected_at?: string; updated_at?: string } }>('/api/outlook/status'),
    ])

    const google = googleRes.status === 'fulfilled' ? googleRes.value : { connected: false, integration: null }
    const outlook = outlookRes.status === 'fulfilled' ? outlookRes.value : { connected: false, integration: null }

    return [
      {
        id: 'google_workspace',
        provider: 'google_workspace',
        category: 'calendar',
        status: google.connected ? 'connected' : 'disconnected',
        display_name: 'Google Workspace (Gmail)',
        description: 'Gmail, calendar, and contacts sync',
        icon_url: null,
        config: {},
        last_sync_at: null,
        created_at: google.integration?.connected_at || new Date(0).toISOString(),
        updated_at: google.integration?.updated_at || new Date(0).toISOString(),
      },
      {
        id: 'outlook',
        provider: 'outlook',
        category: 'calendar',
        status: outlook.connected ? 'connected' : 'disconnected',
        display_name: 'Outlook (Microsoft 365)',
        description: 'Outlook mail and calendar sync',
        icon_url: null,
        config: {},
        last_sync_at: null,
        created_at: outlook.integration?.connected_at || new Date(0).toISOString(),
        updated_at: outlook.integration?.updated_at || new Date(0).toISOString(),
      },
    ]
  }

  if (category === 'helpdesk') {
    const res = await apiGet<{ connected?: boolean; integration?: { provider?: 'zendesk' | 'freshdesk'; connected_at?: string; updated_at?: string } }>('/api/helpdesk/status')
    const provider = (res.integration?.provider || 'zendesk') as 'zendesk' | 'freshdesk'
    return [
      {
        id: provider,
        provider,
        category: 'helpdesk',
        status: res.connected ? 'connected' : 'disconnected',
        display_name: provider === 'zendesk' ? 'Zendesk' : 'Freshdesk',
        description: 'Helpdesk integration',
        icon_url: null,
        config: {},
        last_sync_at: null,
        created_at: res.integration?.connected_at || new Date(0).toISOString(),
        updated_at: res.integration?.updated_at || new Date(0).toISOString(),
      },
    ]
  }

  const crmRes = await apiGet<{ integrations?: Array<any> }>('/api/crm/integrations')
  const crm = crmRes.integrations || []
  return crm.map((item) => ({
    id: item.id,
    provider: item.provider as IntegrationProvider,
    category: 'crm' as const,
    status:
      item.status === 'active'
        ? 'connected'
        : item.status === 'syncing'
          ? 'pending'
          : item.status === 'error'
            ? 'error'
            : 'disconnected',
    display_name: item.provider_account_name || item.provider,
    description: 'CRM integration',
    icon_url: null,
    config: item.settings || {},
    last_sync_at: item.last_sync_at || null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }))
}

const fetcher = (url: string) => apiGet(url)

export function useIntegrations(category?: IntegrationCategory) {
  const { data, error, isLoading, mutate } = useSWR<Integration[]>(
    ['integrations', category || 'crm'],
    ([, c]) => fetchIntegrations(c as IntegrationCategory),
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
  }>(provider ? (['integration-status', provider] as const) : null, async (key) => {
    const p = key[1] as string
    const integrations = await fetchIntegrations(undefined)
    const match = integrations.find((item) => item.provider === p)
    return {
      provider: p,
      status: (match?.status || 'disconnected') as 'connected' | 'disconnected' | 'error' | 'pending',
      last_sync_at: match?.last_sync_at || null,
      details: {},
    }
  }, { revalidateOnFocus: false, refreshInterval: 60_000 })

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
    '/api/notifications/channels',
    async (url) => {
      const res = await fetcher(url)
      const channels = (res as any).channels || []
      return channels.map((channel: any) => ({
        id: channel.id,
        provider: channel.provider,
        channel_name: channel.name,
        channel_id: channel.webhook_url,
        events: channel.events || [],
        enabled: channel.is_active !== false,
        created_at: channel.created_at,
      }))
    },
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
    '/api/webhooks/subscriptions',
    async (url) => {
      const res = await fetcher(url)
      return ((res as any).subscriptions || (res as any).webhooks || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        url: item.url,
        events: item.events || [],
        secret: item.secret || null,
        active: item.is_active !== false,
        last_triggered_at: item.last_triggered_at || null,
        last_status_code: item.last_status_code || null,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))
    },
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
  if (['hubspot', 'salesforce', 'pipedrive', 'zoho'].includes(provider)) {
    const res = await apiPost<{ integration: any }>('/api/crm/integrations', {
      provider,
      settings: config,
    })
    const item = (res as any).integration
    return {
      id: item.id,
      provider: item.provider,
      category: 'crm',
      status: item.status === 'active' ? 'connected' : 'pending',
      display_name: item.provider_account_name || item.provider,
      description: 'CRM integration',
      icon_url: null,
      config: item.settings || {},
      last_sync_at: item.last_sync_at || null,
      created_at: item.created_at,
      updated_at: item.updated_at,
    } as Integration
  }

  if (provider === 'quickbooks') {
    const res = await apiPost<{ success?: boolean; authUrl?: string }>('/api/quickbooks/connect', {
      state: (config.state as string) || undefined,
    })
    return {
      id: 'quickbooks',
      provider: 'quickbooks',
      category: 'billing',
      status: res.authUrl ? 'pending' : 'connected',
      display_name: 'QuickBooks',
      description: 'Invoice sync and billing automation',
      icon_url: null,
      config: {},
      authUrl: res.authUrl,
      last_sync_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  if (provider === 'google_workspace') {
    const res = await apiPost<{ success?: boolean; authUrl?: string }>('/api/google-workspace/connect', {
      state: (config.state as string) || undefined,
    })
    return {
      id: 'google_workspace',
      provider: 'google_workspace',
      category: 'calendar',
      status: res.authUrl ? 'pending' : 'connected',
      display_name: 'Google Workspace',
      description: 'Calendar and contacts sync',
      icon_url: null,
      config: {},
      authUrl: res.authUrl,
      last_sync_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  if (provider === 'outlook') {
    const res = await apiPost<{ success?: boolean; authUrl?: string }>('/api/outlook/connect', {
      state: (config.state as string) || undefined,
    })
    return {
      id: 'outlook',
      provider: 'outlook',
      category: 'calendar',
      status: res.authUrl ? 'pending' : 'connected',
      display_name: 'Outlook',
      description: 'Mail and calendar sync',
      icon_url: null,
      config: {},
      authUrl: res.authUrl,
      last_sync_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  if (provider === 'zendesk' || provider === 'freshdesk') {
    await apiPost('/api/helpdesk/connect', {
      provider,
      config,
    })
    return {
      id: provider,
      provider,
      category: 'helpdesk',
      status: 'connected',
      display_name: provider === 'zendesk' ? 'Zendesk' : 'Freshdesk',
      description: 'Helpdesk integration',
      icon_url: null,
      config,
      last_sync_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  throw new Error(`Provider ${provider} is not supported by this connect flow`)
}

export async function disconnectIntegration(id: string) {
  if (id === 'quickbooks') {
    await apiPost('/api/quickbooks/disconnect', {})
    return
  }
  if (id === 'google_workspace') {
    await apiPost('/api/google-workspace/disconnect', {})
    return
  }
  if (id === 'outlook') {
    await apiPost('/api/outlook/disconnect', {})
    return
  }
  if (id === 'zendesk' || id === 'freshdesk') {
    await apiPost('/api/helpdesk/disconnect', {})
    return
  }
  await apiDelete(`/api/crm/integrations/${id}`)
}

export async function addNotificationChannel(channel: {
  provider: 'slack' | 'teams'
  channel_name: string
  channel_id: string
  events: string[]
}) {
  const res = await apiPost<{ channel: any }>('/api/notifications/channels', {
    provider: channel.provider,
    name: channel.channel_name,
    webhook_url: channel.channel_id,
    events: channel.events,
    is_active: true,
  })
  const created = (res as any).channel
  return {
    id: created.id,
    provider: created.provider,
    channel_name: created.name,
    channel_id: created.webhook_url,
    events: created.events || [],
    enabled: created.is_active !== false,
    created_at: created.created_at,
  }
}

export async function removeNotificationChannel(id: string) {
  await apiDelete(`/api/notifications/channels/${id}`)
}

export async function createWebhookSubscription(webhook: {
  name: string
  url: string
  events: string[]
}) {
  const res = await apiPost<{ subscription: any }>('/api/webhooks/subscriptions', {
    url: webhook.url,
    events: webhook.events,
    description: webhook.name,
  })
  const subscription = (res as any).subscription || (res as any).webhook
  return {
    id: subscription.id,
    name: subscription.name || subscription.description || webhook.name,
    url: subscription.url,
    events: subscription.events || [],
    secret: subscription.secret || null,
    active: subscription.is_active !== false,
    last_triggered_at: subscription.last_triggered_at || null,
    last_status_code: subscription.last_status_code || null,
    created_at: subscription.created_at,
    updated_at: subscription.updated_at,
  }
}

export async function deleteWebhookSubscription(id: string) {
  await apiDelete(`/api/webhooks/subscriptions/${id}`)
}

export async function testWebhook(id: string) {
  const res = await apiPost(`/api/webhooks/subscriptions/${id}/test`, {})
  return {
    success: (res as any).success === true,
    status_code: (res as any).status_code || 200,
  }
}

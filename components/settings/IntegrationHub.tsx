'use client'

import { useState, useCallback } from 'react'
import {
  Settings,
  RefreshCw,
  Link2,
  Unlink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  TestTube2,
  Webhook,
  Send,
  Calendar,
  CreditCard,
  Headphones,
  Bell,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  useIntegrations,
  useNotificationChannels,
  useWebhookSubscriptions,
  connectIntegration,
  disconnectIntegration,
  addNotificationChannel,
  removeNotificationChannel,
  createWebhookSubscription,
  deleteWebhookSubscription,
  testWebhook,
  type IntegrationProvider,
  type IntegrationCategory,
} from '@/hooks/useIntegrations'
import { triggerSync } from '@/hooks/useCrmIntegration'

// ─── Tab Definitions ─────────────────────────────────────────────────────────

const TABS: { id: IntegrationCategory | 'all'; label: string; icon: React.ReactNode }[] = [
  { id: 'crm', label: 'CRM', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar className="h-4 w-4" /> },
  { id: 'helpdesk', label: 'Helpdesk', icon: <Headphones className="h-4 w-4" /> },
  { id: 'webhooks', label: 'Webhooks', icon: <Webhook className="h-4 w-4" /> },
]

// ─── Provider Metadata ───────────────────────────────────────────────────────

interface ProviderMeta {
  provider: IntegrationProvider
  name: string
  description: string
  category: IntegrationCategory
  color: string
}

const PROVIDERS: ProviderMeta[] = [
  { provider: 'hubspot', name: 'HubSpot', description: 'Sync contacts, deals, and activities', category: 'crm', color: 'bg-orange-500' },
  { provider: 'salesforce', name: 'Salesforce', description: 'Enterprise CRM with full object sync', category: 'crm', color: 'bg-blue-500' },
  { provider: 'pipedrive', name: 'Pipedrive', description: 'Sales pipeline and deal management', category: 'crm', color: 'bg-green-500' },
  { provider: 'zoho', name: 'Zoho CRM', description: 'Complete CRM suite integration', category: 'crm', color: 'bg-red-500' },
  { provider: 'slack', name: 'Slack', description: 'Real-time call notifications and alerts', category: 'notifications', color: 'bg-purple-500' },
  { provider: 'teams', name: 'Microsoft Teams', description: 'Team notifications and call summaries', category: 'notifications', color: 'bg-indigo-500' },
  { provider: 'quickbooks', name: 'QuickBooks', description: 'Invoice sync and billing automation', category: 'billing', color: 'bg-emerald-500' },
  { provider: 'google_workspace', name: 'Google Workspace', description: 'Calendar, contacts, and Gmail sync', category: 'calendar', color: 'bg-yellow-500' },
  { provider: 'zendesk', name: 'Zendesk', description: 'Ticket creation from call outcomes', category: 'helpdesk', color: 'bg-teal-500' },
  { provider: 'freshdesk', name: 'Freshdesk', description: 'Support ticket and knowledge base sync', category: 'helpdesk', color: 'bg-cyan-500' },
]

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'connected':
      return (
        <Badge variant="default" className="bg-green-600 dark:bg-green-700 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Connected
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="error" className="gap-1">
          <XCircle className="h-3 w-3" /> Error
        </Badge>
      )
    case 'pending':
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> Pending
        </Badge>
      )
    default:
      return (
        <Badge variant="default" className="gap-1 text-muted-foreground">
          <Unlink className="h-3 w-3" /> Disconnected
        </Badge>
      )
  }
}

// ─── Integration Card ────────────────────────────────────────────────────────

function IntegrationCard({
  meta,
  status,
  integrationId,
  lastSyncAt,
  onConnect,
  onDisconnect,
  onSync,
  onSettings,
}: {
  meta: ProviderMeta
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  integrationId?: string
  lastSyncAt?: string | null
  onConnect: () => void
  onDisconnect: () => void
  onSync: () => void
  onSettings: () => void
}) {
  const isConnected = status === 'connected'

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20">
      <div className={`absolute top-0 left-0 h-1 w-full ${meta.color}`} />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.color} text-white font-bold text-sm`}>
              {meta.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-base">{meta.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{meta.description}</CardDescription>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {lastSyncAt && (
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last sync: {new Date(lastSyncAt).toLocaleString()}
          </p>
        )}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Button size="sm" variant="outline" onClick={onSync} className="gap-1">
                <RefreshCw className="h-3 w-3" /> Sync Now
              </Button>
              <Button size="sm" variant="ghost" onClick={onSettings}>
                <Settings className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDisconnect}>
                <Unlink className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onConnect} className="gap-1">
              <Link2 className="h-3 w-3" /> Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Connect Dialog ──────────────────────────────────────────────────────────

function ConnectDialog({
  provider,
  open,
  onOpenChange,
  onConnected,
}: {
  provider: ProviderMeta | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected: () => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [instanceUrl, setInstanceUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    if (!provider) return
    setLoading(true)
    try {
      await connectIntegration(provider.provider, {
        api_key: apiKey,
        instance_url: instanceUrl || undefined,
      })
      onConnected()
      onOpenChange(false)
      setApiKey('')
      setInstanceUrl('')
    } catch {
      // Error handled by apiClient toast
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {provider?.name}</DialogTitle>
          <DialogDescription>
            Enter your API credentials to connect {provider?.name} with Word Is Bond.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          {(provider?.provider === 'salesforce' || provider?.provider === 'zoho') && (
            <div className="space-y-2">
              <Label htmlFor="instance-url">Instance URL</Label>
              <Input
                id="instance-url"
                placeholder="https://your-instance.salesforce.com"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConnect} disabled={!apiKey || loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Webhook Manager ─────────────────────────────────────────────────────────

function WebhookManager() {
  const { webhooks, isLoading, mutate } = useWebhookSubscriptions()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState('')
  const [testing, setTesting] = useState<string | null>(null)

  const handleCreate = async () => {
    try {
      await createWebhookSubscription({
        name,
        url,
        events: events.split(',').map((e) => e.trim()).filter(Boolean),
      })
      mutate()
      setShowAdd(false)
      setName('')
      setUrl('')
      setEvents('')
    } catch {
      // Error handled by apiClient
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhookSubscription(id)
      mutate()
    } catch {
      // Error handled by apiClient
    }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      await testWebhook(id)
      mutate()
    } catch {
      // Error handled by apiClient
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Webhook Subscriptions</h3>
          <p className="text-sm text-muted-foreground">
            Send events to Zapier, Make.com, or custom endpoints
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1">
          <Plus className="h-3 w-3" /> Add Webhook
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="wh-name">Name</Label>
              <Input id="wh-name" placeholder="My Zapier Webhook" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input id="wh-url" placeholder="https://hooks.zapier.com/..." value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-events">Events (comma-separated)</Label>
              <Input
                id="wh-events"
                placeholder="call.completed, call.recording.ready"
                value={events}
                onChange={(e) => setEvents(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!name || !url}>
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading webhooks...</p>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Webhook className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No webhook subscriptions configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <Card key={wh.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{wh.name}</p>
                    <Badge variant={wh.active ? 'default' : 'secondary'} className="text-xs">
                      {wh.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{wh.url}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Events: {wh.events.join(', ')}
                    {wh.last_triggered_at && (
                      <> · Last triggered: {new Date(wh.last_triggered_at).toLocaleString()}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTest(wh.id)}
                    disabled={testing === wh.id}
                  >
                    <TestTube2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(wh.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Notification Channels ───────────────────────────────────────────────────

function NotificationChannelManager() {
  const { channels, isLoading, mutate } = useNotificationChannels()
  const [showAdd, setShowAdd] = useState(false)
  const [provider, setProvider] = useState<'slack' | 'teams'>('slack')
  const [channelName, setChannelName] = useState('')
  const [channelId, setChannelId] = useState('')

  const handleAdd = async () => {
    try {
      await addNotificationChannel({
        provider,
        channel_name: channelName,
        channel_id: channelId,
        events: ['call.completed', 'call.missed', 'sentiment.alert'],
      })
      mutate()
      setShowAdd(false)
      setChannelName('')
      setChannelId('')
    } catch {
      // Error handled by apiClient
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await removeNotificationChannel(id)
      mutate()
    } catch {
      // Error handled by apiClient
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Notification Channels</h3>
          <p className="text-sm text-muted-foreground">
            Receive call alerts in Slack or Microsoft Teams
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1">
          <Plus className="h-3 w-3" /> Add Channel
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-4">
              <Label className="text-sm">Provider:</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={provider === 'slack' ? 'default' : 'outline'}
                  onClick={() => setProvider('slack')}
                >
                  Slack
                </Button>
                <Button
                  size="sm"
                  variant={provider === 'teams' ? 'default' : 'outline'}
                  onClick={() => setProvider('teams')}
                >
                  Teams
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-name">Channel Name</Label>
              <Input id="ch-name" placeholder="#call-alerts" value={channelName} onChange={(e) => setChannelName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-id">Channel / Webhook ID</Label>
              <Input id="ch-id" placeholder="C0123456789" value={channelId} onChange={(e) => setChannelId(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!channelName || !channelId}>
                Add Channel
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading channels...</p>
      ) : channels.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No notification channels configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <Card key={ch.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs capitalize">{ch.provider}</Badge>
                    <p className="font-medium text-sm">{ch.channel_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Events: {ch.events.join(', ')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleRemove(ch.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function IntegrationHub() {
  const [activeTab, setActiveTab] = useState<IntegrationCategory | 'all'>('crm')
  const { integrations, isLoading, mutate } = useIntegrations(
    activeTab === 'all' ? undefined : activeTab !== 'webhooks' ? activeTab : undefined
  )
  const [connectProvider, setConnectProvider] = useState<ProviderMeta | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)

  const getStatusForProvider = useCallback(
    (provider: IntegrationProvider) => {
      const match = integrations.find((i) => i.provider === provider)
      return {
        status: match?.status ?? 'disconnected' as const,
        id: match?.id,
        lastSyncAt: match?.last_sync_at,
      }
    },
    [integrations]
  )

  const handleConnect = (meta: ProviderMeta) => {
    setConnectProvider(meta)
    setConnectOpen(true)
  }

  const handleDisconnect = async (id: string) => {
    try {
      await disconnectIntegration(id)
      mutate()
    } catch {
      // Error handled by apiClient
    }
  }

  const handleSync = async (id: string) => {
    setSyncing(id)
    try {
      await triggerSync(id)
      mutate()
    } catch {
      // Error handled by apiClient
    } finally {
      setSyncing(null)
    }
  }

  const filteredProviders = PROVIDERS.filter(
    (p) => activeTab === 'all' || p.category === activeTab
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integration Hub</h2>
        <p className="text-muted-foreground">
          Connect Word Is Bond with your favorite tools and services
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground border border-b-0 border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'webhooks' ? (
        <WebhookManager />
      ) : activeTab === 'notifications' ? (
        <div className="space-y-6">
          <NotificationChannelManager />
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Available Providers</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredProviders.map((meta) => {
                const info = getStatusForProvider(meta.provider)
                return (
                  <IntegrationCard
                    key={meta.provider}
                    meta={meta}
                    status={info.status}
                    integrationId={info.id}
                    lastSyncAt={info.lastSyncAt}
                    onConnect={() => handleConnect(meta)}
                    onDisconnect={() => info.id && handleDisconnect(info.id)}
                    onSync={() => info.id && handleSync(info.id)}
                    onSettings={() => {}}
                  />
                )
              })}
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-3 w-40 rounded bg-muted" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-8 w-20 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProviders.map((meta) => {
            const info = getStatusForProvider(meta.provider)
            return (
              <IntegrationCard
                key={meta.provider}
                meta={meta}
                status={info.status}
                integrationId={info.id}
                lastSyncAt={info.lastSyncAt}
                onConnect={() => handleConnect(meta)}
                onDisconnect={() => info.id && handleDisconnect(info.id)}
                onSync={() => info.id && handleSync(info.id)}
                onSettings={() => {}}
              />
            )
          })}
        </div>
      )}

      {/* Connect Dialog */}
      <ConnectDialog
        provider={connectProvider}
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={() => mutate()}
      />
    </div>
  )
}

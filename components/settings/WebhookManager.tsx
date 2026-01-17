/**
 * Webhook Subscription Management Component
 * 
 * Allows admins to configure webhook endpoints for event notifications
 * Manages webhook subscriptions and event types
 * 
 * Features:
 * - List webhook subscriptions
 * - Add new webhook endpoints
 * - Edit webhook configuration
 * - Test webhook endpoints
 * - View delivery logs
 * - Enable/disable subscriptions
 * 
 * @module components/settings/WebhookManager
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Webhook, Plus, Trash2, TestTube2, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface WebhookSubscription {
  id: string
  url: string
  event_types: string[]
  is_active: boolean
  secret: string
  created_at: string
  last_triggered_at: string | null
  success_count: number
  failure_count: number
}

const availableEvents = [
  { value: 'call.created', label: 'Call Created' },
  { value: 'call.completed', label: 'Call Completed' },
  { value: 'call.updated', label: 'Call Updated' },
  { value: 'transcription.completed', label: 'Transcription Completed' },
  { value: 'campaign.started', label: 'Campaign Started' },
  { value: 'campaign.completed', label: 'Campaign Completed' },
  { value: 'report.generated', label: 'Report Generated' },
]

interface WebhookManagerProps {
  organizationId: string
}

export function WebhookManager({ organizationId }: WebhookManagerProps) {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    url: '',
    eventTypes: [] as string[],
  })

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/webhooks?orgId=${organizationId}`, {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data.webhooks || [])
      }
    } catch (error) {
      logger.error('Failed to fetch webhooks', error, { organizationId })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.url || formData.eventTypes.length === 0) return

    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          url: formData.url,
          eventTypes: formData.eventTypes,
        }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to create webhook')

      setFormData({ url: '', eventTypes: [] })
      setOpen(false)
      await fetchWebhooks()
    } catch (error) {
      logger.error('Failed to create webhook', error, { organizationId, url: formData.url })
    }
  }

  const handleToggle = async (webhookId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
        credentials: 'include'
      })

      if (res.ok) {
        await fetchWebhooks()
      }
    } catch (error) {
      logger.error('Failed to toggle webhook', error, { webhookId, isActive })
    }
  }

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return

    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        await fetchWebhooks()
      }
    } catch (error) {
      logger.error('Failed to delete webhook', error, { webhookId })
    }
  }

  const handleTest = async (webhookId: string) => {
    try {
      setTesting(webhookId)
      const res = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: 'POST',
        credentials: 'include'
      })

      if (res.ok) {
        alert('Test webhook sent successfully! Check your endpoint logs.')
      } else {
        alert('Failed to send test webhook. Please check the URL.')
      }
    } catch (error) {
      logger.error('Failed to test webhook', error, { webhookId })
      alert('Failed to send test webhook.')
    } finally {
      setTesting(null)
    }
  }

  const toggleEventType = (eventType: string) => {
    setFormData((prev) => {
      const eventTypes = prev.eventTypes.includes(eventType)
        ? prev.eventTypes.filter((e) => e !== eventType)
        : [...prev.eventTypes, eventType]
      return { ...prev, eventTypes }
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhook Subscriptions</CardTitle>
            <CardDescription>
              Configure endpoints to receive real-time event notifications
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Webhook Subscription</DialogTitle>
                <DialogDescription>
                  Add a new endpoint to receive event notifications
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://api.example.com/webhooks"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Event Types</Label>
                  <div className="space-y-2">
                    {availableEvents.map((event) => (
                      <div
                        key={event.value}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          id={event.value}
                          checked={formData.eventTypes.includes(event.value)}
                          onChange={() => toggleEventType(event.value)}
                        />
                        <label
                          htmlFor={event.value}
                          className="text-sm cursor-pointer"
                        >
                          {event.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.url || formData.eventTypes.length === 0}
                >
                  Create Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {webhooks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No webhook subscriptions configured</p>
            <p className="text-sm mt-1">
              Add a webhook to receive real-time event notifications
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {webhook.url}
                    </code>
                    {webhook.is_active ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="mr-1 h-3 w-3" />
                        Inactive
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {webhook.event_types.map((eventType) => (
                      <Badge key={eventType} variant="secondary" className="text-xs">
                        {eventType}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Created {formatDate(webhook.created_at)}</span>
                    <span>
                      Success: {webhook.success_count} | Failed:{' '}
                      {webhook.failure_count}
                    </span>
                    {webhook.last_triggered_at && (
                      <span>Last: {formatDate(webhook.last_triggered_at)}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(webhook.id)}
                    disabled={testing !== null}
                  >
                    {testing === webhook.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube2 className="h-4 w-4" />
                    )}
                  </Button>

                  <Switch
                    checked={webhook.is_active}
                    onCheckedChange={(checked) => handleToggle(webhook.id, checked)}
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(webhook.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

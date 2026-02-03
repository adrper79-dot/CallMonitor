"use client"

import React, { useState, useEffect } from 'react'
import { WebhookSubscription } from '@/types/tier1-features'
import { WebhookForm } from './WebhookForm'
import { WebhookDeliveryLog } from './WebhookDeliveryLog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

interface WebhookListProps {
  organizationId: string
  canEdit: boolean
}

/**
 * WebhookList Component - Professional Design System v3.0
 * 
 * Display all webhook subscriptions with actions
 */
export function WebhookList({ organizationId, canEdit }: WebhookListProps) {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookSubscription | null>(null)
  const [viewingLogs, setViewingLogs] = useState<{ id: string; name: string } | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  useEffect(() => {
    loadWebhooks()
  }, [organizationId])

  async function loadWebhooks() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/webhooks/subscriptions', {
        credentials: 'include'
      })

      if (!res.ok) {
        throw new Error('Failed to load webhooks')
      }

      const data = await res.json()
      setWebhooks(data.subscriptions || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(webhook: WebhookSubscription) {
    if (!canEdit) return

    try {
      const res = await fetch(`/api/webhooks/subscriptions/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ active: !webhook.active })
      })

      if (!res.ok) {
        throw new Error('Failed to update webhook')
      }

      await loadWebhooks()
    } catch (err: any) {
      alert(err.message || 'Failed to update webhook')
    }
  }

  async function deleteWebhook(id: string) {
    if (!canEdit) return

    const confirmed = confirm('Are you sure you want to delete this webhook? This action cannot be undone.')
    if (!confirmed) return

    try {
      setDeletingId(id)

      const res = await fetch(`/api/webhooks/subscriptions/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!res.ok) {
        throw new Error('Failed to delete webhook')
      }

      await loadWebhooks()
    } catch (err: any) {
      alert(err.message || 'Failed to delete webhook')
    } finally {
      setDeletingId(null)
    }
  }

  async function testWebhook(webhook: WebhookSubscription) {
    if (!canEdit) return

    try {
      setTestingId(webhook.id)

      const res = await fetch(`/api/webhooks/subscriptions/${webhook.id}/test`, {
        method: 'POST',
        credentials: 'include'
      })

      if (!res.ok) {
        throw new Error('Failed to send test webhook')
      }

      const data = await res.json()
      alert(`Test webhook sent! Check your endpoint for delivery.\n\nDelivery ID: ${data.delivery.id}`)
    } catch (err: any) {
      alert(err.message || 'Failed to send test webhook')
    } finally {
      setTestingId(null)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-500">Loading webhooks...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadWebhooks}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Webhook Subscriptions</h3>
            <p className="text-sm text-gray-500 mt-1">
              Receive real-time notifications when events occur
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => {
                setEditingWebhook(null)
                setShowForm(true)
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
            >
              Create Webhook
            </button>
          )}
        </div>

        {/* Empty State */}
        {webhooks.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No webhooks</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new webhook subscription.
            </p>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingWebhook(null)
                  setShowForm(true)
                }}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
              >
                Create Webhook
              </button>
            )}
          </div>
        ) : (
          /* Webhook Cards */
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
              >
                {/* Row 1: Name + Active Toggle + Menu */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="text-base font-semibold text-gray-900">{webhook.name}</h4>
                    {webhook.active ? (
                      <Badge variant="default" className="bg-green-100 text-green-700">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-gray-100 text-gray-700">
                        Inactive
                      </Badge>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={webhook.active}
                        onCheckedChange={() => toggleActive(webhook)}
                        aria-label="Toggle active"
                      />
                      <div className="relative">
                        <button
                          className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                          onClick={(e) => {
                            e.currentTarget.nextElementSibling?.classList.toggle('hidden')
                          }}
                        >
                          ⋮
                        </button>
                        <div className="hidden absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                          <button
                            onClick={() => {
                              setEditingWebhook(webhook)
                              setShowForm(true)
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => testWebhook(webhook)}
                            disabled={testingId === webhook.id}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          >
                            {testingId === webhook.id ? 'Sending...' : 'Test'}
                          </button>
                          <button
                            onClick={() => setViewingLogs({ id: webhook.id, name: webhook.name })}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            View Logs
                          </button>
                          <button
                            onClick={() => deleteWebhook(webhook.id)}
                            disabled={deletingId === webhook.id}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 border-t border-gray-200"
                          >
                            {deletingId === webhook.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Row 2: URL */}
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-gray-600 truncate flex-1" title={webhook.url}>
                      {webhook.url}
                    </code>
                    <button
                      onClick={() => copyToClipboard(webhook.url)}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                      title="Copy URL"
                    >
                      📋
                    </button>
                  </div>
                </div>

                {/* Row 3: Event Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {webhook.events.slice(0, 3).map((event) => (
                    <Badge key={event} variant="default" className="bg-blue-100 text-blue-700">
                      {event}
                    </Badge>
                  ))}
                  {webhook.events.length > 3 && (
                    <Badge variant="default" className="bg-gray-100 text-gray-700">
                      +{webhook.events.length - 3} more
                    </Badge>
                  )}
                </div>

                {/* Row 4: Metadata */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Created {formatDate(webhook.created_at)}</span>
                  <span>•</span>
                  <span>Retry: {webhook.retry_policy}</span>
                  <span>•</span>
                  <span>Secret: {webhook.secret}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <WebhookForm
          organizationId={organizationId}
          webhook={editingWebhook}
          onClose={() => {
            setShowForm(false)
            setEditingWebhook(null)
          }}
          onSuccess={() => {
            loadWebhooks()
          }}
        />
      )}

      {viewingLogs && (
        <WebhookDeliveryLog
          webhookId={viewingLogs.id}
          webhookName={viewingLogs.name}
          onClose={() => setViewingLogs(null)}
        />
      )}
    </>
  )
}

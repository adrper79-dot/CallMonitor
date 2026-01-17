"use client"

import React, { useState, useEffect } from 'react'
import { WEBHOOK_EVENT_TYPES, WebhookSubscription, CreateWebhookRequest } from '@/types/tier1-features'
import { Badge } from '@/components/ui/badge'

interface WebhookFormProps {
  organizationId: string
  webhook?: WebhookSubscription | null
  onClose: () => void
  onSuccess: () => void
}

/**
 * WebhookForm Component - Professional Design System v3.0
 * 
 * Create or edit webhook subscription
 */
export function WebhookForm({ organizationId, webhook, onClose, onSuccess }: WebhookFormProps) {
  const isEditing = !!webhook

  const [name, setName] = useState(webhook?.name || '')
  const [url, setUrl] = useState(webhook?.url || '')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(webhook?.events || [])
  const [retryPolicy, setRetryPolicy] = useState<'none' | 'fixed' | 'exponential'>(webhook?.retry_policy || 'exponential')
  const [maxRetries, setMaxRetries] = useState(webhook?.max_retries?.toString() || '5')
  const [timeoutMs, setTimeoutMs] = useState(webhook?.timeout_ms?.toString() || '30000')
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>(
    webhook?.headers ? Object.entries(webhook.headers).map(([key, value]) => ({ key, value: value as string })) : []
  )
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)

  // Validation states
  const [nameError, setNameError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [eventsError, setEventsError] = useState<string | null>(null)

  function validateName(value: string): boolean {
    if (!value || value.length < 1 || value.length > 100) {
      setNameError('Name must be 1-100 characters')
      return false
    }
    setNameError(null)
    return true
  }

  function validateUrl(value: string): boolean {
    try {
      const parsed = new URL(value)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setUrlError('URL must use HTTP or HTTPS')
        return false
      }
      setUrlError(null)
      return true
    } catch {
      setUrlError('Invalid URL format')
      return false
    }
  }

  function validateEvents(): boolean {
    if (selectedEvents.length === 0) {
      setEventsError('Select at least one event type')
      return false
    }
    setEventsError(null)
    return true
  }

  function toggleEvent(event: string) {
    if (selectedEvents.includes(event)) {
      setSelectedEvents(selectedEvents.filter(e => e !== event))
    } else {
      setSelectedEvents([...selectedEvents, event])
    }
  }

  function addHeader() {
    setHeaders([...headers, { key: '', value: '' }])
  }

  function updateHeader(index: number, field: 'key' | 'value', value: string) {
    const newHeaders = [...headers]
    newHeaders[index][field] = value
    setHeaders(newHeaders)
  }

  function removeHeader(index: number) {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  function copySecret(secret: string) {
    navigator.clipboard.writeText(secret)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate all fields
    const nameValid = validateName(name)
    const urlValid = validateUrl(url)
    const eventsValid = validateEvents()

    if (!nameValid || !urlValid || !eventsValid) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const headersObj: Record<string, string> = {}
      headers.forEach(h => {
        if (h.key && h.value) {
          headersObj[h.key] = h.value
        }
      })

      const body: any = {
        name,
        url,
        events: selectedEvents,
        headers: headersObj,
        retry_policy: retryPolicy,
        max_retries: parseInt(maxRetries),
        timeout_ms: parseInt(timeoutMs)
      }

      const endpoint = isEditing
        ? `/api/webhooks/subscriptions/${webhook.id}`
        : '/api/webhooks/subscriptions'

      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed to save webhook')
      }

      const data = await res.json()

      if (!isEditing && data.subscription?.secret) {
        // Show secret for new webhooks
        setCreatedSecret(data.subscription.secret)
      } else {
        // For updates, close immediately
        onSuccess()
        onClose()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save webhook')
    } finally {
      setSaving(false)
    }
  }

  // If showing secret, display success screen
  if (createdSecret) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✓</span>
              <h3 className="text-lg font-semibold text-gray-900">Webhook Created!</h3>
            </div>
            <p className="text-sm text-gray-600">
              Save this secret - it won't be shown again.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Webhook Secret
            </label>
            <code className="block bg-white p-3 rounded border border-gray-300 font-mono text-sm text-gray-900 break-all">
              {createdSecret}
            </code>
            <button
              onClick={() => copySecret(createdSecret)}
              className="mt-3 w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Copy Secret
            </button>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                onSuccess()
                onClose()
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Webhook' : 'Create Webhook'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Form Fields */}
          <div className="px-6 py-4 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={(e) => validateName(e.target.value)}
                placeholder="Slack notifications"
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-600 focus:border-primary-600 sm:text-sm ${
                  nameError ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
              {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
              <p className="mt-1 text-xs text-gray-500">Internal name to identify this webhook</p>
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Endpoint URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={(e) => validateUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks/word-is-bond"
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-600 focus:border-primary-600 sm:text-sm ${
                  urlError ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
              {urlError && <p className="mt-1 text-xs text-red-600">{urlError}</p>}
              <p className="mt-1 text-xs text-gray-500">Must be HTTPS</p>
            </div>

            {/* Events */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Events to Subscribe <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3 border border-gray-200 rounded-md p-4">
                {WEBHOOK_EVENT_TYPES.map((event) => (
                  <label key={event} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{event}</span>
                  </label>
                ))}
              </div>
              {eventsError && <p className="mt-1 text-xs text-red-600">{eventsError}</p>}
              <p className="mt-1 text-xs text-gray-500">
                Select at least one event type ({selectedEvents.length} selected)
              </p>
            </div>

            {/* Advanced Settings */}
            <div className="border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  {/* Retry Policy */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Retry Policy
                    </label>
                    <select
                      value={retryPolicy}
                      onChange={(e) => setRetryPolicy(e.target.value as 'none' | 'fixed' | 'exponential')}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-600 focus:border-primary-600 sm:text-sm"
                    >
                      <option value="none">None - Don't retry failed deliveries</option>
                      <option value="fixed">Fixed - Retry with fixed interval</option>
                      <option value="exponential">Exponential - Exponential backoff (recommended)</option>
                    </select>
                  </div>

                  {/* Max Retries */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Retries
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-600 focus:border-primary-600 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">Maximum 10 retries</p>
                  </div>

                  {/* Timeout */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timeout (ms)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      max="60000"
                      step="1000"
                      value={timeoutMs}
                      onChange={(e) => setTimeoutMs(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-600 focus:border-primary-600 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">1000-60000ms (1-60 seconds)</p>
                  </div>

                  {/* Custom Headers */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Headers
                    </label>
                    <div className="space-y-2">
                      {headers.map((header, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Header name"
                            value={header.key}
                            onChange={(e) => updateHeader(index, 'key', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-600 focus:border-primary-600 sm:text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Header value"
                            value={header.value}
                            onChange={(e) => updateHeader(index, 'value', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-600 focus:border-primary-600 sm:text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeHeader(index)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addHeader}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        + Add Header
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Add custom headers for authentication or API keys
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name || !url || selectedEvents.length === 0}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Webhook' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

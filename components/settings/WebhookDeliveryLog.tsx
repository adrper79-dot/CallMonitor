"use client"

import React, { useState, useEffect } from 'react'
import { WebhookStatusBadge } from './WebhookStatusBadge'
import { apiGet } from '@/lib/apiClient'

interface Delivery {
  id: string
  event_type: string
  event_id: string
  status: 'pending' | 'processing' | 'delivered' | 'failed' | 'retrying'
  attempts: number
  max_attempts: number
  response_status: number | null
  response_time_ms: number | null
  last_error: string | null
  created_at: string
  delivered_at: string | null
}

interface WebhookDeliveryLogProps {
  webhookId: string
  webhookName: string
  onClose: () => void
}

/**
 * WebhookDeliveryLog Component - Professional Design System v3.0
 * 
 * Shows delivery history for a webhook with filtering and pagination
 */
export function WebhookDeliveryLog({ webhookId, webhookName, onClose }: WebhookDeliveryLogProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 50

  useEffect(() => {
    loadDeliveries()
  }, [webhookId, statusFilter, offset])

  async function loadDeliveries() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const data = await apiGet<{ deliveries: Delivery[]; pagination?: { total: number } }>(
        `/api/webhooks/subscriptions/${webhookId}/deliveries?${params}`
      )
      setDeliveries(data.deliveries || [])
      setTotal(data.pagination?.total || 0)
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery logs')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function nextPage() {
    if (offset + limit < total) {
      setOffset(offset + limit)
    }
  }

  function prevPage() {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit))
    }
  }

  const hasMore = offset + limit < total

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Delivery Logs</h3>
            <p className="text-sm text-gray-500 mt-1">{webhookName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setOffset(0) // Reset pagination
            }}
            className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-600 focus:border-primary-600 sm:text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="retrying">Retrying</option>
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-500">Loading...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
              <button
                onClick={loadDeliveries}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Retry
              </button>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No deliveries yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Deliveries will appear here when events are triggered
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Response
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attempts
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {delivery.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <WebhookStatusBadge status={delivery.status} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(delivery.created_at)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {delivery.response_status ? (
                          <span
                            className={
                              delivery.response_status >= 200 && delivery.response_status < 300
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {delivery.response_status}
                            {delivery.response_time_ms && ` (${delivery.response_time_ms}ms)`}
                          </span>
                        ) : delivery.last_error ? (
                          <span className="text-red-600 text-xs" title={delivery.last_error}>
                            Error
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {delivery.attempts} / {delivery.max_attempts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && deliveries.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Showing {offset + 1}-{Math.min(offset + deliveries.length, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={prevPage}
                disabled={offset === 0}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={nextPage}
                disabled={!hasMore}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

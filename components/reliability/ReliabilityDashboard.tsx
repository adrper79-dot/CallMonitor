"use client"

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'

interface WebhookFailure {
  id: string
  source: string
  endpoint: string
  error_message: string
  error_code: string | null
  http_status: number | null
  attempt_count: number
  max_attempts: number
  status: 'pending' | 'retrying' | 'succeeded' | 'failed' | 'manual_review' | 'discarded'
  created_at: string
  last_attempt_at: string
  next_retry_at: string | null
  resource_type: string | null
  resource_id: string | null
}

interface ReliabilityMetrics {
  pending_webhooks: number
  failed_webhooks: number
  manual_review_webhooks: number
  recovered_webhooks: number
  failures_24h: number
  recovered_24h: number
  signalwire_failures: number
  assemblyai_failures: number
  oldest_pending: string | null
}

interface ReliabilityDashboardProps {
  organizationId: string
}

/**
 * Reliability Dashboard
 * 
 * Shows webhook failures, retry status, and system health.
 * Per ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md - Structured Error Journaling
 */
export function ReliabilityDashboard({ organizationId }: ReliabilityDashboardProps) {
  const [failures, setFailures] = useState<WebhookFailure[]>([])
  const [metrics, setMetrics] = useState<ReliabilityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'failed' | 'all'>('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  
  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/reliability/webhooks?status=${filter}`, {
          credentials: 'include',
        })
        
        if (!res.ok) {
          throw new Error('Failed to fetch reliability data')
        }
        
        const data = await res.json()
        setFailures(data.failures || [])
        setMetrics(data.metrics || null)
      } catch (err) {
        setError('Failed to load reliability data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [organizationId, filter])
  
  // Handle retry/discard actions
  async function handleAction(failureId: string, action: 'retry' | 'discard' | 'manual_review') {
    setProcessing(failureId)
    setError(null)
    
    try {
      const res = await fetch('/api/reliability/webhooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          failure_id: failureId,
          action,
          resolution_notes: action === 'discard' ? 'Manually discarded by admin' : undefined,
        }),
      })
      
      if (!res.ok) {
        throw new Error('Failed to process action')
      }
      
      const data = await res.json()
      
      // Update local state
      setFailures(prev => prev.map(f => 
        f.id === failureId ? data.failure : f
      ))
    } catch (err) {
      setError('Failed to process action')
      console.error(err)
    } finally {
      setProcessing(null)
    }
  }
  
  const getStatusBadge = (status: WebhookFailure['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>
      case 'retrying':
        return <Badge variant="default">Retrying</Badge>
      case 'succeeded':
        return <Badge variant="success">Recovered</Badge>
      case 'failed':
        return <Badge variant="error">Failed</Badge>
      case 'manual_review':
        return <Badge variant="secondary">Review</Badge>
      case 'discarded':
        return <Badge variant="secondary">Discarded</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }
  
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'signalwire':
        return '📞'
      case 'assemblyai':
        return '🎙️'
      case 'resend':
        return '📧'
      case 'stripe':
        return '💳'
      default:
        return '🔗'
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner" />
        <span className="ml-3 text-gray-500">Loading reliability data...</span>
      </div>
    )
  }
  
  const hasIssues = metrics && (
    metrics.pending_webhooks > 0 || 
    metrics.failed_webhooks > 0 || 
    metrics.manual_review_webhooks > 0
  )
  
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      
      {/* Health Status Banner */}
      <div className={`rounded-md p-4 ${hasIssues ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex items-center gap-3">
          {hasIssues ? (
            <>
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Attention Required
                </p>
                <p className="text-xs text-amber-700">
                  {metrics?.pending_webhooks || 0} pending, {metrics?.failed_webhooks || 0} failed webhook{metrics?.failed_webhooks !== 1 ? 's' : ''}
                </p>
              </div>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">
                  All Systems Operational
                </p>
                <p className="text-xs text-green-700">
                  No pending webhook failures
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-semibold text-amber-600">{metrics.pending_webhooks}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Failed</p>
            <p className="text-2xl font-semibold text-red-600">{metrics.failed_webhooks}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Recovered (24h)</p>
            <p className="text-2xl font-semibold text-green-600">{metrics.recovered_24h}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Failures (24h)</p>
            <p className="text-2xl font-semibold text-gray-900">{metrics.failures_24h}</p>
          </div>
        </div>
      )}
      
      {/* Source Breakdown */}
      {metrics && (metrics.signalwire_failures > 0 || metrics.assemblyai_failures > 0) && (
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Failures by Source</h3>
          <div className="flex gap-6">
            {metrics.signalwire_failures > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-lg">📞</span>
                <span className="text-sm text-gray-600">SignalWire: {metrics.signalwire_failures}</span>
              </div>
            )}
            {metrics.assemblyai_failures > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-lg">🎙️</span>
                <span className="text-sm text-gray-600">AssemblyAI: {metrics.assemblyai_failures}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['pending', 'failed', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Failures List */}
      <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-200">
        {failures.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No {filter === 'all' ? '' : filter} webhook failures
          </div>
        ) : (
          failures.map(failure => (
            <div key={failure.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getSourceIcon(failure.source)}</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {failure.source}
                    </span>
                    {getStatusBadge(failure.status)}
                    <span className="text-xs text-gray-500">
                      Attempt {failure.attempt_count}/{failure.max_attempts}
                    </span>
                  </div>
                  
                  <p className="text-sm text-red-600 truncate mb-1">
                    {failure.error_message}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      Created {new Date(failure.created_at).toLocaleString()}
                    </span>
                    {failure.next_retry_at && failure.status === 'pending' && (
                      <span>
                        Next retry: {new Date(failure.next_retry_at).toLocaleTimeString()}
                      </span>
                    )}
                    {failure.resource_type && (
                      <span>
                        {failure.resource_type}: {failure.resource_id?.substring(0, 8)}...
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                {['pending', 'failed', 'manual_review'].includes(failure.status) && (
                  <div className="flex gap-2 ml-4">
                    {failure.status !== 'failed' && failure.attempt_count < failure.max_attempts && (
                      <button
                        onClick={() => handleAction(failure.id, 'retry')}
                        disabled={processing === failure.id}
                        className="px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50"
                      >
                        Retry Now
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(failure.id, 'discard')}
                      disabled={processing === failure.id}
                      className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    >
                      Discard
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Help Text */}
      <div className="text-xs text-gray-500">
        <p>
          Webhook failures are automatically retried with exponential backoff (up to 5 attempts).
          Failed webhooks after max retries require manual review.
        </p>
      </div>
    </div>
  )
}

export default ReliabilityDashboard

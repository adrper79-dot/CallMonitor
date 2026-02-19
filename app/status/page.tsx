'use client'

/**
 * System Status Page — /status
 *
 * Public, no-auth page. Client-side fetches /health on mount and auto-refreshes
 * every 60 seconds. Works as a Cloudflare Pages static export — no SSR needed.
 *
 * Free alternative to BetterStack status page (saves $30/mo).
 * Pair with:
 *   - Freshping (https://freshping.io) — free HTTP uptime monitoring, 1-min interval
 *   - healthchecks.io (https://healthchecks.io) — free cron heartbeat monitoring
 *
 * Monitor this page: https://wordis-bond.com/status
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const REFRESH_INTERVAL_MS = 60_000

type ServiceStatus = 'healthy' | 'degraded' | 'critical' | 'unknown'

interface ServiceCheck {
  service: string
  status: ServiceStatus
  message: string
  responseTime?: number
}

interface HealthResponse {
  status: ServiceStatus
  timestamp: string
  responseTime: number
  checks: ServiceCheck[]
  environment?: { runtime: string; region: string }
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; dotClass: string; badgeClass: string; bannerClass: string }
> = {
  healthy: {
    label: 'All Systems Operational',
    dotClass: 'bg-green-500',
    badgeClass: 'text-green-700 bg-green-50 ring-green-600/20',
    bannerClass: 'bg-green-50 border-green-200',
  },
  degraded: {
    label: 'Partial Outage',
    dotClass: 'bg-amber-400',
    badgeClass: 'text-amber-700 bg-amber-50 ring-amber-600/20',
    bannerClass: 'bg-amber-50 border-amber-200',
  },
  critical: {
    label: 'Major Outage',
    dotClass: 'bg-red-500',
    badgeClass: 'text-red-700 bg-red-50 ring-red-600/20',
    bannerClass: 'bg-red-50 border-red-200',
  },
  unknown: {
    label: 'Status Unknown',
    dotClass: 'bg-gray-400',
    badgeClass: 'text-gray-700 bg-gray-50 ring-gray-600/20',
    bannerClass: 'bg-gray-50 border-gray-200',
  },
}

const SERVICE_LABELS: Record<string, string> = {
  database: 'Database (Neon PostgreSQL)',
  kv: 'Cache (Cloudflare KV)',
  r2: 'Storage (Cloudflare R2)',
  telnyx: 'Voice (Telnyx)',
  assemblyai: 'Transcription (AssemblyAI)',
  api: 'API (Workers)',
}

function formatMs(ms?: number): string {
  if (ms === undefined) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000)

  const fetchHealth = useCallback(async () => {
    setFetchState('loading')
    try {
      const res = await fetch(`${API_URL}/health`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: HealthResponse = await res.json()
      setHealth(data)
      setFetchState('success')
    } catch {
      setFetchState('error')
      setHealth(null)
    }
    setLastChecked(new Date())
    setCountdown(REFRESH_INTERVAL_MS / 1000)
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  // Auto-refresh every 60s
  useEffect(() => {
    const refreshTimer = setInterval(fetchHealth, REFRESH_INTERVAL_MS)
    return () => clearInterval(refreshTimer)
  }, [fetchHealth])

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(tick)
  }, [lastChecked])

  const overallStatus: ServiceStatus =
    fetchState === 'error' ? 'critical' : (health?.status ?? 'unknown')
  const cfg = STATUS_CONFIG[overallStatus]

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="font-semibold text-gray-900">Wordis Bond</span>
          </Link>
          <Link href="/signin" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Sign In
          </Link>
        </div>
      </header>

      {/* Overall status banner */}
      <section className={`border-b ${cfg.bannerClass} py-10 px-6`}>
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          {/* Animated pulse dot */}
          <span className="relative flex h-4 w-4 flex-shrink-0">
            {overallStatus === 'healthy' && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dotClass} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-4 w-4 ${cfg.dotClass}`} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{cfg.label}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {fetchState === 'loading' && 'Checking services…'}
              {fetchState === 'error' && 'Unable to reach the API — checking again shortly.'}
              {fetchState === 'success' && lastChecked && (
                <>Last checked {formatTimestamp(lastChecked.toISOString())} · refreshing in {countdown}s</>
              )}
              {fetchState === 'idle' && 'Loading…'}
            </p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={fetchState === 'loading'}
            aria-label="Refresh status"
            className="ml-auto text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40 flex items-center gap-1.5"
          >
            <svg
              className={`w-4 h-4 ${fetchState === 'loading' ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </section>

      {/* Service grid */}
      <section className="py-10 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Services
          </h2>

          {fetchState === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-red-700 font-medium">Could not reach the API</p>
              <p className="text-sm text-red-500 mt-1">
                The API at <code className="text-xs">{API_URL}</code> is not responding.
              </p>
            </div>
          )}

          {(fetchState === 'success' || fetchState === 'loading') && (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              {/* API Worker row — always present; uses outer overallStatus so it survives type narrowing */}
              <ServiceRow
                label="API (Cloudflare Workers)"
                status={overallStatus === 'critical' ? 'critical' : 'healthy'}
                message={overallStatus === 'critical' ? 'Unreachable' : 'Workers runtime operational'}
                responseTime={health?.responseTime}
              />
              {health?.checks.map((check) => (
                <ServiceRow
                  key={check.service}
                  label={SERVICE_LABELS[check.service] ?? check.service}
                  status={check.status}
                  message={check.message}
                  responseTime={check.responseTime}
                />
              ))}
              {fetchState === 'loading' && !health && (
                <div className="px-5 py-4 text-sm text-gray-400 animate-pulse">
                  Loading service status…
                </div>
              )}
            </div>
          )}

          {/* Response time summary */}
          {health && (
            <p className="mt-3 text-xs text-gray-400 text-right">
              Total check time: {formatMs(health.responseTime)} · API region: {health.environment?.region ?? '—'}
            </p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Latimer + Woods Tech LLC</p>
          <div className="flex gap-5">
            <Link href="/trust" className="hover:text-gray-600">Trust Pack</Link>
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

function ServiceRow({
  label,
  status,
  message,
  responseTime,
}: {
  label: string
  status: ServiceStatus
  message: string
  responseTime?: number
}) {
  const cfg = STATUS_CONFIG[status]
  const statusLabel =
    status === 'healthy' ? 'Operational' :
    status === 'degraded' ? 'Degraded' :
    status === 'critical' ? 'Outage' : 'Unknown'

  return (
    <div className="flex items-center justify-between px-5 py-3.5 bg-white hover:bg-gray-50/50">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
          <p className="text-xs text-gray-400 truncate">{message}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
        {responseTime !== undefined && (
          <span className="text-xs text-gray-400 hidden sm:block">{formatMs(responseTime)}</span>
        )}
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.badgeClass}`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  )
}

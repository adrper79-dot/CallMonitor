"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

type AlertItem = {
  id: string
  scorecard_name: string
  total_score: number | null
  failures: Array<{ id: string; name: string; value: any; failed: boolean }>
  call_id: string | null
  created_at: string
}

export default function ScorecardAlerts({ organizationId }: { organizationId: string | null }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }

    let isActive = true
    setLoading(true)
    setError(null)

    fetch('/api/scorecards/alerts', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return
        if (data?.success === false) {
          setError(data?.error || 'Unable to load alerts')
          setAlerts([])
          return
        }
        setAlerts(data.alerts || [])
      })
      .catch((err) => {
        if (!isActive) return
        setError(err?.message || 'Unable to load alerts')
        setAlerts([])
      })
      .finally(() => {
        if (isActive) setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [organizationId])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <p className="text-sm text-gray-500">Loading alerts...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  return (
    <section aria-label="QA Alerts" className="bg-white border border-gray-200 rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">QA Alerts</h3>
        <Badge variant={alerts.length ? 'warning' : 'success'}>
          {alerts.length ? `${alerts.length} flagged` : 'No flags'}
        </Badge>
      </div>

      {alerts.length === 0 ? (
        <p className="text-sm text-gray-500">No failed criteria detected.</p>
      ) : (
        <ul className="space-y-3">
          {alerts.slice(0, 6).map((alert) => (
            <li key={alert.id} className="border border-gray-100 rounded-md p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{alert.scorecard_name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant="error">{alert.total_score ?? 0}%</Badge>
              </div>
              {alert.failures.length > 0 && (
                <p className="text-xs text-gray-600 mt-2">
                  Failed: {alert.failures.slice(0, 3).map((f) => f.name).join(', ')}
                </p>
              )}
              {alert.call_id && (
                <Link
                  href={`/voice?callId=${alert.call_id}`}
                  className="inline-block mt-2 text-xs text-primary-600 hover:text-primary-700"
                >
                  Review call
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

'use client'

/**
 * PreDialChecker — Compliance gate before outbound calls
 *
 * Runs pre-dial compliance checks (FDCPA, TCPA, state regulations,
 * 7-in-7 contact limits) and blocks non-compliant calls.
 * Required by law before every outbound collection call.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle,
  XCircle, Loader2, Phone, Clock, MapPin, Ban,
} from 'lucide-react'

export interface ComplianceCheck {
  rule: string
  label: string
  status: 'pass' | 'fail' | 'warn'
  detail: string
}

export interface PreDialResult {
  allowed: boolean
  checks: ComplianceCheck[]
  blocked_reason?: string
}

interface PreDialCheckerProps {
  accountId: string
  phone: string
  accountName?: string
  /** Called when all checks pass and user confirms dial */
  onApproved: () => void
  /** Called when user cancels */
  onCancel: () => void
  /** Show inline (no card wrapper) */
  inline?: boolean
}

export default function PreDialChecker({
  accountId,
  phone,
  accountName,
  onApproved,
  onCancel,
  inline = false,
}: PreDialCheckerProps) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<PreDialResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runChecks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet(
        `/api/compliance/pre-dial?account_id=${accountId}&phone=${encodeURIComponent(phone)}`
      )
      // API may return checks as object {dnc:{}, tcpa:{}, reg_f:{}} or array
      const rawChecks = data.checks
      const checks: ComplianceCheck[] = Array.isArray(rawChecks)
        ? rawChecks
        : rawChecks && typeof rawChecks === 'object'
          ? transformChecksObject(rawChecks)
          : buildFallbackChecks(data)
      const allowed = checks.every((c) => c.status !== 'fail')
      setResult({
        allowed,
        checks,
        blocked_reason: allowed ? undefined : checks.find((c) => c.status === 'fail')?.detail,
      })
    } catch (err: any) {
      const status = err?.status || err?.statusCode
      const message = err?.message || 'Unknown error'

      // Classify the error for user-friendly messaging
      let userMessage: string
      if (status === 404 || message.includes('not found') || message.includes('404')) {
        userMessage = 'Compliance check endpoint not configured — contact your administrator'
        logger.warn('Pre-dial endpoint missing (404)', { accountId })
      } else if (status === 401 || status === 403) {
        userMessage = 'Authentication error — please sign in again'
        logger.warn('Pre-dial auth error', { status, accountId })
      } else if (message.includes('network') || message.includes('fetch') || message.includes('Failed to fetch')) {
        userMessage = 'Network error — check your connection and retry'
        logger.warn('Pre-dial network error', { accountId })
      } else {
        userMessage = 'Compliance check service unavailable'
        logger.error('Pre-dial check failed', { error: message, accountId })
      }

      setError(userMessage)
      // Fail-safe: block if we can't verify compliance
      setResult({
        allowed: false,
        checks: [],
        blocked_reason: 'Unable to verify compliance — call blocked for safety',
      })
    } finally {
      setLoading(false)
    }
  }, [accountId, phone])

  useEffect(() => { runChecks() }, [runChecks])

  const statusIcon = (status: ComplianceCheck['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
      case 'fail': return <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
      case 'warn': return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
    }
  }

  const statusColor = (status: ComplianceCheck['status']) => {
    switch (status) {
      case 'pass': return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
      case 'fail': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
      case 'warn': return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
    }
  }

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {loading ? (
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        ) : result?.allowed ? (
          <ShieldCheck className="w-5 h-5 text-green-600" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-red-600" />
        )}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Pre-Dial Compliance Check
          </h3>
          {accountName && (
            <p className="text-xs text-gray-500">{accountName} • {phone}</p>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          {['FDCPA Calling Hours', 'TCPA Consent', '7-in-7 Contact Limit', 'State Regulations', 'Cease & Desist'].map((label) => (
            <div key={label} className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-gray-700">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-3">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Check results */}
      {result && !loading && (
        <div className="space-y-1.5 mb-4">
          {result.checks.map((check) => (
            <div
              key={check.rule}
              className={`flex items-start gap-2 p-2 rounded border ${statusColor(check.status)}`}
            >
              {statusIcon(check.status)}
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{check.label}</p>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Blocked Banner */}
      {result && !result.allowed && !loading && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Call Blocked
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                {result.blocked_reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!loading && (
        <div className="flex items-center gap-2">
          {result?.allowed ? (
            <Button
              onClick={onApproved}
              className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
              size="sm"
            >
              <Phone className="w-4 h-4" />
              Dial Now
            </Button>
          ) : (
            <Button
              onClick={runChecks}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              Re-check
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </>
  )

  if (inline) return <div>{content}</div>

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800">
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  )
}

/**
 * Build fallback checks from a flat API response
 * (e.g. if API returns {calling_hours: true, consent: true, ...})
 */
/**
 * Transform the object-format checks from the API into ComplianceCheck[]
 * API returns: { dnc: { blocked, reason, source }, tcpa: { restricted, reason }, reg_f: { blocked, contact_count_7day, limit } }
 */
function transformChecksObject(checks: Record<string, any>): ComplianceCheck[] {
  const result: ComplianceCheck[] = []

  if (checks.dnc) {
    result.push({
      rule: 'dnc',
      label: 'Do Not Call List',
      status: checks.dnc.blocked ? 'fail' : 'pass',
      detail: checks.dnc.blocked
        ? `DNC blocked: ${checks.dnc.reason || 'On do-not-call list'}`
        : 'Not on do-not-call list',
    })
  }

  if (checks.tcpa) {
    result.push({
      rule: 'tcpa',
      label: 'TCPA Calling Hours',
      status: checks.tcpa.restricted ? 'fail' : 'pass',
      detail: checks.tcpa.restricted
        ? checks.tcpa.reason || 'Outside permitted calling hours'
        : 'Within permitted calling window',
    })
  }

  if (checks.reg_f) {
    const count = checks.reg_f.contact_count_7day ?? 0
    const limit = checks.reg_f.limit ?? 7
    result.push({
      rule: 'reg_f',
      label: 'Reg F Contact Limit',
      status: checks.reg_f.blocked ? 'fail' : count >= limit - 2 ? 'warn' : 'pass',
      detail: checks.reg_f.blocked
        ? `Contact limit reached (${count}/${limit} in 7 days)`
        : `${count}/${limit} contacts this period`,
    })
  }

  if (result.length === 0) {
    result.push({
      rule: 'generic',
      label: 'Compliance Status',
      status: 'pass',
      detail: 'All checks passed',
    })
  }

  return result
}

function buildFallbackChecks(data: Record<string, any>): ComplianceCheck[] {
  const checks: ComplianceCheck[] = []

  if ('calling_hours' in data) {
    checks.push({
      rule: 'fdcpa_hours',
      label: 'FDCPA Calling Hours',
      status: data.calling_hours ? 'pass' : 'fail',
      detail: data.calling_hours
        ? 'Within permitted calling window (8am–9pm local)'
        : 'Outside permitted calling hours — call blocked',
    })
  }

  if ('consent' in data || 'tcpa_consent' in data) {
    const has = data.consent || data.tcpa_consent
    checks.push({
      rule: 'tcpa_consent',
      label: 'TCPA Consent',
      status: has ? 'pass' : 'warn',
      detail: has
        ? 'Valid consent on file'
        : 'No explicit consent recorded — proceed with caution',
    })
  }

  if ('contact_count_7day' in data || 'seven_in_seven' in data) {
    const count = data.contact_count_7day ?? data.seven_in_seven ?? 0
    checks.push({
      rule: 'seven_in_seven',
      label: '7-in-7 Contact Limit',
      status: count >= 7 ? 'fail' : count >= 5 ? 'warn' : 'pass',
      detail: `${count}/7 contacts this period${count >= 7 ? ' — limit reached' : ''}`,
    })
  }

  if ('state_ok' in data || 'state_regulations' in data) {
    const ok = data.state_ok || data.state_regulations
    checks.push({
      rule: 'state_regs',
      label: 'State Regulations',
      status: ok ? 'pass' : 'fail',
      detail: ok
        ? 'State-specific rules satisfied'
        : 'State regulation violation — check consumer\u2019s state laws',
    })
  }

  if ('cease_desist' in data) {
    checks.push({
      rule: 'cease_desist',
      label: 'Cease & Desist',
      status: data.cease_desist ? 'fail' : 'pass',
      detail: data.cease_desist
        ? 'Active cease & desist on file — DO NOT CALL'
        : 'No cease & desist on file',
    })
  }

  // If API didn't return structured data, add a generic check
  if (checks.length === 0) {
    checks.push({
      rule: 'generic',
      label: 'Compliance Status',
      status: data.allowed === false ? 'fail' : 'pass',
      detail: data.message || 'Check completed',
    })
  }

  return checks
}

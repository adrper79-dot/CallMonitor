'use client'

import React, { useState, useEffect } from 'react'
import { ReviewTimeline, TimelineArtifact } from './ReviewTimeline'
import { AuthorityBadge } from '@/components/ui/AuthorityBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiGet, apiFetch } from '@/lib/apiClient'
import { BondAICopilot } from '@/components/bond-ai'
import { logger } from '@/lib/logger'

interface CallWithArtifacts {
  id: string
  call_sid?: string
  status: string
  started_at: string
  ended_at?: string
  duration_seconds?: number
  from_number?: string
  to_number?: string
  organization_id: string
  created_by?: string
  is_authoritative: boolean
  immutability_policy: string
  recordings?: Array<{
    id: string
    url: string
    duration_seconds?: number
    created_at: string
    is_authoritative: boolean
    source: string
  }>
  transcript_versions?: Array<{
    id: string
    version: number
    transcript_json: any
    transcript_hash: string
    produced_by: string
    created_at: string
    is_authoritative: boolean
  }>
  ai_runs?: Array<{
    id: string
    model: string
    status: string
    output: any
    started_at: string
    completed_at?: string
    is_authoritative: boolean
    produced_by?: string
  }>
  evidence_manifests?: Array<{
    id: string
    manifest: any
    version: number
    created_at: string
    is_authoritative: boolean
    produced_by: string
    cryptographic_hash?: string
  }>
}

interface ReviewModeProps {
  callId: string
  organizationId: string | null
}

/**
 * ReviewMode - Professional Design System v3.0
 *
 * Read-only evidence review interface for dispute resolution.
 * No edit actions - full provenance and authority markers.
 *
 * Reference: ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md
 */
export default function ReviewMode({ callId, organizationId }: ReviewModeProps) {
  const [call, setCall] = useState<CallWithArtifacts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [organizationPlan, setOrganizationPlan] = useState<string | null>(null)
  const { toast } = useToast()

  // Fetch call with all artifacts
  useEffect(() => {
    async function fetchCallDetails() {
      if (!callId) return

      try {
        setLoading(true)
        setError(null)

        const data = await apiGet(
          `/api/calls/${callId}?include=recordings,transcripts,ai_runs,manifests`
        )
        setCall(data.call)
      } catch (err: any) {
        setError(err.message || 'Failed to load call details')
      } finally {
        setLoading(false)
      }
    }

    fetchCallDetails()
  }, [callId])

  // Fetch organization plan for feature gating
  useEffect(() => {
    if (!organizationId) return

    apiGet(`/api/organizations/${organizationId}`)
      .then((data) => {
        if (data.organization?.plan) {
          setOrganizationPlan(data.organization.plan)
        }
      })
      .catch((err) => logger.error('Failed to fetch organization plan', { error: err }))
  }, [organizationId])

  // Export evidence bundle (ZIP format)
  async function handleExport() {
    if (!callId) return

    setExporting(true)

    try {
      const res = await apiFetch(`/api/calls/${callId}/export?format=zip`)

      if (!res.ok) {
        throw new Error('Export failed')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `call-${callId}-evidence.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Export Complete',
        description: 'Evidence bundle downloaded successfully',
      })
    } catch (err: any) {
      toast({
        title: 'Export Failed',
        description: err.message || 'Failed to export evidence bundle',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  // Build timeline artifacts from call data
  function buildTimelineArtifacts(): TimelineArtifact[] {
    if (!call) return []

    const artifacts: TimelineArtifact[] = []

    // Add recordings
    call.recordings?.forEach((rec) => {
      artifacts.push({
        id: rec.id,
        type: 'recording',
        created_at: rec.created_at,
        is_authoritative: rec.is_authoritative ?? true,
        produced_by: rec.source || 'telnyx',
        immutability_policy: 'immutable',
        title: 'Source Recording',
        summary: rec.duration_seconds
          ? `${Math.floor(rec.duration_seconds / 60)}:${(rec.duration_seconds % 60).toString().padStart(2, '0')} duration`
          : undefined,
      })
    })

    // Add transcripts
    call.transcript_versions?.forEach((tv) => {
      artifacts.push({
        id: tv.id,
        type: 'transcript',
        created_at: tv.created_at,
        is_authoritative: tv.is_authoritative ?? true,
        produced_by: tv.produced_by || 'assemblyai',
        immutability_policy: 'immutable',
        title: `Canonical Transcript (v${tv.version})`,
        summary: tv.transcript_hash ? `Hash: ${tv.transcript_hash.slice(0, 12)}...` : undefined,
        provenance: { hash: tv.transcript_hash },
      })
    })

    // Add AI runs
    call.ai_runs?.forEach((run) => {
      artifacts.push({
        id: run.id,
        type: 'ai_run',
        created_at: run.started_at,
        is_authoritative: run.is_authoritative ?? false,
        produced_by: run.produced_by || run.model || 'unknown',
        title: `AI Processing: ${run.model}`,
        summary: `Status: ${run.status}`,
      })
    })

    // Add evidence manifests
    call.evidence_manifests?.forEach((em) => {
      artifacts.push({
        id: em.id,
        type: 'manifest',
        created_at: em.created_at,
        is_authoritative: em.is_authoritative ?? true,
        produced_by: em.produced_by || 'system_cas',
        immutability_policy: 'immutable',
        title: `Evidence Manifest (v${em.version})`,
        summary: em.cryptographic_hash
          ? `Hash: ${em.cryptographic_hash.slice(0, 12)}...`
          : undefined,
        provenance: em.manifest,
      })
    })

    return artifacts
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner" />
        <span className="ml-3 text-gray-500">Loading call details...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-error-light border border-red-200 rounded-md">
        <h3 className="text-error font-medium">Error Loading Call</h3>
        <p className="text-sm text-gray-600 mt-1">{error}</p>
      </div>
    )
  }

  if (!call) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-md text-center">
        <p className="text-gray-500">Call not found</p>
      </div>
    )
  }

  const artifacts = buildTimelineArtifacts()
  const recordingCount = call.recordings?.length || 0
  const transcriptCount = call.transcript_versions?.length || 0
  const manifestCount = call.evidence_manifests?.length || 0

  return (
    <div className="review-mode">
      {/* Header with Locked View indicator */}
      <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Evidence Review</h2>
                <span className="px-2 py-0.5 text-xs font-medium bg-primary-600 text-white rounded-full">
                  LOCKED VIEW
                </span>
              </div>
              <p className="text-sm text-primary-700">
                Immutable record - no modifications allowed
              </p>
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="primary"
            className="flex items-center gap-2"
          >
            {exporting ? (
              <>
                <span className="loading-spinner" />
                Preparing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export Evidence
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Call Summary */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-md">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-900">Call {call.id.slice(0, 8)}...</h3>
            <div className="mt-1 text-sm text-gray-500 space-y-1">
              <p>
                Status:{' '}
                <Badge variant={call.status === 'completed' ? 'success' : 'default'}>
                  {call.status}
                </Badge>
              </p>
              {call.from_number && <p>From: {call.from_number}</p>}
              {call.to_number && <p>To: {call.to_number}</p>}
              {call.duration_seconds && (
                <p>
                  Duration: {Math.floor(call.duration_seconds / 60)}:
                  {(call.duration_seconds % 60).toString().padStart(2, '0')}
                </p>
              )}
            </div>
          </div>

          <AuthorityBadge isAuthoritative={call.is_authoritative ?? true} producer="server" />
        </div>
      </div>

      {/* Primary Evidence Summary */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-md">
        <h3 className="text-sm font-semibold text-gray-900">Primary Evidence</h3>
        <p className="text-xs text-gray-500 mt-1">
          Proof of the call exists when recordings, transcripts, and manifests are present.
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Recordings</p>
            <p className="text-lg font-semibold text-gray-900">{recordingCount}</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Transcripts</p>
            <p className="text-lg font-semibold text-gray-900">{transcriptCount}</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Manifests</p>
            <p className="text-lg font-semibold text-gray-900">{manifestCount}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Artifact Timeline ({artifacts.length} items)
        </h3>
        <ReviewTimeline artifacts={artifacts} />
      </div>

      {/* Bond AI Call Co-Pilot - Pro Plan Only */}
      {organizationPlan === 'pro' && call && (
        <div className="mb-6">
          <BondAICopilot callId={call.id} />
        </div>
      )}

      {/* Provenance Summary */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Provenance Summary</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>Authoritative artifacts: {artifacts.filter((a) => a.is_authoritative).length}</li>
          <li>Preview artifacts: {artifacts.filter((a) => !a.is_authoritative).length}</li>
          <li>Producers: {Array.from(new Set(artifacts.map((a) => a.produced_by))).join(', ')}</li>
        </ul>
      </div>
    </div>
  )
}

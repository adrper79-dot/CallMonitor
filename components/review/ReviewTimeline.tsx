"use client"

import React, { useState } from 'react'
import { AuthorityBadge } from '@/components/ui/AuthorityBadge'
import { ClientDate } from '@/components/ui/ClientDate'

export interface TimelineArtifact {
  id: string
  type: 'recording' | 'transcript' | 'translation' | 'ai_run' | 'score' | 'survey' | 'manifest'
  created_at: string
  is_authoritative: boolean
  produced_by: string
  immutability_policy?: 'immutable' | 'limited' | 'mutable'
  title?: string
  summary?: string
  provenance?: Record<string, any>
}

interface ReviewTimelineProps {
  artifacts: TimelineArtifact[]
}

/**
 * ReviewTimeline - Professional Design System v3.0
 * 
 * Chronological timeline of all artifacts with provenance.
 * Read-only display for evidence review.
 * 
 * Reference: ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md
 */
export function ReviewTimeline({ artifacts }: ReviewTimelineProps) {
  // Sort artifacts chronologically
  const sorted = [...artifacts].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  
  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No artifacts available for this call.
      </div>
    )
  }
  
  return (
    <div className="relative">
      {/* Timeline connector line */}
      <div 
        className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" 
        aria-hidden="true" 
      />
      
      {/* Artifact cards */}
      <div className="space-y-4">
        {sorted.map((artifact, index) => (
          <ArtifactCard 
            key={artifact.id} 
            artifact={artifact}
            isFirst={index === 0}
            isLast={index === sorted.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

interface ArtifactCardProps {
  artifact: TimelineArtifact
  isFirst?: boolean
  isLast?: boolean
}

function ArtifactCard({ artifact, isFirst, isLast }: ArtifactCardProps) {
  const [expanded, setExpanded] = useState(false)
  
  const typeConfig = getTypeConfig(artifact.type)
  
  return (
    <div className="relative pl-10">
      {/* Timeline marker */}
      <div 
        className={`absolute left-2 w-4 h-4 rounded-full border-2 ${
          artifact.is_authoritative 
            ? 'bg-success-light border-success' 
            : 'bg-warning-light border-warning'
        }`}
        style={{ top: '1.25rem' }}
        aria-hidden="true"
      />
      
      {/* Card */}
      <div 
        className={`p-4 bg-white rounded-md border ${
          artifact.is_authoritative ? 'border-gray-200' : 'border-amber-200'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">{typeConfig.icon}</span>
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {artifact.title || typeConfig.label}
              </h4>
              <p className="text-xs text-gray-500">
                <ClientDate date={artifact.created_at} format="long" />
              </p>
            </div>
          </div>
          
          <AuthorityBadge 
            isAuthoritative={artifact.is_authoritative}
            producer={artifact.produced_by}
          />
        </div>
        
        {/* Summary */}
        {artifact.summary && (
          <p className="mt-2 text-sm text-gray-600">{artifact.summary}</p>
        )}
        
        {/* Producer attribution */}
        <div className="mt-3 text-xs text-gray-500">
          Produced by: {formatProducer(artifact.produced_by)}
          {artifact.immutability_policy && (
            <span className="ml-3">
              Policy: {artifact.immutability_policy}
            </span>
          )}
        </div>
        
        {/* Provenance expandable */}
        {artifact.provenance && Object.keys(artifact.provenance).length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <svg 
                className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {expanded ? 'Hide' : 'Show'} Provenance Details
            </button>
            
            {expanded && (
              <pre className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto">
                {JSON.stringify(artifact.provenance, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getTypeConfig(type: TimelineArtifact['type']): { icon: string; label: string } {
  const configs: Record<TimelineArtifact['type'], { icon: string; label: string }> = {
    recording: { icon: '🎙', label: 'Source Recording' },
    transcript: { icon: '📝', label: 'Canonical Transcript' },
    translation: { icon: '🌐', label: 'Translation' },
    ai_run: { icon: '🤖', label: 'AI Processing' },
    score: { icon: '📊', label: 'Call Score' },
    survey: { icon: '📋', label: 'Survey Response' },
    manifest: { icon: '📜', label: 'Evidence Manifest' },
  }
  
  return configs[type] || { icon: '📎', label: 'Artifact' }
}

function formatProducer(producer: string): string {
  const producerMap: Record<string, string> = {
    'signalwire': 'SignalWire',
    'assemblyai': 'AssemblyAI',
    'system_cas': 'System CAS',
    'system': 'System',
    'human': 'Human',
    'model': 'AI Model',
  }
  
  return producerMap[producer?.toLowerCase()] || producer || 'Unknown'
}

export default ReviewTimeline

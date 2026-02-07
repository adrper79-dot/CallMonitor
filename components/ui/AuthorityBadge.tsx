'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'

interface AuthorityBadgeProps {
  isAuthoritative: boolean
  producer?: string
  className?: string
  showTooltip?: boolean
}

/**
 * AuthorityBadge - Professional Design System v3.0
 *
 * Displays whether an artifact is authoritative (legally defensible)
 * or preview (assist-only, not evidential).
 *
 * Reference: ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md
 */
export function AuthorityBadge({
  isAuthoritative,
  producer,
  className = '',
  showTooltip = true,
}: AuthorityBadgeProps) {
  const producerDisplay = producer ? formatProducer(producer) : null

  if (!isAuthoritative) {
    return (
      <Badge
        variant="warning"
        className={className}
        title={
          showTooltip
            ? 'This artifact is for real-time assist only and not recorded as evidence.'
            : undefined
        }
      >
        <svg
          className="w-3 h-3 mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Preview
      </Badge>
    )
  }

  return (
    <Badge
      variant="success"
      className={className}
      title={
        showTooltip
          ? 'This artifact is the canonical source of truth and legally defensible.'
          : undefined
      }
    >
      <svg
        className="w-3 h-3 mr-1"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
      {producerDisplay ? `Authoritative (${producerDisplay})` : 'Authoritative'}
    </Badge>
  )
}

/**
 * Format producer name for display
 */
function formatProducer(producer: string): string {
  const producerMap: Record<string, string> = {
    telnyx: 'Telnyx',
    signalwire: 'Telnyx',
    assemblyai: 'AssemblyAI',
    system_cas: 'System',
    system: 'System',
    human: 'Human',
    model: 'AI Model',
    openai: 'OpenAI',
    elevenlabs: 'ElevenLabs',
  }

  return producerMap[producer.toLowerCase()] || producer
}

export default AuthorityBadge

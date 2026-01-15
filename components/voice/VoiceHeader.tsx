"use client"

import React from 'react'
import { useRBAC } from '@/hooks/useRBAC'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface VoiceHeaderProps {
  organizationId: string | null
  organizationName?: string
}

/**
 * VoiceHeader - Professional Design System v3.0
 * 
 * Clean, minimal header with organization context.
 * Light theme, no decorations.
 */
export default function VoiceHeader({ organizationId, organizationName }: VoiceHeaderProps) {
  const { role, plan, loading } = useRBAC(organizationId)

  const planDisplay = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ''
  const roleDisplay = role ? role.charAt(0).toUpperCase() + role.slice(1) : ''

  const needsUpgrade = plan && !['global', 'enterprise'].includes(plan.toLowerCase())

  return (
    <header className="w-full h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between">
      {/* Left: Logo and title */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-900">CallMonitor</h1>
        {organizationName && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">{organizationName}</span>
          </>
        )}
      </div>

      {/* Right: Plan and role info */}
      <div className="flex items-center gap-4">
        {!loading && (
          <>
            {plan && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Plan:</span>
                <Badge variant="info">{planDisplay}</Badge>
              </div>
            )}
            {role && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Role:</span>
                <Badge variant="default">{roleDisplay}</Badge>
              </div>
            )}
            {needsUpgrade && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = '/settings/billing?upgrade=true'
                }}
                aria-label="Upgrade plan"
              >
                Upgrade
              </Button>
            )}
          </>
        )}
      </div>
    </header>
  )
}

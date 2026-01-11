"use client"

import React from 'react'
import { useRBAC } from '@/hooks/useRBAC'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface VoiceHeaderProps {
  organizationId: string | null
  organizationName?: string
}

export default function VoiceHeader({ organizationId, organizationName }: VoiceHeaderProps) {
  const { role, plan, loading } = useRBAC(organizationId)

  const planDisplay = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Loading...'
  const roleDisplay = role ? role.charAt(0).toUpperCase() + role.slice(1) : ''

  const needsUpgrade = plan && !['global', 'enterprise'].includes(plan.toLowerCase())

  return (
    <header className="w-full border-b border-slate-800 bg-slate-950 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-slate-100">CallMonitor – Voice Operations</h1>
          {organizationName && (
            <span className="text-sm text-slate-400">Org: {organizationName}</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {!loading && (
            <>
              {plan && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Plan:</span>
                  <Badge variant="info">{planDisplay}</Badge>
                </div>
              )}
              {role && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Role:</span>
                  <Badge variant="default">{roleDisplay}</Badge>
                </div>
              )}
              {needsUpgrade && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Navigate to upgrade page or open modal
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
      </div>
    </header>
  )
}

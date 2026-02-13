'use client'

/**
 * /teams layout — Teams management shell
 * Wraps all /teams/* routes in RoleShell.
 */
import React from 'react'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import RoleShell from '@/components/layout/RoleShell'

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <RoleShell>{children}</RoleShell>
    </ProtectedGate>
  )
}

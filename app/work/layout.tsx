'use client'

/**
 * /work layout — Agent workspace shell
 *
 * Wraps all /work/* routes in the new RoleShell (agent view).
 * Uses ProtectedGate to enforce authentication.
 */

import React from 'react'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import RoleShell from '@/components/layout/RoleShell'

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <RoleShell>{children}</RoleShell>
    </ProtectedGate>
  )
}

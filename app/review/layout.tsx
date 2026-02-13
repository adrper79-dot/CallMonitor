'use client'

/**
 * /review layout — Call intelligence review shell
 * Wraps all /review/* routes in RoleShell.
 */
import React from 'react'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import RoleShell from '@/components/layout/RoleShell'

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <RoleShell>{children}</RoleShell>
    </ProtectedGate>
  )
}

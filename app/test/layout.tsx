'use client'

/**
 * /test layout — Test dashboard shell
 * Wraps all /test/* routes in RoleShell.
 */
import React from 'react'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import RoleShell from '@/components/layout/RoleShell'

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <RoleShell>{children}</RoleShell>
    </ProtectedGate>
  )
}

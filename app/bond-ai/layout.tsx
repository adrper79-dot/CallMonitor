'use client'

/**
 * /bond-ai layout — Bond AI features shell
 * Wraps all /bond-ai/* routes (including /bond-ai/alerts) in RoleShell.
 */
import React from 'react'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import RoleShell from '@/components/layout/RoleShell'

export default function BondAILayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <RoleShell>{children}</RoleShell>
    </ProtectedGate>
  )
}

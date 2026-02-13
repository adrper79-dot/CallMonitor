'use client'

/**
 * /voice-operations layout — Voice operations shell
 * Wraps all /voice-operations/* routes in RoleShell.
 */
import React from 'react'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import RoleShell from '@/components/layout/RoleShell'

export default function VoiceOperationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <RoleShell>{children}</RoleShell>
    </ProtectedGate>
  )
}

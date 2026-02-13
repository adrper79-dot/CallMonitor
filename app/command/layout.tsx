'use client'

import RoleShell from '@/components/layout/RoleShell'
import { ProtectedGate } from '@/components/auth/ProtectedGate'

export default function CommandLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <RoleShell>{children}</RoleShell>
    </ProtectedGate>
  )
}

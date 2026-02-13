'use client'

import RoleShell from '@/components/layout/RoleShell'
import { ProtectedGate } from '@/components/ui/ProtectedGate'

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <RoleShell>{children}</RoleShell>
    </ProtectedGate>
  )
}

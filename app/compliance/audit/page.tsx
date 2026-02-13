'use client'

/**
 * /compliance/audit — Deep-link to audit trail browser
 */

import dynamic from 'next/dynamic'

const AuditLogBrowser = dynamic(() => import('@/components/compliance/AuditLogBrowser'), { ssr: false })

export default function AuditPage() {
  return (
    <div className="p-4 lg:p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Audit Trail</h1>
      <AuditLogBrowser />
    </div>
  )
}

'use client'

/**
 * /compliance/violations — Deep-link to violations dashboard
 */

import dynamic from 'next/dynamic'

const ViolationDashboard = dynamic(() => import('@/components/compliance/ViolationDashboard'), { ssr: false })

export default function ViolationsPage() {
  return (
    <div className="p-4 lg:p-6">
      <ViolationDashboard />
    </div>
  )
}

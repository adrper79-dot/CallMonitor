'use client'

import dynamic from 'next/dynamic'

const CollectionsKPIs = dynamic(() => import('@/components/analytics/CollectionsKPIs'), { ssr: false })
const CollectionsAnalytics = dynamic(() => import('@/components/voice/CollectionsAnalytics'), { ssr: false })

/**
 * /analytics/collections — Collections-specific KPI dashboard
 * Shows contact rates, PTP rates, aging buckets, and recovery metrics.
 */
export default function CollectionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Collections Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Recovery performance, aging buckets, and contact effectiveness</p>
      </header>

      <CollectionsKPIs />

      {/* Portfolio-level executive insights from existing component */}
      <div className="mt-8">
        <CollectionsAnalytics />
      </div>
    </div>
  )
}

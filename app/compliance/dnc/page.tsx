'use client'

/**
 * /compliance/dnc — Deep-link to Do Not Call list manager
 */

import dynamic from 'next/dynamic'

const DNCManager = dynamic(() => import('@/components/compliance/DNCManager'), { ssr: false })

export default function DNCPage() {
  return (
    <div className="p-4 lg:p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Do Not Call List</h1>
      <DNCManager />
    </div>
  )
}

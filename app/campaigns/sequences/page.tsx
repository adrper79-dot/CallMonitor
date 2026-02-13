'use client'

import dynamic from 'next/dynamic'

const ContactSequenceEditor = dynamic(() => import('@/components/campaigns/ContactSequenceEditor'), { ssr: false })

/**
 * /campaigns/sequences — Contact sequence builder
 * Multi-step outreach flow editor (Call → SMS → Email → Wait).
 */
export default function SequencesPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sequence Builder</h1>
        <p className="text-sm text-gray-500 mt-1">Design multi-step contact sequences for automated outreach</p>
      </header>

      <ContactSequenceEditor />
    </div>
  )
}

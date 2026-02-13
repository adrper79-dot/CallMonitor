'use client'

import dynamic from 'next/dynamic'

const SentimentDashboard = dynamic(
  () => import('@/components/analytics/SentimentDashboard').then(m => m.SentimentDashboard),
  { ssr: false }
)

/**
 * /analytics/sentiment — Deep-dive sentiment analysis
 * Reuses existing SentimentDashboard (242 lines) with full trend visualization.
 */
export default function SentimentPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sentiment Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">Call sentiment trends, scoring, and agent impact</p>
      </header>

      <SentimentDashboard />
    </div>
  )
}

'use client'

import dynamic from 'next/dynamic'

const AgentLeaderboard = dynamic(() => import('@/components/analytics/AgentLeaderboard'), { ssr: false })

/**
 * /analytics/agents — Agent performance leaderboard
 * Gamified ranking with collections, calls, contact rate, and achievement badges.
 */
export default function AgentsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Agent Leaderboard</h1>
        <p className="text-sm text-gray-500 mt-1">Performance rankings, streaks, and achievements</p>
      </header>

      <AgentLeaderboard />
    </div>
  )
}

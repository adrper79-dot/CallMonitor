'use client'

/**
 * /command/live — Live board (real-time agent status grid)
 */

import dynamic from 'next/dynamic'

const LiveBoard = dynamic(() => import('@/components/manager/LiveBoard'), { ssr: false })

export default function LiveBoardPage() {
  return (
    <div className="p-4 lg:p-6">
      <LiveBoard />
    </div>
  )
}

'use client'

import dynamic from 'next/dynamic'

const FollowUpTracker = dynamic(() => import('@/components/schedule/FollowUpTracker'), { ssr: false })

export default function FollowUpsPage() {
  return <FollowUpTracker />
}

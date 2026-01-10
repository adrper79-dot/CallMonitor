import React from 'react'

export default function ActivityFeedEmbed({ callId, limit = 20 }: { callId: string | null; limit?: number }) {
  return (
    <div className="space-y-2">
      {!callId && <div className="text-slate-500">Select a call to see activity</div>}
      {callId && <div className="text-slate-400">Activity feed for {callId} (mock)</div>}
    </div>
  )
}

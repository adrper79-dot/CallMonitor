import React from 'react'

interface CallItem {
  id: string
  status: string
  started_at?: string | null
}

export default function CallList({ calls, selectedCallId, onSelect }: { calls: CallItem[]; selectedCallId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {calls.length === 0 && <div className="text-slate-500">No calls</div>}
      {calls.map((c) => (
        <div key={c.id} className={`p-2 rounded-md cursor-pointer ${selectedCallId === c.id ? 'bg-slate-800' : 'hover:bg-slate-900'}`} onClick={() => onSelect(c.id)}>
          <div className="flex justify-between">
            <div className="font-medium">{c.id}</div>
            <div className="text-sm text-slate-400">{c.status}</div>
          </div>
          <div className="text-xs text-slate-500">{c.started_at ? new Date(c.started_at).toLocaleString() : '—'}</div>
        </div>
      ))}
    </div>
  )
}

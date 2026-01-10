import React, { useState } from 'react'

export default function CallModulations({ callId, initialModulations, onChange }: { callId: string; initialModulations: Record<string, boolean>; onChange: (mods: Record<string, boolean>) => void }) {
  const [mods, setMods] = useState(initialModulations)

  function toggle(key: string) {
    const next = { ...mods, [key]: !mods[key] }
    setMods(next)
    onChange(next)
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.keys(mods).map((k) => (
        <label key={k} className="flex items-center gap-2 p-2 bg-slate-900 rounded-md">
          <input type="checkbox" checked={mods[k]} onChange={() => toggle(k)} />
          <span className="capitalize">{k.replace(/_/g, ' ')}</span>
        </label>
      ))}
    </div>
  )
}

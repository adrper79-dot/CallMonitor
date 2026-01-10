import React from 'react'

export default function EvidenceManifestSummary({ manifest }: { manifest: any | null }) {
  if (!manifest) return <div className="text-slate-500">No evidence manifest</div>

  return (
    <div className="bg-slate-900 p-3 rounded">
      <pre className="text-sm max-h-80 overflow-auto">{JSON.stringify(manifest, null, 2)}</pre>
    </div>
  )
}

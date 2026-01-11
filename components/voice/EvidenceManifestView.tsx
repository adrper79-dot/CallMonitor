"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import EvidenceManifestSummary from './EvidenceManifestSummary'

export interface EvidenceManifestViewProps {
  manifest: any
}

export default function EvidenceManifestView({ manifest }: EvidenceManifestViewProps) {
  const [expanded, setExpanded] = useState(false)

  function exportAsJSON() {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `evidence-manifest-${manifest.id || Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function downloadManifest() {
    exportAsJSON()
  }

  return (
    <section aria-labelledby="manifest-view" className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 id="manifest-view" className="text-lg font-medium text-slate-100">
          Evidence Manifest
        </h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportAsJSON}>
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={downloadManifest}>
            Download
          </Button>
        </div>
      </div>

      <EvidenceManifestSummary manifest={manifest} />

      {expanded && (
        <div className="p-4 bg-slate-900 rounded-md border border-slate-800">
          <div className="text-sm font-medium text-slate-100 mb-2">Provenance Metadata</div>
          <div className="space-y-2 text-xs text-slate-300">
            {manifest.producer && (
              <div>
                <span className="text-slate-400">Producer:</span> {manifest.producer}
              </div>
            )}
            {manifest.created_at && (
              <div>
                <span className="text-slate-400">Created:</span> {new Date(manifest.created_at).toLocaleString()}
              </div>
            )}
            {manifest.manifest_hash && (
              <div>
                <span className="text-slate-400">Hash:</span> <code className="text-slate-200">{manifest.manifest_hash}</code>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-slate-900 rounded-md border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-slate-100">Full Manifest JSON</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
        {expanded && (
          <pre className="text-xs text-slate-200 whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto">
            {JSON.stringify(manifest, null, 2)}
          </pre>
        )}
      </div>
    </section>
  )
}

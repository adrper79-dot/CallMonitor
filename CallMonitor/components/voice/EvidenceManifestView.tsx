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
        <h4 id="manifest-view" className="text-base font-semibold text-[#333333]">
          Evidence Manifest
        </h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportAsJSON} aria-label="Export manifest as JSON">
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={downloadManifest} aria-label="Download manifest">
            Download
          </Button>
        </div>
      </div>

      <EvidenceManifestSummary manifest={manifest} />

      {expanded && (
        <div className="p-4 bg-white border border-[#E5E5E5] rounded">
          <div className="text-sm font-semibold text-[#333333] mb-3">Provenance Metadata</div>
          <div className="space-y-2 text-xs">
            {manifest.producer && (
              <div className="flex items-start gap-2">
                <span className="text-[#666666] font-medium min-w-[80px]">Producer:</span>
                <span className="text-[#333333]">{manifest.producer}</span>
              </div>
            )}
            {manifest.created_at && (
              <div className="flex items-start gap-2">
                <span className="text-[#666666] font-medium min-w-[80px]">Created:</span>
                <span className="text-[#333333]">{new Date(manifest.created_at).toLocaleString()}</span>
              </div>
            )}
            {manifest.manifest_hash && (
              <div className="flex items-start gap-2">
                <span className="text-[#666666] font-medium min-w-[80px]">Hash:</span>
                <code className="text-[#333333] font-mono bg-[#FAFAFA] px-2 py-1 rounded">{manifest.manifest_hash}</code>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E5E5E5] rounded">
        <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5]">
          <div className="text-sm font-semibold text-[#333333]">Full Manifest JSON</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse manifest JSON' : 'Expand manifest JSON'}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
        {expanded && (
          <div className="p-4">
            <pre className="text-xs text-[#333333] whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto bg-[#FAFAFA] p-4 rounded">
              {JSON.stringify(manifest, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}

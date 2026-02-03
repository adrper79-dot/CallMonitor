"use client"

import React, { useState } from 'react'

export interface Artifact {
  type: string
  id: string
  uri?: string
  sha256?: string
}

export interface EvidenceManifest {
  manifest_id: string
  created_at: string
  artifacts: Artifact[]
  manifest_hash?: string
  producer?: string
  [k: string]: any
}

export default function EvidenceManifestSummary({ manifest }: { manifest?: EvidenceManifest | any }) {
  const [expanded, setExpanded] = useState(false)

  if (!manifest) {
    return (
      <div className="p-4 bg-gray-50 rounded-md text-gray-500 text-sm border border-gray-200">No evidence manifest available</div>
    )
  }

  const id = manifest.manifest_id || manifest.id || 'unknown'
  const created = manifest.created_at || manifest.createdAt || 'unknown'
  const artifactsCount = Array.isArray(manifest.artifacts) ? manifest.artifacts.length : 0
  const hash = manifest.manifest_hash || manifest.hash || manifest.manifestHash || 'n/a'

  return (
    <section role="region" aria-label="Evidence manifest summary" className="w-full p-4 bg-white rounded-md border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Manifest</div>
          <div className="text-sm text-gray-800 font-medium">{id}</div>
          <div className="text-xs text-gray-500">{new Date(created).toLocaleString()}</div>
        </div>

        <div className="text-right">
          <div className="text-xs text-gray-500">Artifacts</div>
          <div className="text-sm text-gray-800">{artifactsCount}</div>
          <div className="text-xs text-gray-500 mt-1">{hash}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <button
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          className="text-xs text-[#1E3A5F] hover:underline focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] rounded px-2 py-1"
        >
          {expanded ? 'Hide JSON' : 'Show full manifest'}
        </button>
      </div>

      {expanded ? (
        <pre
          className="mt-3 p-3 rounded bg-gray-50 text-gray-800 text-xs font-mono overflow-auto max-h-80 border border-gray-200"
          tabIndex={0}
          aria-label="Full evidence manifest JSON"
        >
          <code>{JSON.stringify(manifest, null, 2)}</code>
        </pre>
      ) : null}
    </section>
  )
}


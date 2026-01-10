import React from 'react'

export default function AudioPlayer({ recordingUrl, transcriptPreview }: { recordingUrl: string | null; transcriptPreview: string | null }) {
  return (
    <div className="space-y-4">
      {recordingUrl ? (
        <audio controls src={recordingUrl} className="w-full" />
      ) : (
        <div className="text-slate-500">No recording available</div>
      )}

      {transcriptPreview ? (
        <pre className="max-h-48 overflow-auto text-sm bg-slate-900 p-3 rounded">{transcriptPreview}</pre>
      ) : null}
    </div>
  )
}

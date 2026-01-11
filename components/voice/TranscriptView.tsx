"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'

export interface TranscriptViewProps {
  transcript: any
}

export default function TranscriptView({ transcript }: TranscriptViewProps) {
  const [copied, setCopied] = useState(false)

  // Handle different transcript formats
  const transcriptText = 
    typeof transcript === 'string' ? transcript :
    transcript?.text ? transcript.text :
    transcript?.transcript ? transcript.transcript :
    JSON.stringify(transcript, null, 2)

  const segments = transcript?.words || transcript?.segments || []
  const hasTimestamps = segments.length > 0

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(transcriptText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  function exportAsText() {
    const blob = new Blob([transcriptText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transcript-${Date.now()}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportAsJSON() {
    const blob = new Blob([JSON.stringify(transcript, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transcript-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section aria-labelledby="transcript-view" className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 id="transcript-view" className="text-lg font-medium text-slate-100">
          Transcript
        </h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportAsText}>
            Export TXT
          </Button>
          <Button variant="outline" size="sm" onClick={exportAsJSON}>
            Export JSON
          </Button>
        </div>
      </div>

      {hasTimestamps ? (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {segments.map((segment: any, idx: number) => (
            <div
              key={idx}
              className="p-3 bg-slate-900 rounded-md border border-slate-800"
            >
              {segment.start !== undefined && segment.end !== undefined && (
                <div className="text-xs text-slate-400 mb-1 font-mono">
                  {formatTime(segment.start)} - {formatTime(segment.end)}
                </div>
              )}
              {segment.speaker && (
                <div className="text-xs text-indigo-400 mb-1">
                  Speaker {segment.speaker}
                </div>
              )}
              <div className="text-sm text-slate-100">{segment.text || segment.word}</div>
              {segment.confidence !== undefined && (
                <div className="text-xs text-slate-500 mt-1">
                  Confidence: {(segment.confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-slate-900 rounded-md border border-slate-800">
          <pre className="text-sm text-slate-100 whitespace-pre-wrap font-sans">
            {transcriptText}
          </pre>
        </div>
      )}
    </section>
  )
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

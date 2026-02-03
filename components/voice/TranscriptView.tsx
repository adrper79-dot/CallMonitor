"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

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
      logger.error('TranscriptView: clipboard copy failed', err)
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

  function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <section aria-labelledby="transcript-view" className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 id="transcript-view" className="text-base font-semibold text-[#333333]">
          Transcript
        </h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard} aria-label={copied ? 'Copied to clipboard' : 'Copy transcript to clipboard'}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportAsText} aria-label="Export transcript as text file">
            Export TXT
          </Button>
          <Button variant="outline" size="sm" onClick={exportAsJSON} aria-label="Export transcript as JSON file">
            Export JSON
          </Button>
        </div>
      </div>

      {hasTimestamps ? (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto bg-white border border-[#E5E5E5] rounded p-4">
          {segments.map((segment: any, idx: number) => (
            <div
              key={idx}
              className="p-3 bg-[#FAFAFA] border-l-4 border-[#4E79A7] rounded"
            >
              <div className="flex items-start gap-3">
                {(segment.start !== undefined || segment.end !== undefined) && (
                  <div className="text-xs text-[#999999] font-mono whitespace-nowrap flex-shrink-0">
                    {segment.start !== undefined && formatTime(segment.start)}
                    {segment.start !== undefined && segment.end !== undefined && ' - '}
                    {segment.end !== undefined && formatTime(segment.end)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {segment.speaker && (
                    <div className="text-xs font-medium text-[#4E79A7] mb-1">
                      Speaker {segment.speaker}
                    </div>
                  )}
                  <div className="text-sm text-[#333333]">{segment.text || segment.word}</div>
                  {segment.confidence !== undefined && (
                    <div className="text-xs text-[#666666] mt-1">
                      Confidence: {(segment.confidence * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-white border border-[#E5E5E5] rounded">
          <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans max-h-[60vh] overflow-y-auto">
            {transcriptText}
          </pre>
        </div>
      )}
    </section>
  )
}

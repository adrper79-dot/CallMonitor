"use client"

import React, { useEffect, useRef, useState } from 'react'

export interface AudioPlayerProps {
  recordingUrl?: string | null
  transcriptPreview?: string | null
  onPlay?: () => void
}

export default function AudioPlayer({ recordingUrl, transcriptPreview, onPlay }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => { if (el) setTime(el.currentTime) }
    const onDur = () => { if (el) setDuration(isFinite(el.duration) ? el.duration : null) }
    const onPlayEvt = () => { setPlaying(true); onPlay?.() }
    const onPauseEvt = () => { setPlaying(false) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('durationchange', onDur)
    el.addEventListener('play', onPlayEvt)
    el.addEventListener('pause', onPauseEvt)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('durationchange', onDur)
      el.removeEventListener('play', onPlayEvt)
      el.removeEventListener('pause', onPauseEvt)
    }
  }, [onPlay])

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }

  function seek(delta: number) {
    const el = audioRef.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min((el.duration || 0), el.currentTime + delta))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Spacebar') { // space toggles
      e.preventDefault()
      togglePlay()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault(); seek(5)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); seek(-5)
    }
  }

  return (
    <section aria-label="Audio player" role="region" className="w-full p-4 bg-white rounded-md border border-gray-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <button
              onClick={togglePlay}
              onKeyDown={onKeyDown}
              aria-pressed={playing}
              aria-label={playing ? 'Pause audio' : 'Play audio'}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[#1E3A5F] text-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            >
              <span aria-hidden>{playing ? '▮▮' : '▶'}</span>
            </button>
          </div>

          <div className="flex flex-col">
            <div className="text-sm text-gray-800">Audio</div>
            <div className="text-xs text-gray-500">{recordingUrl ? 'Ready to play' : 'No recording available'}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">{Math.floor(time)}s {duration ? ` / ${Math.floor(duration)}s` : ''}</div>
          <div className="text-xs">
            <button onClick={() => seek(-5)} className="text-gray-700 px-2 py-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">-5s</button>
            <button onClick={() => seek(5)} className="ml-2 text-gray-700 px-2 py-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">+5s</button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <audio ref={audioRef} src={recordingUrl || undefined} controls className="w-full rounded" />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-800">Transcript</h4>
          <div className="flex items-center gap-2">
            <a href="#transcript" className="text-xs text-[#1E3A5F] hover:underline">Captions</a>
            <button onClick={() => setExpanded(x => !x)} aria-expanded={expanded} className="text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">{expanded ? 'Collapse' : 'Expand'}</button>
          </div>
        </div>

        <div id="transcript" tabIndex={-1} className={`mt-2 p-3 rounded bg-gray-50 border border-gray-200 ${expanded ? 'max-h-[40vh] overflow-auto' : 'max-h-16 overflow-hidden'}`}>
          {transcriptPreview ? (
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">{transcriptPreview}</pre>
          ) : (
            <div className="text-xs text-gray-400">No transcript available</div>
          )}
        </div>
      </div>
    </section>
  )
}

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
    function onTime() { setTime(el.currentTime) }
    function onDur() { setDuration(isFinite(el.duration) ? el.duration : null) }
    function onPlayEvt() { setPlaying(true); onPlay?.() }
    function onPauseEvt() { setPlaying(false) }
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
    <section aria-label="Audio player" role="region" className="w-full p-4 bg-slate-950 rounded-md">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <button
              onClick={togglePlay}
              onKeyDown={onKeyDown}
              aria-pressed={playing}
              aria-label={playing ? 'Pause audio' : 'Play audio'}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-indigo-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <span aria-hidden>{playing ? '▮▮' : '▶'}</span>
            </button>
          </div>

          <div className="flex flex-col">
            <div className="text-sm text-slate-100">Audio</div>
            <div className="text-xs text-slate-400">{recordingUrl ? 'Ready to play' : 'No recording available'}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400">{Math.floor(time)}s {duration ? ` / ${Math.floor(duration)}s` : ''}</div>
          <div className="text-xs">
            <button onClick={() => seek(-5)} className="text-slate-200 px-2 py-1 rounded hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400">-5s</button>
            <button onClick={() => seek(5)} className="ml-2 text-slate-200 px-2 py-1 rounded hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400">+5s</button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <audio ref={audioRef} src={recordingUrl || undefined} controls className="w-full rounded bg-black" />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-100">Transcript</h4>
          <div className="flex items-center gap-2">
            <a href="#transcript" className="text-xs text-indigo-400 hover:underline">Captions</a>
            <button onClick={() => setExpanded(x => !x)} aria-expanded={expanded} className="text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400">{expanded ? 'Collapse' : 'Expand'}</button>
          </div>
        </div>

        <div id="transcript" tabIndex={-1} className={`mt-2 p-3 rounded bg-slate-800 ${expanded ? 'max-h-[40vh] overflow-auto' : 'max-h-16 overflow-hidden'}`}>
          {transcriptPreview ? (
            <pre className="text-xs text-slate-200 whitespace-pre-wrap">{transcriptPreview}</pre>
          ) : (
            <div className="text-xs text-slate-500">No transcript available</div>
          )}
        </div>
      </div>
    </section>
  )
}

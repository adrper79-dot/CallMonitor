"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export interface RecordingPlayerProps {
  recordingUrl: string
  transcriptPreview?: string | null
  onPlay?: () => void
}

export default function RecordingPlayer({ recordingUrl, transcriptPreview, onPlay }: RecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onTime = () => {
      if (el) setTime(el.currentTime)
    }
    const onDur = () => {
      if (el) setDuration(isFinite(el.duration) ? el.duration : null)
    }
    const onPlayEvt = () => {
      setPlaying(true)
      onPlay?.()
    }
    const onPauseEvt = () => {
      setPlaying(false)
    }
    const onEnded = () => {
      setPlaying(false)
      setTime(0)
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('durationchange', onDur)
    el.addEventListener('play', onPlayEvt)
    el.addEventListener('pause', onPauseEvt)
    el.addEventListener('ended', onEnded)

    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('durationchange', onDur)
      el.removeEventListener('play', onPlayEvt)
      el.removeEventListener('pause', onPauseEvt)
      el.removeEventListener('ended', onEnded)
    }
  }, [onPlay])

  useEffect(() => {
    const el = audioRef.current
    if (el) {
      el.volume = volume
    }
  }, [volume])

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }

  function seek(seconds: number) {
    const el = audioRef.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + seconds))
  }

  function handleSeekBarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current
    if (!el) return
    const newTime = parseFloat(e.target.value)
    el.currentTime = newTime
    setTime(newTime)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      togglePlay()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      seek(5)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      seek(-5)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setVolume(Math.min(1, volume + 0.1))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setVolume(Math.max(0, volume - 0.1))
    }
  }

  function formatTime(seconds: number | null) {
    if (seconds === null) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function downloadRecording() {
    const link = document.createElement('a')
    link.href = recordingUrl
    link.download = `recording-${Date.now()}.mp3`
    link.click()
  }

  return (
    <section aria-label="Audio player" role="region" className="w-full space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          onKeyDown={onKeyDown}
          aria-pressed={playing}
          aria-label={playing ? 'Pause audio' : 'Play audio'}
          className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[#1E3A5F] text-white hover:bg-[#15294A] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-2"
        >
          <span aria-hidden>{playing ? '▮▮' : '▶'}</span>
        </button>

        <div className="flex-1">
          <div className="text-sm text-gray-800 mb-1">Recording</div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={time}
              onChange={handleSeekBarChange}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
              aria-label="Seek position"
            />
            <span className="text-xs text-gray-500 font-mono min-w-[4rem] text-right">
              {formatTime(time)} / {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500" htmlFor="volume-control">
            Volume
          </label>
          <input
            id="volume-control"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
            aria-label="Volume control"
          />
        </div>

        <Button variant="outline" size="sm" onClick={downloadRecording} aria-label="Download recording">
          Download
        </Button>
      </div>

      <audio
        ref={audioRef}
        src={recordingUrl}
        className="hidden"
        preload="metadata"
        aria-label="Audio recording"
      />

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => seek(-5)}
          aria-label="Rewind 5 seconds"
        >
          -5s
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => seek(5)}
          aria-label="Forward 5 seconds"
        >
          +5s
        </Button>
        {transcriptPreview && (
          <a
            href="#transcript"
            className="text-xs text-[#1E3A5F] hover:underline ml-auto"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('artifact-transcript')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            View Transcript →
          </a>
        )}
      </div>

      {transcriptPreview && (
        <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Transcript Preview</div>
          <div className="text-sm text-gray-700 line-clamp-3">{transcriptPreview}</div>
        </div>
      )}
    </section>
  )
}

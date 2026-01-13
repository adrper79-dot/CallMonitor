"use client"

import React, { useState } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { toast } from './ui/use-toast'

export interface TTSGeneratorProps {
  organizationId: string
}

// ElevenLabs voice options (from elevenlabs.ts LANGUAGE_VOICE_MAP)
const VOICE_OPTIONS = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (English Female)', language: 'en', gender: 'female' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (English Male)', language: 'en', gender: 'male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (English Male)', language: 'en', gender: 'male' },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Diego (Spanish Male)', language: 'es', gender: 'male' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Lotte (German Female)', language: 'de', gender: 'female' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Matilda (French Female)', language: 'fr', gender: 'female' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Giovanni (Italian Male)', language: 'it', gender: 'male' },
  { id: 'Yko7PKHZNXotIFUBG7i9', name: 'Antonio (Portuguese Male)', language: 'pt', gender: 'male' },
]

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
]

export default function TTSGenerator({ organizationId }: TTSGeneratorProps) {
  const [text, setText] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id)
  const [generating, setGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const filteredVoices = VOICE_OPTIONS.filter(v => v.language === selectedLanguage)

  const handleGenerate = async () => {
    if (!text.trim() || !organizationId) return

    setGenerating(true)
    setAudioUrl(null)

    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice_id: selectedVoice,
          language: selectedLanguage,
          organization_id: organizationId
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Generation failed')
      }

      const data = await response.json()
      setAudioUrl(data.audio_url)

      toast({
        title: 'Audio generated!',
        description: 'Your text has been converted to speech'
      })
    } catch (err: any) {
      console.error('TTS generation error:', err)
      toast({
        title: 'Generation failed',
        description: err.message || 'An error occurred',
        variant: 'destructive'
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!audioUrl) return
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = 'generated-speech.mp3'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-slate-100">
          Text-to-Speech Generator
        </h3>
        <Badge variant="secondary">ElevenLabs</Badge>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        Convert text to natural-sounding speech with professional voice options.
      </p>

      <div className="space-y-4">
        {/* Text Input */}
        <div>
          <label className="block text-sm text-slate-300 mb-2">
            Text to Convert
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the text you want to convert to speech..."
            rows={4}
            maxLength={5000}
            className="w-full p-3 rounded bg-slate-900 text-white border border-slate-700 focus:border-blue-500 focus:outline-none resize-none"
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-slate-500">
              Max 5,000 characters
            </p>
            <p className="text-xs text-slate-400">
              {text.length} / 5,000
            </p>
          </div>
        </div>

        {/* Voice Options */}
        <div className="grid grid-cols-2 gap-3">
          {/* Language Selection */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value)
                // Auto-select first voice for new language
                const firstVoice = VOICE_OPTIONS.find(v => v.language === e.target.value)
                if (firstVoice) setSelectedVoice(firstVoice.id)
              }}
              className="w-full p-2 rounded bg-slate-900 text-white border border-slate-700"
            >
              {LANGUAGE_OPTIONS.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Selection */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Voice
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full p-2 rounded bg-slate-900 text-white border border-slate-700"
            >
              {filteredVoices.map(voice => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Voice Info */}
        {filteredVoices.find(v => v.id === selectedVoice) && (
          <div className="p-3 bg-slate-900 rounded border border-slate-700">
            <p className="text-xs text-slate-400">
              Selected: <span className="text-slate-200">
                {filteredVoices.find(v => v.id === selectedVoice)?.name}
              </span>
              {' • '}
              <span className="capitalize">
                {filteredVoices.find(v => v.id === selectedVoice)?.gender}
              </span>
            </p>
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={!text.trim() || generating || !organizationId}
          className="w-full"
        >
          {generating ? '⏳ Generating...' : '🎙️ Generate Speech'}
        </Button>

        {/* Audio Player */}
        {audioUrl && (
          <div className="p-4 bg-slate-900 rounded border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-200">
                ✅ Audio Generated
              </p>
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
              >
                ⬇️ Download
              </Button>
            </div>

            <audio
              controls
              src={audioUrl}
              className="w-full"
              preload="metadata"
            >
              Your browser does not support audio playback.
            </audio>

            <p className="text-xs text-slate-500">
              Audio will be available for 24 hours. Download to save permanently.
            </p>
          </div>
        )}

        {/* Help Text */}
        <div className="p-3 bg-blue-900/20 rounded border border-blue-800/50">
          <p className="text-xs text-blue-300">
            💡 <strong>Tip:</strong> Generated audio uses premium ElevenLabs voices for natural-sounding speech. 
            Perfect for IVR prompts, voicemails, or testing translation quality.
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiGet } from '@/lib/apiClient'

interface LanguageDetectionIndicatorProps {
  callId: string
  isActive: boolean
  sourceLanguage?: string
  targetLanguage?: string
  onLanguageDetected?: (lang: string) => void
}

const LANGUAGE_MAP: Record<string, { name: string; flag: string; rtl?: boolean }> = {
  en: { name: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', flag: '🇪🇸' },
  fr: { name: 'French', flag: '🇫🇷' },
  de: { name: 'German', flag: '🇩🇪' },
  zh: { name: 'Chinese', flag: '🇨🇳' },
  ja: { name: 'Japanese', flag: '🇯🇵' },
  pt: { name: 'Portuguese', flag: '🇧🇷' },
  it: { name: 'Italian', flag: '🇮🇹' },
  ko: { name: 'Korean', flag: '🇰🇷' },
  ar: { name: 'Arabic', flag: '🇸🇦', rtl: true },
  hi: { name: 'Hindi', flag: '🇮🇳' },
  ru: { name: 'Russian', flag: '🇷🇺' },
  vi: { name: 'Vietnamese', flag: '🇻🇳' },
  tl: { name: 'Tagalog', flag: '🇵🇭' },
}

/**
 * LanguageDetectionIndicator — Shows detected language during live calls.
 *
 * Displays the detected language with confidence and allows
 * manual language override. Integrates with the translation panel.
 *
 * Professional Design System v3.0
 */
export function LanguageDetectionIndicator({
  callId,
  isActive,
  sourceLanguage,
  targetLanguage,
  onLanguageDetected,
}: LanguageDetectionIndicatorProps) {
  const [detectedLang, setDetectedLang] = useState(sourceLanguage || 'en')
  const [confidence, setConfidence] = useState(0)
  const [showSelector, setShowSelector] = useState(false)

  // Poll for language detection updates
  useEffect(() => {
    if (!isActive || !callId) return

    const poll = async () => {
      try {
        const res = await apiGet<any>(`/api/sentiment/live/${callId}?after=-1`)
        // Language detection piggybacks on sentiment data - check latest translation
        if (res?.scores?.length > 0) {
          // Try to get detected language from translation table
          const translationRes = await apiGet<any>(
            `/api/voice/translate/segments/${callId}?limit=1&order=desc`
          )
          if (translationRes?.segments?.[0]?.source_language) {
            const lang = translationRes.segments[0].source_language
            if (lang !== detectedLang) {
              setDetectedLang(lang)
              onLanguageDetected?.(lang)
            }
          }
        }
      } catch {
        // Non-fatal — detection is supplementary
      }
    }

    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [callId, isActive, detectedLang, onLanguageDetected])

  const langInfo = LANGUAGE_MAP[detectedLang] || { name: detectedLang, flag: '🌐' }

  return (
    <div className="rounded-xl border p-3 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{langInfo.flag}</span>
          <div>
            <div className="text-xs font-medium">
              {langInfo.name}
              {langInfo.rtl && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  RTL
                </Badge>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {isActive ? 'Auto-detected' : 'Source language'}
            </div>
          </div>
        </div>

        {targetLanguage && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>→</span>
            <span>{LANGUAGE_MAP[targetLanguage]?.flag || '🌐'}</span>
            <span>{LANGUAGE_MAP[targetLanguage]?.name || targetLanguage}</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setShowSelector(!showSelector)}
        >
          {showSelector ? 'Close' : 'Change'}
        </Button>
      </div>

      {/* Language selector */}
      {showSelector && (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {Object.entries(LANGUAGE_MAP).map(([code, info]) => (
            <button
              key={code}
              onClick={() => {
                setDetectedLang(code)
                onLanguageDetected?.(code)
                setShowSelector(false)
              }}
              className={`text-xs p-1.5 rounded border transition-colors ${
                code === detectedLang
                  ? 'bg-primary/10 border-primary'
                  : 'hover:bg-muted border-transparent'
              }`}
            >
              {info.flag} {info.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

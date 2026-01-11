"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface TranslationViewProps {
  translation: any
  originalTranscript?: any | null
}

export default function TranslationView({ translation, originalTranscript }: TranslationViewProps) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'toggle'>('side-by-side')
  const [showOriginal, setShowOriginal] = useState(true)

  // Extract translation data
  const translatedText = 
    typeof translation === 'string' ? translation :
    translation?.text ? translation.text :
    translation?.translation ? translation.translation :
    JSON.stringify(translation, null, 2)

  const originalText = 
    originalTranscript?.text || 
    (typeof originalTranscript === 'string' ? originalTranscript : '') ||
    'Original transcript not available'

  const fromLang = translation?.from_language || translation?.from || 'Unknown'
  const toLang = translation?.to_language || translation?.to || 'Unknown'

  return (
    <section aria-labelledby="translation-view" className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 id="translation-view" className="text-lg font-medium text-slate-100">
          Translation
        </h4>
        <div className="flex items-center gap-2">
          <Badge variant="info">{fromLang} → {toLang}</Badge>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('side-by-side')}
            >
              Side by Side
            </Button>
            <Button
              variant={viewMode === 'toggle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('toggle')}
            >
              Toggle
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-900 rounded-md border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="default">{fromLang}</Badge>
            </div>
            <div className="text-sm text-slate-100 whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
              {originalText}
            </div>
          </div>
          <div className="p-4 bg-slate-900 rounded-md border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="info">{toLang}</Badge>
            </div>
            <div className="text-sm text-slate-100 whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
              {translatedText}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={showOriginal ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowOriginal(true)}
            >
              Original ({fromLang})
            </Button>
            <Button
              variant={!showOriginal ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowOriginal(false)}
            >
              Translation ({toLang})
            </Button>
          </div>
          <div className="p-4 bg-slate-900 rounded-md border border-slate-800">
            <div className="text-sm text-slate-100 whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
              {showOriginal ? originalText : translatedText}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

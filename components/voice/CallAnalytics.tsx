'use client'

import React from 'react'

interface SentimentResult {
  text: string
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  confidence: number
  start: number
  end: number
}

interface Entity {
  entity_type: string
  text: string
  start: number
  end: number
}

interface Chapter {
  headline: string
  summary: string
  start: number
  end: number
}

interface Utterance {
  speaker: string
  text: string
  start: number
  end: number
  confidence: number
}

interface CallAnalyticsProps {
  transcriptJson: {
    text?: string
    sentiment_analysis?: SentimentResult[]
    sentiment_summary?: {
      overall: string
      positive_percent: number
      negative_percent: number
      neutral_percent: number
      segment_count: number
    }
    entities?: Entity[]
    chapters?: Chapter[]
    utterances?: Utterance[]
    content_safety?: {
      status: string
      results: Array<{ label: string; confidence: number }>
      summary: Record<string, number>
    }
    iab_categories?: {
      status: string
      results: Array<{ label: string; relevance: number }>
      summary: Record<string, number>
    }
  }
}

/**
 * CallAnalytics - Display AI-powered call intelligence
 * 
 * Shows:
 * - Sentiment analysis with visual breakdown
 * - Entity extraction (people, companies, etc.)
 * - Topic chapters with summaries
 * - Speaker diarization
 * - Content safety flags
 */
export default function CallAnalytics({ transcriptJson }: CallAnalyticsProps) {
  const { 
    sentiment_analysis, 
    sentiment_summary, 
    entities, 
    chapters, 
    utterances,
    content_safety,
    iab_categories 
  } = transcriptJson

  const hasAnalytics = sentiment_analysis || entities || chapters || utterances

  if (!hasAnalytics) {
    return (
      <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 text-center">
        <p className="text-4xl mb-2">📊</p>
        <p className="text-slate-400">Analytics not available for this call</p>
        <p className="text-xs text-slate-500 mt-1">
          Enable transcription to unlock AI-powered insights
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sentiment Overview */}
      {sentiment_summary && (
        <section aria-label="Sentiment Analysis" className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>😊</span> Sentiment Analysis
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Sentiment */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-3 ${
                sentiment_summary.overall === 'POSITIVE' ? 'bg-green-900/50' :
                sentiment_summary.overall === 'NEGATIVE' ? 'bg-red-900/50' : 'bg-slate-700/50'
              }`}>
                <span className="text-5xl">
                  {sentiment_summary.overall === 'POSITIVE' ? '😊' :
                   sentiment_summary.overall === 'NEGATIVE' ? '😟' : '😐'}
                </span>
              </div>
              <p className="text-xl font-bold text-white capitalize">
                {sentiment_summary.overall.toLowerCase()}
              </p>
              <p className="text-xs text-slate-400">Overall Sentiment</p>
            </div>
            
            {/* Breakdown */}
            <div className="space-y-3">
              <SentimentBar 
                label="Positive" 
                value={sentiment_summary.positive_percent} 
                color="green"
                icon="😊"
              />
              <SentimentBar 
                label="Neutral" 
                value={sentiment_summary.neutral_percent} 
                color="slate"
                icon="😐"
              />
              <SentimentBar 
                label="Negative" 
                value={sentiment_summary.negative_percent} 
                color="red"
                icon="😟"
              />
              <p className="text-xs text-slate-500 text-right">
                Based on {sentiment_summary.segment_count} analyzed segments
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Topic Chapters */}
      {chapters && chapters.length > 0 && (
        <section aria-label="Call Topics" className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>📚</span> Call Topics
          </h3>
          
          <div className="space-y-3">
            {chapters.map((chapter, idx) => (
              <div 
                key={idx}
                className="p-4 bg-slate-700/30 rounded-lg border-l-4 border-teal-500"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-slate-100">{chapter.headline}</h4>
                    <p className="text-sm text-slate-400 mt-1">{chapter.summary}</p>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap ml-4">
                    {formatTime(chapter.start)} - {formatTime(chapter.end)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Entities */}
      {entities && entities.length > 0 && (
        <section aria-label="Detected Entities" className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>🏷️</span> Detected Entities
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {groupEntities(entities).map(([type, items]) => (
              <div key={type} className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide">
                  {formatEntityType(type)}
                </p>
                <div className="flex flex-wrap gap-1">
                  {items.map((entity, idx) => (
                    <span 
                      key={idx}
                      className={`px-2 py-1 rounded-full text-xs ${getEntityColor(type)}`}
                    >
                      {entity.text}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Speaker Timeline */}
      {utterances && utterances.length > 0 && (
        <section aria-label="Speaker Timeline" className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>🎙️</span> Speaker Timeline
          </h3>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {utterances.slice(0, 20).map((utterance, idx) => (
              <div 
                key={idx}
                className={`flex gap-3 p-3 rounded-lg ${
                  utterance.speaker === 'A' ? 'bg-blue-900/20' : 'bg-purple-900/20'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  utterance.speaker === 'A' ? 'bg-blue-600' : 'bg-purple-600'
                }`}>
                  {utterance.speaker}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-200">{utterance.text}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatTime(utterance.start)}
                  </p>
                </div>
              </div>
            ))}
            {utterances.length > 20 && (
              <p className="text-xs text-slate-500 text-center">
                +{utterances.length - 20} more segments
              </p>
            )}
          </div>
        </section>
      )}

      {/* Content Safety */}
      {content_safety && content_safety.results && content_safety.results.length > 0 && (
        <section aria-label="Content Safety" className="bg-amber-900/20 rounded-xl border border-amber-700/50 p-5">
          <h3 className="text-lg font-semibold text-amber-200 mb-4 flex items-center gap-2">
            <span>⚠️</span> Content Flags
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {content_safety.results.map((result, idx) => (
              <span 
                key={idx}
                className="px-3 py-1 bg-amber-900/50 text-amber-300 rounded-full text-sm"
              >
                {result.label} ({Math.round(result.confidence * 100)}%)
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Topic Categories */}
      {iab_categories && iab_categories.results && iab_categories.results.length > 0 && (
        <section aria-label="Topic Categories" className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>🏷️</span> Topic Categories
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {iab_categories.results.slice(0, 10).map((cat, idx) => (
              <span 
                key={idx}
                className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-sm"
                title={`Relevance: ${Math.round(cat.relevance * 100)}%`}
              >
                {cat.label.split('>').pop()?.trim() || cat.label}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// Helper functions

function SentimentBar({ label, value, color, icon }: {
  label: string
  value: number
  color: 'green' | 'red' | 'slate'
  icon: string
}) {
  const colorMap = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    slate: 'bg-slate-500'
  }
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">{label}</span>
          <span className="text-slate-300">{value}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${colorMap[color]} transition-all duration-500`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function groupEntities(entities: Entity[]): [string, Entity[]][] {
  const grouped: Record<string, Entity[]> = {}
  
  entities.forEach(entity => {
    if (!grouped[entity.entity_type]) {
      grouped[entity.entity_type] = []
    }
    // Deduplicate
    if (!grouped[entity.entity_type].some(e => e.text === entity.text)) {
      grouped[entity.entity_type].push(entity)
    }
  })
  
  return Object.entries(grouped)
}

function formatEntityType(type: string): string {
  const typeMap: Record<string, string> = {
    person_name: 'People',
    organization: 'Companies',
    location: 'Places',
    phone_number: 'Phone Numbers',
    email_address: 'Emails',
    date: 'Dates',
    money_amount: 'Money',
    occupation: 'Occupations',
    medical_condition: 'Medical',
    blood_type: 'Medical',
    drug: 'Medications'
  }
  return typeMap[type] || type.replace(/_/g, ' ')
}

function getEntityColor(type: string): string {
  const colorMap: Record<string, string> = {
    person_name: 'bg-blue-900/50 text-blue-300',
    organization: 'bg-purple-900/50 text-purple-300',
    location: 'bg-green-900/50 text-green-300',
    phone_number: 'bg-amber-900/50 text-amber-300',
    email_address: 'bg-cyan-900/50 text-cyan-300',
    date: 'bg-rose-900/50 text-rose-300',
    money_amount: 'bg-emerald-900/50 text-emerald-300'
  }
  return colorMap[type] || 'bg-slate-700/50 text-slate-300'
}

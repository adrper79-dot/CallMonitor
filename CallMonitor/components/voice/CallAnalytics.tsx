'use client'

import React from 'react'
import { ProgressBar } from '@/components/tableau/ProgressBar'

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
 * Clean Tableau-style widgets with data-first design
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
      <div className="p-6 bg-white border border-[#E5E5E5] rounded text-center">
        <p className="text-sm text-[#666666] mb-2">Analytics not available for this call</p>
        <p className="text-xs text-[#999999]">
          Enable transcription to unlock AI-powered insights
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sentiment Overview */}
      {sentiment_summary && (
        <section aria-label="Sentiment Analysis" className="bg-white border border-[#E5E5E5] rounded p-5">
          <h3 className="text-base font-semibold text-[#333333] mb-4">
            Sentiment Analysis
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Sentiment */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-3 ${
                sentiment_summary.overall === 'POSITIVE' ? 'bg-[#E8F5E9]' :
                sentiment_summary.overall === 'NEGATIVE' ? 'bg-[#FFEBEE]' : 'bg-gray-100'
              }`}>
                <span className={`text-3xl ${
                  sentiment_summary.overall === 'POSITIVE' ? 'text-[#59A14F]' :
                  sentiment_summary.overall === 'NEGATIVE' ? 'text-[#E15759]' : 'text-gray-500'
                }`}>
                  {sentiment_summary.overall === 'POSITIVE' ? '😊' :
                   sentiment_summary.overall === 'NEGATIVE' ? '😟' : '😐'}
                </span>
              </div>
              <p className="text-xl font-semibold text-[#333333] capitalize mb-1">
                {sentiment_summary.overall.toLowerCase()}
              </p>
              <p className="text-xs text-[#666666]">Overall Sentiment</p>
            </div>
            
            {/* Breakdown */}
            <div className="space-y-3">
              <ProgressBar 
                label="Positive" 
                value={sentiment_summary.positive_percent} 
                color="green"
                showValue={true}
              />
              <ProgressBar 
                label="Neutral" 
                value={sentiment_summary.neutral_percent} 
                color="blue"
                showValue={true}
              />
              <ProgressBar 
                label="Negative" 
                value={sentiment_summary.negative_percent} 
                color="red"
                showValue={true}
              />
              <p className="text-xs text-[#999999] text-right">
                Based on {sentiment_summary.segment_count} analyzed segments
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Topic Chapters */}
      {chapters && chapters.length > 0 && (
        <section aria-label="Call Topics" className="bg-white border border-[#E5E5E5] rounded p-5">
          <h3 className="text-base font-semibold text-[#333333] mb-4">
            Call Topics
          </h3>
          
          <div className="space-y-3">
            {chapters.map((chapter, idx) => (
              <div 
                key={idx}
                className="p-4 bg-[#FAFAFA] border-l-4 border-[#4E79A7] rounded"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium text-[#333333] text-sm">{chapter.headline}</h4>
                    <p className="text-sm text-[#666666] mt-1">{chapter.summary}</p>
                  </div>
                  <span className="text-xs text-[#999999] whitespace-nowrap">
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
        <section aria-label="Detected Entities" className="bg-white border border-[#E5E5E5] rounded p-5">
          <h3 className="text-base font-semibold text-[#333333] mb-4">
            Detected Entities
          </h3>
          
          <div className="space-y-4">
            {groupEntities(entities).map(([type, items]) => (
              <div key={type}>
                <p className="text-xs text-[#666666] uppercase tracking-wide mb-2">
                  {formatEntityType(type)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((entity, idx) => (
                    <span 
                      key={idx}
                      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${getEntityColor(type)}`}
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
        <section aria-label="Speaker Timeline" className="bg-white border border-[#E5E5E5] rounded p-5">
          <h3 className="text-base font-semibold text-[#333333] mb-4">
            Speaker Timeline
          </h3>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {utterances.slice(0, 20).map((utterance, idx) => (
              <div 
                key={idx}
                className={`flex gap-3 p-3 rounded border-l-4 ${
                  utterance.speaker === 'A' 
                    ? 'bg-[#E3F2FD] border-l-[#4E79A7]' 
                    : 'bg-[#F3E5F5] border-l-[#AF7AA1]'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${
                  utterance.speaker === 'A' ? 'bg-[#4E79A7]' : 'bg-[#AF7AA1]'
                }`}>
                  {utterance.speaker}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#333333]">{utterance.text}</p>
                  <p className="text-xs text-[#666666] mt-1">
                    {formatTime(utterance.start)}
                  </p>
                </div>
              </div>
            ))}
            {utterances.length > 20 && (
              <p className="text-xs text-[#999999] text-center pt-2">
                +{utterances.length - 20} more segments
              </p>
            )}
          </div>
        </section>
      )}

      {/* Content Safety */}
      {content_safety && content_safety.results && content_safety.results.length > 0 && (
        <section aria-label="Content Safety" className="bg-white border border-[#E5E5E5] rounded p-5">
          <h3 className="text-base font-semibold text-[#333333] mb-4">
            Content Flags
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {content_safety.results.map((result, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center px-3 py-1 bg-[#FFF8E1] text-[#F57C00] border border-[#FFE082] rounded text-sm font-medium"
              >
                {result.label} ({Math.round(result.confidence * 100)}%)
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Topic Categories */}
      {iab_categories && iab_categories.results && iab_categories.results.length > 0 && (
        <section aria-label="Topic Categories" className="bg-white border border-[#E5E5E5] rounded p-5">
          <h3 className="text-base font-semibold text-[#333333] mb-4">
            Topic Categories
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {iab_categories.results.slice(0, 10).map((cat, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center px-3 py-1 bg-gray-100 text-[#666666] border border-gray-200 rounded text-sm"
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
    person_name: 'bg-[#E3F2FD] text-[#4E79A7] border border-[#BBDEFB]',
    organization: 'bg-[#F3E5F5] text-[#AF7AA1] border border-[#E1BEE7]',
    location: 'bg-[#E8F5E9] text-[#59A14F] border border-[#C8E6C9]',
    phone_number: 'bg-[#FFF8E1] text-[#F57C00] border border-[#FFE082]',
    email_address: 'bg-[#E0F2F1] text-[#76B7B2] border border-[#B2DFDB]',
    date: 'bg-[#FCE4EC] text-[#C2185B] border border-[#F8BBD0]',
    money_amount: 'bg-[#E8F5E9] text-[#388E3C] border border-[#C8E6C9]'
  }
  return colorMap[type] || 'bg-gray-100 text-[#666666] border border-gray-200'
}

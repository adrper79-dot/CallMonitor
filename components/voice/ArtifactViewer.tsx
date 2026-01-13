"use client"

import React, { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import RecordingPlayer from './RecordingPlayer'
import TranscriptView from './TranscriptView'
import TranslationView from './TranslationView'
import SurveyResults from './SurveyResults'
import EvidenceManifestView from './EvidenceManifestView'
import ScoreView from './ScoreView'

export interface ArtifactViewerProps {
  callId: string
  organizationId?: string
  recording: {
    id: string
    recording_url: string
    duration_seconds: number | null
    transcript_json: any | null
    status: string | null
  } | null
  transcript: any | null
  translation: any | null
  manifest: any | null
  score: {
    score: number
    scorecard_id: string | null
    breakdown: any
  } | null
  survey?: any | null
}

export default function ArtifactViewer({
  callId,
  organizationId,
  recording,
  transcript,
  translation,
  manifest,
  score,
  survey,
}: ArtifactViewerProps) {
  const hasRecording = !!recording?.recording_url
  const hasTranscript = !!transcript
  const hasTranslation = !!translation
  const hasSurvey = !!survey
  const hasManifest = !!manifest
  const hasScore = !!score
  const hasAnyArtifact = hasRecording || hasTranscript || hasTranslation

  // Email state
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      setEmailStatus({ type: 'error', message: 'Please enter a valid email address' })
      return
    }

    setEmailSending(true)
    setEmailStatus(null)

    try {
      const res = await fetch(`/api/calls/${callId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: emailAddress,
          includeRecording: hasRecording,
          includeTranscript: hasTranscript,
          includeTranslation: hasTranslation
        })
      })

      const data = await res.json()

      if (data.success) {
        setEmailStatus({ type: 'success', message: `Artifacts sent to ${emailAddress}` })
        setEmailAddress('')
        setTimeout(() => {
          setShowEmailForm(false)
          setEmailStatus(null)
        }, 3000)
      } else {
        setEmailStatus({ type: 'error', message: data.error || 'Failed to send email' })
      }
    } catch (err: any) {
      setEmailStatus({ type: 'error', message: err?.message || 'Failed to send email' })
    } finally {
      setEmailSending(false)
    }
  }

  // Determine default tab
  const defaultTab = hasRecording ? 'recording' : hasTranscript ? 'transcript' : hasManifest ? 'manifest' : 'recording'

  return (
    <section aria-labelledby="artifact-viewer" className="w-full bg-slate-950 rounded-md border border-slate-800">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <h3 id="artifact-viewer" className="text-lg font-medium text-slate-100">
          Artifacts
        </h3>
        {hasAnyArtifact && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmailForm(!showEmailForm)}
            className="text-sm"
          >
            📧 Email Artifacts
          </Button>
        )}
      </div>

      {/* Email Form */}
      {showEmailForm && (
        <div className="p-4 bg-slate-900 border-b border-slate-800">
          <p className="text-sm text-slate-300 mb-2">
            Send all artifacts as email attachments (files, not links):
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              className="flex-1"
              disabled={emailSending}
            />
            <Button
              onClick={handleSendEmail}
              disabled={emailSending || !emailAddress}
              className="whitespace-nowrap"
            >
              {emailSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
          {emailStatus && (
            <p className={`text-sm mt-2 ${emailStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {emailStatus.message}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Includes: {[
              hasRecording && 'Recording',
              hasTranscript && 'Transcript',
              hasTranslation && 'Translation'
            ].filter(Boolean).join(', ') || 'No artifacts'}
          </p>
        </div>
      )}

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full border-b border-slate-800">
          {hasRecording && (
            <TabsTrigger value="recording">
              Recording
            </TabsTrigger>
          )}
          {hasTranscript && (
            <TabsTrigger value="transcript">
              Transcript
            </TabsTrigger>
          )}
          {hasTranslation && (
            <TabsTrigger value="translation">
              Translation
            </TabsTrigger>
          )}
          {hasSurvey && (
            <TabsTrigger value="survey">
              Survey
            </TabsTrigger>
          )}
          {hasManifest && (
            <TabsTrigger value="manifest">
              Manifest
            </TabsTrigger>
          )}
          {hasScore && (
            <TabsTrigger value="score">
              Score
            </TabsTrigger>
          )}
        </TabsList>

        {hasRecording && (
          <TabsContent value="recording" className="p-4">
            <RecordingPlayer
              recordingUrl={recording!.recording_url}
              transcriptPreview={recording!.transcript_json?.text || null}
            />
          </TabsContent>
        )}

        {hasTranscript && (
          <TabsContent value="transcript" className="p-4">
            <TranscriptView transcript={transcript} />
          </TabsContent>
        )}

        {hasTranslation && (
          <TabsContent value="translation" className="p-4">
            <TranslationView translation={translation} originalTranscript={transcript} />
          </TabsContent>
        )}

        {hasSurvey && (
          <TabsContent value="survey" className="p-4">
            <SurveyResults survey={survey} />
          </TabsContent>
        )}

        {hasManifest && (
          <TabsContent value="manifest" className="p-4">
            <EvidenceManifestView manifest={manifest} />
          </TabsContent>
        )}

        {hasScore && (
          <TabsContent value="score" className="p-4">
            <ScoreView score={score} />
          </TabsContent>
        )}

        {!hasRecording && !hasTranscript && !hasTranslation && !hasSurvey && !hasManifest && !hasScore && (
          <div className="p-8 text-center text-slate-400">
            No artifacts available for this call yet.
          </div>
        )}
      </Tabs>
    </section>
  )
}

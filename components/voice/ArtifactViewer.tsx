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
  transcriptionStatus?: 'queued' | 'processing' | 'completed' | 'failed' | null
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
  transcriptionStatus,
}: ArtifactViewerProps) {
  const hasRecording = !!recording?.recording_url
  const hasTranscript = !!transcript
  const hasTranslation = !!translation
  const hasSurvey = !!survey
  const hasManifest = !!manifest
  const hasScore = !!score
  const hasAnyArtifact = hasRecording || hasTranscript || hasTranslation
  const isTranscribing = transcriptionStatus === 'queued' || transcriptionStatus === 'processing'

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

        {!hasRecording && !hasTranscript && !hasTranslation && !hasSurvey && !hasManifest && !hasScore && !isTranscribing && (
          <div className="p-8 text-center text-slate-400">
            No artifacts available for this call yet.
          </div>
        )}

        {/* Transcription in progress indicator */}
        {isTranscribing && !hasTranscript && (
          <div className="p-6 text-center">
            <div className="inline-flex items-center gap-3 px-4 py-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
              <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium text-blue-300">
                  {transcriptionStatus === 'queued' ? 'Transcription queued' : 'Transcribing audio...'}
                </p>
                <p className="text-xs text-blue-400/70">This typically takes 1-3 minutes</p>
              </div>
            </div>
          </div>
        )}

        {/* Transcription failed indicator */}
        {transcriptionStatus === 'failed' && !hasTranscript && (
          <div className="p-6 text-center">
            <div className="inline-flex items-center gap-3 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium text-red-300">Transcription failed</p>
                <p className="text-xs text-red-400/70">The audio could not be transcribed</p>
              </div>
            </div>
          </div>
        )}
      </Tabs>
    </section>
  )
}

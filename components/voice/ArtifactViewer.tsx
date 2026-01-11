"use client"

import React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import RecordingPlayer from './RecordingPlayer'
import TranscriptView from './TranscriptView'
import TranslationView from './TranslationView'
import SurveyResults from './SurveyResults'
import EvidenceManifestView from './EvidenceManifestView'
import ScoreView from './ScoreView'

export interface ArtifactViewerProps {
  callId: string
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

  // Determine default tab
  const defaultTab = hasRecording ? 'recording' : hasTranscript ? 'transcript' : hasManifest ? 'manifest' : 'recording'

  return (
    <section aria-labelledby="artifact-viewer" className="w-full bg-slate-950 rounded-md border border-slate-800">
      <h3 id="artifact-viewer" className="text-lg font-medium text-slate-100 p-4 border-b border-slate-800">
        Artifacts
      </h3>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full border-b border-slate-800">
          {hasRecording && (
            <TabsTrigger value="recording" id="artifact-recording">
              Recording
            </TabsTrigger>
          )}
          {hasTranscript && (
            <TabsTrigger value="transcript" id="artifact-transcript">
              Transcript
            </TabsTrigger>
          )}
          {hasTranslation && (
            <TabsTrigger value="translation" id="artifact-translation">
              Translation
            </TabsTrigger>
          )}
          {hasSurvey && (
            <TabsTrigger value="survey" id="artifact-survey">
              Survey
            </TabsTrigger>
          )}
          {hasManifest && (
            <TabsTrigger value="manifest" id="artifact-manifest">
              Manifest
            </TabsTrigger>
          )}
          {hasScore && (
            <TabsTrigger value="score" id="artifact-score">
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

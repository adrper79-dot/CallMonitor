"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { toast } from './ui/use-toast'
import { logger } from '@/lib/logger'
import { apiGet, apiPost } from '@/lib/apiClient'
import { apiPostFormData } from '@/lib/apiClient'

export interface AudioUploadProps {
  organizationId: string
  onUploadComplete?: (transcriptId: string, transcript?: string) => void
}

export default function AudioUpload({ organizationId, onUploadComplete }: AudioUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pollingId, setPollingId] = useState<string | null>(null)
  const [transcriptResult, setTranscriptResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollCountRef = useRef(0)
  const MAX_POLL_ATTEMPTS = 60 // 5 minutes at 5-second intervals

  // Poll for transcription status
  const pollStatus = useCallback(async (transcriptId: string) => {
    try {
      const data = await apiGet(`/api/audio/status/${transcriptId}`)
      
      if (data.status === 'completed') {
        // Success! Stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        setTranscribing(false)
        setProgress(100)
        setPollingId(null)
        setTranscriptResult(data.transcript || null)
        
        toast({
          title: 'Transcription complete!',
          description: data.transcript 
            ? `${data.transcript.substring(0, 100)}${data.transcript.length > 100 ? '...' : ''}`
            : 'Transcript is ready'
        })
        
        if (onUploadComplete) {
          onUploadComplete(transcriptId, data.transcript)
        }
        return
      }

      if (data.status === 'failed') {
        // Error - stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        setTranscribing(false)
        setPollingId(null)
        
        toast({
          title: 'Transcription failed',
          description: data.error || 'Unknown error occurred',
          variant: 'destructive'
        })
        return
      }

      // Still processing - update progress (visual feedback)
      pollCountRef.current += 1
      const estimatedProgress = Math.min(50 + (pollCountRef.current * 0.8), 95)
      setProgress(estimatedProgress)

      // Check timeout
      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        setTranscribing(false)
        setPollingId(null)
        
        toast({
          title: 'Transcription timeout',
          description: 'Transcription is taking longer than expected. Check back later.',
          variant: 'destructive'
        })
      }
    } catch (err) {
      logger.error('AudioUpload: poll status failed', err)
    }
  }, [onUploadComplete])

  // Start polling when pollingId is set
  useEffect(() => {
    if (pollingId && !pollIntervalRef.current) {
      pollCountRef.current = 0
      pollIntervalRef.current = setInterval(() => {
        pollStatus(pollingId)
      }, 5000) // Poll every 5 seconds
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [pollingId, pollStatus])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/ogg']
    if (!validTypes.some(type => selectedFile.type.includes(type.split('/')[1]))) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an audio file (MP3, WAV, M4A, OGG)',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (max 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 50MB',
        variant: 'destructive'
      })
      return
    }

    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file || !organizationId) return

    setUploading(true)
    setProgress(0)

    try {
      // Step 1: Upload to Supabase Storage via Workers API
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organization_id', organizationId)

      const uploadData = await apiPostFormData('/api/audio/upload', formData)
      setProgress(50)

      // Step 2: Request transcription
      setUploading(false)
      setTranscribing(true)

      const transcribeData = await apiPost('/api/audio/transcribe', {
        organization_id: organizationId,
        audio_url: uploadData.url,
        filename: file.name
      })
      setProgress(50)

      // Start polling for completion (webhook will update status)
      setPollingId(transcribeData.transcript_id)

      toast({
        title: 'Transcription started',
        description: 'Processing audio... This may take a few minutes.'
      })

      // Reset file selection (but keep transcribing state for polling)
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setUploading(false)
      // Note: transcribing remains true until polling completes
    } catch (err: any) {
      logger.error('AudioUpload: upload/transcription failed', err, {
        organizationId
      })
      toast({
        title: 'Upload failed',
        description: err.message || 'An error occurred',
        variant: 'destructive'
      })
      setUploading(false)
      setTranscribing(false)
      setProgress(0)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-slate-100">
          Audio Upload & Transcription
        </h3>
        <Badge variant="secondary">AssemblyAI</Badge>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        Upload audio files for transcription and analysis. Supports MP3, WAV, M4A, OGG (max 50MB).
      </p>

      <div className="space-y-4">
        {/* File Input */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
            id="audio-upload"
          />
          <label htmlFor="audio-upload">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || transcribing}
            >
              {file ? '📎 Change File' : '📁 Select Audio File'}
            </Button>
          </label>
        </div>

        {/* File Info */}
        {file && (
          <div className="p-3 bg-slate-900 rounded border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-100 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-slate-400">
                  {formatFileSize(file.size)} • {file.type}
                </p>
              </div>
              <button
                onClick={() => {
                  setFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="ml-2 text-slate-400 hover:text-red-400"
                disabled={uploading || transcribing}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Progress */}
        {(uploading || transcribing) && (
          <div className="space-y-2">
            <div className="w-full bg-slate-900 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 text-center">
              {uploading && 'Uploading...'}
              {transcribing && 'Transcribing...'}
              {progress}%
            </p>
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!file || uploading || transcribing || !organizationId}
          className="w-full"
        >
          {uploading && '⏳ Uploading...'}
          {transcribing && '🎙️ Transcribing...'}
          {!uploading && !transcribing && '🚀 Upload & Transcribe'}
        </Button>

        {/* Help Text */}
        <p className="text-xs text-slate-500">
          Audio will be uploaded to secure storage and transcribed using AssemblyAI. 
          Results will appear in your Voice Operations page.
        </p>

        {/* Transcript Result */}
        {transcriptResult && (
          <div className="p-4 bg-slate-900 rounded border border-green-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-500">✓</span>
              <span className="text-sm font-medium text-slate-100">Transcription Complete</span>
            </div>
            <p className="text-sm text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {transcriptResult}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(transcriptResult)
                toast({ title: 'Copied to clipboard' })
              }}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Copy to clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

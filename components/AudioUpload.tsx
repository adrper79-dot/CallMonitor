"use client"

import React, { useState, useRef } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { toast } from './ui/use-toast'

export interface AudioUploadProps {
  organizationId: string
  onUploadComplete?: (transcriptId: string) => void
}

export default function AudioUpload({ organizationId, onUploadComplete }: AudioUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      // Step 1: Upload to Supabase Storage
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organization_id', organizationId)

      const uploadRes = await fetch('/api/audio/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok) {
        const error = await uploadRes.json()
        throw new Error(error.error || 'Upload failed')
      }

      const uploadData = await uploadRes.json()
      setProgress(50)

      // Step 2: Request transcription
      setUploading(false)
      setTranscribing(true)

      const transcribeRes = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          audio_url: uploadData.url,
          filename: file.name
        })
      })

      if (!transcribeRes.ok) {
        const error = await transcribeRes.json()
        throw new Error(error.error || 'Transcription failed')
      }

      const transcribeData = await transcribeRes.json()
      setProgress(100)

      toast({
        title: 'Success!',
        description: `Audio uploaded and transcription started. ID: ${transcribeData.transcript_id}`
      })

      // Reset form
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      if (onUploadComplete) {
        onUploadComplete(transcribeData.transcript_id)
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      toast({
        title: 'Upload failed',
        description: err.message || 'An error occurred',
        variant: 'destructive'
      })
    } finally {
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
      </div>
    </div>
  )
}

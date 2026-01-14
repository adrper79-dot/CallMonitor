/**
 * Email Service
 * 
 * Sends emails with artifact attachments using Resend.
 * Supports sending recordings, transcripts, and translations as attachments.
 */

import supabaseAdmin from '@/lib/supabaseAdmin'

const RESEND_API_URL = 'https://api.resend.com/emails'

export interface EmailAttachment {
  filename: string
  content: Buffer | string // Buffer for binary, string for text
  content_type?: string
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  attachments?: EmailAttachment[]
  from?: string
}

export interface ArtifactEmailOptions {
  callId: string
  organizationId: string
  recipientEmail: string
  includeRecording?: boolean
  includeTranscript?: boolean
  includeTranslation?: boolean
}

/**
 * Send an email using Resend API
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  
  if (!apiKey) {
    console.error('emailService: RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  // IMPORTANT: Use verified domain or Resend's test domain
  // For production, set RESEND_FROM_EMAIL to your verified domain (e.g., noreply@voxsouth.online)
  // For testing, Resend allows sending from onboarding@resend.dev
  const fromAddress = options.from || process.env.RESEND_FROM_EMAIL || 'CallMonitor <onboarding@resend.dev>'

  try {
    // Prepare attachments for Resend API format
    const attachments = options.attachments?.map(att => ({
      filename: att.filename,
      content: typeof att.content === 'string' 
        ? att.content 
        : att.content.toString('base64'),
      content_type: att.content_type || 'application/octet-stream'
    }))

    const payload: any = {
      from: fromAddress,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
    }

    if (options.html) {
      payload.html = options.html
    }
    if (options.text) {
      payload.text = options.text
    }
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('emailService: Resend API error', { status: response.status, error: errorText })
      return { success: false, error: `Email send failed: ${response.status}` }
    }

    const result = await response.json()
    console.log('emailService: Email sent successfully', { messageId: result.id, to: options.to })
    
    return { success: true, messageId: result.id }
  } catch (error: any) {
    console.error('emailService: Send failed', { error: error?.message })
    return { success: false, error: error?.message || 'Failed to send email' }
  }
}

/**
 * Send call artifacts (recording, transcript, translation) via email
 * Attaches files directly instead of sending links
 */
export async function sendArtifactEmail(options: ArtifactEmailOptions): Promise<{ success: boolean; error?: string }> {
  const { callId, organizationId, recipientEmail, includeRecording = true, includeTranscript = true, includeTranslation = true } = options

  try {
    // Fetch call details
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('id, started_at, ended_at, status')
      .eq('id', callId)
      .limit(1)

    const call = callRows?.[0]
    if (!call) {
      return { success: false, error: 'Call not found' }
    }

    const attachments: EmailAttachment[] = []
    const artifactSummary: string[] = []

    // Get recording if requested
    if (includeRecording) {
      const { data: recRows } = await supabaseAdmin
        .from('recordings')
        .select('id, recording_url, duration, created_at')
        .eq('call_id', callId)
        .limit(1)

      const recording = recRows?.[0]
      if (recording?.recording_url) {
        try {
          // Download the audio file
          const audioResponse = await fetch(recording.recording_url)
          if (audioResponse.ok) {
            const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
            attachments.push({
              filename: `call-${callId.substring(0, 8)}-recording.mp3`,
              content: audioBuffer,
              content_type: 'audio/mpeg'
            })
            artifactSummary.push(`✅ Recording (${Math.round((recording.duration || 0) / 60)} min)`)
          } else {
            artifactSummary.push('⚠️ Recording (could not download)')
          }
        } catch (err) {
          console.warn('emailService: Could not download recording', { callId, error: (err as any)?.message })
          artifactSummary.push('⚠️ Recording (download failed)')
        }
      }
    }

    // Get transcript if requested
    if (includeTranscript) {
      const { data: recRows } = await supabaseAdmin
        .from('recordings')
        .select('transcript_json')
        .eq('call_id', callId)
        .limit(1)

      const transcriptJson = recRows?.[0]?.transcript_json
      if (transcriptJson) {
        // Format transcript as readable text
        let transcriptText = `Call Transcript\n`
        transcriptText += `Call ID: ${callId}\n`
        transcriptText += `Date: ${new Date(call.started_at || Date.now()).toLocaleString()}\n`
        transcriptText += `Duration: ${transcriptJson.audio_duration ? Math.round(transcriptJson.audio_duration / 60) + ' minutes' : 'N/A'}\n`
        transcriptText += `Language: ${transcriptJson.language_code || 'Unknown'}\n`
        transcriptText += `\n${'='.repeat(50)}\n\n`

        // Add utterances if available
        if (transcriptJson.utterances && Array.isArray(transcriptJson.utterances)) {
          for (const utterance of transcriptJson.utterances) {
            const speaker = utterance.speaker || 'Unknown'
            const startTime = utterance.start ? formatTime(utterance.start) : ''
            transcriptText += `[${startTime}] Speaker ${speaker}:\n${utterance.text}\n\n`
          }
        } else if (transcriptJson.text) {
          transcriptText += transcriptJson.text
        }

        attachments.push({
          filename: `call-${callId.substring(0, 8)}-transcript.txt`,
          content: transcriptText,
          content_type: 'text/plain'
        })
        artifactSummary.push(`✅ Transcript (${transcriptJson.words?.length || 'N/A'} words)`)
      }
    }

    // Get translation if requested
    if (includeTranslation) {
      const { data: aiRows } = await supabaseAdmin
        .from('ai_runs')
        .select('output, status')
        .eq('call_id', callId)
        .in('model', ['assemblyai-translation', 'openai-translation'])
        .eq('status', 'completed')
        .limit(1)

      const translation = aiRows?.[0]
      if (translation?.output) {
        const output = translation.output as any

        // Add translated text
        if (output.translated_text) {
          let translationText = `Translation\n`
          translationText += `Call ID: ${callId}\n`
          translationText += `From: ${output.from_language || 'Unknown'}\n`
          translationText += `To: ${output.to_language || 'Unknown'}\n`
          translationText += `Provider: ${output.provider || 'Unknown'}\n`
          if (output.voice_cloning_used) {
            translationText += `Voice Cloning: Yes\n`
          }
          translationText += `\n${'='.repeat(50)}\n\n`
          translationText += `Original:\n${output.source_text || 'N/A'}\n\n`
          translationText += `Translated:\n${output.translated_text}\n`

          attachments.push({
            filename: `call-${callId.substring(0, 8)}-translation.txt`,
            content: translationText,
            content_type: 'text/plain'
          })
          artifactSummary.push(`✅ Translation (${output.from_language} → ${output.to_language})`)
        }

        // Add translated audio if available
        if (output.translated_audio_url) {
          try {
            const audioResponse = await fetch(output.translated_audio_url)
            if (audioResponse.ok) {
              const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
              attachments.push({
                filename: `call-${callId.substring(0, 8)}-translation-audio.mp3`,
                content: audioBuffer,
                content_type: 'audio/mpeg'
              })
              artifactSummary.push(`✅ Translation Audio${output.voice_cloning_used ? ' (cloned voice)' : ''}`)
            }
          } catch (err) {
            console.warn('emailService: Could not download translation audio', { callId })
          }
        }
      }
    }

    if (attachments.length === 0) {
      return { success: false, error: 'No artifacts available for this call' }
    }

    // Compose email
    const callDate = call.started_at ? new Date(call.started_at).toLocaleDateString() : 'Unknown'
    const subject = `CallMonitor: Call Artifacts - ${callDate}`

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">📞 Call Artifacts</h2>
        <p>Here are the artifacts from your call:</p>
        
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Call ID:</strong> ${callId}</p>
          <p><strong>Date:</strong> ${call.started_at ? new Date(call.started_at).toLocaleString() : 'N/A'}</p>
          <p><strong>Status:</strong> ${call.status || 'Unknown'}</p>
        </div>
        
        <h3>Included Artifacts:</h3>
        <ul style="list-style: none; padding: 0;">
          ${artifactSummary.map(s => `<li style="padding: 4px 0;">${s}</li>`).join('')}
        </ul>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          The artifacts are attached to this email. Please note that audio files may be large.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          Sent by CallMonitor
        </p>
      </div>
    `

    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html,
      attachments
    })

    if (result.success) {
      // Audit log
      try {
        await supabaseAdmin.from('audit_logs').insert({
          id: crypto.randomUUID(),
          organization_id: organizationId,
          user_id: null,
          system_id: null,
          resource_type: 'calls',
          resource_id: callId,
          action: 'email_artifacts',
          before: null,
          after: { 
            recipient: recipientEmail, 
            attachments: attachments.map(a => a.filename),
            messageId: result.messageId
          },
          created_at: new Date().toISOString()
        })
      } catch (_) {}
    }

    return result
  } catch (error: any) {
    console.error('emailService: sendArtifactEmail failed', { error: error?.message, callId })
    return { success: false, error: error?.message || 'Failed to send artifact email' }
  }
}

/**
 * Format milliseconds to MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

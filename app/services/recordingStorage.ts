import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

/**
 * Recording Storage Service - Downloads recordings from SignalWire and uploads to Supabase Storage.
 */

export async function storeRecording(
  recordingUrl: string,
  organizationId: string,
  callId: string,
  recordingId: string
): Promise<string | null> {
  try {
    const signalwireProjectId = process.env.SIGNALWIRE_PROJECT_ID
    const signalwireToken = process.env.SIGNALWIRE_TOKEN

    if (!signalwireProjectId || !signalwireToken) {
      logger.error('recordingStorage: SignalWire credentials not configured')
      return null
    }

    const authHeader = `Basic ${Buffer.from(`${signalwireProjectId}:${signalwireToken}`).toString('base64')}`

    logger.debug('recordingStorage: downloading from SignalWire', { recordingId })

    const response = await fetch(recordingUrl, {
      method: 'GET',
      headers: { 'Accept': 'audio/*', 'Authorization': authHeader }
    })

    if (!response.ok) {
      logger.error('recordingStorage: failed to download from SignalWire', undefined, {
        status: response.status, statusText: response.statusText
      })
      return null
    }

    logger.debug('recordingStorage: download successful', {
      recordingId,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    })

    const audioBuffer = await response.arrayBuffer()

    // Detect content type - handle octet-stream by inferring from URL or defaulting to audio/wav
    let contentType = response.headers.get('content-type') || 'audio/mpeg'
    // If octet-stream, infer from URL or default to wav (SignalWire typically returns wav)
    if (contentType === 'application/octet-stream') {
      if (recordingUrl.includes('.wav')) contentType = 'audio/wav'
      else if (recordingUrl.includes('.mp3')) contentType = 'audio/mpeg'
      else contentType = 'audio/wav' // Default to wav for SignalWire recordings
    }
    const extension = contentType.includes('wav') ? 'wav' : contentType.includes('mp3') ? 'mp3' : 'mp3'

    // Create Blob WITH the correct content type - important for Supabase Storage
    const audioBlob = new Blob([audioBuffer], { type: contentType })

    const storagePath = `${organizationId}/${callId}/${recordingId}.${extension}`

    const { error } = await supabaseAdmin.storage
      .from('recordings')
      .upload(storagePath, audioBlob, { contentType, upsert: false })

    if (error) {
      logger.error('recordingStorage: failed to upload to Supabase Storage', error, { storagePath })
      return null
    }

    logger.info('recordingStorage: uploaded to Supabase Storage', {
      recordingId, storagePath, sizeBytes: audioBuffer.byteLength
    })

    const { data: urlData } = supabaseAdmin.storage.from('recordings').getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl

    await supabaseAdmin.from('recordings').update({
      recording_url: publicUrl,
      updated_at: new Date().toISOString()
    }).eq('id', recordingId)

    logger.info('recordingStorage: stored recording and updated DB', { recordingId, storagePath })

    return storagePath
  } catch (err: any) {
    logger.error('recordingStorage: error', err, { recordingId })
    return null
  }
}

export async function getRecordingSignedUrl(
  organizationId: string,
  callId: string,
  recordingId: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('recording_url')
      .eq('id', recordingId)
      .limit(1)

    if (!recRows || recRows.length === 0) return null

    const extensions = ['mp3', 'wav', 'm4a']
    for (const ext of extensions) {
      const storagePath = `${organizationId}/${callId}/${recordingId}.${ext}`

      const { data, error } = await supabaseAdmin.storage
        .from('recordings')
        .createSignedUrl(storagePath, expiresIn)

      if (!error && data) return data.signedUrl
    }

    return recRows[0].recording_url || null
  } catch (err: any) {
    logger.error('recordingStorage: failed to get signed URL', err, { recordingId })
    return null
  }
}

export async function ensureRecordingsBucket(): Promise<boolean> {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()

    if (listError) {
      logger.error('recordingStorage: failed to list buckets', listError)
      return false
    }

    const recordingsBucket = buckets?.find(b => b.name === 'recordings')

    if (!recordingsBucket) {
      const { error: createError } = await supabaseAdmin.storage.createBucket('recordings', {
        public: true,
        fileSizeLimit: 104857600,
        allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/mp4']
      })

      if (createError) {
        logger.error('recordingStorage: failed to create bucket', createError)
        return false
      }

      logger.info('recordingStorage: created PUBLIC recordings bucket')
    }

    return true
  } catch (err: any) {
    logger.error('recordingStorage: ensure bucket error', err)
    return false
  }
}

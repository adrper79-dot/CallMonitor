import supabaseAdmin from '@/lib/supabaseAdmin'

/**
 * Recording Storage Service
 * 
 * Downloads recordings from SignalWire and uploads to Supabase Storage.
 * Per SECRET_SHOPPER_INFRASTRUCTURE.md and MEDIA_PLANE_ARCHITECTURE.txt
 */

/**
 * Download recording from SignalWire and upload to Supabase Storage
 */
export async function storeRecording(
  recordingUrl: string,
  organizationId: string,
  callId: string,
  recordingId: string
): Promise<string | null> {
  try {
    // Get SignalWire credentials for authentication
    const signalwireProjectId = process.env.SIGNALWIRE_PROJECT_ID
    const signalwireToken = process.env.SIGNALWIRE_TOKEN
    
    if (!signalwireProjectId || !signalwireToken) {
      console.error('recordingStorage: SignalWire credentials not configured')
      return null
    }

    // Create Basic Auth header for SignalWire API
    const authHeader = `Basic ${Buffer.from(`${signalwireProjectId}:${signalwireToken}`).toString('base64')}`
    
    console.log('recordingStorage: downloading from SignalWire', { 
      recordingId,
      hasAuth: true 
    })

    // Download recording from SignalWire with authentication
    const response = await fetch(recordingUrl, {
      method: 'GET',
      headers: {
        'Accept': 'audio/*',
        'Authorization': authHeader
      }
    })

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error('recordingStorage: failed to download from SignalWire', { 
        status: response.status, 
        statusText: response.statusText,
        recordingUrl: '[REDACTED]' 
      })
      return null
    }

    console.log('recordingStorage: download successful', { 
      recordingId,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    })

    const audioBuffer = await response.arrayBuffer()
    const audioBlob = new Blob([audioBuffer])

    // Determine file extension from content type or URL
    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    const extension = contentType.includes('wav') ? 'wav' : 
                     contentType.includes('mp3') ? 'mp3' : 
                     'mp3' // default

    // Storage path: {organization_id}/{call_id}/{recording_id}.{ext}
    const storagePath = `${organizationId}/${callId}/${recordingId}.${extension}`

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('recordings')
      .upload(storagePath, audioBlob, {
        contentType,
        upsert: false
      })

    if (error) {
      // eslint-disable-next-line no-console
      console.error('recordingStorage: failed to upload to Supabase Storage', { 
        error: error.message, 
        storagePath 
      })
      return null
    }

    console.log('recordingStorage: uploaded to Supabase Storage', { 
      recordingId, 
      storagePath,
      sizeBytes: audioBuffer.byteLength
    })

    // Get public URL for the recording
    const { data: urlData } = supabaseAdmin.storage
      .from('recordings')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    // Update recording with Supabase Storage public URL
    await supabaseAdmin
      .from('recordings')
      .update({
        recording_url: publicUrl, // Replace SignalWire URL with Supabase public URL
        updated_at: new Date().toISOString()
      }).eq('id', recordingId)

    // eslint-disable-next-line no-console
    console.log('recordingStorage: stored recording and updated DB', { 
      recordingId, 
      storagePath,
      publicUrl: publicUrl.substring(0, 50) + '...'
    })

    return storagePath
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('recordingStorage: error', { error: err?.message, recordingId })
    return null
  }
}

/**
 * Get signed URL for recording playback
 */
export async function getRecordingSignedUrl(
  organizationId: string,
  callId: string,
  recordingId: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string | null> {
  try {
    // Try to find storage path from recording metadata or construct it
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('recording_url')
      .eq('id', recordingId)
      .limit(1)

    if (!recRows || recRows.length === 0) {
      return null
    }

    // Try common extensions
    const extensions = ['mp3', 'wav', 'm4a']
    for (const ext of extensions) {
      const storagePath = `${organizationId}/${callId}/${recordingId}.${ext}`
      
      const { data, error } = await supabaseAdmin.storage
        .from('recordings')
        .createSignedUrl(storagePath, expiresIn)

      if (!error && data) {
        return data.signedUrl
      }
    }

    // If not found in storage, return original SignalWire URL
    return recRows[0].recording_url || null
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('recordingStorage: failed to get signed URL', { error: err?.message, recordingId })
    return null
  }
}

/**
 * Ensure recordings bucket exists and has proper RLS policies
 */
export async function ensureRecordingsBucket(): Promise<boolean> {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    
    if (listError) {
      // eslint-disable-next-line no-console
      console.error('recordingStorage: failed to list buckets', { error: listError.message })
      return false
    }

    const recordingsBucket = buckets?.find(b => b.name === 'recordings')
    
    if (!recordingsBucket) {
      // Create bucket as PUBLIC so recordings are accessible
      const { data, error: createError } = await supabaseAdmin.storage.createBucket('recordings', {
        public: true, // Public bucket for easy access
        fileSizeLimit: 104857600, // 100 MB max
        allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/mp4']
      })

      if (createError) {
        // eslint-disable-next-line no-console
        console.error('recordingStorage: failed to create bucket', { error: createError.message })
        return false
      }

      // eslint-disable-next-line no-console
      console.log('recordingStorage: created PUBLIC recordings bucket')
    }

    return true
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('recordingStorage: ensure bucket error', { error: err?.message })
    return false
  }
}

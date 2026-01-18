/**
 * Download recording from SignalWire to Supabase Storage
 * 
 * SignalWire recording URLs are private API endpoints that require authentication.
 * This function downloads recordings and stores them in Supabase Storage for public access.
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const signalwireProjectId = process.env.SIGNALWIRE_PROJECT_ID!
const signalwireToken = process.env.SIGNALWIRE_TOKEN!

export async function downloadRecordingToStorage(
  recordingUrl: string,
  recordingId: string,
  organizationId: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    logger.info('downloadRecording: starting download', { recordingId })

    // Download recording from SignalWire with authentication
    const response = await fetch(recordingUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${signalwireProjectId}:${signalwireToken}`).toString('base64')}`
      }
    })

    if (!response.ok) {
      logger.error('downloadRecording: SignalWire fetch failed', undefined, { 
        status: response.status, 
        statusText: response.statusText 
      })
      return { 
        success: false, 
        error: `Failed to download from SignalWire: ${response.status}` 
      }
    }

    // Get recording as buffer
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    logger.debug('downloadRecording: downloaded from SignalWire', { 
      recordingId, 
      sizeBytes: buffer.length 
    })

    // Determine file extension from content-type
    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    const extension = contentType.includes('wav') ? 'wav' : 'mp3'

    // Upload to Supabase Storage
    const filePath = `recordings/${organizationId}/${recordingId}.${extension}`
    
    const { data, error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filePath, buffer, {
        contentType,
        upsert: true // Overwrite if exists
      })

    if (uploadError) {
      logger.error('downloadRecording: Supabase upload failed', uploadError, { 
        recordingId 
      })
      return { 
        success: false, 
        error: `Failed to upload to Supabase: ${uploadError.message}` 
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(filePath)

    logger.info('downloadRecording: successfully stored', { 
      recordingId, 
      publicUrl: urlData.publicUrl 
    })

    return { 
      success: true, 
      publicUrl: urlData.publicUrl 
    }

  } catch (err: any) {
    logger.error('downloadRecording: unexpected error', err, { 
      recordingId 
    })
    return { 
      success: false, 
      error: err.message 
    }
  }
}

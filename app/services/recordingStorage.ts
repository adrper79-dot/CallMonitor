import { logger } from '@/lib/logger'
import { query } from '@/lib/pgClient'
import { getRequestContext } from '@cloudflare/next-on-pages'

/**
 * Recording Storage Service - Downloads recordings from SignalWire and uploads to Cloudflare R2.
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

    const audioBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'audio/wav'
    const extension = contentType.includes('mp3') ? 'mp3' : 'wav'

    // Convert to Node Buffer for R2 API compatibility if needed, or use ArrayBuffer directly supported by Workers
    const audioBufferNode = Buffer.from(audioBuffer)
    const storagePath = `${organizationId}/${callId}/${recordingId}.${extension}`

    // Upload to Cloudflare R2
    try {
      const ctx = getRequestContext()
      if (!ctx?.env?.RECORDINGS_BUCKET) {
        throw new Error('R2 Binding RECORDINGS_BUCKET not found')
      }

      logger.info('recordingStorage: uploading to R2', { storagePath })
      await ctx.env.RECORDINGS_BUCKET.put(storagePath, audioBufferNode, {
        httpMetadata: { contentType }
      })

    } catch (r2Error: any) {
      logger.error('recordingStorage: R2 upload failed', r2Error)
      return null
    }

    logger.info('recordingStorage: uploaded to R2', {
      recordingId, storagePath, sizeBytes: audioBufferNode.byteLength
    })

    // Construct Public URL (Assuming Custom Domain or R2.dev subdomain is configured)
    // For now, we store the R2 path. Code consuming this should know how to construct the full URL.
    // Ideally: https://<custom-domain>/<storagePath>
    const publicUrl = `https://${process.env.PUBLIC_ASSETS_URL || 'assets.gemini-project.com'}/${storagePath}`

    // Update Database using pgClient (Replace Supabase)
    await query(
      `UPDATE recordings SET recording_url = $1, updated_at = NOW() WHERE id = $2`,
      [publicUrl, recordingId]
    )

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
  // Pure R2 implementation would use S3 presign here.
  // For now, returning the stored URL or null if logic requires it.
  // Since we are moving to R2 public access or Worker-mediated access,
  // we query the DB for the URL.

  try {
    const res = await query(`SELECT recording_url FROM recordings WHERE id = $1 LIMIT 1`, [recordingId])
    if (res.rows.length === 0) return null
    return res.rows[0].recording_url
  } catch (err: any) {
    logger.error('recordingStorage: failed to get recording URL', err)
    return null
  }
}

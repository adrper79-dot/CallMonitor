import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/recordings/[key] - Proxy access to R2 recordings with authentication
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const key = params.key
    if (!key) {
      return NextResponse.json({ error: 'Recording key required' }, { status: 400 })
    }

    // Extract call ID from key (format: recordings/callId.webm or just callId)
    const callId = key.replace(/^recordings\//, '').replace(/\.(webm|wav|mp3)$/, '')

    // Verify user has access to this recording through organization membership
    const accessCheck = await query(`
      SELECT c.id, c.organization_id
      FROM calls c
      JOIN organization_memberships om ON c.organization_id = om.organization_id
      WHERE c.id = $1 AND om.user_id = $2
    `, [callId, session.user.id])

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Recording not found or access denied' }, { status: 404 })
    }

    // Access R2 bucket through Cloudflare binding
    const bucket = (globalThis as any).RECORDINGS_BUCKET
    if (!bucket) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    }

    // Get the recording from R2
    const recordingKey = key.startsWith('recordings/') ? key : `recordings/${key}`
    const object = await bucket.get(recordingKey)

    if (!object) {
      return NextResponse.json({ error: 'Recording not found in storage' }, { status: 404 })
    }

    // Stream the recording back to the client
    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType || 'audio/webm')
    headers.set('Content-Length', object.size.toString())
    headers.set('Content-Disposition', `attachment; filename="${callId}.webm"`)
    headers.set('Cache-Control', 'private, max-age=3600') // Cache for 1 hour
    
    return new Response(object.body, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Error retrieving recording:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve recording' },
      { status: 500 }
    )
  }
}

// DELETE /api/recordings/[key] - Delete a recording (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    // Check authentication and admin status
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const key = params.key
    if (!key) {
      return NextResponse.json({ error: 'Recording key required' }, { status: 400 })
    }

    // Extract call ID from key
    const callId = key.replace(/^recordings\//, '').replace(/\.(webm|wav|mp3)$/, '')

    // Verify user is admin of the organization that owns this recording
    const adminCheck = await query(`
      SELECT c.id, c.organization_id, om.role
      FROM calls c
      JOIN organization_memberships om ON c.organization_id = om.organization_id
      WHERE c.id = $1 AND om.user_id = $2 AND om.role = 'admin'
    `, [callId, session.user.id])

    if (adminCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Recording not found or admin access required' }, { status: 403 })
    }

    // Delete from R2
    const bucket = (globalThis as any).RECORDINGS_BUCKET
    if (!bucket) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    }

    const recordingKey = key.startsWith('recordings/') ? key : `recordings/${key}`
    await bucket.delete(recordingKey)

    // Update database to mark recording as deleted
    await query(`
      UPDATE calls 
      SET recording_url = NULL, recording_deleted_at = NOW()
      WHERE id = $1
    `, [callId])

    return NextResponse.json({ success: true, message: 'Recording deleted' })

  } catch (error) {
    console.error('Error deleting recording:', error)
    return NextResponse.json(
      { error: 'Failed to delete recording' },
      { status: 500 }
    )
  }
}
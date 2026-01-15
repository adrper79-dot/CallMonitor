import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api/utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) {
      return ctx
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    // Use authenticated user's org instead of trusting client-provided value
    const organizationId = ctx.orgId

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/ogg', 'audio/webm']
    if (!validTypes.some(type => file.type.includes(type.split('/')[1]))) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExt}`
    const filePath = `uploads/${organizationId}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data, error } = await supabaseAdmin.storage
      .from('recordings')
      .upload(filePath, buffer, { contentType: file.type, upsert: false })

    if (error) {
      logger.error('Upload error', error)
      return NextResponse.json({ error: 'Upload failed: ' + error.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from('recordings').getPublicUrl(filePath)

    return NextResponse.json({ success: true, url: urlData.publicUrl, path: filePath, filename: fileName })
  } catch (error: any) {
    logger.error('Audio upload error', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}

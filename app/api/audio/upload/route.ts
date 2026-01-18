import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api/utils'
import { ApiErrors } from '@/lib/errors/apiHandler'

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
      return ApiErrors.badRequest('No file provided')
    }

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/ogg', 'audio/webm']
    if (!validTypes.some(type => file.type.includes(type.split('/')[1]))) {
      return ApiErrors.badRequest('Invalid file type')
    }

    if (file.size > 50 * 1024 * 1024) {
      return ApiErrors.badRequest('File too large (max 50MB)')
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
      return ApiErrors.internal('Upload failed: ' + error.message)
    }

    const { data: urlData } = supabaseAdmin.storage.from('recordings').getPublicUrl(filePath)

    return NextResponse.json({ success: true, url: urlData.publicUrl, path: filePath, filename: fileName })
  } catch (error: any) {
    logger.error('Audio upload error', error)
    return ApiErrors.internal(error.message || 'Upload failed')
  }
}

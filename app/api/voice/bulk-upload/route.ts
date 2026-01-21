import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import startCallHandler from '@/app/actions/calls/startCallHandler'
import { logger } from '@/lib/logger'
import { requireRole } from '@/lib/api/utils'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and admin/owner role for bulk operations
    const ctx = await requireRole(['owner', 'admin'])
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

    // Read CSV file
    const text = await file.text()

    // Parse CSV
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Record<string, string>[]

    // Validate and process each record
    const results = []

    for (const record of records) {
      const phoneNumber = record.phone_number || record['Phone Number'] || record.PhoneNumber
      const description = record.description || record.Description || ''
      const notes = record.notes || record.Notes || ''

      if (!phoneNumber) {
        results.push({
          phone_number: 'N/A',
          description,
          status: 'error',
          error: 'Missing phone number'
        })
        continue
      }

      // Validate E.164 format
      if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
        results.push({
          phone_number: phoneNumber,
          description,
          status: 'error',
          error: 'Invalid phone format (must be E.164, e.g., +15551234567)'
        })
        continue
      }

      // Initiate call
      try {
        const result = await startCallHandler(
          {
            organization_id: organizationId,
            phone_number: phoneNumber,
            modulations: {
              record: true,
              transcribe: true,
              translate: false
            },
            actor_id: ctx.userId  // SECURITY: Pass authenticated user
          },
          {
            supabaseAdmin: (await import('@/lib/supabaseAdmin')).default
          }
        )

        if (result.success) {
          results.push({
            phone_number: phoneNumber,
            description,
            notes,
            status: 'success',
            call_id: result.call_id
          })
        } else {
          results.push({
            phone_number: phoneNumber,
            description,
            notes,
            status: 'error',
            error: (result.error as any)?.message || 'Call failed'
          })
        }
      } catch (error: any) {
        results.push({
          phone_number: phoneNumber,
          description,
          notes,
          status: 'error',
          error: error.message || 'Unknown error'
        })
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return NextResponse.json({
      success: true,
      total: records.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results
    })

  } catch (error: any) {
    logger.error('Bulk upload error', error)
    return ApiErrors.internal(error.message || 'Failed to process bulk upload')
  }
}

// Generate CSV template
export async function GET() {
  const template = `phone_number,description,notes,results
+15551234567,Test Call 1,Optional notes here,
+15559876543,Test Call 2,Another note,
+15555555555,Test Call 3,,`

  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="bulk_call_template.csv"'
    }
  })
}

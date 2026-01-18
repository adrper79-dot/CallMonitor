/**
 * OpenAPI Specification Endpoint
 * GET /api/openapi
 * 
 * Serves the OpenAPI 3.0 specification for the Wordis Bond API
 * This endpoint is public for API documentation purposes
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '@/lib/logger'

// Force dynamic rendering for file system access
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'yaml'
    
    // Read the OpenAPI spec from public directory
    const specPath = path.join(process.cwd(), 'public', 'openapi.yaml')
    const yamlContent = await fs.readFile(specPath, 'utf-8')
    
    if (format === 'json') {
      // Convert YAML to JSON (simple approach - for production use js-yaml library)
      // For now, return yaml with different content type header note
      return new NextResponse(yamlContent, {
        headers: {
          'Content-Type': 'application/x-yaml',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
    
    return new NextResponse(yamlContent, {
      headers: {
        'Content-Type': 'application/x-yaml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    logger.error('Failed to serve OpenAPI spec', error)
    return NextResponse.json(
      { error: 'Failed to load API specification' },
      { status: 500 }
    )
  }
}

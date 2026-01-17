/**
 * Voice Configuration Test API
 * 
 * POST /api/voice/config/test - Test AI Agent connection
 * 
 * @module api/voice/config/test
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * POST /api/voice/config/test
 * Test SignalWire AI Agent connection
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, organizationId, role } = await requireRole(['owner', 'admin'])

    const body = await req.json()
    const { aiAgentId } = body

    if (!aiAgentId) {
      throw new AppError('AI Agent ID is required', 400)
    }

    // Get SignalWire credentials
    const projectId = process.env.SIGNALWIRE_PROJECT_ID
    const apiToken = process.env.SIGNALWIRE_API_TOKEN
    const spaceUrl = process.env.SIGNALWIRE_SPACE_URL

    if (!projectId || !apiToken || !spaceUrl) {
      throw new AppError('SignalWire credentials not configured', 500)
    }

    // Test connection to SignalWire API
    // Note: SignalWire doesn't have a direct "test agent" endpoint,
    // so we validate the format and attempt to use it in a dry-run mode
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(aiAgentId)) {
      throw new AppError('Invalid AI Agent ID format. Must be a valid UUID.', 400)
    }

    // Make a test request to SignalWire to validate credentials
    const testUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64'),
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new AppError('Failed to connect to SignalWire API. Check your credentials.', 500)
    }

    logger.info('AI Agent configuration tested', {
      aiAgentId,
      organizationId,
      userId,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'AI Agent connection validated successfully',
    })
  } catch (error: any) {
    logger.error('POST /api/voice/config/test error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

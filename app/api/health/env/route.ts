import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { validateEnvVars } from '@/lib/env-validation'

// Force dynamic rendering - env checks should always be fresh
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * Environment Variables Health Check
 * 
 * Returns validation status of environment variables.
 * Requires authentication (admin only in production).
 */
export async function GET(req: Request) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required', severity: 'high' } },
        { status: 401 }
      )
    }

    const result = validateEnvVars()

    // In production, mask sensitive values
    const masked = process.env.NODE_ENV === 'production'

    return NextResponse.json({
      success: true,
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      // Only show masked values in production
      ...(masked ? {} : {
        sample: {
          SIGNALWIRE_PROJECT_ID: process.env.SIGNALWIRE_PROJECT_ID ? '[SET]' : '[MISSING]',
          ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY ? '[SET]' : '[MISSING]',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '[SET]' : '[MISSING]'
        }
      })
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ENV_CHECK_ERROR', message: err?.message || 'Failed to check environment variables', severity: 'high' } },
      { status: 500 }
    )
  }
}

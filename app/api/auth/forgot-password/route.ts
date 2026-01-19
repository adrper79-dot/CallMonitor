import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/forgot-password
 * 
 * Sends a password reset email to the user.
 * Uses Supabase Auth's built-in password reset functionality.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get the app URL for the redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    })

    if (error) {
      logger.error('Password reset error', { error: error.message, email })
      // Don't reveal if email exists or not for security
      return NextResponse.json({ success: true })
    }

    logger.info('Password reset email sent', { email })
    return NextResponse.json({ success: true })

  } catch (error) {
    logger.error('Forgot password error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

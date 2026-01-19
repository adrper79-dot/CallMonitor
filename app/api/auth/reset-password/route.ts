import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/reset-password
 * 
 * Updates the user's password after they've clicked the reset link.
 * Requires the user to be authenticated via the reset token.
 */
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const supabase = supabaseAdmin

    // Update the user's password
    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      logger.error('Password update error', { error: error.message })
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    logger.info('Password reset successful')
    return NextResponse.json({ success: true })

  } catch (error) {
    logger.error('Reset password error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}

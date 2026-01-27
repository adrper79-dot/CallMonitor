import { NextRequest, NextResponse } from 'next/server'
import pgClient from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { scryptSync, randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'edge'

/**
 * POST /api/auth/reset-password
 * 
 * Updates the user's password after they've clicked the reset link.
 * Requires the user to be authenticated via the reset token.
 */
export async function POST(request: NextRequest) {
  try {
    const { password, token } = await request.json()

    if (!token) {
      return NextResponse.json({ success: false, error: 'Reset token required' }, { status: 400 })
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Validate token and look up reset request
    const resetRes = await pgClient.query(`SELECT id, user_id, email, token, expires_at FROM password_resets WHERE token = $1 LIMIT 1`, [token])
    const resetRow = resetRes?.rows && resetRes.rows.length ? resetRes.rows[0] : null
    if (!resetRow) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 400 })
    }

    const expires = new Date(resetRow.expires_at).getTime()
    if (Date.now() > expires) {
      return NextResponse.json({ success: false, error: 'Token expired' }, { status: 400 })
    }

    // Hash the new password (scrypt)
    const salt = randomBytes(16).toString('hex')
    const derived = scryptSync(password, salt, 64).toString('hex')
    const passwordHash = `${salt}:${derived}`

    // Update user password hash
    await pgClient.query(`UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`, [passwordHash, new Date().toISOString(), resetRow.user_id])

    // Invalidate the token
    await pgClient.query(`DELETE FROM password_resets WHERE id = $1`, [resetRow.id])

    logger.info('Password reset successful', { user_id: resetRow.user_id })
    return NextResponse.json({ success: true })

  } catch (error) {
    logger.error('Reset password error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}

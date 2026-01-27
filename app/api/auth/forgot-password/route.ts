import { NextRequest, NextResponse } from 'next/server'
import pgClient from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'edge'

async function sendResetEmail(to: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  const from = process.env.EMAIL_FROM || `no-reply@${(process.env.NEXT_PUBLIC_APP_URL || 'localhost').replace(/^https?:\/\//, '')}`
  const html = `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [to], subject: 'Reset your password', html })
  })
  if (!res.ok) throw new Error(`Resend API error: ${res.status} ${await res.text()}`)
}

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

    // Lookup user by email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    try {
      const userRes = await pgClient.query(`SELECT id, email FROM users WHERE email = $1 LIMIT 1`, [email])
      const user = userRes?.rows && userRes.rows.length ? userRes.rows[0] : null

      if (user) {
        // Create a one-time reset token and persist it
        const token = uuidv4()
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
        await pgClient.query(
          `INSERT INTO password_resets (id, user_id, email, token, expires_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [uuidv4(), user.id, user.email, token, expiresAt, new Date().toISOString()]
        )

        const resetUrl = `${appUrl}/reset-password?token=${token}`
        try {
          await sendResetEmail(user.email, resetUrl)
        } catch (sendErr) {
          logger.error('Failed to send reset email', { error: (sendErr as Error).message })
        }
      }

      // Always return success to avoid revealing account existence
      logger.info('Password reset requested', { email })
      return NextResponse.json({ success: true })
    } catch (err) {
      logger.error('Forgot password processing error', err as Error)
      return NextResponse.json({ success: true })
    }

  } catch (error) {
    logger.error('Forgot password error', { error })
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
  }
}

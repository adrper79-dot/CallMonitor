import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Public Signup API
 * 
 * Allows users to create new accounts.
 * Creates a user in Supabase Auth and returns success.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = body?.email
    const password = body?.password
    const name = body?.name

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_EMAIL', message: 'Invalid email format' } },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } },
        { status: 400 }
      )
    }

    // Support both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'Server configuration error' } },
        { status: 500 }
      )
    }

    // Create user via Supabase Admin API
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`
    const userMetadata: Record<string, any> = {}
    if (name) userMetadata.name = name

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true, // Auto-confirm email (you may want to change this)
        user_metadata: Object.keys(userMetadata).length ? userMetadata : undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      // Handle common errors
      if (res.status === 422 && data?.message?.includes('already registered')) {
        return NextResponse.json(
          { success: false, error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' } },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { success: false, error: { code: 'SIGNUP_FAILED', message: data?.message || 'Failed to create account' } },
        { status: res.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
      user: {
        id: data?.id,
        email: data?.email,
      }
    })

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: err?.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}

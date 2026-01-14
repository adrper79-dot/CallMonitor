import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to diagnose auth issues
 * GET /api/auth/debug
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    
    // Check for session cookies (don't log values, just presence)
    const sessionCookies = {
      'next-auth.session-token': cookieStore.has('next-auth.session-token'),
      '__Secure-next-auth.session-token': cookieStore.has('__Secure-next-auth.session-token'),
      'next-auth.csrf-token': cookieStore.has('next-auth.csrf-token'),
      '__Host-next-auth.csrf-token': cookieStore.has('__Host-next-auth.csrf-token'),
    }
    
    // Try to get session
    let session = null
    let sessionError = null
    try {
      session = await getServerSession(authOptions)
    } catch (e: any) {
      sessionError = e.message
    }
    
    // Check auth config
    const authConfigCheck = {
      hasSecret: !!process.env.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      nextAuthUrl: process.env.NEXTAUTH_URL || 'not set',
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV || 'not set',
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      cookies: sessionCookies,
      session: session ? {
        hasUser: !!session.user,
        userEmail: session.user?.email || null,
        userId: (session.user as any)?.id || null,
        expires: session.expires,
      } : null,
      sessionError,
      authConfig: authConfigCheck,
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 })
  }
}

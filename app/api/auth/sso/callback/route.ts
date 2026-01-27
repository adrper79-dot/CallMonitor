/**
 * SSO Callback Handler
 * 
 * Phase 2: Enterprise Readiness
 * Handles SAML and OIDC callback responses
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import {
  getSSOConfig,
  validateSAMLResponse,
  exchangeOIDCCode,
  getOIDCUserInfo,
  processSSOLogin
} from '@/lib/sso/ssoService'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

// =============================================================================
// POST - Handle SAML Response (POST binding)
// =============================================================================

export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData()
    const samlResponse = formData.get('SAMLResponse') as string
    const relayState = formData.get('RelayState') as string

    if (!samlResponse) {
      logger.error('Missing SAML response in callback')
      return redirectWithError('Missing SAML response')
    }

    // Decode relay state
    let stateData: { callbackUrl: string; configId: string; nonce: string }
    try {
      stateData = JSON.parse(Buffer.from(relayState, 'base64').toString('utf-8'))
    } catch {
      logger.error('Invalid relay state in SAML callback')
      return redirectWithError('Invalid callback state')
    }

    // Get SSO config
    const { data: config } = await supabaseAdmin
      .from('org_sso_configs')
      .select('*')
      .eq('id', stateData.configId)
      .single()

    if (!config) {
      logger.error('SSO config not found', undefined, { configId: stateData.configId })
      return redirectWithError('SSO configuration not found')
    }

    // Validate SAML response
    const validation = await validateSAMLResponse(samlResponse, config)
    if (!validation.success || !validation.assertion) {
      logger.error('SAML validation failed', undefined, { error: validation.error })
      return redirectWithError(validation.error || 'SAML validation failed')
    }

    // Process login
    const { assertion } = validation
    const email = assertion.subject.nameId
    const name = assertion.attributes.name as string | undefined

    const loginResult = await processSSOLogin(
      config,
      email,
      name,
      undefined,
      assertion.subject.nameId,
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    if (!loginResult.success) {
      logger.error('SSO login failed', undefined, { error: loginResult.error })
      return redirectWithError(loginResult.error?.message || 'Login failed')
    }

    // Create session cookie
    const sessionToken = await createSSOSession(loginResult.user!.id, config.organization_id)

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set('next-auth.session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    })

    logger.info('SSO login completed', { userId: loginResult.user!.id, email })

    // Redirect to callback URL or dashboard
    const redirectUrl = stateData.callbackUrl || '/dashboard'
    return NextResponse.redirect(new URL(redirectUrl, process.env.NEXT_PUBLIC_APP_URL))
  } catch (err) {
    logger.error('SSO callback POST error', err as Error)
    return redirectWithError('Authentication failed')
  }
}

// =============================================================================
// GET - Handle OIDC Callback
// =============================================================================

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')

    // Handle error response from IdP
    if (error) {
      logger.error('OIDC callback error', undefined, { error, errorDescription })
      return redirectWithError(errorDescription || error)
    }

    if (!code || !state) {
      logger.error('Missing code or state in OIDC callback')
      return redirectWithError('Invalid callback parameters')
    }

    // Retrieve stored state
    const { data: stateLog } = await supabaseAdmin
      .from('audit_logs')
      .select('after')
      .eq('resource_type', 'sso_state')
      .eq('resource_id', state)
      .single()

    if (!stateLog || !stateLog.after) {
      logger.error('SSO state not found or expired')
      return redirectWithError('Session expired. Please try again.')
    }

    const stateData = stateLog.after as { config_id: string; callback_url: string; expires: number }

    // Check expiry
    if (stateData.expires < Date.now()) {
      logger.error('SSO state expired')
      return redirectWithError('Session expired. Please try again.')
    }

    // Get SSO config
    const { data: config } = await supabaseAdmin
      .from('org_sso_configs')
      .select('*')
      .eq('id', stateData.config_id)
      .single()

    if (!config) {
      logger.error('SSO config not found', undefined, { configId: stateData.config_id })
      return redirectWithError('SSO configuration not found')
    }

    // Exchange code for tokens
    const tokenResult = await exchangeOIDCCode(code, config)
    if (!tokenResult.success || !tokenResult.tokens) {
      logger.error('OIDC token exchange failed')
      return redirectWithError('Authentication failed')
    }

    // Get user info
    const userInfo = await getOIDCUserInfo(tokenResult.tokens.access_token, config)
    if (!userInfo || !userInfo.email) {
      logger.error('Failed to get user info from OIDC provider')
      return redirectWithError('Failed to retrieve user information')
    }

    // Process login
    const loginResult = await processSSOLogin(
      config,
      userInfo.email,
      userInfo.name,
      userInfo.groups,
      undefined,
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    if (!loginResult.success) {
      logger.error('SSO login failed', undefined, { error: loginResult.error })
      return redirectWithError(loginResult.error?.message || 'Login failed')
    }

    // Create session
    const sessionToken = await createSSOSession(loginResult.user!.id, config.organization_id)

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set('next-auth.session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    })

    // Clean up state
    await supabaseAdmin
      .from('audit_logs')
      .delete()
      .eq('resource_type', 'sso_state')
      .eq('resource_id', state)

    logger.info('OIDC login completed', { userId: loginResult.user!.id, email: userInfo.email })

    // Redirect to callback URL or dashboard
    const redirectUrl = stateData.callback_url || '/dashboard'
    return NextResponse.redirect(new URL(redirectUrl, process.env.NEXT_PUBLIC_APP_URL))
  } catch (err) {
    logger.error('SSO callback GET error', err as Error)
    return redirectWithError('Authentication failed')
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function redirectWithError(message: string): Response {
  const errorUrl = new URL('/auth/error', process.env.NEXT_PUBLIC_APP_URL)
  errorUrl.searchParams.set('error', 'SSOError')
  errorUrl.searchParams.set('message', message)
  return NextResponse.redirect(errorUrl)
}

async function createSSOSession(userId: string, organizationId: string): Promise<string> {
  // Generate a session token
  const sessionToken = randomBytes(32).toString('hex')

  // Store session in database
  // Note: In production, integrate with NextAuth's session management
  // This is a simplified approach for SSO sessions
  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    organization_id: organizationId,
    resource_type: 'sso_session',
    resource_id: sessionToken as unknown as string,
    action: 'create',
    after: {
      userId,
      organizationId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  })

  return sessionToken
}

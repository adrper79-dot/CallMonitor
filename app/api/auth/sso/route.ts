/**
 * SSO Authentication API Routes
 * 
 * Phase 2: Enterprise Readiness
 * Handles SAML and OIDC SSO flows
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { AppError } from '@/types/app-error'
import {
  getSSOConfig,
  getSSOConfigByDomain,
  generateSAMLAuthnRequest,
  generateOIDCAuthUrl,
  generateSPMetadata,
  isSSORquired
} from '@/lib/sso/ssoService'
import { withRateLimit } from '@/lib/rateLimit'
import { randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

// =============================================================================
// GET - SSO Configuration & Metadata
// =============================================================================

async function handleGET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  try {
    // Return SP SAML metadata
    if (action === 'metadata') {
      const metadata = generateSPMetadata()
      return new Response(metadata, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=86400'
        }
      })
    }

    // Check if SSO is required for an email
    if (action === 'check') {
      const email = url.searchParams.get('email')
      if (!email) {
        return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 })
      }

      const result = await isSSORquired(email)
      return NextResponse.json({
        success: true,
        sso_required: result.required,
        provider_type: result.config?.provider_type,
        provider_name: result.config?.provider_name
      })
    }

    // Get SSO config for authenticated user's org
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Please sign in', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const userId = (session.user as any).id
    const orgId = url.searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization ID required' }, { status: 400 })
    }

    // Verify user is admin/owner of org
    const { data: membership } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      const err = new AppError({ code: 'FORBIDDEN', message: 'Access denied', user_message: 'Admin access required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Get all SSO configs for org
    const { data: configs, error } = await supabaseAdmin
      .from('org_sso_configs')
      .select('id, provider_type, provider_name, is_enabled, verified_domains, require_sso, auto_provision_users, default_role, created_at, updated_at, last_login_at, login_count')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Failed to fetch SSO configs', error, { orgId })
      return NextResponse.json({ success: false, error: 'Failed to fetch SSO configurations' }, { status: 500 })
    }

    return NextResponse.json({ success: true, configs: configs || [] })
  } catch (err) {
    logger.error('SSO GET handler error', err as Error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}

// =============================================================================
// POST - Create SSO Config or Initiate SSO Login
// =============================================================================

async function handlePOST(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { action } = body

    // Initiate SSO login flow
    if (action === 'login') {
      const { email, callback_url } = body

      if (!email) {
        return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 })
      }

      const config = await getSSOConfigByDomain(email)
      if (!config) {
        return NextResponse.json({
          success: false,
          sso_available: false,
          error: 'No SSO configuration found for this email domain'
        }, { status: 404 })
      }

      // Generate state for CSRF protection
      const state = randomBytes(32).toString('hex')

      // Store state temporarily (in production, use Redis or similar)
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        resource_type: 'sso_state',
        resource_id: state as unknown as string,
        action: 'create',
        after: {
          config_id: config.id,
          callback_url: callback_url || '/',
          expires: Date.now() + 600000 // 10 minutes
        }
      })

      let authUrl: string
      if (config.provider_type === 'saml' || config.provider_type === 'okta') {
        authUrl = generateSAMLAuthnRequest(config, callback_url || '/')
      } else {
        authUrl = generateOIDCAuthUrl(config, state)
      }

      logger.info('SSO login initiated', { email, provider: config.provider_type })

      return NextResponse.json({
        success: true,
        sso_available: true,
        redirect_url: authUrl,
        provider_type: config.provider_type,
        provider_name: config.provider_name
      })
    }

    // Create/Update SSO configuration
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Please sign in', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { orgId, config } = body

    if (!orgId || !config) {
      return NextResponse.json({ success: false, error: 'Organization ID and config required' }, { status: 400 })
    }

    // Verify user is owner of org
    const { data: membership } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .single()

    if (!membership || membership.role !== 'owner') {
      const err = new AppError({ code: 'FORBIDDEN', message: 'Owner access required', user_message: 'Only organization owners can configure SSO', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Validate required fields based on provider type
    if (!config.provider_type || !config.provider_name) {
      return NextResponse.json({ success: false, error: 'Provider type and name required' }, { status: 400 })
    }

    if ((config.provider_type === 'saml' || config.provider_type === 'okta') &&
      (!config.saml_entity_id || !config.saml_sso_url || !config.saml_certificate)) {
      return NextResponse.json({
        success: false,
        error: 'SAML configuration requires Entity ID, SSO URL, and Certificate'
      }, { status: 400 })
    }

    if (['oidc', 'azure_ad', 'google_workspace'].includes(config.provider_type) &&
      (!config.oidc_client_id || !config.oidc_issuer_url)) {
      return NextResponse.json({
        success: false,
        error: 'OIDC configuration requires Client ID and Issuer URL'
      }, { status: 400 })
    }

    // Upsert SSO config
    const { data: savedConfig, error } = await supabaseAdmin
      .from('org_sso_configs')
      .upsert({
        ...config,
        organization_id: orgId,
        created_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id,provider_type'
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to save SSO config', error, { orgId })
      return NextResponse.json({ success: false, error: 'Failed to save SSO configuration' }, { status: 500 })
    }

    // Log audit event
    await supabaseAdmin.from('audit_logs').insert({
      id: uuidv4(),
      organization_id: orgId,
      user_id: userId,
      resource_type: 'sso_config',
      resource_id: savedConfig.id,
      action: 'create',
      after: { provider_type: config.provider_type, provider_name: config.provider_name }
    })

    logger.info('SSO config saved', { orgId, provider: config.provider_type })

    return NextResponse.json({
      success: true,
      config: {
        id: savedConfig.id,
        provider_type: savedConfig.provider_type,
        provider_name: savedConfig.provider_name,
        is_enabled: savedConfig.is_enabled
      }
    })
  } catch (err) {
    logger.error('SSO POST handler error', err as Error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}

// =============================================================================
// DELETE - Remove SSO Configuration
// =============================================================================

async function handleDELETE(req: Request): Promise<Response> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Please sign in', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const url = new URL(req.url)
    const configId = url.searchParams.get('configId')
    const orgId = url.searchParams.get('orgId')
    const userId = (session.user as any).id

    if (!configId || !orgId) {
      return NextResponse.json({ success: false, error: 'Config ID and Org ID required' }, { status: 400 })
    }

    // Verify user is owner of org
    const { data: membership } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .single()

    if (!membership || membership.role !== 'owner') {
      const err = new AppError({ code: 'FORBIDDEN', message: 'Owner access required', user_message: 'Only organization owners can delete SSO configurations', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Delete config
    const { error } = await supabaseAdmin
      .from('org_sso_configs')
      .delete()
      .eq('id', configId)
      .eq('organization_id', orgId)

    if (error) {
      logger.error('Failed to delete SSO config', error, { configId, orgId })
      return NextResponse.json({ success: false, error: 'Failed to delete SSO configuration' }, { status: 500 })
    }

    // Log audit event
    await supabaseAdmin.from('audit_logs').insert({
      id: uuidv4(),
      organization_id: orgId,
      user_id: userId,
      resource_type: 'sso_config',
      resource_id: configId as unknown as string,
      action: 'delete'
    })

    logger.info('SSO config deleted', { configId, orgId })

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('SSO DELETE handler error', err as Error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const GET = withRateLimit(handleGET, { config: { maxAttempts: 60, windowMs: 60000, blockMs: 300000 } })
export const POST = withRateLimit(handlePOST, { config: { maxAttempts: 20, windowMs: 60000, blockMs: 300000 } })
export const DELETE = withRateLimit(handleDELETE, { config: { maxAttempts: 10, windowMs: 60000, blockMs: 300000 } })

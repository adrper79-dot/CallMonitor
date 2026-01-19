/**
 * Enterprise SSO Service
 * 
 * Phase 2: Enterprise Readiness - SSO/SAML Implementation
 * Handles SAML 2.0 and OIDC authentication for enterprise customers.
 * 
 * Supported Providers:
 * - Okta (SAML 2.0)
 * - Azure AD (OIDC)
 * - Google Workspace (OIDC)
 * - Custom SAML/OIDC providers
 */

import { logger } from '@/lib/logger'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { createHash, randomBytes } from 'crypto'

// =============================================================================
// TYPES
// =============================================================================

export type SSOProviderType = 'saml' | 'oidc' | 'azure_ad' | 'okta' | 'google_workspace'

export interface SSOConfig {
  id: string
  organization_id: string
  provider_type: SSOProviderType
  provider_name: string
  is_enabled: boolean
  
  // SAML Configuration
  saml_entity_id?: string
  saml_sso_url?: string
  saml_slo_url?: string
  saml_certificate?: string
  saml_signature_algorithm?: string
  saml_name_id_format?: string
  
  // OIDC Configuration
  oidc_client_id?: string
  oidc_client_secret_encrypted?: string
  oidc_issuer_url?: string
  oidc_authorization_url?: string
  oidc_token_url?: string
  oidc_userinfo_url?: string
  oidc_scopes?: string[]
  
  // Domain & Provisioning
  verified_domains: string[]
  auto_provision_users: boolean
  default_role: string
  require_sso: boolean
  
  // Attribute Mapping
  attribute_mapping: Record<string, string>
  group_mapping: Record<string, string>
  
  created_at: string
  updated_at: string
}

export interface SSOLoginResult {
  success: boolean
  user?: {
    id: string
    email: string
    name?: string
    groups?: string[]
  }
  error?: {
    code: string
    message: string
  }
  redirect_url?: string
}

export interface SAMLAssertion {
  issuer: string
  subject: {
    nameId: string
    nameIdFormat: string
  }
  conditions: {
    notBefore: Date
    notOnOrAfter: Date
  }
  attributes: Record<string, string | string[]>
  sessionIndex?: string
}

// =============================================================================
// SSO CONFIGURATION MANAGEMENT
// =============================================================================

/**
 * Get SSO configuration for an organization
 */
export async function getSSOConfig(organizationId: string): Promise<SSOConfig | null> {
  const { data, error } = await supabaseAdmin
    .from('org_sso_configs')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_enabled', true)
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data as SSOConfig
}

/**
 * Get SSO configuration by email domain
 */
export async function getSSOConfigByDomain(email: string): Promise<SSOConfig | null> {
  const domain = email.toLowerCase().split('@')[1]
  if (!domain) return null

  const { data, error } = await supabaseAdmin
    .from('org_sso_configs')
    .select('*')
    .eq('is_enabled', true)
    .contains('verified_domains', [domain])
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data as SSOConfig
}

/**
 * Check if SSO is required for a given email
 */
export async function isSSORquired(email: string): Promise<{
  required: boolean
  config?: SSOConfig
  redirectUrl?: string
}> {
  const config = await getSSOConfigByDomain(email)
  
  if (!config) {
    return { required: false }
  }

  return {
    required: config.require_sso,
    config,
    redirectUrl: config.saml_sso_url || config.oidc_authorization_url
  }
}

/**
 * Create or update SSO configuration
 */
export async function upsertSSOConfig(
  organizationId: string,
  config: Partial<SSOConfig>,
  userId: string
): Promise<{ success: boolean; config?: SSOConfig; error?: string }> {
  try {
    // Encrypt client secret if provided
    let processedConfig = { ...config }
    if (config.oidc_client_secret_encrypted) {
      processedConfig.oidc_client_secret_encrypted = encryptSecret(config.oidc_client_secret_encrypted)
    }

    const { data, error } = await supabaseAdmin
      .from('org_sso_configs')
      .upsert({
        ...processedConfig,
        organization_id: organizationId,
        updated_by: userId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id,provider_type'
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to upsert SSO config', error, { organizationId })
      return { success: false, error: error.message }
    }

    // Log the configuration change
    await logSSOAuditEvent(organizationId, userId, 'sso_config_updated', { provider_type: config.provider_type })

    return { success: true, config: data }
  } catch (err) {
    logger.error('SSO config upsert failed', err as Error, { organizationId })
    return { success: false, error: 'Failed to save SSO configuration' }
  }
}

/**
 * Delete SSO configuration
 */
export async function deleteSSOConfig(
  organizationId: string,
  configId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('org_sso_configs')
      .delete()
      .eq('id', configId)
      .eq('organization_id', organizationId)

    if (error) {
      logger.error('Failed to delete SSO config', error, { organizationId, configId })
      return { success: false, error: error.message }
    }

    await logSSOAuditEvent(organizationId, userId, 'sso_config_deleted', { config_id: configId })

    return { success: true }
  } catch (err) {
    logger.error('SSO config delete failed', err as Error, { organizationId })
    return { success: false, error: 'Failed to delete SSO configuration' }
  }
}

// =============================================================================
// SAML AUTHENTICATION
// =============================================================================

/**
 * Generate SAML AuthnRequest URL for Okta/SAML providers
 */
export function generateSAMLAuthnRequest(config: SSOConfig, callbackUrl: string): string {
  const requestId = `_${randomBytes(16).toString('hex')}`
  const issueInstant = new Date().toISOString()
  
  // Service Provider entity ID (our application)
  const spEntityId = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/metadata`
  
  // Assertion Consumer Service URL
  const acsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/callback`
  
  // Build AuthnRequest XML
  const authnRequest = `
    <samlp:AuthnRequest
      xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${requestId}"
      Version="2.0"
      IssueInstant="${issueInstant}"
      Destination="${config.saml_sso_url}"
      ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      AssertionConsumerServiceURL="${acsUrl}">
      <saml:Issuer>${spEntityId}</saml:Issuer>
      <samlp:NameIDPolicy
        Format="urn:oasis:names:tc:SAML:1.1:nameid-format:${config.saml_name_id_format || 'emailAddress'}"
        AllowCreate="true"/>
    </samlp:AuthnRequest>
  `.trim().replace(/\s+/g, ' ')

  // Encode and build redirect URL
  const encodedRequest = Buffer.from(authnRequest).toString('base64')
  const relayState = Buffer.from(JSON.stringify({ 
    callbackUrl, 
    configId: config.id,
    nonce: randomBytes(16).toString('hex')
  })).toString('base64')

  const ssoUrl = new URL(config.saml_sso_url!)
  ssoUrl.searchParams.set('SAMLRequest', encodedRequest)
  ssoUrl.searchParams.set('RelayState', relayState)

  logger.info('Generated SAML AuthnRequest', { 
    configId: config.id, 
    requestId,
    providerType: config.provider_type 
  })

  return ssoUrl.toString()
}

/**
 * Validate and parse SAML Response
 * Note: In production, use a proper SAML library like @node-saml/node-saml
 */
export async function validateSAMLResponse(
  samlResponse: string,
  config: SSOConfig
): Promise<{ success: boolean; assertion?: SAMLAssertion; error?: string }> {
  try {
    // Decode the SAML response
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8')
    
    // In production, implement proper XML signature validation
    // This is a simplified example - use @node-saml/node-saml for production
    
    // Extract NameID (email)
    const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i)
    const emailMatch = decoded.match(/<saml:Attribute Name="email"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/i)
    const nameMatch = decoded.match(/<saml:Attribute Name="(displayName|name)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/i)
    
    const email = emailMatch?.[1] || nameIdMatch?.[1]
    if (!email) {
      return { success: false, error: 'No email found in SAML response' }
    }

    const assertion: SAMLAssertion = {
      issuer: config.saml_entity_id || '',
      subject: {
        nameId: email,
        nameIdFormat: config.saml_name_id_format || 'emailAddress'
      },
      conditions: {
        notBefore: new Date(),
        notOnOrAfter: new Date(Date.now() + 300000) // 5 minutes
      },
      attributes: {
        email,
        name: nameMatch?.[2] || email.split('@')[0]
      }
    }

    logger.info('SAML response validated', { configId: config.id, email })
    return { success: true, assertion }
  } catch (err) {
    logger.error('SAML validation failed', err as Error)
    return { success: false, error: 'Invalid SAML response' }
  }
}

// =============================================================================
// OIDC AUTHENTICATION
// =============================================================================

/**
 * Generate OIDC authorization URL
 */
export function generateOIDCAuthUrl(config: SSOConfig, state: string): string {
  const authUrl = new URL(config.oidc_authorization_url || `${config.oidc_issuer_url}/authorize`)
  
  authUrl.searchParams.set('client_id', config.oidc_client_id!)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/callback`)
  authUrl.searchParams.set('scope', (config.oidc_scopes || ['openid', 'email', 'profile']).join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('nonce', randomBytes(16).toString('hex'))

  logger.info('Generated OIDC auth URL', { configId: config.id })
  return authUrl.toString()
}

/**
 * Exchange OIDC code for tokens
 */
export async function exchangeOIDCCode(
  code: string,
  config: SSOConfig
): Promise<{ success: boolean; tokens?: any; error?: string }> {
  try {
    const tokenUrl = config.oidc_token_url || `${config.oidc_issuer_url}/token`
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.oidc_client_id!,
        client_secret: decryptSecret(config.oidc_client_secret_encrypted!),
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/callback`
      })
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('OIDC token exchange failed', undefined, { error })
      return { success: false, error: 'Token exchange failed' }
    }

    const tokens = await response.json()
    return { success: true, tokens }
  } catch (err) {
    logger.error('OIDC token exchange error', err as Error)
    return { success: false, error: 'Token exchange failed' }
  }
}

/**
 * Get user info from OIDC provider
 */
export async function getOIDCUserInfo(
  accessToken: string,
  config: SSOConfig
): Promise<{ email: string; name?: string; groups?: string[] } | null> {
  try {
    const userInfoUrl = config.oidc_userinfo_url || `${config.oidc_issuer_url}/userinfo`
    
    const response = await fetch(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      return null
    }

    const userInfo = await response.json()
    
    // Apply attribute mapping
    const mapping = config.attribute_mapping
    return {
      email: userInfo[mapping.email || 'email'],
      name: userInfo[mapping.name || 'name'],
      groups: userInfo[mapping.groups || 'groups']
    }
  } catch (err) {
    logger.error('OIDC userinfo fetch failed', err as Error)
    return null
  }
}

// =============================================================================
// SSO SESSION MANAGEMENT
// =============================================================================

/**
 * Process SSO login and create/link user
 */
export async function processSSOLogin(
  config: SSOConfig,
  email: string,
  name?: string,
  groups?: string[],
  idpSubject?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<SSOLoginResult> {
  try {
    // Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('email', email.toLowerCase())
      .single()

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      
      // Update user name if provided and different
      if (name && name !== existingUser.name) {
        await supabaseAdmin
          .from('users')
          .update({ name })
          .eq('id', userId)
      }
    } else if (config.auto_provision_users) {
      // Auto-provision new user
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError || !newUser) {
        logger.error('Failed to provision SSO user', createError, { email })
        return {
          success: false,
          error: { code: 'PROVISION_FAILED', message: 'Failed to create user account' }
        }
      }

      userId = newUser.id

      // Add to organization with default role
      const { error: memberError } = await supabaseAdmin
        .from('org_members')
        .upsert({
          organization_id: config.organization_id,
          user_id: userId,
          role: config.default_role
        }, { onConflict: 'organization_id,user_id' })
        
      logger.info('SSO user auto-provisioned', { userId, email, organizationId: config.organization_id })
    } else {
      // User doesn't exist and auto-provision is disabled
      await recordSSOLoginEvent(config, 'login_failure', email, name, groups, ipAddress, userAgent, 'USER_NOT_FOUND', 'User not found and auto-provision disabled')
      
      return {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'No account found. Contact your administrator.' }
      }
    }

    // Apply group mappings if configured
    if (groups && Object.keys(config.group_mapping).length > 0) {
      for (const group of groups) {
        const mappedRole = config.group_mapping[group]
        if (mappedRole) {
          await supabaseAdmin
            .from('org_members')
            .update({ role: mappedRole })
            .eq('organization_id', config.organization_id)
            .eq('user_id', userId)
        }
      }
    }

    // Record successful login
    await recordSSOLoginEvent(config, 'login_success', email, name, groups, ipAddress, userAgent)

    logger.info('SSO login successful', { userId, email, configId: config.id })

    return {
      success: true,
      user: {
        id: userId,
        email: email.toLowerCase(),
        name,
        groups
      }
    }
  } catch (err) {
    logger.error('SSO login processing failed', err as Error, { email })
    return {
      success: false,
      error: { code: 'SSO_ERROR', message: 'Authentication failed' }
    }
  }
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

async function recordSSOLoginEvent(
  config: SSOConfig,
  eventType: 'login_success' | 'login_failure' | 'logout',
  email: string,
  name?: string,
  groups?: string[],
  ipAddress?: string,
  userAgent?: string,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await supabaseAdmin.from('sso_login_events').insert({
      organization_id: config.organization_id,
      sso_config_id: config.id,
      event_type: eventType,
      email,
      name,
      groups,
      ip_address: ipAddress,
      user_agent: userAgent,
      error_code: errorCode,
      error_message: errorMessage
    })
  } catch (err) {
    logger.warn('Failed to record SSO login event', { error: (err as Error).message })
  }
}

async function logSSOAuditEvent(
  organizationId: string,
  userId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      organization_id: organizationId,
      user_id: userId,
      resource_type: 'sso_config',
      action,
      actor_type: 'human',
      actor_label: userId,
      after: details,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    logger.warn('Failed to log SSO audit event', { error: (err as Error).message })
  }
}

// =============================================================================
// ENCRYPTION HELPERS
// =============================================================================

function encryptSecret(plaintext: string): string {
  // In production, use proper encryption (e.g., AWS KMS, HashiCorp Vault)
  // This is a simple base64 encoding for development
  const key = process.env.SSO_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'dev-key'
  const hash = createHash('sha256').update(key).digest('hex')
  return `v1:${Buffer.from(plaintext).toString('base64')}:${hash.substring(0, 8)}`
}

function decryptSecret(encrypted: string): string {
  // In production, use proper decryption
  const parts = encrypted.split(':')
  if (parts.length >= 2 && parts[0] === 'v1') {
    return Buffer.from(parts[1], 'base64').toString('utf-8')
  }
  return encrypted
}

// =============================================================================
// SP METADATA GENERATION
// =============================================================================

/**
 * Generate Service Provider SAML metadata XML
 */
export function generateSPMetadata(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com'
  const entityId = `${appUrl}/api/auth/sso/metadata`
  const acsUrl = `${appUrl}/api/auth/sso/callback`
  const sloUrl = `${appUrl}/api/auth/sso/logout`

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${sloUrl}"/>
  </md:SPSSODescriptor>
  <md:Organization>
    <md:OrganizationName xml:lang="en">Word Is Bond</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">Word Is Bond Call Monitor</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">${appUrl}</md:OrganizationURL>
  </md:Organization>
</md:EntityDescriptor>`
}

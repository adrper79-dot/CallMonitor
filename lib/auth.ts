/**
 * NextAuth Configuration
 * 
 * Centralized auth configuration to avoid exporting from route files
 * (App Router doesn't allow non-handler exports from route.ts files)
 */

import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import AzureADProvider from "next-auth/providers/azure-ad"
import TwitterProvider from "next-auth/providers/twitter"
import FacebookProvider from "next-auth/providers/facebook"
import { createClient } from '@supabase/supabase-js'
import { SupabaseAdapter } from '@next-auth/supabase-adapter'
import { logger } from '@/lib/logger'

async function sendViaResend(to: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `no-reply@${process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '')}`,
      to: [to],
      subject: 'Your sign-in link',
      html,
    }),
  })
  if (!res.ok) throw new Error(`Resend API error: ${res.status} ${await res.text()}`)
}

// Lazily configure Supabase adapter (avoid failing at build-time when env missing)
function getAdapter() {
  // Skip adapter creation during build phase or when env vars not yet loaded
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return undefined
  }
  
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  // If URL is missing, return undefined silently (env vars not loaded yet in serverless cold start)
  // Credentials provider will still work
  if (!supabaseUrl || !serviceKey) {
    // Only log if we're clearly in runtime (not during module initialization)
    if (typeof globalThis !== 'undefined' && (globalThis as any).__NEXTAUTH_RUNTIME_INIT) {
      logger.warn('Supabase adapter skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not available')
    }
    return undefined
  }
  
  try {
    const supabaseForAdapter = createClient(supabaseUrl, serviceKey)
    return SupabaseAdapter(supabaseForAdapter as any)
  } catch (e) {
    // Suppress noisy errors during serverless initialization
    // Auth will continue to work via Credentials provider
    return undefined
  }
}

function getProviders(adapter: any) {
  const providers: any[] = []
  
  // Always include credentials provider
  providers.push(CredentialsProvider({
    name: 'Credentials',
    credentials: {
      username: { label: 'Username or Email', type: 'text' },
      password: { label: 'Password', type: 'password' }
    },
    async authorize(credentials) {
      if (!credentials || !credentials.username || !credentials.password) return null
      
      const key = String(credentials.username).toLowerCase()
      if (!(global as any).__loginRateLimiter) (global as any).__loginRateLimiter = new Map()
      const limiter: Map<string, any> = (global as any).__loginRateLimiter
      const MAX_ATTEMPTS = 5
      const WINDOW_MS = 15 * 60 * 1000
      const BLOCK_MS = 15 * 60 * 1000

      function now() { return Date.now() }

      const entry = limiter.get(key) || { attempts: [] as number[], blockedUntil: 0 }
      entry.attempts = entry.attempts.filter((t: number) => t > now() - WINDOW_MS)
      if (entry.blockedUntil && entry.blockedUntil > now()) {
        return null
      }

      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseUrl || !serviceKey) throw new Error('Supabase not configured for credentials login')

      function looksLikeEmail(v: string) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) }
      let identifier = String(credentials.username)
      let emailToUse: string | null = null
      if (looksLikeEmail(identifier)) {
        emailToUse = identifier
      } else {
        try {
          const sup = createClient(supabaseUrl, serviceKey)
          const { data: found, error: findErr } = await sup.from('users').select('email,username').or(`username.eq.${identifier},email.eq.${identifier}`).limit(1)
          if (!findErr && Array.isArray(found) && found.length) {
            emailToUse = (found[0] as any).email ?? null
          }
        } catch (e) {
          // ignore lookup errors
        }
      }

      if (!emailToUse) {
        entry.attempts.push(now())
        if (entry.attempts.length >= MAX_ATTEMPTS) {
          entry.blockedUntil = now() + BLOCK_MS
        }
        limiter.set(key, entry)
        return null
      }

      // Check if SSO is required for this email domain
      // Skip this check if the table doesn't exist yet (migration not run)
      try {
        const sup = createClient(supabaseUrl, serviceKey)
        const emailDomain = emailToUse.toLowerCase().split('@')[1]
        const { data: ssoConfig, error: ssoError } = await sup
          .from('org_sso_configs')
          .select('require_sso, provider_name')
          .eq('is_enabled', true)
          .contains('verified_domains', [emailDomain])
          .limit(1)
          .single()
        
        // If SSO is required for this domain, block password login
        if (!ssoError && ssoConfig?.require_sso) {
          logger.warn('Password login blocked: SSO required for domain', { email: emailToUse, domain: emailDomain })
          // Return null to block login - user must use SSO
          return null
        }
      } catch (e) {
        // Ignore errors (table may not exist)
        logger.debug('SSO check skipped', { error: (e as Error).message })
      }

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY not configured for password login')

      const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ email: emailToUse, password: credentials.password })
      })
      if (!res.ok) {
        entry.attempts.push(now())
        if (entry.attempts.length >= MAX_ATTEMPTS) {
          entry.blockedUntil = now() + BLOCK_MS
        }
        limiter.set(key, entry)
        return null
      }
      const data = await res.json()
      const user = data?.user ?? null
      if (!user) {
        entry.attempts.push(now())
        if (entry.attempts.length >= MAX_ATTEMPTS) entry.blockedUntil = now() + BLOCK_MS
        limiter.set(key, entry)
        return null
      }
      limiter.delete(key)
      return { id: user.id, name: user.email, email: user.email }
    }
  }))

  // Only include Email provider if adapter is present
  if (adapter) {
    providers.push(EmailProvider({
      async sendVerificationRequest({ identifier: email, url }) {
        const html = `<p>Sign in to the app with this link:</p><p><a href="${url}">${url}</a></p>`
        await sendViaResend(email, html)
      },
      server: undefined,
    }))
  }

  // Add Google OAuth provider if configured
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }))
  }

  // Add Microsoft (Azure AD) OAuth provider if configured
  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
    providers.push(AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      allowDangerousEmailAccountLinking: false,
    }))
  }

  // Add X (Twitter) OAuth provider if configured
  if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
    providers.push(TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      version: '2.0', // Use Twitter OAuth 2.0
    }))
  }

  // Add Facebook OAuth provider if configured
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push(FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    }))
  }

  return providers
}

export function getAuthOptions() {
  const adapter = getAdapter()
  const providers = getProviders(adapter)

  return {
    ...(adapter ? { adapter } : {}),
    providers,
    secret: process.env.NEXTAUTH_SECRET,
    
    // Mobile-friendly cookie settings
    cookies: {
      sessionToken: {
        name: `next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax', // Changed from default 'strict' for mobile compatibility
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
      callbackUrl: {
        name: `next-auth.callback-url`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
      csrfToken: {
        name: `next-auth.csrf-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax', // Critical for mobile OAuth flows
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
    },
    
    // Use JWT for mobile compatibility - required for cross-device sessions
    session: {
      strategy: 'jwt' as const,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    
    // Trust proxy (Vercel)
    useSecureCookies: process.env.NODE_ENV === 'production',
    
    callbacks: {
      async jwt({ token, user }: { token: any; user: any }) {
        if (user) {
          token.id = user.id
        }
        return token
      },
      async session({ session, token }: { session: any; token: any }) {
        if (session?.user && token?.id) {
          (session.user as any).id = token.id
          
          if (typeof token.id === 'string') {
            try {
              const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
              const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
              
              if (supabaseUrl && serviceKey) {
                const supabase = createClient(supabaseUrl, serviceKey)
                
                const { data: existingUser } = await supabase
                  .from('users')
                  .select('id, organization_id')
                  .eq('id', token.id)
                  .single()
                
                if (!existingUser) {
                  let orgId: string | null = null
                  
                  const { data: orgs } = await supabase
                    .from('organizations')
                    .select('id, tool_id')
                    .order('created_at', { ascending: false })
                    .limit(1)
                  
                  if (orgs && orgs.length > 0) {
                    orgId = orgs[0].id
                    logger.info('Session callback: using existing organization', { orgId, email: session.user.email })
                  } else {
                    const { data: newOrg, error: orgError } = await supabase
                      .from('organizations')
                      .insert({
                        name: `${session.user.email}'s Organization`,
                        plan: 'professional',
                        plan_status: 'active',
                        created_by: token.id
                      })
                      .select('id')
                      .single()
                    
                    if (orgError) {
                      logger.error('Session callback: failed to create organization', orgError, { email: session.user.email })
                      throw new Error('Failed to create organization')
                    }
                    
                    orgId = newOrg.id
                    logger.info('Session callback: created organization', { orgId, email: session.user.email })
                    
                    const { data: tool, error: toolError } = await supabase
                      .from('tools')
                      .insert({
                        name: `${session.user.email}'s Recording Tool`,
                        type: 'recording',
                        organization_id: orgId,
                        created_by: token.id
                      })
                      .select('id')
                      .single()
                    
                    if (toolError) {
                      logger.error('Session callback: failed to create tool', toolError)
                    } else if (tool) {
                      const { error: updateError } = await supabase
                        .from('organizations')
                        .update({ tool_id: tool.id })
                        .eq('id', orgId)
                      
                      if (updateError) {
                        logger.error('Session callback: failed to link tool to organization', updateError)
                      } else {
                        logger.info('Session callback: created and linked tool', { toolId: tool.id, orgId })
                      }
                    }
                  }
                  
                  if (!orgId) {
                    throw new Error('Organization is required but missing')
                  }
                  
                  const { error: userInsertErr } = await supabase.from('users').insert({
                    id: token.id,
                    email: session.user.email,
                    organization_id: orgId,
                    role: 'owner',  // First user in org gets owner role
                    is_admin: true
                  })
                  
                  if (userInsertErr) {
                    logger.error('Session callback: failed to create user', userInsertErr)
                    throw new Error('Failed to create user record')
                  }
                  
                  logger.info('Session callback: created user record', { email: session.user.email })
                  
                  const { error: memberInsertErr } = await supabase.from('org_members').insert({
                    organization_id: orgId,
                    user_id: token.id,
                    role: 'owner'  // Per RBAC matrix: owner has full access
                  })
                  
                  if (memberInsertErr) {
                    logger.error('Session callback: failed to create org membership', memberInsertErr)
                    throw new Error('Failed to create organization membership')
                  }
                  
                  logger.info('Session callback: created org_members record', { email: session.user.email })
                }
              }
            } catch (err) {
              logger.error('Failed to ensure user organization setup', err)
            }
          }
        }
        return session
      }
    }
  }
}

// Cached auth options - initialized lazily on first access
let _cachedAuthOptions: ReturnType<typeof getAuthOptions> | null = null

/**
 * Get the auth options object (cached).
 * This function ensures lazy initialization and caches the result.
 * Prefer using this function directly instead of the authOptions export
 * when passing to getServerSession() for maximum compatibility.
 */
export function getAuthOptionsLazy(): ReturnType<typeof getAuthOptions> {
  if (_cachedAuthOptions) {
    return _cachedAuthOptions
  }
  
  try {
    _cachedAuthOptions = getAuthOptions()
    return _cachedAuthOptions
  } catch (e) {
    logger.error('[auth] Failed to initialize auth options', e)
    // Return minimal fallback to prevent crashes
    const fallback = {
      providers: [] as any[],
      secret: process.env.NEXTAUTH_SECRET || 'auth-secret-fallback',
      session: { strategy: 'jwt' as const, maxAge: 30 * 24 * 60 * 60 },
      cookies: {
        sessionToken: { name: 'next-auth.session-token', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' } },
        callbackUrl: { name: 'next-auth.callback-url', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' } },
        csrfToken: { name: 'next-auth.csrf-token', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' } },
      },
      useSecureCookies: process.env.NODE_ENV === 'production',
      callbacks: {
        jwt: async ({ token, user }: any) => {
          if (user) token.id = user.id
          return token
        },
        session: async ({ session, token }: any) => {
          if (session?.user && token?.id) {
            (session.user as any).id = token.id
          }
          return session
        }
      }
    } as unknown as ReturnType<typeof getAuthOptions>
    _cachedAuthOptions = fallback
    return fallback
  }
}

/**
 * Auth options export for backwards compatibility.
 * Uses a Proxy to lazily initialize and delegate all operations to the real options object.
 * This handles property access, iteration, spread, and other operations correctly.
 */
export const authOptions: ReturnType<typeof getAuthOptions> = new Proxy(
  {} as ReturnType<typeof getAuthOptions>,
  {
    get(target, prop, receiver) {
      const opts = getAuthOptionsLazy()
      return Reflect.get(opts, prop, receiver)
    },
    has(target, prop) {
      const opts = getAuthOptionsLazy()
      return Reflect.has(opts, prop)
    },
    ownKeys(target) {
      const opts = getAuthOptionsLazy()
      return Reflect.ownKeys(opts)
    },
    getOwnPropertyDescriptor(target, prop) {
      const opts = getAuthOptionsLazy()
      return Reflect.getOwnPropertyDescriptor(opts, prop)
    },
    // Make properties appear enumerable for spread/iteration
    getPrototypeOf(target) {
      const opts = getAuthOptionsLazy()
      return Reflect.getPrototypeOf(opts)
    }
  }
)

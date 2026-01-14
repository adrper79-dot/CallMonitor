/**
 * NextAuth Configuration
 * 
 * Centralized auth configuration to avoid exporting from route files
 * (App Router doesn't allow non-handler exports from route.ts files)
 */

import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { createClient } from '@supabase/supabase-js'
import { SupabaseAdapter } from '@next-auth/supabase-adapter'

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
  // Skip adapter creation during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return undefined
  }
  
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseForAdapter = createClient(String(supabaseUrl), String(process.env.SUPABASE_SERVICE_ROLE_KEY))
      return SupabaseAdapter(supabaseForAdapter as any)
    }
  } catch (e) {
    // Only log error if not during build phase
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      console.error('Failed to initialize Supabase adapter for NextAuth', e)
    }
  }
  return undefined
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

  return providers
}

export function getAuthOptions() {
  const adapter = getAdapter()
  const providers = getProviders(adapter)

  return {
    ...(adapter ? { adapter } : {}),
    providers,
    secret: process.env.NEXTAUTH_SECRET,
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
                    console.log('Session callback: using existing organization', orgId, 'for', session.user.email)
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
                      console.error('Session callback: failed to create organization:', orgError.message)
                      throw new Error('Failed to create organization')
                    }
                    
                    orgId = newOrg.id
                    console.log('Session callback: created organization', orgId, 'for', session.user.email)
                    
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
                      console.error('Session callback: failed to create tool:', toolError.message)
                    } else if (tool) {
                      const { error: updateError } = await supabase
                        .from('organizations')
                        .update({ tool_id: tool.id })
                        .eq('id', orgId)
                      
                      if (updateError) {
                        console.error('Session callback: failed to link tool to organization:', updateError.message)
                      } else {
                        console.log('Session callback: created and linked tool', tool.id, 'to organization', orgId)
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
                    console.error('Session callback: failed to create user:', userInsertErr.message)
                    throw new Error('Failed to create user record')
                  }
                  
                  console.log('Session callback: created user record for', session.user.email)
                  
                  const { error: memberInsertErr } = await supabase.from('org_members').insert({
                    organization_id: orgId,
                    user_id: token.id,
                    role: 'owner'  // Per RBAC matrix: owner has full access
                  })
                  
                  if (memberInsertErr) {
                    console.error('Session callback: failed to create org membership:', memberInsertErr.message)
                    throw new Error('Failed to create organization membership')
                  }
                  
                  console.log('Session callback: created org_members record for', session.user.email)
                }
              }
            } catch (err) {
              console.error('Failed to ensure user organization setup:', err)
            }
          }
        }
        return session
      }
    }
  }
}

// Export authOptions - use function form to avoid build-time evaluation
// Files using getServerSession should use: getServerSession(authOptions)
export const authOptions = (() => {
  // During build phase, return a minimal config that won't fail
  if (typeof window === 'undefined' && process.env.NEXT_PHASE === 'phase-production-build') {
    return {
      providers: [],
      secret: 'build-time-placeholder',
      callbacks: {}
    } as any
  }
  
  // At runtime, return the real config
  try {
    return getAuthOptions()
  } catch (e) {
    // If config fails (missing env vars), return minimal config
    console.error('Failed to initialize auth options:', e)
    return {
      providers: [],
      secret: process.env.NEXTAUTH_SECRET || 'fallback',
      callbacks: {}
    } as any
  }
})()

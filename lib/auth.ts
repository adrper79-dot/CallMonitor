/**
 * NextAuth Configuration (ARCH_DOCS-compliant)
 *
 * Centralized, standards-based authentication config.
 * - No non-handler exports from route files (App Router restriction)
 * - All environment/config variables accessed via project conventions
 * - Logging, error handling, and comments follow ARCH_DOCS standards
 */

import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import AzureADProvider from "next-auth/providers/azure-ad"
import TwitterProvider from "next-auth/providers/twitter"
import FacebookProvider from "next-auth/providers/facebook"

import pgClient from '@/lib/pgClient'
import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto'
import { logger } from '@/lib/logger'
import { v5 as uuidv5 } from 'uuid'

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
      tags: [{ name: 'category', value: 'auth' }],
    }),
  })
  if (!res.ok) throw new Error(`Resend API error: ${res.status} ${await res.text()}`)
}

import PostgresAdapter from "@auth/pg-adapter"
import { pool } from "@/lib/pgClient"

// ARCH_DOCS: Lazy Postgres adapter for Neon
function getAdapter() {
  if (!pool) {
    logger.warn('[Auth] Postgres pool not available - disabling adapter')
    return undefined
  }
  return PostgresAdapter(pool)
}

/**
 * Check if a string is a valid UUID v4 format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * ARCH_DOCS: Deterministic UUID v5 from OAuth provider ID
 * - Uses DNS namespace for consistency
 */
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
function generateUUIDFromOAuthId(providerId: string): string {
  if (isValidUUID(providerId)) return providerId;
  return uuidv5(providerId, NAMESPACE);
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
      if (!(globalThis as any).__loginRateLimiter) (globalThis as any).__loginRateLimiter = new Map()
      const limiter: Map<string, { attempts: number[]; blockedUntil: number }> = (globalThis as any).__loginRateLimiter
      const MAX_ATTEMPTS = 5
      const WINDOW_MS = 15 * 60 * 1000
      const BLOCK_MS = 15 * 60 * 1000

      function now() { return Date.now() }

      const entry = limiter.get(key) || { attempts: [] as number[], blockedUntil: 0 }
      entry.attempts = entry.attempts.filter((t: number) => t > now() - WINDOW_MS)
      if (entry.blockedUntil && entry.blockedUntil > now()) {
        return null
      }

      function looksLikeEmail(v: string) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) }
      let identifier = String(credentials.username)
      let emailToUse: string | null = null
      if (looksLikeEmail(identifier)) {
        emailToUse = identifier
      } else {
        try {
          const foundRes = await pgClient.query(`SELECT email, username FROM users WHERE username = $1 OR email = $1 LIMIT 1`, [identifier])
          if (foundRes?.rows && foundRes.rows.length) {
            emailToUse = foundRes.rows[0].email ?? null
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
      try {
        const emailDomain = emailToUse.toLowerCase().split('@')[1]
        const ssoRes = await pgClient.query(
          `SELECT require_sso, provider_name FROM org_sso_configs WHERE is_enabled = true AND verified_domains @> $1::jsonb LIMIT 1`,
          [JSON.stringify([emailDomain])]
        )
        const ssoConfig = ssoRes?.rows && ssoRes.rows.length ? ssoRes.rows[0] : null
        if (ssoConfig?.require_sso) {
          logger.warn('Password login blocked: SSO required for domain', { email: emailToUse, domain: emailDomain })
          return null
        }
      } catch (e) {
        logger.debug('SSO check skipped', { error: (e as Error).message })
      }

      // Use Supabase Auth signInWithPassword for credentials
      try {
        // Verify password against stored hash
        const userRes = await pgClient.query(`SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1`, [emailToUse])
        const userRow = userRes?.rows && userRes.rows.length ? userRes.rows[0] : null
        if (!userRow || !userRow.password_hash) {
          entry.attempts.push(now())
          if (entry.attempts.length >= MAX_ATTEMPTS) entry.blockedUntil = now() + BLOCK_MS
          limiter.set(key, entry)
          return null
        }
        const [salt, storedDerived] = String(userRow.password_hash).split(':')
        if (!salt || !storedDerived) {
          entry.attempts.push(now())
          if (entry.attempts.length >= MAX_ATTEMPTS) entry.blockedUntil = now() + BLOCK_MS
          limiter.set(key, entry)
          return null
        }
        const derived = scryptSync(credentials.password, salt, 64).toString('hex')
        const match = timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(storedDerived, 'hex'))
        if (!match) {
          entry.attempts.push(now())
          if (entry.attempts.length >= MAX_ATTEMPTS) entry.blockedUntil = now() + BLOCK_MS
          limiter.set(key, entry)
          return null
        }
        limiter.delete(key)
        return { id: userRow.id, email: userRow.email, name: userRow.email }
      } catch (e) {
        entry.attempts.push(now())
        if (entry.attempts.length >= MAX_ATTEMPTS) entry.blockedUntil = now() + BLOCK_MS
        limiter.set(key, entry)
        return null
      }
    }
  }))

  // Only include Email provider if adapter is present
  if (adapter) {
    providers.push(EmailProvider({
      async sendVerificationRequest({ identifier: email, url }) {
        const html = `<p>Sign in: <a href="${url}">${url}</a></p>`;
        try {
          await sendViaResend(email, html);
        } catch (err) {
          logger.error('[Auth] Resend email failed', err);
          throw new Error('Failed to send verification email');
        }
      },
      server: undefined,
    }));
  } else {
    logger.warn('[Auth] Email provider disabled: Supabase adapter unavailable');
  }

  // Add OAuth providers regardless of adapter
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }))
  }
  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
    providers.push(AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      allowDangerousEmailAccountLinking: false,
    }))
  }
  if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
    providers.push(TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      version: '2.0',
    }))
  }
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

    // ARCH_DOCS: Mobile-friendly cookie settings
    cookies: {
      sessionToken: {
        name: 'next-auth.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
      callbackUrl: {
        name: 'next-auth.callback-url',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
      csrfToken: {
        name: 'next-auth.csrf-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
    },

    // ARCH_DOCS: Database strategy for SupabaseAdapter compatibility
    session: {
      strategy: adapter ? 'database' as const : 'jwt' as const,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },

    // ARCH_DOCS: Trust proxy (Vercel)
    useSecureCookies: process.env.NODE_ENV === 'production',

    callbacks: {
      // ARCH_DOCS: SignIn callback for OAuth user/org setup (runs only on login)
      async signIn({ user, account }: { user: any; account: any }) {
        // Only run provider linking/creation for common OAuth providers
        if (account && ['google', 'azure-ad', 'twitter', 'facebook'].includes(account.provider)) {
          try {
            // Use the adapter-provided user id (do not generate a separate UUID)
            const userId = user.id;

            // Normalize email for provider-specific equivalence (gmail/microsoft rules)
            const normalizeEmail = (email: string) => {
              if (!email) return email;
              const parts = email.split('@');
              if (parts.length !== 2) return email.toLowerCase();
              const local = parts[0];
              const domain = parts[1].toLowerCase();
              if (domain.endsWith('gmail.com') || domain.endsWith('googlemail.com')) {
                const localNoPlus = local.split('+')[0].replace(/\./g, '');
                return (localNoPlus + '@' + domain).toLowerCase();
              }
              if (domain.endsWith('outlook.com') || domain.endsWith('hotmail.com') || domain.endsWith('live.com') || domain.endsWith('microsoft.com')) {
                const localNoPlus = local.split('+')[0];
                return (localNoPlus + '@' + domain).toLowerCase();
              }
              return email.toLowerCase();
            };

            const normalizedEmail = normalizeEmail(user.email || '');

            // First try to find an existing account link by provider/providerAccountId
            const accRes = await pgClient.query(`SELECT user_id FROM accounts WHERE provider = $1 AND provider_account_id = $2 LIMIT 1`, [account.provider, account.providerAccountId])
            const accountRow = accRes?.rows && accRes.rows.length ? accRes.rows[0] : null

            let existingUser: any = null;
            if (accountRow && accountRow.user_id) {
              const userRes = await pgClient.query(`SELECT id, organization_id FROM users WHERE id = $1 LIMIT 1`, [accountRow.user_id])
              existingUser = userRes?.rows && userRes.rows.length ? userRes.rows[0] : null
            }

            // If not found by account link, try normalized email lookup
            if (!existingUser) {
              const userRes = await pgClient.query(`SELECT id, organization_id FROM users WHERE normalized_email = $1 OR email = $2 LIMIT 1`, [normalizedEmail, user.email])
              existingUser = userRes?.rows && userRes.rows.length ? userRes.rows[0] : null
            }

            if (existingUser) {
              // Ensure account link exists for this provider
              const acctId = `${account.provider}:${account.providerAccountId}`;
              const existAcctRes = await pgClient.query(`SELECT id FROM accounts WHERE provider = $1 AND provider_account_id = $2 LIMIT 1`, [account.provider, account.providerAccountId])
              const existingAcct = existAcctRes?.rows && existAcctRes.rows.length ? existAcctRes.rows[0] : null
              if (!existingAcct) {
                try {
                  await pgClient.query(`INSERT INTO accounts (id, user_id, type, provider, provider_account_id) VALUES ($1,$2,$3,$4,$5)`, [acctId, existingUser.id, account.type || 'oauth', account.provider, account.providerAccountId])
                } catch (insertErr) {
                  logger.warn('[Auth] Could not create accounts link', { error: insertErr })
                }
              }
              logger.info('[Auth] Linked OAuth login to existing user', { email: user.email, userId: existingUser.id });
            } else {
              // Create org and user then link membership
              const orgInsert = await pgClient.query(`INSERT INTO organizations (name, plan, created_at) VALUES ($1,$2,$3) RETURNING id`, [`${user.email?.split('@')[0] ?? 'user'}'s Organization`, 'professional', new Date().toISOString()])
              const orgId = orgInsert?.rows && orgInsert.rows.length ? orgInsert.rows[0].id : null
              if (!orgId) throw new Error('Failed to create organization')
              await pgClient.query(`INSERT INTO users (id, email, normalized_email, organization_id, role, is_admin, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [userId, user.email, normalizedEmail, orgId, 'owner', true, new Date().toISOString()])
              await pgClient.query(`INSERT INTO org_members (organization_id, user_id, role) VALUES ($1,$2,$3)`, [orgId, userId, 'owner'])
              logger.info('[Auth] Created new user/org for OAuth login', { email: user.email, userId, orgId });
            }
          } catch (err) {
            logger.error('[Auth] User/org setup failed on OAuth login', err);
            // Do not throw; allow login, log for monitoring
          }
        }
        return true;
      },
      // ARCH_DOCS: JWT callback for user ID
      async jwt({ token, user }: { token: any; user: any }) {
        if (user) token.id = user.id;
        return token;
      },
      // ARCH_DOCS: Session callback ensures user ID in session
      async session({ session, token }: { session: any; token: any }) {
        if (session?.user && token?.id) {
          ; (session.user as any).id = token.id;
        }
        return session;
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
      providers: [],
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
            ; (session.user as any).id = token.id
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
export const authOptions: Awaited<ReturnType<typeof getAuthOptions>> = new Proxy(
  {} as Awaited<ReturnType<typeof getAuthOptions>>,

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

It looks like the code you pasted is a NextAuth configuration for authentication—in TypeScript/JavaScript, not shell/CLI.
The suggested edit:
        if (!ssoError && ssoConfig?.require_sso) {
          logger.warn('Password login blocked: SSO required for domain', { email: emailToUse, domain: emailDomain })
          return null
        }
      } catch (e) {
        logger.debug('SSO check skipped', { error: (e as Error).message })
      }

      // Use Supabase Auth signInWithPassword for credentials
      try {
        const sup = createClient(supabaseUrl, anonKey)
        const { data, error } = await sup.auth.signInWithPassword({
          email: emailToUse,
          password: credentials.password
        })
        if (error || !data.user) {
          entry.attempts.push(now())
          if (entry.attempts.length >= MAX_ATTEMPTS) entry.blockedUntil = now() + BLOCK_MS
          limiter.set(key, entry)
          return null
        }
        limiter.delete(key)
        return { id: data.user.id, email: data.user.email, name: data.user.email || data.user.user_metadata?.name }
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
        if (account && ['google', 'azure-ad', 'twitter', 'facebook'].includes(account.provider)) {
          try {
            const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!supabaseUrl || !serviceKey) throw new Error('Supabase not configured');
            const supabase = createClient(supabaseUrl, serviceKey);

            const userId = generateUUIDFromOAuthId(user.id);

            // Check if user exists
            let { data: existingUser } = await supabase
              .from('users')
              .select('id, organization_id')
              .eq('email', user.email)
              .maybeSingle();

            if (!existingUser) {
              // Create org and user (deterministic UUID)
              const { data: newOrg, error: orgError } = await supabase
                .from('organizations')
                .insert({ name: `${user.email.split('@')[0]}'s Organization`, plan: 'professional' })
                .select('id')
                .single();
              if (orgError || !newOrg?.id) throw new Error('Failed to create organization');
              const orgId = newOrg.id;
              const { error: userInsertErr } = await supabase.from('users').insert({
                id: userId,
                email: user.email,
                organization_id: orgId,
                role: 'owner',
                is_admin: true
              });
              if (userInsertErr) throw new Error('Failed to create user');
              const { error: memberInsertErr } = await supabase.from('org_members').insert({
                organization_id: orgId,
                user_id: userId,
                role: 'owner'
              });
              if (memberInsertErr) throw new Error('Failed to create org membership');
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
          ;(session.user as any).id = token.id;
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
            ;(session.user as any).id = token.id
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

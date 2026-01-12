Auth notes

- The project uses Supabase Auth for core authentication. Supabase creates an `auth.users` table which is referenced by application tables (see `ARCH_DOCS/Schema.txt`).
- For credential-based sign-in we implemented a NextAuth CredentialsProvider which calls Supabase Auth's token endpoint using the service role key. Ensure the following env vars are set:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXTAUTH_URL`
  - `NEXTAUTH_SECRET`

Rate-limiting

- A simple in-memory rate limiter was added to the CredentialsProvider to block repeated failed attempts (default: 5 attempts per 15 minutes, block for 15 minutes).
- For production, replace the in-memory store with a centralized store (Redis) or persist attempts in `public.login_attempts` (migration included in `migrations/2026-01-11-add-login-attempts.sql`).

Migration

- `migrations/2026-01-11-add-login-attempts.sql` — optional table to persist login attempts for analysis or cross-instance enforcement.

Security considerations

- The Supabase service role key MUST never be exposed to the client. It should only be used server-side. Rotate the key periodically and audit usage.
- Consider adding rate-limiting by IP and CAPTCHAs for high-risk flows.

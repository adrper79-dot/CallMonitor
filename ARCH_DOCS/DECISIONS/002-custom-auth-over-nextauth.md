# ADR 002: Custom Session-Based Auth Over NextAuth

**Status**: Accepted
**Date**: 2026-02-06
**Deciders**: Engineering Team
**Tags**: authentication, security, infrastructure

## Context

Wordis Bond requires user authentication for:
- Multi-tenant organization access control
- Session management across browser and API
- Secure API endpoints with role-based permissions
- Cross-origin authentication (Pages → Workers)
- Evidence custody chain (who accessed what, when)

The platform uses Next.js with static export (`output: 'export'`) deployed to Cloudflare Pages, with a separate API layer on Cloudflare Workers. This architecture creates constraints for authentication:

1. **No Server-Side Rendering**: Static export eliminates Next.js server-side features
2. **Cross-Origin**: UI (Pages) and API (Workers) are different origins
3. **Edge Compute**: Workers environment requires auth compatible with V8 isolates
4. **No Node.js**: Workers use Web APIs, not Node.js runtime

NextAuth (Auth.js) is the standard solution for Next.js authentication, but it has critical incompatibilities with our architecture.

## Decision

Implement **custom session-based authentication** with:
- Password hashing: PBKDF2-SHA256 (120,000 iterations)
- Session storage: PostgreSQL `sessions` table
- Session tokens: Bearer tokens in `Authorization` header
- CSRF protection: Server-side tokens in Cloudflare KV (10-minute TTL)
- Device fingerprinting: Bind sessions to User-Agent + origin (H2 security hardening)
- Rate limiting: KV-backed sliding window (auth endpoints only initially)

Authentication implementation:
- Signup/Login: `workers/src/routes/auth.ts`
- Session verification: `workers/src/lib/auth.ts` (`requireAuth()` middleware)
- Client integration: `lib/apiClient.ts` (automatic Bearer token injection)

## Rationale

### Why Not NextAuth?

NextAuth requires server-side rendering or API routes, which are incompatible with static export:

```javascript
// next.config.js
module.exports = {
  output: 'export',  // ← NextAuth incompatible
}
```

NextAuth limitations with static export:
1. **No API Routes**: NextAuth requires `/api/auth/[...nextauth]` endpoint
2. **Server Dependencies**: Needs Node.js server for session management
3. **Database Adapters**: Require server-side code for session storage
4. **OAuth Providers**: Require callback URLs on server
5. **Edge Runtime**: NextAuth edge support is experimental and limited

### Why Custom Implementation Works

Our architecture separates concerns cleanly:

**Static UI (Pages)**:
- No authentication logic
- Client-side session check via `/api/auth/session`
- Stores session token in `localStorage`
- Sends token in `Authorization: Bearer <token>` header

**Edge API (Workers)**:
- Full authentication logic in `workers/src/routes/auth.ts`
- Session verification middleware: `requireAuth(c)`
- Direct database access for user/session queries
- CSRF protection via KV storage
- Compatible with Workers V8 isolate runtime

### Security Hardening Applied

Based on lessons from `LESSONS_LEARNED.md` and security sprints:

1. **Password Hashing**: PBKDF2 with 120,000 iterations (NIST SP 800-132 compliant)
   - Replaces legacy SHA-256 (transparently upgraded on login)
   - Salt: 32 bytes random
   - Output: 32 bytes derived key

2. **Session Fingerprinting** (H2 hardening):
   - Compute fingerprint from User-Agent + origin
   - Store in KV bound to session token
   - Verify on every request
   - Prevents stolen token reuse from different device

3. **CSRF Protection**:
   - Server-generated tokens stored in KV (not client-side)
   - 10-minute TTL
   - One-time use (deleted after validation)
   - Required for login/signup

4. **Rate Limiting**:
   - Login: 5 attempts per IP per minute
   - Signup: 3 attempts per IP per hour
   - Forgot password: 2 attempts per email per hour
   - Fail-open if KV unavailable (business continuity)

5. **Session Expiry**:
   - 7 days (reduced from 30 days in H2 hardening)
   - No refresh tokens (v1 - planned for v2)

## Consequences

### Positive
- Full control over authentication flow and security
- Works seamlessly with static export + Workers architecture
- No external auth service dependencies (Auth0, Clerk, etc.)
- No vendor lock-in
- Direct database access for audit logging
- Customizable for compliance requirements (SOC 2, HIPAA-ready)
- Session fingerprinting prevents token theft
- PBKDF2 provides strong password security

### Negative
- More code to maintain vs. managed auth service
- Must implement security features ourselves (2FA, OAuth, etc.)
- Higher risk of security bugs if not careful
- No built-in social login (Google, GitHub, etc.)
- Must manually audit security patterns
- Session refresh requires manual implementation (not yet done)

### Neutral
- Password reset flow partially implemented (email sending TODO)
- API key authentication separate path (`/api/auth/validate-key`)
- Compatible with future OAuth addition if needed
- Could migrate to Auth.js later if we move away from static export

## Alternatives Considered

### Alternative 1: NextAuth (Auth.js)
- **Description**: Official Next.js authentication library
- **Pros**:
  - Industry standard, well-tested
  - Built-in OAuth providers
  - Database adapters for session storage
  - CSRF protection built-in
  - Email/passwordless options
- **Cons**:
  - **Incompatible with static export** (deal-breaker)
  - Requires Next.js API routes or server
  - Edge runtime support experimental
  - Less control over security implementation
- **Why Rejected**: Fundamentally incompatible with `output: 'export'` architecture

### Alternative 2: Auth0 (Managed Service)
- **Description**: Third-party authentication platform
- **Pros**:
  - Fully managed, no code to maintain
  - OAuth, social login, 2FA built-in
  - Compliance certifications (SOC 2, HIPAA)
  - Universal login UI
  - Strong security by default
- **Cons**:
  - Monthly cost per user (adds up at scale)
  - Vendor lock-in
  - External dependency for critical path
  - Privacy concerns (third-party data storage)
  - Harder to customize for compliance edge cases
  - Requires internet connection for auth (no offline mode)
- **Why Rejected**: Cost, vendor lock-in, less control over custody chain

### Alternative 3: Clerk
- **Description**: Modern authentication platform for React/Next.js
- **Pros**:
  - Great DX, React-native components
  - Built-in user management UI
  - Social login, 2FA, magic links
  - Works with edge runtime
  - Good pricing for startups
- **Cons**:
  - Vendor lock-in
  - Monthly cost per user
  - Third-party data storage
  - Less customizable than custom implementation
  - Requires Clerk SDK client-side
- **Why Rejected**: Vendor lock-in, monthly costs, less control

### Alternative 4: Supabase Auth
- **Description**: Open-source auth built on PostgreSQL
- **Pros**:
  - Open source, self-hostable
  - PostgreSQL-based (matches our stack)
  - OAuth, magic links, 2FA
  - Good SDK
  - Row-level security integration
- **Cons**:
  - Requires Supabase runtime (separate infrastructure)
  - Less flexible than custom implementation
  - Still external dependency
  - Migration from Neon → Supabase complicates stack
- **Why Rejected**: Extra infrastructure complexity, not needed for our use case

### Alternative 5: JWT-Only (No Sessions)
- **Description**: Stateless JWT tokens, no database sessions
- **Pros**:
  - Stateless, no database queries for auth
  - Scalable (no session storage)
  - Simple to implement
  - Works across distributed systems
- **Cons**:
  - **Cannot revoke tokens** (major security issue)
  - No device binding (token theft more dangerous)
  - Refresh token complexity
  - Larger payload (JWT vs. random token)
  - Audit trail harder (no session records)
- **Why Rejected**: Cannot revoke sessions is deal-breaker for security/compliance

## Implementation

### Code Locations
- **Auth Routes**: `workers/src/routes/auth.ts`
  - `POST /api/auth/signup` - User registration
  - `POST /api/auth/callback/credentials` - Login
  - `POST /api/auth/signout` - Logout
  - `GET /api/auth/session` - Session verification
  - `GET /api/auth/csrf` - CSRF token generation
  - `POST /api/auth/forgot-password` - Password reset (partial)
  - `POST /api/auth/validate-key` - API key validation

- **Auth Library**: `workers/src/lib/auth.ts`
  - `requireAuth(c)` - Middleware for protected routes
  - `verifySession(c, token)` - Session verification
  - `computeFingerprint(c)` - Device fingerprinting

- **Client Library**: `lib/apiClient.ts`
  - `apiGet()`, `apiPost()`, `apiPut()`, `apiDelete()` - Auto-attach Bearer tokens
  - Session token stored in `localStorage`

- **Rate Limiting**: `workers/src/lib/rate-limit.ts`
  - `loginRateLimit`, `signupRateLimit`, `forgotPasswordRateLimit`

- **Validation**: `workers/src/lib/schemas.ts`
  - Zod schemas for signup/login/password reset

### Database Schema
```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,  -- PBKDF2 format: "pbkdf2:120000:salt:hash"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization membership
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- admin, member, viewer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);
```

### KV Storage
- **CSRF Tokens**: `csrf:<token>` → `1` (TTL: 10 minutes)
- **Session Fingerprints**: `fp:<session_token>` → `<fingerprint>` (TTL: 7 days)
- **Rate Limits**: `rl:<endpoint>:<identifier>` → `<count>` (TTL: varies)

### Security Migration History

Git commit history shows evolution:
- Legacy SHA-256 hashing → PBKDF2 (transparent upgrade on login)
- Added session fingerprinting (H2 hardening)
- Added CSRF token server-side storage (security sprint)
- Reduced session expiry 30d → 7d (H2 hardening)
- Added rate limiting to auth endpoints

See commits:
- `Security sprint: H2 token fingerprinting...`
- `Sprint 4: Security hardening, Zod validation, rate limiting...`

## References

- [PBKDF2 (NIST SP 800-132)](https://csrc.nist.gov/publications/detail/sp/800-132/final)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Lessons Learned](../LESSONS_LEARNED.md) - Security hardening lessons
- [Agent Instructions](../../AGENT_INSTRUCTIONS.md) - Security standards
- Git commits: `git log --grep="auth\|Security sprint"`

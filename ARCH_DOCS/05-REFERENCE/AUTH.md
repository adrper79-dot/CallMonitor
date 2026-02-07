# Custom Authentication Guide

## Overview

- Session-based (no JWT/NextAuth full).
- Backend: DB sessions (public.sessions), custom pw hash.
- Frontend: localStorage token + Context poll.

## Backend (Workers)

- **Tables**: users (uuid, email, pw_hash), org_members, public.sessions (sessionToken, userId, expires)
- **Hash**: SHA256(salt:hex + pw) `crypto.subtle.digest`
- **Session**: verifySession JOIN users/org_members LIMIT 1
- Routes: /api/auth/session, /signup, /callback/credentials, /signout (DELETE session)

### Key Functions (lib/auth.ts)

```ts
parseSessionToken(c) // Bearer or cookie
verifySession(c, token) // neon query valid + org
requireAuth(c) // middleware
```

## Frontend (AuthProvider.tsx)

- **Storage**: localStorage 'wb-session-token'
- **signIn**: /csrf → /callback/credentials → store token
- **signOut**: POST /signout Bearer → clear storage
- **useSession**: poll /session, dispatch 'auth-change'

## Flow

1. Signup/Login → sessionToken
2. Bearer/cookie → /session → user/org
3. No org → WebRTC blocked

## Best Practices

- CSRF: fetch /csrf pre-login.
- Expires: 30d, check > NOW()
- Role: org_members.role hierarchy.

## Troubleshooting

- No org: INSERT org_members.
- Signout fail: Check neon DELETE public.sessions.
- Tail: wrangler tail wordisbond-api /api/auth/\*

See routes/auth.ts, lib/auth.ts, AuthProvider.tsx

# Hybrid Cloudflare Deployment Gospel

**TOGAF Phase:** F — Migration Planning  
**Status**: Production Gospel | Date: 2026-02-02  
**Validation**: ✅ Successfully deployed at https://827487ca.wordisbond.pages.dev

**Truth**: Static UI (Pages) + Edge APIs (Workers). Best: Immutable artifacts, edge cache, typesafe (Zod/Hono), RBAC RLS.

---

## Architecture

UI Static (Pages CDN) → APIs Workers (Hono/bindings) → Stack (Neon Hyperdrive/Telnyx VXML/Stripe webhooks/AssemblyAI/OpenAI/ElevenLabs TTS).

### Stack Components:

**Cloudflare:**

- **Pages**: Static UI from `out/` directory (Next.js static export)
- **Workers**: API layer (Hono framework) in `workers/` directory
- **Hyperdrive**: Neon Postgres connection pooling
- **R2**: Artifact storage (recordings, transcripts)
- **KV**: Sessions, feature flags, rate limiting

**Database:**

- **Neon**: PostgreSQL with connection pooling + RLS (Row-Level Security)

**Telephony:**

- **Telnyx**: SIP/VXML telephony with webhooks

**Billing:**

- **Stripe**: Subscription billing + usage metering

**AI Stack:**

- **AssemblyAI**: Transcription + NLP (edge proxy)
- **OpenAI**: LLM reasoning + translation
- **ElevenLabs**: Text-to-speech + voice cloning

---

## Configuration

### Pages Configuration (wrangler.toml - UI)

```toml
# Cloudflare Pages Configuration (Static Site)
# Static Next.js export - server features in Workers
name = "wordisbond"
pages_build_output_dir = "out"
compatibility_date = "2026-02-01"

# Build: npm run build (outputs to out/)
# Deploy: wrangler pages deploy out

# Environment variables for Pages (build-time)
[vars]
NODE_ENV = "production"
NEXT_PUBLIC_API_URL = "https://wordisbond-api.adrper79.workers.dev"
```

### Workers Configuration (workers/wrangler.toml - APIs)

```toml
name = "wordisbond-api"
main = "src/index.ts"
compatibility_date = "2026-02-01"
compatibility_flags = ["nodejs_compat"]

# Hyperdrive (Neon Postgres)
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "YOUR_HYPERDRIVE_ID"

# R2 Bucket (Artifacts)
[[r2_buckets]]
binding = "ARTIFACTS"
bucket_name = "wordisbond"

# KV Namespace (sessions, rate limiting, idempotency)
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID"

# Scheduled handlers (cron jobs)
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

### Next.js Configuration (next.config.js - UI)

```javascript
module.exports = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // NO serverless features
  // NO API routes in app/api/
  // NO getServerSideProps
  // NO server components with data fetching
}
```

---

## Deployment Commands

### Build & Deploy UI (Pages)

```bash
# Build static export
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy out --project-name=wordisbond

# Output: https://[deployment-id].wordisbond.pages.dev
```

### Deploy APIs (Workers)

```bash
# Navigate to workers directory
cd workers

# Deploy Workers API
wrangler deploy

# Output: https://wordisbond-api.adrper79.workers.dev
```

### Routing Configuration (Cloudflare Dashboard)

- `wordis-bond.com/*` → Pages (Static UI)
- `wordisbond-api.adrper79.workers.dev/*` → Workers (APIs)

Or use a single domain with Workers routes:

- `wordis-bond.com/api/*` → Workers
- `wordis-bond.com/*` → Pages (fallback)

---

## Architecture Patterns

### 1. Client-Side Pages (No SSR)

```typescript
'use client'

import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState(null)

  useEffect(() => {
    // Fetch from Workers API via apiClient
    apiGet('/organizations/current')
      .then(res => setData(res.data))
  }, [])

  return <div>Dashboard</div>
}
```

### 2. Workers API Routes (Hono)

```typescript
import { Hono } from 'hono'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'

export const callsRoutes = new Hono<{ Bindings: Env }>()

callsRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  const result = await db.query('SELECT * FROM calls WHERE organization_id = $1', [
    session.organization_id,
  ])

  return c.json({ calls: result.rows })
})
```

### 3. Type Safety (Zod Validation)

```typescript
import { z } from 'zod'

const startCallSchema = z.object({
  phone_number: z.string().regex(/^\+[1-9]\d{1,14}$/),
  organization_id: z.string().max(100),
  system_id: z.string().uuid().optional(),
})

export async function POST(c: Context) {
  const body = await c.req.json()
  const result = startCallSchema.safeParse(body)

  if (!result.success) {
    return c.json({ error: result.error }, 400)
  }

  // Safe to use result.data
}
```

---

## Best Practices

### ✅ DO:

- **Immutable artifacts**: Use RLS for read-only audit data
- **Edge caching**: Cache static assets at CDN (Pages)
- **Type safety**: Use Zod for API validation, TypeScript everywhere
- **RBAC**: Enforce via KV sessions + RLS policies
- **Telephony**: Use Telnyx VXML for voice workflows
- **Client-side auth**: `useSession()` instead of `getServerSession()`
- **API calls**: Always call Workers endpoints from client

### ❌ DON'T:

- **No SSR**: Static export can't use server-side rendering
- **No API routes in app/api**: Move to `workers/src/routes/`
- **No server components with data fetching**: Use client-side fetch
- **No getServerSession**: Use `useSession()` hook
- **No direct DB access from Pages**: All DB via Workers APIs

---

## Troubleshooting

### Build Fails: "export const dynamic = 'force-dynamic' cannot be used with output: export"

**Cause**: Page or API route has server-side features  
**Fix**: Convert to client-side or move API route to Workers

### 500 Errors in Workers

**Cause**: Missing `nodejs_compat` flag  
**Fix**: Add to `workers/wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]
```

### Pages Deploy Shows 404

**Cause**: No static files generated  
**Fix**: Verify `out/` directory exists after `npm run build`

### API Calls Fail with CORS

**Cause**: CORS not configured in Workers  
**Fix**: Add CORS middleware in `workers/src/index.ts`:

```typescript
import { cors } from 'hono/cors'

app.use(
  '*',
  cors({
    origin: ['https://wordis-bond.com'],
    credentials: true,
  })
)
```

### Authentication (Custom Workers Auth)

**Status**: ✅ **WORKING** - Custom session-based auth with CSRF protection
**Architecture**:

- Frontend: Custom AuthProvider with useSession() hook
- Backend: Workers API with session tokens
- Security: CSRF tokens + CORS protection

**API Endpoints:**

```
GET  /api/auth/csrf → CSRF token
POST /api/auth/callback/credentials → Login
GET  /api/auth/session → Session validation
POST /api/auth/signup → User registration
```

**Session Flow:**

1. Client fetches CSRF token from Workers
2. Client sends credentials + CSRF token to Workers
3. Workers validates CSRF, creates session in DB
4. Workers returns sessionToken to client
5. Client stores sessionToken, validates via /api/auth/session

**Security Features:**

- CSRF protection via token validation
- Session persistence in database
- CORS-restricted to allowed origins
- No external auth dependencies

---

## Migration Checklist

### Converting Server Pages → Client Pages:

- [ ] Add `'use client'` directive
- [ ] Replace `getServerSession()` with `useSession()`
- [ ] Replace server data fetching with `useEffect` + `fetch()`
- [ ] Add loading states (`useState`, loading spinners)
- [ ] Add error boundaries
- [ ] Use `ProtectedGate` for unauthenticated users

### Moving API Routes → Workers:

- [ ] Copy logic from `app/api/*/route.ts` to `workers/src/routes/*.ts`
- [ ] Convert Next.js Request/Response to Hono context
- [ ] Replace `supabaseAdmin` with `getDb(c.env)` + SQL
- [ ] Register route in `workers/src/index.ts`
- [ ] Test endpoint in isolation
- [ ] Deploy Workers

---

## Current Status (Feb 7, 2026)

✅ **Successfully Deployed:**

- Static UI: https://wordis-bond.com (production) / https://wordisbond.pages.dev (pages)
- Workers API: https://wordisbond-api.adrper79.workers.dev
- Build: 28+ static pages, ~102KB first load JS
- All API routes migrated to `workers/src/routes/`
- Custom auth (session tokens via Bearer header) — fully operational
- 109/109 ROADMAP items complete (100%)

---

## Production Architecture

**Live Deployment:**

```
https://wordis-bond.com                              → Cloudflare Pages (Static UI)
https://wordisbond-api.adrper79.workers.dev/api/*     → Cloudflare Workers (API)
```

**How It Works:**

1. User visits `wordis-bond.com` → Cloudflare serves static HTML from Pages
2. Client-side JS calls Workers API via `apiClient` with Bearer auth
3. Workers process API request (auth → validation → DB → response)
4. CORS configured for cross-origin (`wordis-bond.com` ↔ Workers)

---

## References

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)

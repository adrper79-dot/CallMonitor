# Hybrid Cloudflare Deployment Gospel

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

# KV Namespace (Sessions)
[[kv_namespaces]]
binding = "SESSIONS"
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
    unoptimized: true
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

- `wordisbond.com/*` → Pages (Static UI)
- `api.wordisbond.com/*` → Workers (APIs)

Or use a single domain with Workers routes:
- `wordisbond.com/api/*` → Workers
- `wordisbond.com/*` → Pages (fallback)

---

## Architecture Patterns

### 1. Client-Side Pages (No SSR)

```typescript
'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState(null)

  useEffect(() => {
    // Fetch from Workers API
    fetch('/api/organizations/current')
      .then(res => res.json())
      .then(setData)
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
  const result = await db.query(
    'SELECT * FROM calls WHERE organization_id = $1',
    [session.organizationId]
  )

  return c.json({ calls: result.rows })
})
```

### 3. Type Safety (Zod Validation)

```typescript
import { z } from 'zod'

const startCallSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
  organizationId: z.string().uuid(),
  systemId: z.string().uuid().optional()
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

app.use('*', cors({
  origin: ['https://wordisbond.pages.dev', 'https://wordisbond.com'],
  credentials: true
}))
```

### Authentication Fails (NextAuth)

**Cause**: ❌ **CRITICAL** - NextAuth incompatible with static-only Pages  
**Symptoms**: 
```
GET /api/auth/session → 404
POST /api/auth/signin → 405  
POST /api/auth/signup → 405
```

**Explanation:**
NextAuth requires server-side API routes (`app/api/auth/*`) that don't exist in static export. When we moved to `output: 'export'`, all API routes were removed.

**Fix Options:**
1. **Clerk/Auth0** (Recommended) - Replace NextAuth with client-side auth SaaS
2. **Custom JWT** - Build auth endpoints in Workers
3. **Port NextAuth** - Migrate NextAuth to Workers (complex)

**See:** [AUTH_ARCHITECTURE_DECISION.md](../AUTH_ARCHITECTURE_DECISION.md) for detailed analysis and recommendations.

**Quick Workaround (Testing Only):**
Mock the session for UI testing:
```typescript
// lib/mockSession.ts
export const useMockSession = () => ({
  data: { user: { id: '123', email: 'test@example.com' } },
  status: 'authenticated'
})
```

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

## Current Status (Feb 2, 2026)

✅ **Successfully Deployed:**
- Static UI: https://a4b3599d.wordisbond.pages.dev (deployment URL)
- **Production URL:** https://wordis-bond.com (custom domain - setup in progress)
- Build: 28 static pages, ~102KB first load JS
- Client-side pages converted: dashboard, voice-operations
- Workers APIs: calls, organizations, auth, webhooks, health
- **Workers Routes:** Configured for `wordis-bond.com/api/*` ✅

⚠️ **In Progress:**
- Custom domain activation in Cloudflare Dashboard (Pages)
- DNS configuration for wordis-bond.com

🔧 **Known Issue - Authentication:**
NextAuth endpoints still need migration (see AUTH_ARCHITECTURE_DECISION.md). Once custom domain is active, API routing will work but authentication requires additional implementation.

---

## Production Architecture

**Live Deployment:**
```
https://wordis-bond.com          → Cloudflare Pages (Static UI)
https://wordis-bond.com/api/*    → Cloudflare Workers (API)
```

**How It Works:**
1. User visits `wordis-bond.com` → Cloudflare serves static HTML from Pages
2. User calls `/api/auth/session` → Cloudflare routes to Workers via Workers Route
3. Workers process API request and return JSON
4. **Same origin** = No CORS issues

**Workers Routes (Active):**
- Pattern: `wordis-bond.com/api/*`
- Worker: `wordisbond-api`
- Zone: wordis-bond.com
- Status: ✅ Deployed (Version: 629f1afa-6e41-4c81-b0d9-98653664d746)

⚠️ **Known Limitation - API Routing:**

**Problem:** Client calls `/api/auth/session` but Pages has no API routes (they're in Workers at a separate URL).

**Error Symptoms:**
```
GET /api/auth/session → 404 (Not Found)
POST /api/auth/signup → 405 (Method Not Allowed)
GET /api/health/auth-providers → 404 (Not Found)
```

**Root Cause:** Hybrid architecture has UI and API at **different URLs**:
- UI: `https://wordisbond.pages.dev`
- API: `https://wordisbond-api.adrper79.workers.dev`

Client code expects APIs at same origin (`/api/*`), but they don't exist there.

**Solutions (Choose One):**

### Solution 1: Custom Domain with Workers Routes (Production)

Use a single custom domain with Cloudflare Workers Routes:

1. **Configure DNS:**
   - `wordisbond.com` → Cloudflare Pages project
   
2. **Add Workers Route in Cloudflare Dashboard:**
   - Route: `wordisbond.com/api/*`
   - Worker: `wordisbond-api`
   - This intercepts `/api/*` requests and sends them to Workers

3. **Result:** 
   - `wordisbond.com/` → Pages (UI)
   - `wordisbond.com/api/*` → Workers (API)
   - Same origin, no CORS issues

### Solution 2: Environment Variable + CORS (Dev/Testing)

Configure client to call Workers API directly:

1. **Update `.env.local`:**
   ```bash
   NEXT_PUBLIC_API_URL=https://wordisbond-api.adrper79.workers.dev
   ```

2. **Update API calls in client:**
   ```typescript
   const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
   fetch(`${apiUrl}/api/auth/session`)
   ```

3. **Enable CORS in Workers** (already done in `workers/src/index.ts`)

4. **Result:**
   - Cross-origin requests work
   - Different URLs (CORS required)
   - No custom domain needed

### Solution 3: Pages Functions (Proxy Pattern)

Create Pages Functions to proxy API requests:

1. **Create `functions/api/[[path]].ts`:**
   ```typescript
   export async function onRequest(context) {
     const url = new URL(context.request.url)
     const apiUrl = `https://wordisbond-api.adrper79.workers.dev${url.pathname}`
     
     return fetch(apiUrl, {
       method: context.request.method,
       headers: context.request.headers,
       body: context.request.body
     })
   }
   ```

2. **Result:**
   - Pages proxies `/api/*` to Workers
   - Same origin (no CORS)
   - More complex (extra function)

### Recommended: Solution 1 (Custom Domain)

For production, use a custom domain with Workers Routes. This is:
- ✅ Cleanest architecture (single domain)
- ✅ No CORS complexity
- ✅ Native Cloudflare routing
- ✅ Best performance (no proxy hop)

For now, testing can continue with direct Workers URL calls and CORS.

⚠️ **API Migration In Progress:**
- Moved `app/api/` → `app/_api_to_migrate/` (100+ routes)
- Strategy: Migrate on-demand as features are tested
- See [API_MIGRATION_GUIDE.md](../API_MIGRATION_GUIDE.md) for details

📋 **Next Steps:**
1. Test deployed site, identify missing API endpoints
2. Migrate critical routes (campaigns, reports, analytics)
3. Update client code to call Workers endpoints
4. Deploy Workers after each migration
5. Iterate until all features work

---

## References

- [API_MIGRATION_GUIDE.md](../API_MIGRATION_GUIDE.md) - Complete migration guide
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)

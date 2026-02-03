# API Migration Guide: app/api → workers/src/routes

## Status: Build Successful ✅

The static export builds successfully after moving `app/api/` routes out of the way.

## Why This Was Necessary

Next.js `output: 'export'` creates **purely static files** (HTML/CSS/JS only). It CANNOT include:
- API routes (`app/api/` directory)
- Server-side rendering (`getServerSession`, `supabaseAdmin`)  
- Dynamic routes with server data fetching

This aligns with ARCH_DOCS design: **Cloudflare Pages (UI) + Cloudflare Workers (API)**

## Current State

- ✅ `out/` directory contains static build
- ✅ Server pages converted to client-side:
  - `app/dashboard/page.tsx` - now uses `useSession()`, fetches `/api/organizations/current`
  - `app/voice-operations/page.tsx` - now uses `useSession()`, fetches `/api/calls`
- ⚠️ `app/_api_to_migrate/` - Contains ~100+ API routes that were in `app/api/`
- ⚠️ `app/_invite_to_migrate/` - Invite acceptance page (complex server logic)

## Workers API Routes (Already Implemented)

Located in `workers/src/routes/`:
- ✅ `calls.ts` - GET/POST `/api/calls`, `/api/calls/:id`, `/api/calls/start`, `/api/calls/:id/end`
- ✅ `organizations.ts` - GET `/api/organizations/current`, `/api/organizations/:id`
- ✅ `auth.ts` - Authentication endpoints
- ✅ `webhooks.ts` - Webhook handlers  
- ✅ `health.ts` - Health check endpoints

## Migration Strategy

### Option 1: On-Demand Migration (Recommended)

1. Deploy static Pages + current Workers
2. Test UI in browser
3. When you hit a missing endpoint error (404), migrate that specific route from `app/_api_to_migrate/` to `workers/src/routes/`
4. Redeploy Workers
5. Repeat

**Pros:** Fast, pragmatic, only migrate what you actually use  
**Cons:** Discover issues at runtime

### Option 2: Comprehensive Migration

1. Catalog all API routes in `app/_api_to_migrate/`
2. Create corresponding Workers routes for each
3. Test locally
4. Deploy everything at once

**Pros:** Thorough, nothing breaks  
**Cons:** Time-consuming, may migrate unused routes

## How to Migrate a Single API Route

Example: Migrating `app/_api_to_migrate/campaigns/route.ts` to Workers

### Step 1: Read the Next.js Route

```typescript
// app/_api_to_migrate/campaigns/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import supabaseAdmin from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('organization_id', session.organizationId)
  
  return Response.json({ campaigns: data })
}
```

### Step 2: Create Workers Route

```typescript
// workers/src/routes/campaigns.ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { requireAuth } from '../lib/auth'

export const campaignsRoutes = new Hono<{ Bindings: Env }>()

campaignsRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  
  const db = getDb(c.env)
  const result = await db.query(
    'SELECT * FROM campaigns WHERE organization_id = $1',
    [session.organizationId]
  )
  
  return c.json({ campaigns: result.rows })
})
```

### Step 3: Register Route

```typescript
// workers/src/index.ts
import { campaignsRoutes } from './routes/campaigns'

app.route('/api/campaigns', campaignsRoutes)
```

### Step 4: Deploy

```bash
cd workers
npm run deploy
```

## Critical Routes to Migrate First

Based on the UI pages, these routes are likely needed:

1. **Calls Management:**
   - ✅ `/api/calls` - Already in Workers
   - ✅ `/api/calls/start` - Already in Workers
   - May need: `/api/calls/[id]/disposition`, `/api/calls/[id]/notes`

2. **Organization:**
   - ✅ `/api/organizations/current` - Already in Workers

3. **Campaigns:**
   - ⚠️ `/api/campaigns` - Not yet migrated (campaigns page uses this)

4. **Reports:**
   - ⚠️ `/api/reports` - Not yet migrated (reports page uses this)

5. **Analytics:**
   - ⚠️ `/api/analytics` - Not yet migrated (analytics page uses this)

6. **Settings:**
   - ⚠️ `/api/team/*` - Not yet migrated (settings team management uses this)

## Testing Strategy

1. **Deploy Pages:**
   ```bash
   wrangler pages deploy out --project-name wordisbond
   ```

2. **Open browser DevTools → Network tab**

3. **Navigate through the app:**
   - Dashboard → Should work (uses `/api/organizations/current`)
   - Voice Operations → Should work (uses `/api/calls`)
   - Campaigns → Will fail (needs `/api/campaigns` migration)
   - Reports → Will fail (needs `/api/reports` migration)

4. **For each 404 error:**
   - Note the endpoint
   - Migrate from `app/_api_to_migrate/` to `workers/src/routes/`
   - Redeploy Workers

## Invite Page

The invite acceptance flow (`app/_invite_to_migrate/[token]/page.tsx`) is complex:
- Validates invite token
- Checks expiration
- Matches user email
- Adds user to organization
- Updates database tables

**Options:**
1. Create a dedicated `/api/invites/:token/accept` Workers endpoint
2. Move invite logic to client-side with API calls
3. Keep invite page as a separate Workers-based page (non-Next.js)

## Next Steps

1. ✅ **Build completed** - `out/` directory ready
2. **Deploy Pages:** `wrangler pages deploy out --project-name wordisbond`
3. **Test in browser** - identify missing endpoints
4. **Migrate critical routes** as needed
5. **Deploy Workers** after each migration
6. **Iterate** until all features work

## Rollback Plan

If needed, restore the old structure:
```bash
Move-Item ".\app\_api_to_migrate" ".\app\api" -Force
Move-Item ".\app\_invite_to_migrate" ".\app\invite" -Force
```

Then revert `next.config.js` to use SSR instead of static export.

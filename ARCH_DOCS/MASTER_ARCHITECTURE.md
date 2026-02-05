# Master Architecture Reference

**Status**: Production Gospel | Updated: Feb 3, 2026
**Version**: 4.0 - Bond AI + Team Management + PBKDF2 Security

---

## Architecture Overview

**Wordis Bond** uses a **hybrid Cloudflare architecture**:
- **Static UI** deployed to Cloudflare Pages (CDN-delivered HTML/CSS/JS)
- **API layer** deployed to Cloudflare Workers (edge-native Hono framework)
- **Clean separation** between presentation and business logic

This aligns with modern edge-first patterns and provides:
- ✅ Global CDN distribution for UI
- ✅ Edge computing for APIs (low latency)
- ✅ Immutable deployments (rollback-friendly)
- ✅ Type safety (Zod validation + TypeScript)
- ✅ Scalability (auto-scaling Workers)

---

## Coding Standards

### Naming Convention: Snake Case Only

**MANDATORY**: All database columns, API endpoints, and variable names MUST use **snake_case** exclusively.

- ✅ **Correct**: `session_token`, `user_id`, `organization_name`, `created_at`
- ❌ **Incorrect**: `sessionToken`, `userId`, `organizationName`, `createdAt`
- ❌ **Incorrect**: `session-token`, `user-id`, `organization-name`, `created-at`

**Rationale**:
- PostgreSQL standard (snake_case columns)
- API consistency (RESTful conventions)
- TypeScript/JavaScript compatibility
- Prevents database query failures from case mismatches

**Enforcement**:
- Database migrations: Always use snake_case column names
- API responses: Always return snake_case keys
- TypeScript interfaces: Use snake_case for API data types
- Code review: Reject any camelCase database references

---

## Component Architecture

```mermaid
flowchart TB
    subgraph "Client Browser"
        Browser[Browser Client<br/>Next.js Static Pages + React<br/>Custom AuthProvider + useSession()]
    end

    subgraph "Cloudflare Edge Network"
        Pages[Cloudflare Pages<br/>Static HTML/CSS/JS<br/>Global CDN Caching<br/>No SSR]

        Workers[Cloudflare Workers<br/>Hono Framework<br/>Custom Auth + CSRF<br/>Session-based Auth<br/>API Routes: /auth, /calls, /orgs, /teams, /bond-ai]
    end

    subgraph "Data & Services"
        Neon[Neon Postgres<br/>Hyperdrive Pooling<br/>RLS Security<br/>113 Tables]

        R2[Cloudflare R2<br/>Object Storage<br/>Audio Recordings<br/>Evidence Bundles]

        Telnyx[Telnyx<br/>Voice/SMS Telephony<br/>Branded DIDs<br/>Media Streams]

        Stripe[Stripe<br/>Billing & Subscriptions<br/>Usage Tracking]

        AssemblyAI[AssemblyAI<br/>Transcription<br/>Real-time + Batch]

        ElevenLabs[ElevenLabs<br/>Text-to-Speech<br/>Voice Cloning]

        OpenAI[OpenAI<br/>LLM Reasoning<br/>Bond AI Chat/Copilot<br/>Translation Support]
    end

    Browser -->|HTTPS| Pages
    Browser -->|API Calls /api/*| Workers
    Workers -->|Database Queries| Neon
    Workers -->|Media Storage| R2
    Workers -->|Voice Calls| Telnyx
    Workers -->|Billing| Stripe
    Workers -->|Transcription| AssemblyAI
    Workers -->|TTS/Audio| ElevenLabs
    Workers -->|Translation| OpenAI

    style Browser fill:#e1f5fe
    style Pages fill:#f3e5f5
    style Workers fill:#e8f5e8
    style Neon fill:#fff3e0
    style R2 fill:#fce4ec
    style Telnyx fill:#f1f8e9
    style Stripe fill:#e0f2f1
    style AssemblyAI fill:#ede7f6
    style ElevenLabs fill:#fff8e1
    style OpenAI fill:#fce4ec
```

---

## Technology Stack

### Frontend (Pages)
- **Next.js 15.5.7**: Static export mode (`output: 'export'`)
- **React 19**: Client-side rendering only
- **Custom AuthProvider**: Client-side session management (`useSession()`)
- **Tailwind CSS**: Styling
- **TypeScript**: Type safety

### Backend (Workers)
- **Hono 4.7.4**: Web framework (Express-like)
- **Node.js Compatibility**: `nodejs_compat` flag
- **Zod 3.22+**: API validation
- **TypeScript**: Type safety
- **Neon SDK**: PostgreSQL client (single client approach)

### Infrastructure
- **Cloudflare Pages**: UI hosting
- **Cloudflare Workers**: API hosting
- **Cloudflare Hyperdrive**: Database connection pooling
- **Cloudflare R2**: Object storage (recordings)
- **Cloudflare KV**: Key-value store (cache only - sessions in DB)

### External Services
- **Neon**: PostgreSQL database (serverless)
- **Telnyx**: Voice/SMS telephony
- **Stripe**: Billing/subscriptions
- **AssemblyAI**: Transcription
- **OpenAI**: LLM reasoning
- **ElevenLabs**: Text-to-speech
- **Resend**: Transactional email

---

## Key Design Decisions

### 1. Static Export (No SSR)

**Decision**: Use Next.js static export instead of server-side rendering.

**Rationale**:
- Simpler deployment (just HTML/CSS/JS files)
- Better CDN caching (immutable artifacts)
- Aligns with Cloudflare Pages architecture
- Avoids Vercel dependency (@cloudflare/next-on-pages complexity)

**Trade-offs**:
- ❌ No `getServerSideProps` or server components with data fetching
- ❌ No API routes in `app/api/` directory
- ✅ Faster builds, simpler deploys, better caching

### 2. Workers for APIs (Hono)

**Decision**: Build all APIs in Cloudflare Workers using Hono framework.

**Rationale**:
- Native Cloudflare (no adapter needed)
- Edge computing (low latency globally)
- Auto-scaling (no capacity planning)
- Clean separation from UI

**Trade-offs**:
- ❌ Different framework than Next.js (learning curve)
- ✅ Better performance, simpler architecture, native bindings

### 3. Custom Client-Side Auth

**Decision**: Use custom AuthProvider with session-based authentication instead of NextAuth.

**Rationale**:
- Compatible with static export
- Full control over auth flow
- No external dependencies on auth libraries
- Direct integration with Workers API
- CSRF protection for cross-origin requests

**Trade-offs**:
- ❌ More custom code to maintain
- ✅ No library conflicts, cleaner architecture

---

## Data Flow Patterns

### Authentication Flow

```
1. User visits /signin
2. Client-side form submission → POST /api/auth/csrf (Workers) → Get CSRF token
3. Client-side form submission → POST /api/auth/callback/credentials (Workers)
4. Workers validates CSRF token + credentials → Creates session in DB
5. Workers returns sessionToken → Client stores in localStorage
6. Client calls /api/auth/session → Workers validates sessionToken
7. Subsequent requests include sessionToken in Authorization header
```

### API Request Flow

```
1. Client component (useEffect) → fetch('/api/organizations/current')
2. Request hits Workers endpoint with Authorization: Bearer <sessionToken>
3. Workers:
   a. Validate sessionToken against DB (verifySession)
   b. Extract user/org from session
   c. Query Neon via Hyperdrive
   d. Return JSON response
4. Client component updates state
```

### Data Fetching Pattern

```typescript
'use client'

import { useSession } from '@/components/AuthProvider'
import { useEffect, useState } from 'react'

export default function Page() {
  const { data: session, status } = useSession()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetch('/api/organizations/current', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('wb-session-token')}`
        }
      })
        .then(res => res.json())
        .then(setData)
        .finally(() => setLoading(false))
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
  }, [session, status])

  if (status === 'loading' || loading) return <Loading />
  if (status === 'unauthenticated') return <SignInPrompt />
  return <Content data={data} />
}
```

---

## Security Architecture

### Session-Based Authentication

Implemented with database persistence:

1. **Client-side** (UI visibility):
   ```typescript
   const { data: session } = useSession()
   if (session?.user?.role !== 'admin') return null
   ```

2. **Workers API** (endpoint protection):
   ```typescript
   const session = await requireAuth(c)
   if (session.role !== 'admin') {
     return c.json({ error: 'Forbidden' }, 403)
   }
   ```

3. **Database RLS** (data isolation):
   ```sql
   CREATE POLICY org_isolation ON calls
   FOR SELECT USING (organization_id = current_setting('app.org_id')::uuid);
   ```

### Authentication

- **JWT tokens**: Issued by Workers, stored in HttpOnly cookies
- **Session validation**: Every API request validates JWT
- **Expiration**: Configurable (default 7 days)
- **Refresh**: Automatic with sliding window

### Password Security

**PBKDF2-SHA256 Implementation**:
- **Algorithm**: PBKDF2 with SHA-256
- **Iterations**: 120,000 (NIST recommended minimum)
- **Salt**: 32-byte cryptographically secure random
- **Key Length**: 256 bits (32 bytes)
- **Backward Compatibility**: Transparent migration from legacy SHA-256 hashes

**Implementation**:
```typescript
// workers/src/routes/auth.ts
const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const key = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']),
    256
  )
  return `pbkdf2:${btoa(String.fromCharCode(...salt))}:${btoa(String.fromCharCode(...new Uint8Array(key)))}`
}
```

---

## Bond AI Architecture

### 3-Tier AI Assistant System

**Tier 1 - Chat Widget**:
- **Purpose**: Conversational AI assistant with access to testing data
- **Features**: Context-aware responses, conversation history, suggested questions
- **Data Access**: Organization stats, recent alerts, KPI summaries, test results
- **UI**: Floating chat widget in AppShell

**Tier 2 - Proactive Alerts**:
- **Purpose**: AI-driven alert system for operational insights
- **Features**: Auto-generated alerts, severity classification, bulk actions
- **Data Sources**: Call metrics, performance KPIs, anomaly detection
- **UI**: Dashboard alerts panel with real-time updates

**Tier 3 - Call Co-Pilot**:
- **Purpose**: Real-time AI assistance during voice calls
- **Features**: Context-aware suggestions, quick actions, custom questions
- **Data Access**: Live call context, historical patterns, compliance rules
- **UI**: Integrated into CallDetailView

### AI Data Flow

```
1. User interacts with Bond AI (chat/alerts/copilot)
2. Workers route calls Bond AI lib with user/org context
3. Bond AI fetches relevant data (stats, alerts, call context, test results)
4. OpenAI API processes context + user query
5. Response formatted and returned to UI
6. UI updates with AI insights/suggestions
```

### Team Management Architecture

**Multi-Organization Support**:
- **Org Switching**: Users can belong to multiple organizations
- **Role-Based Access**: viewer → agent → manager/compliance → admin → owner
- **Team Structure**: Departments with hierarchical team management
- **RBAC v2**: Database-backed permissions with 58 granular permissions

**Database Schema**:
- `teams`: Team definitions with department grouping
- `team_members`: User-team associations with roles
- `rbac_permissions`: Granular permission definitions
- `user_organization_roles`: Multi-org role assignments

---

## Deployment Strategy

### Current Deployments

**Pages (UI)**:
- URL: https://wordisbond.pages.dev
- Build: `npm run build` → `out/` directory
- Deploy: `wrangler pages deploy out --project-name=wordisbond`

**Workers (API)**:
- URL: https://wordisbond-api.adrper79.workers.dev
- Build: TypeScript → JavaScript in `workers/`
- Deploy: `cd workers && wrangler deploy`

### Deployment Flow

```bash
# 1. Build UI
npm run build

# 2. Deploy Pages
wrangler pages deploy out --project-name=wordisbond

# 3. Deploy Workers
cd workers
wrangler deploy

# 4. Verify
curl -I https://827487ca.wordisbond.pages.dev
curl https://wordisbond-api.adrper79.workers.dev/health
```

---

## Migration Status

### ✅ Completed

- Static export build configuration
- Client-side page conversions (dashboard, voice-operations)
- Workers API scaffolding (calls, organizations, auth, webhooks)
- Cloudflare deployment pipeline
- Security headers configuration
- **Bond AI 3-tier system** (chat widget, proactive alerts, call co-pilot)
- **Team Management** (multi-org support, RBAC v2, team/department structure)
- **PBKDF2 password security upgrade** (backward-compatible migration)
- Database schema migrations (7 new tables + 58 permissions)

### 🔄 In Progress

- API route migration from `app/_api_to_migrate/` to `workers/src/routes/`
- On-demand migration as features are tested
- Strategy: Migrate only what's actually used

### 📋 Remaining

- ~100+ API routes to evaluate and migrate
- Invite acceptance flow (complex server logic)
- Feature testing and endpoint discovery

---

## References

- **Deployment Guide**: [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)
- **Migration Guide**: [../API_MIGRATION_GUIDE.md](../API_MIGRATION_GUIDE.md)
- **Roadmap**: [../ROADMAP.md](../ROADMAP.md)
- **Current Status**: [CURRENT_STATUS.md](CURRENT_STATUS.md)

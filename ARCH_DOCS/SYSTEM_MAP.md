# Codebase System Map

```mermaid
graph TB
    subgraph "Frontend (Next.js Static)"
        UI[UI Pages<br/>app/page.tsx<br/>app/dashboard/*<br/>app/signin/*]
        Components[Reusable Components<br/>components/ui/*<br/>components/AuthProvider.tsx<br/>components/voice/*]
        Hooks[Custom Hooks<br/>hooks/useWebRTC.ts<br/>hooks/useSession.ts<br/>hooks/useRBAC.ts]
    end

    subgraph "Backend (Cloudflare Workers)"
        WorkersAPI[API Layer<br/>workers/src/index.ts<br/>workers/src/routes/*]
        Auth[Authentication<br/>workers/src/routes/auth.ts<br/>workers/src/lib/auth.ts]
        DB[Database Layer<br/>workers/src/lib/db.ts<br/>workers/src/lib/pgClient.ts]
    end

    subgraph "Shared Libraries"
        APIClient[API Client<br/>lib/api-client.ts<br/>lib/schemas/api.ts]
        Utils[Utilities<br/>lib/rbac.ts<br/>lib/rbac-server.ts<br/>lib/logger.ts]
        Services[External Services<br/>lib/services/elevenlabs.ts<br/>lib/services/translation.ts]
    end

    subgraph "Testing & Config"
        Tests[Tests<br/>tests/e2e/*<br/>tests/unit/*<br/>vitest.config.ts]
        Config[Configuration<br/>wrangler.toml<br/>package.json<br/>tsconfig.json]
    end

    UI --> APIClient
    Components --> Hooks
    Hooks --> APIClient
    APIClient --> WorkersAPI
    WorkersAPI --> Auth
    WorkersAPI --> DB
    Auth --> DB
    DB --> Utils
    WorkersAPI --> Services
    Tests --> UI
    Tests --> WorkersAPI
    Tests --> Utils

    style UI fill:#e1f5fe
    style Components fill:#f3e5f5
    style Hooks fill:#e8f5e8
    style WorkersAPI fill:#fff3e0
    style Auth fill:#fce4ec
    style DB fill:#f1f8e9
    style APIClient fill:#e0f2f1
    style Utils fill:#ede7f6
    style Services fill:#fff8e1
    style Tests fill:#fce4ec
    style Config fill:#f0f8ff
```

## 1. Backend API (Cloudflare Workers)
**Purpose**: Edge API, auth, DB, voice.

**Files**:
- `workers/src/index.ts`: App entry, routes mount
- `workers/src/routes/auth.ts`: Signup/login/session
- `workers/src/routes/organizations.ts`: Org create/current
- `workers/src/routes/calls.ts`: Call start/end
- `workers/src/lib/auth.ts`: Session verify
- `workers/src/lib/db.ts`: Neon getDb
- `workers/src/scheduled.ts`: Cron jobs

## 2. Frontend App (Next.js Static)
**Purpose**: UI pages.

**Files**:
- `app/layout.tsx`: Root + AuthProvider
- `app/page.tsx`: Landing
- `app/signin/page.tsx`: Login
- `app/dashboard/page.tsx`: Main
- `app/voice/*`: Dialer
- `app/settings/*`: Config

## 3. UI Components
**Purpose**: Reusable UI (shadcn).

**Files**:
- `components/ui/*`: Button, Input etc.
- `components/AuthProvider.tsx`: Session context
- `components/voice/*`: Voice/WebRTC UI
- `components/Navigation.tsx`: Nav bar

## 4. Custom Hooks
**Purpose**: Logic.

**Files**:
- `hooks/useWebRTC.ts`: SIP connect/call
- `hooks/useSession` via AuthProvider
- `hooks/useRBAC.ts`: Permissions

## 5. Lib/Utils
**Purpose**: Shared.

**Files**:
- `lib/api-client.ts`: Typed fetch
- `lib/schemas/api.ts`: Zod
- `lib/logger.ts`: Logs

## 6. Testing
**Files**:
- `tests/e2e/login.spec.ts`
- `tests/production/*`

## 7. Deploy/Config
**Files**:
- `wrangler.toml`: Pages
- `workers/wrangler.toml`: API
- `package.json`: Scripts
- `.cf_put.ps1`: Deploy

Audit for excellence next.
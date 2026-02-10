# Wordis Bond

> **"The System of Record for Business Conversations"**  
> Latimer + Woods Tech LLC

[![Cloudflare Workers](https://img.shields.io/badge/API-Cloudflare%20Workers-orange)]()
[![Cloudflare Pages](https://img.shields.io/badge/UI-Cloudflare%20Pages-blue)]()
[![Neon PostgreSQL](https://img.shields.io/badge/DB-Neon%20PG%2017-green)]()

---

## Architecture

| Layer          | Technology                         | URL                                           |
| -------------- | ---------------------------------- | --------------------------------------------- |
| **UI**         | Next.js 15 · React 19 · Tailwind 4 | `https://wordis-bond.com`                     |
| **API**        | Hono 4.7 on Cloudflare Workers     | `https://wordisbond-api.adrper79.workers.dev` |
| **Database**   | Neon PostgreSQL 17 (serverless)    | Hyperdrive-pooled                             |
| **Storage**    | Cloudflare R2                      | Recordings, evidence bundles                  |
| **Cache / KV** | Cloudflare KV                      | Rate limiting, idempotency                    |
| **Auth**       | Custom session + bcrypt            | Cookie-based, fingerprint-bound               |
| **Payments**   | Stripe                             | Checkout, subscriptions, portal               |
| **Voice**      | Telnyx WebRTC + SIP                | Two-way browser calling                       |
| **AI**         | OpenAI, ElevenLabs, AssemblyAI     | Summaries, TTS, transcription                 |

Static UI is exported via `next build` → deployed to Cloudflare Pages.  
All dynamic logic lives in `workers/src/` → deployed as a single Cloudflare Worker.

For detailed architecture, see [ARCH_DOCS/00-README.md](ARCH_DOCS/00-README.md).

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .dev.vars.example .dev.vars     # Workers secrets
cp .env.local.example .env.local   # Next.js env

# 3. Start local development
npm run dev          # Next.js UI on :3000
npm run api:dev      # Workers API on :8787 (wrangler)

# 4. Run tests
npm test             # Unit tests (vitest)
npm run test:live    # Production smoke tests
```

---

## npm Scripts

### Development

| Script            | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Next.js dev server (port 3000)           |
| `npm run api:dev` | Wrangler Workers dev server (port 8787)  |
| `npm run build`   | Next.js production build (static export) |

### Deployment

| Script                 | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `npm run deploy:all`   | **Full deploy** — env verify → build → Pages → Workers |
| `npm run pages:deploy` | Deploy UI to Cloudflare Pages                          |
| `npm run api:deploy`   | Deploy API to Cloudflare Workers                       |
| `npm run env:verify`   | Validate all required env vars                         |

### Testing

| Script                    | Description                  |
| ------------------------- | ---------------------------- |
| `npm test`                | Run vitest in watch mode     |
| `npm run test:run`        | Single vitest run            |
| `npm run test:live`       | Production smoke tests (all) |
| `npm run test:live:api`   | API endpoint smoke tests     |
| `npm run test:live:db`    | Database connectivity tests  |
| `npm run test:live:voice` | Voice/Telnyx tests           |
| `npm run test:coverage`   | Coverage report              |

### Database

| Script                  | Description            |
| ----------------------- | ---------------------- |
| `npm run db:migrate`    | Run schema migrations  |
| `npm run db:reset-test` | Reset + seed test data |

### Code Quality

| Script                 | Description                   |
| ---------------------- | ----------------------------- |
| `npm run lint`         | ESLint check                  |
| `npm run lint:fix`     | ESLint auto-fix               |
| `npm run format`       | Prettier format all           |
| `npm run format:check` | Prettier check                |
| `npm run typecheck`    | TypeScript type check         |
| `npm run cf:typegen`   | Generate Cloudflare env types |

### Observability

| Script                 | Description                 |
| ---------------------- | --------------------------- |
| `npm run health-check` | Curl the `/health` endpoint |
| `npm run api:tail`     | Live-tail Workers logs      |
| `npm run cf:logs`      | Pretty-print Workers logs   |

---

## Project Structure

```
├── app/                    # Next.js pages & components (static export)
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   ├── dashboard/          # Authenticated dashboard
│   ├── signin/ signup/     # Auth flows
│   ├── bookings/           # Booking management
│   ├── campaigns/          # Campaign management
│   ├── voice/              # WebRTC voice interface
│   └── api-docs/           # Interactive API docs
│
├── workers/                # Cloudflare Workers API
│   ├── src/
│   │   ├── index.ts        # Hono app — CORS, routes, error handler
│   │   ├── lib/            # Shared utilities
│   │   │   ├── db.ts       # Database connection (Neon via Hyperdrive)
│   │   │   ├── auth.ts     # Session validation + fingerprinting
│   │   │   ├── audit.ts    # Centralized audit log writer
│   │   │   ├── rate-limit.ts  # KV sliding-window rate limiter
│   │   │   ├── idempotency.ts # KV idempotency middleware
│   │   │   ├── logger.ts   # Structured JSON logger
│   │   │   └── errors.ts   # Error classes + handler
│   │   └── routes/         # Route modules (~27 files)
│   │       ├── calls.ts    # Call CRUD, outcomes, timeline
│   │       ├── billing.ts  # Stripe subscriptions, checkout
│   │       ├── recordings.ts # Recording access + storage
│   │       ├── bookings.ts # Booking management
│   │       └── ...
│   └── wrangler.toml       # Worker bindings (KV, R2, Hyperdrive)
│
├── migrations/             # SQL migrations + seeds
│   ├── reset_test.sql      # Test data reset + seed
│   └── ...
│
├── tests/                  # Test suites
│   └── production/         # Live smoke tests
│
├── ARCH_DOCS/              # Architecture documentation
│   ├── 00-README.md        # Doc navigation index
│   ├── 01-CORE/            # Core architecture docs
│   └── 02-FEATURES/        # Feature-specific docs
│
├── ROADMAP.md              # Development progress tracker
└── package.json            # Scripts, dependencies
```

---

## Environment Variables

### Workers (`.dev.vars`)

| Variable                | Description                       |
| ----------------------- | --------------------------------- |
| `NEON_PG_CONN`          | Neon PostgreSQL connection string |
| `SESSION_SECRET`        | HMAC session signing key          |
| `STRIPE_SECRET_KEY`     | Stripe API key                    |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret     |
| `TELNYX_API_KEY`        | Telnyx voice API key              |
| `OPENAI_API_KEY`        | OpenAI API key                    |
| `RESEND_API_KEY`        | Resend email API key              |
| `ELEVENLABS_API_KEY`    | ElevenLabs TTS key                |
| `ASSEMBLYAI_API_KEY`    | AssemblyAI transcription key      |

### Pages (`.env.local`)

| Variable                   | Description         |
| -------------------------- | ------------------- |
| `NEXT_PUBLIC_API_URL`      | Workers API URL     |
| `NEXT_PUBLIC_TELNYX_TOKEN` | Telnyx WebRTC token |

Run `npm run env:verify` to validate all required variables are set.

---

## Deployment

### Full Deploy (recommended)

```bash
npm run deploy:all
```

### Manual Steps

```bash
# 1. Verify environment
npm run env:verify

# 2. Build static UI
npm run build

# 3. Deploy Pages (UI)
npm run pages:deploy

# 4. Deploy Workers (API)
npm run api:deploy

# 5. Verify
npm run health-check
npm run test:live
```

---

## Contributing

1. All commits go through `husky` pre-commit hooks (lint-staged)
2. Follow patterns in `ARCH_DOCS/` — especially the DB connection standard
3. All mutation routes must use `writeAuditLog()` from `workers/src/lib/audit.ts`
4. Rate-sensitive endpoints must use `rateLimit()` from `workers/src/lib/rate-limit.ts`
5. Non-idempotent POST endpoints must use `idempotent()` middleware
6. Run `npm run typecheck` before pushing

---

## License

Proprietary — Latimer + Woods Tech LLC. All rights reserved.

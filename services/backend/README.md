# Gemini Backend

This service hosts server-only API endpoints that are incompatible with Cloudflare Pages edge runtime (database access, native Node modules, long-running jobs, and webhook handlers).

Quick dev

1. Install dependencies from the repo root:

```bash
cd "c:\Users\Ultimate Warrior\My project\gemini-project"
npm run backend:install
```

Note: security middlewares (`helmet`, `express-rate-limit`) were recently added. If you installed dependencies previously, re-run `npm run backend:install` in the repo root to pick up the new packages.
```

2. Start locally (foreground):

```bash
Deploy
- Use `scripts/deploy_backend.sh <ORG>` to build and push the Docker image to GHCR (set `GITHUB_REPOSITORY_OWNER` or pass org).
- CI workflow publishes images to `ghcr.io/<owner>/gemini-backend` (see `.github/workflows/backend-ci.yml`).
- Example platform manifests available in `deploy/render.yaml` and `deploy/fly.toml`.

```bash
docker run -p 8080:8080 --env NEON_PG_CONN="$NEON_PG_CONN" --env ASSEMBLYAI_API_KEY="$ASSEMBLYAI_API_KEY" gemini-backend:latest
```

Notes

- Webhook handlers are intentionally simple stubs; implement domain logic and signature verification before using in production.
# Gemini Backend Service

Small Node/Express backend intended to host server-only API routes (database access, native modules) while the Next.js frontend is deployed to Cloudflare Pages.

Quick start:

1. Copy `.env.example` to `.env` and set `NEON_PG_CONN` if you want DB access.

2. From `services/backend` install and start:

```bash
cd services/backend
npm install
npm start
```

This will start an Express server on `PORT` (default 8080). Endpoints:
- `GET /health` - basic health check
- `GET /api/attention/events` - sample events listing (requires DB)
- `POST /api/attention/decisions/:id/override` - sample override insert (requires DB)

Next steps:
- Add additional endpoints mapping server-only routes from the Next app.
- Deploy this service to a Node-friendly host (Render, Fly, Vercel Serverless Functions, Cloud Run).

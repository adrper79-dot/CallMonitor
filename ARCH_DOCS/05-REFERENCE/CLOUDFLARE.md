# Cloudflare Stack Guide (Workers + Pages + Wrangler)

## Versions
- `wrangler`: ^4.61.1
- `@cloudflare/workers-types`: ^4.20260131.0

## Architecture
- **Frontend**: Static Next.js export → Cloudflare Pages ("wordisbond")
- **Backend API**: Hono Workers ("wordisbond-api.adrper79.workers.dev")
- **Split deploy** for static + edge API.

## Key Configs

### Pages (wrangler.toml root)
```toml
name = "wordisbond"
pages_build_output_dir = "out"
[vars]
NEXT_PUBLIC_API_URL = "https://wordisbond-api..."
```

### Workers (workers/wrangler.toml)
```
# Deploy: npm run api:deploy
# Tail: npm run api:tail (wrangler tail wordisbond-api)
```

## Commands (npm scripts)
```
npm run pages:deploy     # wrangler pages deploy out --project-name wordisbond
npm run api:deploy       # wrangler deploy --config workers/wrangler.toml
npm run api:tail         # wrangler tail wordisbond-api
npm run deploy:all       # build + both deploys
npm run cf:tail          # wrangler tail (current project)
```

## Env Bindings (TypeScript)
```ts
export type Env = {
  NEON_PG_CONN: string
  HYPERDRIVE: { connectionString: string }
  // KV, R2, DO, etc.
}
```

## Best Practices
- Static export Next.js: next.config.js output: 'export'
- Workers: compat_date, types.
- Secrets: wrangler secret put NEON_PG_CONN
- Tail format: --format pretty

## Troubleshooting
- Tail error: cd workers/ for API or specify --name wordisbond-api
- Pages vs Workers: separate configs/projects.
- Env: npm run env:verify

See CLOUDFLARE_DEPLOYMENT.md, 03-INFRASTRUCTURE/CLOUDFLARE_COMPLIANCE.md
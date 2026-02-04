# Hono Router Guide (Cloudflare Workers Backend)

## Version
- `hono`: ^4.7.0

## Key Concepts
- Ultra-fast web framework for Workers/Pages Functions.
- Type-safe with `Hono<{ Bindings: Env }>`
- Route modules: export const authRoutes = new Hono()

## Env Bindings
```ts
// workers/src/index.ts
export type Env = {
  NEON_PG_CONN: string
  HYPERDRIVE: DurableObjectNamespace // or KVNamespace etc.
}
```

## Core Usage

### Route Definition
```ts
// workers/src/routes/auth.ts
export const authRoutes = new Hono<{ Bindings: Env }>()

authRoutes.post('/signup', async (c) => {
  const body = await c.req.json()
  const db = getDb(c.env)
  // ...
  return c.json({ success: true })
})
```

### Middleware
```ts
// lib/auth.ts
export async function requireAuth(c: Context): Promise<Session | null>
app.use('*', requireAuth) // or per-route
if (!session) return c.json({error: 'Unauthorized'}, 401)
```

### Mounting Routes
```ts
// index.ts
app.route('/api/auth', authRoutes)
app.route('/api/organizations', organizationsRoutes)
export default app
```

## Examples from Codebase

### Auth Session GET
```ts
authRoutes.get('/session', async (c) => {
  const token = parseSessionToken(c)
  const session = await verifySession(c, token)
  return c.json({ user: session ? { ... } : null })
})
```

### Protected Route
```ts
organizationsRoutes.post('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({error: 'Unauthorized'}, 401)
  // Create org...
})
```

## Best Practices
- Type Env bindings.
- Async handlers.
- c.env.DB access.
- Error handling: try/catch, c.json(500)
- Debug: console.error in catch.

## Deployment
```
npm run api:deploy  # wrangler deploy --config workers/wrangler.toml
npm run api:tail    # wrangler tail wordisbond-api
```

See workers/src/routes/* for all routes.
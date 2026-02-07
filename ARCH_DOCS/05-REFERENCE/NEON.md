# Neon Postgres Integration Guide

## Version

- `@neondatabase/serverless`: ^1.0.2
- `pg`: ^8.17.2 (fallback/hyperdrive)

## Key Concepts

- Serverless driver for Neon Postgres (pooled, edge).
- Dual mode: `NEON_PG_CONN` (direct) vs `HYPERDRIVE.connectionString` (pooled).
- Used in Workers for low-latency queries.

## Environment Variables

```
NEON_PG_CONN=postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/db?sslmode=require
# OR
HYPERDRIVE.connectionString=postgres://...
```

## Core Functions

### getDb (workers/src/lib/db.ts)

```ts
import { getDb } from '../lib/db' // Returns pg.Pool-like
const db = getDb(c.env)
await db.query('SELECT * FROM users', [])
```

### Direct Neon Client

```ts
// From auth.ts signup/login
const { neon } = await import('@neondatabase/serverless')
const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
const sql = neon(connectionString)
const users = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
```

## Tagged Template Queries

- Safe from SQL injection.
- Returns array of rows.

```ts
const result = await sql`INSERT INTO users (...) VALUES (...) RETURNING id`
const id = result[0].id
```

## Examples from Codebase

### User Signup (routes/auth.ts)

```ts
// Check existing
const existing = await sqlClient`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
// Insert
await sqlClient`INSERT INTO users (...) VALUES (...)`
// Select new
const userResult = await sqlClient`SELECT id, email FROM users WHERE email = ${email}`
```

### Session Verify (lib/auth.ts)

```ts
const result = await sql`
  SELECT s.expires, u.email, om.organization_id
  FROM public.sessions s JOIN users u ON u.id = s."userId"::text
  LEFT JOIN org_members om ON om.user_id = u.id
  WHERE s."sessionToken" = ${token}
`
```

## Best Practices

- Prefer tagged templates for params.
- Use direct neon for Workers (fast).
- Fallback to hyperdrive for pooling.
- Debug: console.log connectionString type.
- Migrations: `npm run db:migrate` (psql schema.sql)

## Troubleshooting

- Conn error: Check env vars, Neon dashboard.
- Schema mismatch: Run schema.sql.
- Slow queries: Neon query perf dashboard.
- Casting: Note "userId"::text for uuid.

See 01-CORE/Schema.txt for full schema.

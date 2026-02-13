# Database Connection Standard

> **CRITICAL ARCHITECTURAL REQUIREMENT**
> Last Updated: 2026-02-05
> Hours Lost to Violation: 8+

## TL;DR

**When using `@neondatabase/serverless` in Cloudflare Workers, ALWAYS use `NEON_PG_CONN` (direct connection string), NEVER use `HYPERDRIVE.connectionString`.**

```typescript
// ✅ CORRECT - Always do this
const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString

// ❌ WRONG - Never do this
const connectionString = c.env.HYPERDRIVE?.connectionString || c.env.NEON_PG_CONN
```

---

## The Problem

### Hyperdrive vs @neondatabase/serverless Are Incompatible

| Technology               | Connection Method | Protocol                   |
| ------------------------ | ----------------- | -------------------------- |
| Cloudflare Hyperdrive    | TCP proxy         | PostgreSQL wire protocol   |
| @neondatabase/serverless | WebSocket         | WebSocket to Neon endpoint |

**Hyperdrive** is Cloudflare's database connection pooler/accelerator. It:

- Proxies connections to your database
- Uses standard PostgreSQL wire protocol over TCP
- Provides connection pooling and caching
- Works with standard `pg` library

**@neondatabase/serverless** is Neon's edge-compatible driver. It:

- Uses WebSocket connections (not TCP)
- Connects directly to Neon's serverless WebSocket endpoint
- Is designed for edge runtimes that don't support TCP

### Why They Don't Mix

When you pass `HYPERDRIVE.connectionString` to the Neon serverless driver:

1. Driver parses the connection string
2. Driver tries to open a WebSocket to Hyperdrive's proxy endpoint
3. Hyperdrive expects PostgreSQL wire protocol, not WebSocket
4. Hyperdrive returns HTTP 530 error
5. Driver throws: `WebSocket connection failed: expected 101, got 530`

---

## The Standard

### Environment Variables

| Variable       | Purpose                           | Use With                                |
| -------------- | --------------------------------- | --------------------------------------- |
| `NEON_PG_CONN` | Direct Neon serverless connection | `@neondatabase/serverless` (neon, Pool) |
| `HYPERDRIVE`   | Cloudflare connection pooler      | Standard `pg` library only              |

### Connection String Priority

**For @neondatabase/serverless (our standard):**

```typescript
// In workers/src/lib/db.ts
const connectionString = env.NEON_PG_CONN || env.HYPERDRIVE?.connectionString

// In any route using neon() or Pool
const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
```

**NEVER reverse this order.** The fallback to HYPERDRIVE is only for compatibility if NEON_PG_CONN is somehow missing.

### Code Patterns

#### Tagged Template Queries (Simple Queries)

```typescript
import { neon } from '@neondatabase/serverless'

const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
const sql = neon(connectionString)

// Use tagged template literals
const users = await sql`SELECT * FROM users WHERE id = ${userId}`
```

#### Parameterized Queries (Dynamic SQL)

```typescript
import { Pool } from '@neondatabase/serverless'

const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
const pool = new Pool({ connectionString })

// Use parameterized queries
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
```

---

## Why This Matters

### Symptoms of Violation

When code incorrectly prefers HYPERDRIVE:

1. **Intermittent failures** - Some endpoints work, some don't
2. **WebSocket errors** - `expected 101, got 530`
3. **Auth failures** - Sessions can't be verified
4. **Silent failures** - Queries return empty results

### Debugging Difficulty

This bug is hard to catch because:

1. **Different code paths** - Some files use one order, others use another
2. **Works in debug endpoints** - If debug endpoint uses correct order, it works
3. **Works locally** - Local dev might use different connection string
4. **No compile-time error** - Both connection strings are valid strings

---

## Verification Checklist

Before deploying any database-related changes, verify:

- [ ] All `getDb()` calls use `NEON_PG_CONN` first
- [ ] All `neon()` imports use `NEON_PG_CONN` first
- [ ] All `Pool` instantiations use `NEON_PG_CONN` first
- [ ] No route directly accesses `HYPERDRIVE.connectionString` without fallback

### Grep Commands

```bash
# Find potential violations (HYPERDRIVE first)
grep -r "HYPERDRIVE.*connectionString.*||.*NEON" workers/src/

# Find correct patterns (NEON first)
grep -r "NEON_PG_CONN.*||.*HYPERDRIVE" workers/src/
```

---

## Future Considerations

### When to Use Hyperdrive

Hyperdrive CAN be used if:

1. You switch from `@neondatabase/serverless` to standard `pg` library
2. You need connection pooling at the Cloudflare edge level
3. You're connecting to a non-Neon Postgres database

### Migration Path

If we ever need Hyperdrive's features:

1. Replace `@neondatabase/serverless` with `pg` library
2. Update all database code to use `HYPERDRIVE.connectionString`
3. Remove `NEON_PG_CONN` from secrets

But for now, **Neon serverless driver with direct connection is our standard**.

---

## References

- [Neon Serverless Driver Docs](https://neon.tech/docs/serverless/serverless-driver)
- [Cloudflare Hyperdrive Docs](https://developers.cloudflare.com/hyperdrive/)
- [Why Hyperdrive doesn't work with WebSocket drivers](https://community.cloudflare.com/t/hyperdrive-with-neon-serverless-driver/558891)

---

## Incident History

| Date       | Issue                                | Root Cause                            | Hours Lost |
| ---------- | ------------------------------------ | ------------------------------------- | ---------- |
| 2026-02-05 | Auth sessions not verifying          | `verifySession` used HYPERDRIVE first | 4+         |
| 2026-02-05 | /api/calls returning WebSocket error | `getDb()` used HYPERDRIVE first       | 2+         |
| 2026-02-05 | Login working but session invalid    | Inconsistent connection string order  | 2+         |

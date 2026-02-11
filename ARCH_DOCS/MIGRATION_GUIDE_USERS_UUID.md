# users.id TEXT → UUID Migration Guide

**Priority:** HIGH  
**Effort:** 5 hours  
**Risk:** HIGH (affects all user references across 170+ tables)  
**Fixes:** BL-001 (Root cause of schema drift)

---

## Problem Statement

The `users.id` and `accounts.id` columns are `TEXT` type (legacy from NextAuth), while most other tables use `UUID`. This creates:

1. **Cross-type JOINs** — TEXT ↔ UUID implicit casts that are fragile
2. **Type confusion** — Code assumes UUID but DB stores TEXT
3. **FK integrity issues** — Foreign keys can't enforce referential integrity across types
4. **Performance degradation** — Implicit casts prevent index usage

### Affected Tables (6 confirmed cross-type JOINs)

```sql
-- auth.ts L82: users.id (TEXT) = sessions.user_id (UUID)
-- auth.ts L83: org_members.user_id (TEXT) = users.id (TEXT) ✓
-- teams.ts L54: users.id (TEXT) = teams.manager_user_id (UUID)
-- teams.ts L197: users.id (TEXT) = team_members.user_id (UUID)
-- dialer.ts L198: users.id (TEXT) = dialer_agent_status.user_id (UUID)
-- calls.ts L348: users.id (TEXT) = call_outcomes.declared_by_user_id (UUID)
-- calls.ts L1071: users.id (TEXT) = call_notes.created_by (UUID)
```

---

## Migration Strategy

### Phase 1: Preparation (30 min)

1. **Full database backup**

   ```bash
   npm run db:backup
   ```

2. **Audit all user_id references**

   ```sql
   SELECT
     table_name,
     column_name,
     data_type
   FROM information_schema.columns
   WHERE column_name LIKE '%user_id%'
      OR column_name = 'id' AND table_name IN ('users', 'accounts')
   ORDER BY table_name, column_name;
   ```

3. **Verify all users.id values are valid UUIDs**
   ```sql
   SELECT id FROM users
   WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
   -- Should return 0 rows
   ```

### Phase 2: Table Conversions (2 hours)

**Order matters** — child tables before parents to preserve foreign keys.

#### Step 1: Convert TEXT user_id columns to UUID

```sql
-- Tables with TEXT user_id referencing users.id
ALTER TABLE org_members ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE calls ALTER COLUMN initiated_by TYPE uuid USING initiated_by::uuid;
-- Add all other TEXT user_id columns here after auditing
```

#### Step 2: Convert users.id from TEXT to UUID

```sql
-- This is the critical step — all FKs must already be UUID
ALTER TABLE users ALTER COLUMN id TYPE uuid USING id::uuid;
ALTER TABLE accounts ALTER COLUMN id TYPE uuid USING id::uuid;
```

#### Step 3: Recreate foreign key constraints

```sql
-- Example for org_members
ALTER TABLE org_members
  ADD CONSTRAINT fk_org_members_user_id
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Repeat for all tables with user_id FKs
```

### Phase 3: Code Updates (1.5 hours)

#### Remove all `::uuid` and `::text` casts in queries

**Files to update:**

- `workers/src/lib/auth.ts` — Remove `::uuid` casts in verifySession
- `workers/src/routes/auth.ts` — Lines 193, 279 (remove `$1::uuid`)
- `workers/src/routes/teams.ts` — All JOIN clauses
- `workers/src/routes/dialer.ts` — All JOIN clauses
- `workers/src/routes/calls.ts` — All JOIN clauses

**Before:**

```typescript
;`SELECT * FROM users u 
 JOIN sessions s ON u.id = s.user_id::text` // TEXT = UUID cast
```

**After:**

```typescript
;`SELECT * FROM users u 
 JOIN sessions s ON u.id = s.user_id` // UUID = UUID (native)
```

### Phase 4: Verification (1 hour)

1. **Run all tests**

   ```bash
   npm run test
   ```

2. **Verify no implicit casts**

   ```sql
   EXPLAIN (VERBOSE)
   SELECT u.*, s.*
   FROM users u
   JOIN sessions s ON u.id = s.user_id;
   -- Check query plan — should NOT show ::text or ::uuid casts
   ```

3. **Check all FK constraints**

   ```sql
   SELECT
     tc.table_name,
     kcu.column_name,
     ccu.table_name AS foreign_table_name,
     ccu.column_name AS foreign_column_name
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND (ccu.table_name = 'users' OR ccu.table_name = 'accounts');
   ```

4. **Smoke test critical flows**
   - Signup → Login → Create org
   - Create call → Assign to user
   - Team invite → Accept

---

## Rollback Plan

If migration fails:

1. **Restore from backup**

   ```bash
   psql $NEON_PG_CONN < backup-$(date +%Y%m%d).sql
   ```

2. **Revert code changes**
   ```bash
   git revert <migration-commit-hash>
   ```

---

## Post-Migration Checklist

- [ ] All tests passing
- [ ] No `::uuid` or `::text` casts in codebase
- [ ] All FK constraints verified
- [ ] Query performance benchmarked (should improve)
- [ ] Production deployment coordinated with downtime window
- [ ] Monitoring alerts for failed queries

---

## Notes

- **Downtime required:** ~15 minutes (during ALTER TABLE on users)
- **Run during low-traffic window** (e.g., 2-4 AM UTC)
- **Monitor connection pool** — schema changes can cause brief connection

disruptions

- **Notify team** before starting migration

---

## Success Criteria

✅ `users.id` and `accounts.id` are UUID type  
✅ All user_id FK columns are UUID type  
✅ No implicit type casts in query plans  
✅ All foreign key constraints enforced  
✅ Test suite passes (585+ tests)  
✅ No cross-type JOINs detected by DB Matcher audit

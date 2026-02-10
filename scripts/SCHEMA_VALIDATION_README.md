# Schema Drift Validation - README

## Quick Start

```bash
# Set database connection
export NEON_PG_CONN="postgresql://neondb_owner:npg_***@ep-mute-recipe-ahsibut8-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Run validation
npx tsx scripts/validate-schema-drift.ts

# View results
cat SCHEMA_DRIFT_REPORT.md
```

## What This Validates

The schema drift validator performs **10 comprehensive checks**:

1. **snake_case Convention** - Scans all columns for uppercase violations
2. **Critical Tables** - Validates 11 core tables exist
3. **Column Schema** - Compares documented vs. actual columns
4. **Foreign Keys** - Checks for orphaned references
5. **Index Coverage** - Validates performance-critical indexes
6. **RLS Policies** - Checks multi-tenant isolation policies
7. **Audit Columns** - Validates old_value/new_value naming
8. **Multi-Tenant** - Checks organization_id on business tables
9. **Type Consistency** - Flags inconsistent ID column types
10. **Documentation** - Compares schema vs. registry

## Output Files

- **SCHEMA_DRIFT_REPORT.md** - Detailed findings (auto-generated)
- **ARCH_DOCS/SCHEMA_DRIFT_VALIDATION_2026-02-10.md** - Analysis & recommendations
- **ARCH_DOCS/SCHEMA_DRIFT_QUICK_ACTIONS.md** - Action checklist

## Latest Run Results (Feb 10, 2026)

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | ✅ PASS |
| 🟠 HIGH | 2 | ⚠️ RLS policies needed |
| 🟡 MEDIUM | 2 | ℹ️ Type inconsistencies (acceptable) |
| 🟢 LOW | 120 | ℹ️ Undocumented tables |

## Immediate Actions

1. Deploy `migrations/2026-02-11-add-rls-transcriptions-summaries.sql`
2. Test RLS isolation in staging
3. Deploy to production
4. Re-run validation to confirm HIGH issues resolved

## Schedule

Run this validator:
- **After major migrations** - Verify schema compliance
- **Before production releases** - Catch drift early
- **Monthly** - Routine validation
- **When onboarding new developers** - Show schema health

## Reference

- **Full Report:** [ARCH_DOCS/SCHEMA_DRIFT_VALIDATION_2026-02-10.md](../ARCH_DOCS/SCHEMA_DRIFT_VALIDATION_2026-02-10.md)
- **Quick Actions:** [ARCH_DOCS/SCHEMA_DRIFT_QUICK_ACTIONS.md](../ARCH_DOCS/SCHEMA_DRIFT_QUICK_ACTIONS.md)
- **Schema Registry:** [ARCH_DOCS/DATABASE_SCHEMA_REGISTRY.md](../ARCH_DOCS/DATABASE_SCHEMA_REGISTRY.md)

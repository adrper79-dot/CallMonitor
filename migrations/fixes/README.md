# SQL Fix Files

This directory contains SQL scripts that were manually run to fix issues in the production database. These are kept for historical reference and audit purposes.

## Important Notes

⚠️ **DO NOT RUN THESE SCRIPTS AGAIN** - They have already been applied to production.

These files are kept for:
- Historical reference
- Audit trail
- Understanding what manual interventions were needed
- Preventing similar issues in future

## Files in This Directory

### User & Organization Fixes
- `FIX_NEW_USER_adrper792.sql` - Fixed broken user signup (missing organization_id)
- `FIX_NEW_USER_ORG_MEMBERSHIP.sql` - Fixed missing org_members records
- `FIX_EXISTING_USERS.sql` - Fixed multiple users with missing data
- `FIX_USER_SIMPLE.sql` - Simple user fix script
- `FIX_CURRENT_USER_COMPLETE.sql` - Comprehensive current user fix

### Tool ID Fixes
- `FIX_MISSING_TOOL_ID.sql` - Fixed organizations missing tool_id
- `FIX_TOOL_ID_SIMPLE.sql` - Simple tool_id fix
- `FIX_USER_LINK_EXISTING_TOOL.sql` - Linked users to existing tools

### Database Cleanup
- `CLEANUP_COMPLETE.sql` - Complete database cleanup (DANGEROUS)
- `CLEANUP_SAFE.sql` - Safe cleanup script
- `CLEANUP_PUBLIC_TABLES_ONLY.sql` - Public tables only cleanup
- `CLEANUP_ALL_USERS_AND_ORGS.sql` - User and org cleanup (DANGEROUS)

### Diagnostic Scripts
- `CHECK_TRANSCRIPTION.sql` - Check transcription status
- `CHECK_NEW_USER_ORG_MEMBERSHIP.sql` - Verify org membership
- `CHECK_RECORDING_FINAL.sql` - Final recording verification
- `CHECK_RECORDING_SIMPLE.sql` - Simple recording check
- `CHECK_RECENT_CALL.sql` - Check recent call status
- `CHECK_RECENT_CALL_FIXED.sql` - Verify call fix
- `CHECK_DB_FOR_RECORDING.sql` - Database recording diagnostic
- `DIAGNOSE_RECORDING_ISSUE.sql` - Recording issue diagnosis

## Best Practices Going Forward

1. **Use Supabase Migrations**: All schema changes should go in `/migrations` with proper versioning
2. **No Manual Fixes in Production**: Test in staging, then deploy via migration
3. **Document Everything**: If a manual fix is needed, document it immediately
4. **Create Migration Tracking**: Use a `migration_history` table to track what's been applied

## Root Cause

These files exist because:
1. Initial signup code had incorrect schema assumptions
2. Schema evolved but code wasn't updated
3. Manual fixes were applied directly to production

## Prevention

To prevent needing more fix files:
1. ✅ Use centralized config (`lib/config.ts`)
2. ✅ Enable TypeScript strict mode
3. ✅ Test signup flow in CI/CD
4. ✅ Use proper migrations
5. ✅ Never skip type checking in production

# Supabase CLI Connection Guide

**Status:** ✅ Connected to project `Word Is Bond` (fiijrhpjpebevfavzlhu)

---

## Connection Status

You are successfully connected to your Supabase project via CLI. The project is linked and ready to use.

**Note:** There's a migration history mismatch (remote has 001-004, local has date-based migrations). This is fine if you're managing migrations directly.

---

## Useful Supabase CLI Commands

### Database Operations

```bash
# Pull remote schema to local
supabase db pull --schema public

# Push local migrations to remote
supabase db push

# Execute SQL file on remote database
supabase db remote exec -f migrations/2026-01-13-add-indexes.sql

# Get database connection URL (for direct psql connection)
# Note: You'll need to use psql directly for interactive SQL queries
```

### Direct SQL Connection (Recommended)

For executing SQL queries, use `psql` with the connection string:

```bash
# First, get your connection details from Supabase Dashboard:
# Project Settings > Database > Connection string

# Then connect with psql:
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

### Migration Management

```bash
# List migration status
supabase migration list

# Create new migration
supabase migration new <name>

# Repair migration history (if needed)
supabase migration repair --status reverted <version>
```

### Project Management

```bash
# Check project status
supabase projects list

# Link to a different project
supabase link --project-ref <project-ref>

# Get project info
supabase projects list --output json
```

### Storage Operations

```bash
# List storage buckets
supabase storage list

# Upload file to storage
supabase storage upload <bucket> <file-path>

# Download file from storage
supabase storage download <bucket> <file-path>
```

### Real-time & Functions

```bash
# List edge functions
supabase functions list

# Deploy edge function
supabase functions deploy <function-name>

# Check real-time status
supabase realtime status
```

### Direct SQL Connection

If you need to connect directly via psql:

```bash
# Get connection string
supabase db remote get-url

# Then use psql:
psql "<connection-string>"
```

---

## Quick Connection Test

Try this to verify your connection:

```bash
# Test query
supabase db remote exec "SELECT COUNT(*) FROM calls;"
```

---

## Troubleshooting

### Migration History Mismatch

If you see migration errors, you can:

1. **Repair migrations** (if needed):
   ```bash
   supabase migration repair --status reverted 001
   supabase migration repair --status reverted 002
   ```

2. **Or use direct SQL** for schema changes:
   ```bash
   supabase db remote exec -f migrations/2026-01-13-add-indexes.sql
   ```

### Connection Issues

- Make sure you're logged in: `supabase login`
- Check project link: `supabase projects list`
- Verify project ref: `supabase link --project-ref <ref>`

---

## Next Steps

1. **Test connection**: Run a simple query to verify
2. **Check schema**: Pull remote schema to see current state
3. **Run migrations**: Apply any pending migrations if needed
4. **Verify tables**: Check that all required tables exist

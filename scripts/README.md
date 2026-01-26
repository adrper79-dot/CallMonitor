Run SQL non-interactively with psql

Usage:

PowerShell (example):

```powershell
# Create a SQL file with the statements you want to run, e.g. add_providerAccountId.sql
$conn = 'postgresql://postgres:YOUR_PASSWORD@db.fiijrhpjpebevfavzlhu.supabase.co:5432/postgres'
.
\scripts\run_psql.ps1 -ConnString $conn -SqlFile .\add_providerAccountId.sql
```

Notes:
- Do not commit credentials into the repository. Use environment variables or a secure vault in production.
- The script prefers Postgres clients installed under `C:\Program Files\PostgreSQL` and falls back to `psql` on PATH.
Seed/test scripts

seed_test_users.ts
- Creates Supabase Auth users using the Admin API and `SUPABASE_SERVICE_ROLE_KEY`.

Usage:

```bash
# single user
npx ts-node scripts/seed_test_users.ts --email user@example.com --password Passw0rd! --username user1 --role tester

# multiple from JSON file (array of objects with email,password,username,role,organization_id)
npx ts-node scripts/seed_test_users.ts --file ./test_users.json
```

Note: This script requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` available in your environment (or pass via `--supabaseUrl` and `--serviceKey`).

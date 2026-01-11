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

const fs = require('fs');
const { Client } = require('pg');

function getConn() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const m = /NEON_PG_CONN=([^\n]+)/.exec(env);
  if (!m) throw new Error('NEON_PG_CONN missing');
  return m[1].trim();
}

(async () => {
  const conn = getConn();
  const client = new Client({ connectionString: conn });
  await client.connect();

  // Basic table sample
  const tables = await client.query(
    'select table_name from information_schema.tables where table_schema=$1 order by table_name limit 50',
    ['public']
  );
  console.log('tables:', JSON.stringify(tables.rows, null, 2));

  // RLS policy count by table
  const policies = await client.query(
    `select schemaname as table_schema, tablename as table_name, count(*) as policy_count
     from pg_policies
     where schemaname = 'public'
     group by schemaname, tablename
     order by tablename
     limit 50`
  );
  console.log('policies:', JSON.stringify(policies.rows, null, 2));

  // Tables missing organization_id column (potential multi-tenant gap)
  const missingOrg = await client.query(
    `select table_name
     from information_schema.tables t
     where table_schema='public'
       and table_type='BASE TABLE'
       and not exists (
         select 1 from information_schema.columns c
         where c.table_schema='public' and c.table_name=t.table_name and c.column_name='organization_id'
       )
     order by table_name
     limit 50`
  );
  console.log('missing_org_id:', JSON.stringify(missingOrg.rows, null, 2));

  await client.end();
})().catch((err) => {
  console.error('DB audit failed', err);
  process.exit(1);
});

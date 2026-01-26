const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUT_DIR = path.join('migrations', 'supabase_inventory');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const conn = process.env.PG_CONN || process.env.SUPABASE_PG_CONN || process.env.DATABASE_URL;
if (!conn) {
  console.error('Set PG_CONN or SUPABASE_PG_CONN environment variable to the Supabase connection string');
  process.exit(2);
}

const client = new Client({ connectionString: conn });

const tasks = [
  { name: 'version', sql: `select version()` },
  { name: 'extensions', sql: `select * from pg_extension order by extname` },
  { name: 'sequences', sql: `select sequence_schema, sequence_name from information_schema.sequences where sequence_schema='public' order by sequence_name` },
  { name: 'functions', sql: `select n.nspname as schema, p.proname as name, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname not in ('pg_catalog','information_schema') order by n.nspname, p.proname` },
  { name: 'triggers', sql: `select n.nspname as schema, c.relname as table, t.tgname as trigger_name, pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on t.tgrelid = c.oid join pg_namespace n on c.relnamespace = n.oid where NOT t.tgisinternal and n.nspname not in ('pg_catalog','information_schema') order by n.nspname, c.relname` },
  { name: 'policies', sql: `select * from pg_policy order by tablename` },
  { name: 'roles', sql: `select rolname, rolsuper, rolreplication, rolcreaterole, rolcreatedb from pg_roles order by rolname` },
  { name: 'grants', sql: `select grantee, table_schema, table_name, privilege_type from information_schema.role_table_grants where table_schema='public' order by table_name` },
  { name: 'tables', sql: `select table_schema, table_name, table_type from information_schema.tables where table_schema='public' order by table_name` },
  { name: 'publications', sql: `select * from pg_publication` },
  { name: 'replication_slots', sql: `select * from pg_replication_slots` },
];

async function run() {
  await client.connect();
  for (const t of tasks) {
    try {
      const res = await client.query(t.sql);
      const outPath = path.join(OUT_DIR, `${t.name}.json`);
      fs.writeFileSync(outPath, JSON.stringify({ query: t.sql, rows: res.rows }, null, 2));
      console.log('Wrote', outPath);
    } catch (err) {
      const outPath = path.join(OUT_DIR, `${t.name}.error.txt`);
      fs.writeFileSync(outPath, `ERROR: ${err.message}\nSQL: ${t.sql}`);
      console.error('ERROR for', t.name, err.message);
    }
  }

  // Rowcounts per table (lightweight): only estimate via pg_class
  try {
    const qc = await client.query(`select relname as table, reltuples::bigint as approx_rows from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and relkind='r' order by relname`);
    fs.writeFileSync(path.join(OUT_DIR, 'table_row_estimates.json'), JSON.stringify(qc.rows, null, 2));
    console.log('Wrote table_row_estimates.json');
  } catch (err) {
    console.error('Could not get row estimates', err.message);
  }

  await client.end();
  console.log('Inventory complete. Review', OUT_DIR);
}

run().catch(e => { console.error(e); process.exit(1); });

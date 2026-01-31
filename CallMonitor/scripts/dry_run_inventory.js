const fs = require('fs');
const { Client } = require('pg');

function parseConn(arg) {
  if (!arg) return null;
  return arg;
}

async function run(conn, label) {
  const client = new Client({ connectionString: conn });
  await client.connect();
  const out = { label, version: null, public_table_count: null, sample_tables: {} };
  try {
    const v = await client.query('SELECT version()');
    out.version = v.rows[0].version;
    const tc = await client.query("SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    out.public_table_count = tc.rows[0].cnt;
    // sample up to 5 largest tables by estimated rows
    const sample = await client.query(`SELECT relname as table, reltuples::bigint as est_rows
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND relkind='r' ORDER BY reltuples DESC LIMIT 5`);
    for (const r of sample.rows) {
      out.sample_tables[r.table] = { est_rows: r.est_rows };
    }
  } finally {
    await client.end();
  }
  return out;
}

async function main() {
  const supabase = process.env.SUPABASE_PG_CONN || process.argv[2];
  const neon = process.env.NEON_PG_CONN || process.argv[3];
  if (!supabase && !neon) {
    console.error('Usage: SUPABASE_PG_CONN=... NEON_PG_CONN=... node scripts/dry_run_inventory.js');
    process.exit(2);
  }
  const results = [];
  if (supabase) {
    try { results.push(await run(supabase, 'supabase')); } catch (e) { results.push({ label: 'supabase', error: e.message }); }
  }
  if (neon) {
    try { results.push(await run(neon, 'neon')); } catch (e) { results.push({ label: 'neon', error: e.message }); }
  }
  const outDir = 'migrations/dry_run_inventory';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = `${outDir}/inventory_${Date.now()}.json`;
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log('Wrote', outFile);
}

main().catch(e=>{ console.error(e); process.exit(1); });

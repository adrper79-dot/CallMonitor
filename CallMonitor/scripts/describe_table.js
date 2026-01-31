const { Client } = require('pg');
const tbl = process.argv[2];
if (!tbl) { console.error('Usage: node describe_table.js schema.table'); process.exit(2); }
const [schema, table] = tbl.split('.');
if (!schema || !table) { console.error('Provide schema.table'); process.exit(2); }
(async()=>{
  const conn = process.env.PG_CONN || process.env.DATABASE_URL;
  if (!conn) { console.error('Set PG_CONN'); process.exit(2); }
  const c = new Client({ connectionString: conn });
  await c.connect();
  const q = await c.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position", [schema, table]);
  console.log(q.rows);
  await c.end();
})();

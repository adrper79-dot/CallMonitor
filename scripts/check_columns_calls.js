const { Client } = require('pg');
(async()=>{
  const conn = process.env.PG_CONN || process.env.DATABASE_URL;
  if(!conn){ console.error('Set PG_CONN'); process.exit(2); }
  const c = new Client({ connectionString: conn });
  await c.connect();
  const q = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='calls' ORDER BY ordinal_position");
  console.log(q.rows);
  await c.end();
})();

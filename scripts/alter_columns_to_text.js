const { Client } = require('pg');
const conn = process.env.PG_CONN || process.env.DATABASE_URL;
if (!conn) { console.error('Set PG_CONN'); process.exit(2); }
(async()=>{
  const c = new Client({ connectionString: conn });
  await c.connect();
  const alters = [
    "ALTER TABLE public.recordings ALTER COLUMN created_by TYPE text USING created_by::text;",
    "ALTER TABLE public.tool_team_members ALTER COLUMN user_id TYPE text USING user_id::text;"
  ];
  for (const a of alters) {
    try {
      await c.query(a);
      console.log('OK', a);
    } catch (err) {
      console.error('ERR', a, err.code || err.message);
    }
  }
  await c.end();
})();

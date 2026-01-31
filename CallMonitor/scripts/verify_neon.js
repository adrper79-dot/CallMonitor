const { Client } = require('pg');

const conn = process.env.NEON_PG_CONN;
if (!conn) {
  console.error('NEON_PG_CONN not set');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    const r1 = await client.query("SELECT COUNT(*) AS cnt FROM public.recordings WHERE tool_id IS NULL");
    console.log('recordings_tool_id_null:' + r1.rows[0].cnt);

    const r2 = await client.query("SELECT COUNT(*) AS cnt FROM public.calls WHERE caller_id_number_id IS NULL");
    console.log('calls_caller_id_number_id_null:' + r2.rows[0].cnt);

    const r3 = await client.query("SELECT COUNT(*) AS cnt FROM public.scorecards WHERE created_by IS NOT NULL AND NOT (created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')");
    console.log('scorecards_created_by_non_uuid:' + r3.rows[0].cnt);
  } finally {
    await client.end();
  }
})().catch(err => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});

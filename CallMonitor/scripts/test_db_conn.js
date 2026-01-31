const { Client } = require('pg');
(async () => {
  const conn = process.env.PG_CONN;
  if(!conn){ console.error('NO_CONN'); process.exit(2); }
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT version()');
    console.log(res.rows[0].version);
    await client.end();
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e.message);
    process.exit(3);
  }
})();

const fs = require('fs');
const { Client } = require('pg');

const LOG = 'migrations/neon_apply_report_pass2.log';
if (!fs.existsSync(LOG)) { console.error('log not found'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(LOG,'utf8'));
const missing = new Set();
data.results.filter(r => r.status === 'ERR' && r.code === '42P01').forEach(r => {
  const m = r.statement.match(/ALTER TABLE\s+([^\s]+)\s+/i);
  if (m) missing.add(m[1].replace(/"/g, ''));
});
const list = Array.from(missing);
if (list.length === 0) { console.log('No missing-table errors'); process.exit(0); }
const conn = process.env.PG_CONN || process.env.DATABASE_URL;
if (!conn) { console.error('Set PG_CONN or DATABASE_URL'); process.exit(2); }

(async () => {
  const c = new Client({ connectionString: conn });
  await c.connect();
  for (const t of list) {
    const q = await c.query('SELECT to_regclass($1) as reg', [t]);
    console.log(t, '=>', q.rows[0].reg);
  }
  await c.end();
})();

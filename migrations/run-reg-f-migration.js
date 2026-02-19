/**
 * Run Reg F compliance migration
 * @see migrations/2026-02-17-reg-f-compliance.sql
 */
const fs = require('fs');
const { Client } = require('pg');

function getConn() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const m = /NEON_PG_CONN=([^\n]+)/.exec(env);
  if (!m) throw new Error('NEON_PG_CONN missing from .env.local');
  return m[1].trim();
}

(async () => {
  const conn = getConn();
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const migration = fs.readFileSync('migrations/2026-02-17-reg-f-compliance.sql', 'utf8');

  // Run entire migration as a single transaction
  try {
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');
    console.log('✓ Migration completed successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('✗ Migration failed:', e.message);
    // Try running individual statements for better error diagnosis
    console.log('\nAttempting individual statements...');
  }

  await client.end();
})();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlPath = path.join(__dirname, '..', 'migrations', 'neon_public_schema.sql');
const conn = process.env.PG_CONN;
if (!fs.existsSync(sqlPath)) { console.error('missing sql file', sqlPath); process.exit(2); }
if (!conn) { console.error('PG_CONN not set'); process.exit(3); }

const raw = fs.readFileSync(sqlPath, 'utf8');

// Split into statements naively — good for CREATE/ALTER statements separated by semicolons
const parts = raw.split(/;\r?\n/).map(s => s.trim()).filter(s => s.length);

const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
(async () => {
  try {
    await client.connect();
    for (const stmt of parts) {
      try {
        let toRun = stmt;
        // Convert CREATE TABLE to IF NOT EXISTS
        if (/^CREATE TABLE\s+/i.test(stmt)) {
          toRun = stmt.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
        }

        // Handle ALTER TABLE ... ADD CONSTRAINT by wrapping in a conditional DO block
        if (/ALTER TABLE\s+.+ADD CONSTRAINT\s+/i.test(stmt)) {
          const m = stmt.match(/ADD CONSTRAINT\s+([a-zA-Z0-9_]+)/i);
          const cname = m && m[1];
          if (cname) {
            const safe = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${cname}') THEN EXECUTE $$${stmt}$$; END IF; END $$;`;
            toRun = safe;
          }
        }

        // Execute statement
        await client.query(toRun);
        console.log('OK:', (toRun.split('\n')[0]||toRun).slice(0,120));
      } catch (e) {
        // Log and continue for non-fatal errors
        console.error('ERR executing stmt start:', stmt.slice(0,80));
        console.error(e.message);
      }
    }
    await client.end();
    console.log('Done applying schema.');
  } catch (e) {
    console.error('ERROR', e.message);
    process.exit(4);
  }
})();

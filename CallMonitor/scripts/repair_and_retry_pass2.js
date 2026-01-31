const fs = require('fs');
const { Client } = require('pg');

const LOG = 'migrations/neon_apply_report_pass2.log';
const PASS1 = 'migrations/neon_public_schema_pass1.sql';

if (!fs.existsSync(LOG)) { console.error('pass2 log not found'); process.exit(1); }
if (!fs.existsSync(PASS1)) { console.error('pass1 not found'); process.exit(1); }

const log = JSON.parse(fs.readFileSync(LOG, 'utf8'));
const pass1 = fs.readFileSync(PASS1, 'utf8');
const conn = process.env.PG_CONN || process.env.DATABASE_URL;
if (!conn) { console.error('Set PG_CONN'); process.exit(2); }

function findColumnDefinition(tableName, columnName) {
  // find CREATE TABLE block for tableName
  const re = new RegExp('CREATE\\s+TABLE\\s+' + tableName.replace('.', '\\.') + '[^;]+;', 'i');
  const m = pass1.match(re);
  if (!m) return null;
  const block = m[0];
  const colRe = new RegExp('\\n\\s*' + columnName + '\\s+([^,\n]+)', 'i');
  const cm = block.match(colRe);
  if (!cm) return null;
  return cm[1].trim();
}

(async ()=>{
  const client = new Client({ connectionString: conn });
  await client.connect();

  const errs = log.results.filter(r => r.status === 'ERR');
  const repairs = [];
  for (const e of errs) {
    const stmt = e.statement || '';
    if (e.code === '42703') {
      // column missing
      const m = stmt.match(/FOREIGN KEY \(([^)]+)\) REFERENCES\s+([^\.\s]+\.[^\(\s]+)\s*\(([^)]+)\)/i);
      if (m) {
        const col = m[1].trim();
        const table = stmt.match(/ALTER TABLE\s+([^\s]+)\s+/i)[1];
        const def = findColumnDefinition(table, col);
        if (def) {
          const add = `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def};`;
          try {
            await client.query(add);
            repairs.push({ type: 'add_column', table, column: col, stmt: add, ok: true });
            console.log('Added column', table, col);
          } catch (err) {
            repairs.push({ type: 'add_column', table, column: col, stmt: add, ok: false, error: err.message });
            console.error('Failed to add column', table, col, err.message);
          }
        } else {
          repairs.push({ type: 'add_column', table, column: col, ok: false, reason: 'definition not found in pass1' });
          console.log('Definition for', table, col, 'not found in pass1');
        }
      }
    } else if (e.code === '42804') {
      // type mismatch; attempt to coerce
      const m = stmt.match(/FOREIGN KEY \(([^)]+)\) REFERENCES\s+([^\.\s]+\.[^\(\s]+)\s*\(([^)]+)\)/i);
      if (m) {
        const col = m[1].trim();
        const ref = m[2].trim();
        const refcol = m[3].trim();
        try {
          const parts = ref.split('.');
          const schema = parts[0];
          const tableName = parts[1];
          const refQ = await client.query("SELECT data_type, udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3", [schema, tableName, refcol]);
          if (refQ.rows.length) {
            const targetType = refQ.rows[0].udt_name === 'uuid' ? 'uuid' : refQ.rows[0].data_type;
            const table = stmt.match(/ALTER TABLE\s+([^\s]+)\s+/i)[1];
            const alter = `ALTER TABLE ${table} ALTER COLUMN ${col} TYPE ${targetType} USING ${col}::${targetType};`;
            try {
              await client.query(alter);
              repairs.push({ type: 'alter_column', table, column: col, to: targetType, ok: true });
              console.log('Altered column type', table, col, '->', targetType);
            } catch (err) {
              repairs.push({ type: 'alter_column', table, column: col, to: targetType, ok: false, error: err.message });
              console.error('Failed to alter column', table, col, err.message);
            }
          }
        } catch (err) {
          console.error('Error checking reference type', err.message);
        }
      }
    }
  }

  await client.end();
  fs.writeFileSync('migrations/neon_pass2_repairs.json', JSON.stringify({ runAt: new Date().toISOString(), repairs }, null, 2));
  console.log('Wrote repairs log');
})();

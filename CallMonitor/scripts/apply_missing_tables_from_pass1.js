const fs = require('fs');
const { Client } = require('pg');

const PASS1 = 'migrations/neon_public_schema_pass1.sql';
const LOG = 'migrations/neon_apply_missing_tables.log';

if (!fs.existsSync(PASS1)) { console.error('pass1 not found'); process.exit(1); }
const pass1 = fs.readFileSync(PASS1, 'utf8');

const toCheck = process.argv.slice(2); // table names like public.kpi_logs
if (toCheck.length === 0) { console.error('Usage: node apply_missing_tables_from_pass1.js public.table_name [...]'); process.exit(2); }

function extractCreate(tableName) {
  const re = new RegExp('CREATE\\s+TABLE\\s+' + tableName.replace('.', '\\.') + '\\\s*\\(', 'i');
  const m = pass1.match(re);
  if (!m) return null;
  const start = m.index;
  const openParenIndex = pass1.indexOf('(', start);
  if (openParenIndex === -1) return null;
  let depth = 0;
  let i = openParenIndex;
  for (; i < pass1.length; i++) {
    const ch = pass1[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        // find the next semicolon after i
        const semi = pass1.indexOf(';', i);
        if (semi === -1) return null;
        return pass1.slice(start, semi + 1).trim();
      }
    }
  }
  return null;
}

async function main() {
  const conn = process.env.PG_CONN || process.env.DATABASE_URL;
  if (!conn) { console.error('Set PG_CONN'); process.exit(2); }
  const client = new Client({ connectionString: conn });
  await client.connect();
  const results = [];
  for (const t of toCheck) {
    const createStmt = extractCreate(t);
    if (!createStmt) { console.error('CREATE not found for', t); results.push({table:t, status:'NOT_FOUND'}); continue; }
    // Fix common portability issues in the extracted CREATE
    let fixed = createStmt;
    // Replace malformed text[] defaults like: DEFAULT text[]['a','b'] -> DEFAULT ARRAY['a','b']::text[]
    if (/DEFAULT\s+text\[\]\s*\[/i.test(fixed)) {
      fixed = fixed.replace(/DEFAULT\s+text\[\]\s*\[/gi, 'DEFAULT ARRAY[');
      fixed = fixed.replace(/\]\s*(,|\))/g, ']::text[]$1');
    }
    // Ensure referenced sequences exist: nextval('name')
    const seqs = [];
    const seqRe = /nextval\('\s*([^']+?)\s*'\)/gi;
    let sm;
    while ((sm = seqRe.exec(fixed)) !== null) seqs.push(sm[1]);

    // Make it IF NOT EXISTS
    const stmtIf = fixed.replace(/CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
    try {
      // Pre-create any referenced sequences
      for (const seq of seqs) {
        try {
          await client.query(`CREATE SEQUENCE IF NOT EXISTS ${seq};`);
          console.log('CREATED SEQ IF NOT EXISTS', seq);
        } catch (sErr) {
          console.error('SEQ ERR', seq, sErr.code || sErr.message);
        }
      }
      await client.query(stmtIf);
      console.log('CREATED/ENSURED', t);
      results.push({table:t, status:'OK'});
    } catch (err) {
      console.error('ERR', t, err.code || err.message);
      results.push({table:t, status:'ERR', error: err.message, code: err.code});
    }
  }
  await client.end();
  fs.writeFileSync(LOG, JSON.stringify({runAt:new Date().toISOString(), results},null,2));
  console.log('Wrote', LOG);
}

main().catch(e=>{console.error(e);process.exit(1);});

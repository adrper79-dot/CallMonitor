const fs = require('fs');
const { Client } = require('pg');

const PASS2_PATH = 'migrations/neon_public_schema_pass2.sql';
const LOG_PATH = 'migrations/neon_apply_report_pass2.log';

function splitStatements(sql) {
  // Naive split on semicolons that are at line ends. Assumes no $$ blocks in pass2.
  return sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => (s.endsWith(';') ? s : s + ';'));
}

function wrapStatement(stmt) {
  const s = stmt.trim();
  const lower = s.toLowerCase();

  if (/^create\s+(unique\s+)?index/i.test(s)) {
    const m = s.match(/create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?"?([^(\s]+)"?/i);
    const idx = m ? m[1].replace(/"/g, '') : null;
    if (idx) {
      return `DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='${idx}' AND relkind='i') THEN\n    EXECUTE $$${s}$$;\n  END IF;\nEXCEPTION WHEN SQLSTATE '42710' THEN NULL;\nEND$$;`;
    }
  }

  if (/^alter\s+table/i.test(s)) {
    const m = s.match(/add\s+constraint\s+"?([^(\s]+)"?/i);
    if (m) {
      const con = m[1].replace(/"/g, '');
      return `DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='${con}') THEN\n    EXECUTE $$${s}$$;\n  END IF;\nEXCEPTION WHEN SQLSTATE '42710' THEN NULL;\nEND$$;`;
    }
    // Fallback: try to execute and ignore duplicate-object errors
    return `DO $$\nBEGIN\n  EXECUTE $$${s}$$;\nEXCEPTION WHEN SQLSTATE '42710' THEN NULL;\nEND$$;`;
  }

  // Generic fallback
  return `DO $$\nBEGIN\n  EXECUTE $$${s}$$;\nEXCEPTION WHEN SQLSTATE '42710' THEN NULL;\nEND$$;`;
}

async function main() {
  if (!fs.existsSync(PASS2_PATH)) {
    console.error('Pass2 SQL not found:', PASS2_PATH);
    process.exit(2);
  }

  const raw = fs.readFileSync(PASS2_PATH, 'utf8');
  const stmts = splitStatements(raw);

  const conn = process.env.PG_CONN || process.env.DATABASE_URL || process.argv[2];
  if (!conn) {
    console.error('Please set PG_CONN or DATABASE_URL environment variable to the Neon connection string.');
    process.exit(2);
  }

  const client = new Client({ connectionString: conn });
  await client.connect();

  const log = [];
  for (let i = 0; i < stmts.length; i++) {
    const original = stmts[i];
    const s = original.trim();
    try {
      if (/^alter\s+table/i.test(s) && /add\s+constraint/i.test(s)) {
        const m = s.match(/add\s+constraint\s+"?([^\(\s]+)"?/i);
        if (m) {
          const con = m[1].replace(/"/g, '');
          const { rows } = await client.query('SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1', [con]);
          if (rows.length === 0) {
            await client.query(s);
            console.log('OK', s.split('\n')[0].slice(0, 120));
            log.push({ idx: i + 1, status: 'OK', statement: s.replace(/\s+/g, ' ').slice(0, 300) });
          } else {
            console.log('SKIP exists', con);
            log.push({ idx: i + 1, status: 'SKIP', reason: 'constraint exists', constraint: con });
          }
          continue;
        }
      }

      if (/^create\s+(unique\s+)?index/i.test(s)) {
        const m = s.match(/create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?"?([^\(\s]+)"?/i);
        if (m) {
          const idx = m[1].replace(/"/g, '');
          const { rows } = await client.query("SELECT 1 FROM pg_class WHERE relname=$1 AND relkind='i' LIMIT 1", [idx]);
          if (rows.length === 0) {
            await client.query(s);
            console.log('OK', s.split('\n')[0].slice(0, 120));
            log.push({ idx: i + 1, status: 'OK', statement: s.replace(/\s+/g, ' ').slice(0, 300) });
          } else {
            console.log('SKIP index exists', idx);
            log.push({ idx: i + 1, status: 'SKIP', reason: 'index exists', index: idx });
          }
          continue;
        }
      }

      // Fallback: run directly and ignore duplicate-object (42710)
      try {
        await client.query(s);
        console.log('OK', s.split('\n')[0].slice(0, 120));
        log.push({ idx: i + 1, status: 'OK', statement: s.replace(/\s+/g, ' ').slice(0, 300) });
      } catch (innerErr) {
        if (innerErr && innerErr.code === '42710') {
          console.log('SKIP duplicate', s.split('\n')[0].slice(0, 120));
          log.push({ idx: i + 1, status: 'SKIP', code: innerErr.code, statement: s.replace(/\s+/g, ' ').slice(0, 300) });
        } else {
          console.error('ERR', innerErr.code || innerErr.message, s.split('\n')[0].slice(0, 120));
          log.push({ idx: i + 1, status: 'ERR', error: innerErr.message, code: innerErr.code, statement: s.replace(/\s+/g, ' ').slice(0, 300) });
        }
      }
    } catch (err) {
      console.error('ERR', err.code || err.message, s.split('\n')[0].slice(0, 120));
      log.push({ idx: i + 1, status: 'ERR', error: err.message, code: err.code, statement: s.replace(/\s+/g, ' ').slice(0, 300) });
    }
  }

  await client.end();
  fs.writeFileSync(LOG_PATH, JSON.stringify({ runAt: new Date().toISOString(), results: log }, null, 2));
  console.log('Wrote log to', LOG_PATH);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

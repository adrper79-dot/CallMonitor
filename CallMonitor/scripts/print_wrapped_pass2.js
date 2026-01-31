const fs = require('fs');

const PASS2_PATH = 'migrations/neon_public_schema_pass2.sql';

function splitStatements(sql) {
  return sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 0).map(s => (s.endsWith(';') ? s : s + ';'));
}

function wrapStatementSimple(stmt) {
  const s = stmt.trim();
  if (/^create\s+index/i.test(s)) {
    return `DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='<index_name>' AND relkind='i') THEN\n    EXECUTE $$${s}$$;\n  END IF;\nEXCEPTION WHEN SQLSTATE '42710' THEN NULL;\nEND$$;`;
  }
  if (/^alter\s+table/i.test(s)) {
    // If constraint name exists, check pg_constraint; otherwise fall back to try/catch wrapper
    if (/add\s+constraint/i.test(s)) {
      const conMatch = s.match(/add\s+constraint\s+"?([^\(\s]+)"?/i);
      if (conMatch) {
        const con = conMatch[1];
        return `DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='${con}') THEN\n    EXECUTE $$${s}$$;\n  END IF;\nEXCEPTION WHEN SQLSTATE '42710' THEN NULL;\nEND$$;`;
      }
    }
    return `DO $$\nBEGIN\n  EXECUTE $$${s}$$;\nEXCEPTION WHEN SQLSTATE '42710' THEN NULL;\nEND$$;`;
  }
  return `DO $$\nBEGIN\n  EXECUTE $$${s}$$;\nEXCEPTION WHEN SQLSTATE '42710' THEN NULL;\nEND$$;`;
}

if (!fs.existsSync(PASS2_PATH)) {
  console.error('pass2 not found');
  process.exit(1);
}

const raw = fs.readFileSync(PASS2_PATH, 'utf8');
const stmts = splitStatements(raw);
for (let i = 0; i < Math.min(5, stmts.length); i++) {
  console.log('--- ORIGINAL ---');
  console.log(stmts[i]);
  console.log('--- WRAPPED ---');
  console.log(wrapStatementSimple(stmts[i]));
  console.log('\n');
}

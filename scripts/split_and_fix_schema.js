const fs = require('fs');
const path = require('path');

const inPath = path.join(__dirname, '..', 'migrations', 'neon_public_schema.sql');
const out1 = path.join(__dirname, '..', 'migrations', 'neon_public_schema_pass1.sql');
const out2 = path.join(__dirname, '..', 'migrations', 'neon_public_schema_pass2.sql');
if (!fs.existsSync(inPath)) { console.error('input missing', inPath); process.exit(2); }
let s = fs.readFileSync(inPath, 'utf8');

// Portability fixes
// 1) time without time zone -> time
s = s.replace(/time without time zone/ig, 'time');
// 2) Normalize ARRAY usages: convert column type declarations like `tags ARRAY` -> `tags text[]`
//    and convert DEFAULT ARRAY['a'] -> DEFAULT ARRAY['a']::text[]
s = s.replace(/DEFAULT\s+ARRAY\s*\(\s*\)\s*/ig, "DEFAULT ARRAY[]::text[]");
s = s.replace(/DEFAULT\s+ARRAY\s*\['([^']*)'\]/ig, "DEFAULT ARRAY['$1']::text[]");
s = s.replace(/\b([a-zA-Z0-9_]+)\s+ARRAY\b/ig, '$1 text[]');

// 3) Ensure standard empty-array defaults use '{}'::text[] where appropriate
s = s.replace(/DEFAULT\s+'\{\}'::text\[\]/ig, "DEFAULT '{}'::text[]");

// Split into blocks of CREATE TABLE / other statements
const createTableRegex = /CREATE TABLE[\s\S]*?\);/ig;
let pass1 = [];
let pass2 = [];

// extract create table blocks
let m;
let lastIndex = 0;
while ((m = createTableRegex.exec(s)) !== null) {
  const block = m[0];
  const start = m.index;
  // push preceding SQL (ALTERs, other statements) into pass2 candidates
  const pre = s.slice(lastIndex, start);
  if (pre.trim()) pass2.push(pre.trim());

  // remove FOREIGN KEY constraint lines from the block and collect them for pass2
  const lines = block.split(/\r?\n/);
  const tblLine = lines[0];
  const tblNameMatch = tblLine.match(/CREATE TABLE\s+([a-zA-Z0-9_.]+)/i);
  const tblName = tblNameMatch ? tblNameMatch[1] : null;
  const newLines = [];
  for (const line of lines) {
    if (/FOREIGN KEY/i.test(line) || /REFERENCES\s+[a-zA-Z0-9_.]+\(/i.test(line)) {
      // convert to ALTER TABLE if we can extract the constraint
      const cMatch = line.match(/CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+([a-zA-Z0-9_.]+)\s*\(([^)]+)\)/i);
      if (cMatch && tblName) {
        const cname = cMatch[1];
        const cols = cMatch[2];
        const refTbl = cMatch[3];
        const refCols = cMatch[4];
        pass2.push(`ALTER TABLE ${tblName} ADD CONSTRAINT ${cname} FOREIGN KEY (${cols}) REFERENCES ${refTbl}(${refCols});`);
      } else {
        // try a simpler references match
        const rMatch = line.match(/REFERENCES\s+([a-zA-Z0-9_.]+)\s*\(([^)]+)\)/i);
        const fkColsMatch = line.match(/FOREIGN KEY\s*\(([^)]+)\)/i);
        if (rMatch && fkColsMatch && tblName) {
          const refTbl = rMatch[1];
          const refCols = rMatch[2];
          const fkCols = fkColsMatch[1];
          const genName = `${tblName.replace(/\W/g,'')}_${fkCols.replace(/[^a-zA-Z0-9]/g,'')}_fkey`;
          pass2.push(`ALTER TABLE ${tblName} ADD CONSTRAINT ${genName} FOREIGN KEY (${fkCols}) REFERENCES ${refTbl}(${refCols});`);
        }
      }
      continue; // skip including this line in pass1
    }

    // keep other constraint lines (primary key, unique, check) in table
    newLines.push(line);
  }

  pass1.push(newLines.join('\n'));
  lastIndex = createTableRegex.lastIndex;
}

// remaining tail
const tail = s.slice(lastIndex);
if (tail.trim()) pass2.push(tail.trim());

// Tidy pass1 and pass2 strings
const pass1Text = '-- pass1: CREATE TABLE statements (safe)\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\n\n' + pass1.join('\n\n') + '\n';
const pass2Text = '-- pass2: ALTER TABLE / FK / additional DDL\n' + pass2.join('\n\n') + '\n';

fs.writeFileSync(out1, pass1Text, 'utf8');
fs.writeFileSync(out2, pass2Text, 'utf8');
console.log('wrote', out1, out2);

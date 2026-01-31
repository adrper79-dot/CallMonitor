const fs = require('fs');
const p = 'migrations/neon_public_schema_pass1.sql';
if(!fs.existsSync(p)){ console.error('missing', p); process.exit(2); }
let s = fs.readFileSync(p,'utf8');

// Find nextval sequence names
const seqs = new Set();
const nv = s.matchAll(/nextval\('\s*([^']+)\s*'\)/g);
for (const m of nv) seqs.add(m[1]);
let seqText = '';
for (const seq of seqs) seqText += `CREATE SEQUENCE IF NOT EXISTS ${seq};\n`;
if (seqText) s = seqText + '\n' + s;

// Fix DEFAULT 'HH:MM:SS' without time zone -> DEFAULT 'HH:MM:SS'
s = s.replace(/DEFAULT\s+'([^']+)'\s+without time zone/ig, "DEFAULT '$1'");

fs.writeFileSync(p, s, 'utf8');
console.log('prepended sequences and fixed time defaults');

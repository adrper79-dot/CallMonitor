const fs = require('fs');
const p = 'migrations/neon_public_schema_pass1.sql';
if(!fs.existsSync(p)){ console.error('missing', p); process.exit(2); }
let s = fs.readFileSync(p,'utf8');

// Fix malformed ANY(text[]['a','b']) -> ANY (ARRAY['a','b']::text[])
s = s.replace(/ANY\s*\(\s*text\[\]\s*\[([^\]]*)\]\s*\)/ig, (m, g1) => `ANY (ARRAY[${g1}]::text[])`);

// Fix patterns like text[]['a']::text[] -> ARRAY['a']::text[]
s = s.replace(/text\[\]\s*\[([^\]]*)\]\s*::text\[\]/ig, (m,g1) => `ARRAY[${g1}]::text[]`);

// Fix stray default '{}'[] -> '{}'::text[]
s = s.replace(/'\{\}'\s*\[\]/g, "'{}'::text[]");

// Fix leftover patterns like text[]['a'][] -> ARRAY['a']::text[]
s = s.replace(/text\[\]\s*\[([^\]]*)\]\s*\[\]/ig, (m,g1) => `ARRAY[${g1}]::text[]`);

// Tidy multiple blank lines
s = s.replace(/(\r?\n){3,}/g, '\r\n\r\n');

fs.writeFileSync(p, s, 'utf8');
console.log('fixed checks in', p);

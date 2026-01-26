const fs = require('fs');
const p = 'migrations/neon_public_schema_pass1.sql';
if(!fs.existsSync(p)){ console.error('missing', p); process.exit(2); }
let s = fs.readFileSync(p,'utf8');
// Remove trailing commas before closing paren of CREATE TABLE blocks
s = s.replace(/,\s*\n\)/g, '\n)');
// Convert ARRAY['a'] -> ARRAY['a']::text[]
s = s.replace(/ARRAY\s*\['([^']*)'\]/g, "ARRAY['$1']::text[]");
// Convert any remaining ' ARRAY' type tokens to ' text[]'
s = s.replace(/\bARRAY\b/g, 'text[]');
// Remove explicit ::time without time zone/coercions
s = s.replace(/::time( without time zone)?/ig, '');
// Remove odd casts like ::tool_role_type
s = s.replace(/::[a-zA-Z0-9_]+/g, '');
// Tidy repeated blank lines
s = s.replace(/(\r?\n){3,}/g, '\r\n\r\n');
fs.writeFileSync(p, s, 'utf8');
console.log('fixed', p);

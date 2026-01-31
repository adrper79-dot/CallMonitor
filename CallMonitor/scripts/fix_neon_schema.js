const fs = require('fs');
const p = 'migrations/neon_public_schema.sql';
if(!fs.existsSync(p)) { console.error('missing', p); process.exit(2); }
let s = fs.readFileSync(p,'utf8');
// Remove trailing commas before closing );
s = s.replace(/,\r?\n\);/g, '\r\n);');
// Tidy multiple blank lines
s = s.replace(/(\r?\n){3,}/g, '\r\n\r\n');
fs.writeFileSync(p,s,'utf8');
console.log('fixed', p);

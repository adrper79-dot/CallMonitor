const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'ARCH_DOCS', '01-CORE', 'Schema.txt');
const outDir = path.join(__dirname, '..', 'migrations');
const outPath = path.join(outDir, 'neon_public_schema.sql');

if (!fs.existsSync(inputPath)) {
  console.error('Input schema not found:', inputPath);
  process.exit(2);
}
const raw = fs.readFileSync(inputPath, 'utf8');
let out = raw;

// 1) Normalize uuid functions to gen_random_uuid()
out = out.replace(/uuid_generate_v4\(\)/g, 'gen_random_uuid()');

// 2) Replace USER-DEFINED types with text (conservative) to avoid unknown type errors
out = out.replace(/USER-DEFINED/g, 'text');

// 3) Remove Postgres schema-specific foreign keys to auth/next_auth (leave columns intact)
out = out.replace(/^\s*CONSTRAINT .*FOREIGN KEY.*REFERENCES\s+(auth|next_auth)\.users\([^)]+\),?\s*$/gmi, '');

// 4) Remove duplicate camelCase columns left from other exports
out = out.replace(/^\s*providerAccountId .*\r?\n/gm, '');
out = out.replace(/^\s*sessionToken .*\r?\n/gm, '');

// 5) Remove casts to removed custom types (example: ::tool_role_type)
out = out.replace(/::[a-zA-Z0-9_]+/g, '');

// 6) Tidy: remove multiple consecutive blank lines
out = out.replace(/(\r?\n){3,}/g, '\r\n\r\n');

// 7) Add pgcrypto extension header for gen_random_uuid()
const header = `-- Generated Neon-ready schema draft\r\n-- Conservative transformations applied: gen_random_uuid(), USER-DEFINED->text,\r\n-- removed foreign keys referencing auth/next_auth schemas, removed camelCase duplicate columns.\r\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\r\n\r\n`;

const final = header + out;

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, final, 'utf8');
console.log('Wrote', outPath);

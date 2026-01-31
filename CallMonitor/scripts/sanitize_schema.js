const fs = require('fs');
const path = require('path');
const inPath = path.join(__dirname, '..', 'migrations', 'backups', 'supabase_schema_public.filtered.sql');
const outPath = path.join(__dirname, '..', 'migrations', 'backups', 'supabase_schema_public.prepared.sql');
let s = fs.readFileSync(inPath, 'utf8');
// Replacements
s = s.replace(/::tool_role_type/g, '::text');
s = s.replace(/::tool_type/g, '::text');
// OWNER replacement
s = s.replace(/OWNER TO postgres/g, 'OWNER TO neondb_owner');
s = s.replace(/OWNER TO "postgres"/g, 'OWNER TO neondb_owner');
// Comment out ALTER DEFAULT PRIVILEGES lines that mention postgres
s = s.replace(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres/gi, '-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres');
s = s.replace(/ALTER DEFAULT PRIVILEGES FOR ROLE "postgres"/gi, '-- ALTER DEFAULT PRIVILEGES FOR ROLE "postgres"');
// Also remove any occurrence of '::tool_role_type' in types (defensive)
s = s.replace(/\bpublic\.tool_role_type\b/g, 'text');
s = s.replace(/\bpublic\.tool_type\b/g, 'text');
fs.writeFileSync(outPath, s, 'utf8');
console.log('Wrote', outPath);
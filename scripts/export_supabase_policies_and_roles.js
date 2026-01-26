const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUT_DIR = path.join('migrations', 'supabase_inventory');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const conn = process.env.PG_CONN || process.env.SUPABASE_PG_CONN || process.env.DATABASE_URL;
if (!conn) {
  console.error('Set PG_CONN or SUPABASE_PG_CONN environment variable to the Supabase connection string');
  process.exit(2);
}

const client = new Client({ connectionString: conn });

async function run() {
  await client.connect();
  // Export policies with table names and expressions
  try {
    const policiesQ = `
      SELECT
        p.oid,
        p.polname AS policy_name,
        n.nspname AS schema,
        c.relname AS table_name,
        p.polcmd AS cmd,
        p.polpermissive AS permissive,
        CASE WHEN p.polqual IS NULL THEN NULL ELSE pg_get_expr(p.polqual, p.polrelid) END AS qual,
        CASE WHEN p.polwithcheck IS NULL THEN NULL ELSE pg_get_expr(p.polwithcheck, p.polrelid) END AS with_check,
        p.polroles::text AS roles_raw
      FROM pg_policy p
      JOIN pg_class c ON p.polrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
      ORDER BY c.relname, p.polname;
    `;
    const res = await client.query(policiesQ);
    fs.writeFileSync(path.join(OUT_DIR, 'policies_verbose.json'), JSON.stringify({query: policiesQ, rows: res.rows}, null, 2));
    console.log('Wrote policies_verbose.json');
  } catch (err) {
    fs.writeFileSync(path.join(OUT_DIR, 'policies_verbose.error.txt'), `${err.message}\n`);
    console.error('Failed to export policies:', err.message);
  }

  // Export role memberships and grants
  try {
    const rolesQ = `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin FROM pg_roles ORDER BY rolname;`;
    const roles = await client.query(rolesQ);
    fs.writeFileSync(path.join(OUT_DIR, 'roles_verbose.json'), JSON.stringify({query: rolesQ, rows: roles.rows}, null, 2));
    console.log('Wrote roles_verbose.json');

    // role membership: use pg_auth_members and resolve OIDs
    const membersQ = `SELECT r.rolname AS role, (SELECT rolname FROM pg_roles WHERE oid=am.member) AS member FROM pg_auth_members am JOIN pg_roles r ON am.roleid=r.oid ORDER BY r.rolname;`;
    const members = await client.query(membersQ);
    fs.writeFileSync(path.join(OUT_DIR, 'role_members.json'), JSON.stringify({query: membersQ, rows: members.rows}, null, 2));
    console.log('Wrote role_members.json');

    const grantsQ = `SELECT grantee, table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY table_name, grantee;`;
    const grants = await client.query(grantsQ);
    fs.writeFileSync(path.join(OUT_DIR, 'table_grants_verbose.json'), JSON.stringify({query: grantsQ, rows: grants.rows}, null, 2));
    console.log('Wrote table_grants_verbose.json');
  } catch (err) {
    fs.writeFileSync(path.join(OUT_DIR, 'roles_verbose.error.txt'), `${err.message}\n`);
    console.error('Failed to export roles/grants:', err.message);
  }

  await client.end();
  console.log('Policies and roles export complete');
}

run().catch(e => { console.error(e); process.exit(1); });

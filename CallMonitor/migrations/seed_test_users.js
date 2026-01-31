const { Pool } = require('pg');
const crypto = require('crypto');

async function up() {
  const conn = process.env.NEON_PG_CONN;
  if (!conn) {
    console.error('NEON_PG_CONN not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: conn });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // helper to upsert a user (id as uuid string stored into text id)
    async function upsertUser(email, name, id) {
      // prefer to find existing by email; fallback to insert
      const found = await client.query(`SELECT id, email, name FROM public.users WHERE email = $1`, [email]);
      if (found.rowCount > 0) {
        await client.query(`UPDATE public.users SET name = $1 WHERE email = $2`, [name, email]);
        return (await client.query(`SELECT id, email, name FROM public.users WHERE email = $1`, [email])).rows[0];
      }
      const userId = id || crypto.randomUUID();
      const res = await client.query(`INSERT INTO public.users (id, name, email) VALUES ($1, $2, $3) RETURNING id, email, name`, [userId, name, email]);
      return res.rows[0];
    }

    // create admin user
    const admin = await upsertUser('admin01@testgroup.org', 'admin01');
    console.log('Admin created/updated:', admin);

    // create owner and team users
    const owner = await upsertUser('owner@testgroup.org', 'owner');
    const user1 = await upsertUser('user1@testgroup.org', 'user1');
    const user2 = await upsertUser('user2@testgroup.org', 'user2');
    console.log('Users created/updated:', owner.email, user1.email, user2.email);

    // create organization (testgroup)
    const orgName = 'testgroup';
    // insert or find organization by name
    let org = (await client.query(`SELECT id, name FROM public.organizations WHERE name = $1`, [orgName])).rows[0];
    if (!org) {
      const orgRes = await client.query(`INSERT INTO public.organizations (name, created_by) VALUES ($1, $2) RETURNING id, name`, [orgName, admin.id]);
      org = orgRes.rows[0];
    }
    console.log('Organization created/updated:', org);

    // helper to add org membership
    async function addOrgMember(orgId, userId, role) {
      await client.query(
        `INSERT INTO public.org_members (organization_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [orgId, userId, role]
      );
    }

    // add memberships: owner (owner), user1/user2 (member), admin (admin)
    await addOrgMember(org.id, owner.id, 'owner');
    await addOrgMember(org.id, user1.id, 'member');
    await addOrgMember(org.id, user2.id, 'member');
    await addOrgMember(org.id, admin.id, 'admin');

    // populate tool_team_members for the tool 'callmonitor' as an example
    const toolName = 'callmonitor';
    async function addToolMember(orgId, userId, role) {
      await client.query(
        `INSERT INTO public.tool_team_members (organization_id, user_id, tool, role, invited_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, user_id, tool) DO NOTHING`,
        [orgId, userId, toolName, role, admin.id]
      );
    }

    await addToolMember(org.id, owner.id, 'admin');
    await addToolMember(org.id, user1.id, 'editor');
    await addToolMember(org.id, user2.id, 'editor');

    await client.query('COMMIT');
    console.log('Seeding complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  up();
}

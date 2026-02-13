const { Client } = require('@neondatabase/serverless');
const fs = require('fs');

async function runMigration() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_HKXlEiWM9BF2@ep-mute-recipe-ahsibut8-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'
  });

  try {
    await client.connect();
    console.log('Connected to Neon');

    const sql = fs.readFileSync('migrations/2026-02-10-session7-rls-security-hardening.sql', 'utf8');
    await client.query(sql);
    console.log('RLS security hardening migration completed');

    // Verify RLS enabled
    const result = await client.query(`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true`);
    console.log('Tables with RLS enabled:', result.rows.length);

  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
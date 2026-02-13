const { Client } = require('@neondatabase/serverless');
const fs = require('fs');

async function runMigration() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_HKXlEiWM9BF2@ep-mute-recipe-ahsibut8-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'
  });

  try {
    await client.connect();
    console.log('Connected to Neon');

    const sql = fs.readFileSync('migrations/2026-02-13-orphan-tables-cleanup.sql', 'utf8');
    await client.query(sql);
    console.log('Orphan tables cleanup migration completed');

    // Count remaining tables
    const result = await client.query(`SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='public'`);
    console.log('Remaining tables:', result.rows[0].table_count);

  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
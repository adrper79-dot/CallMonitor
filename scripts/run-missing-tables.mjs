const { Client } = require('@neondatabase/serverless');
const fs = require('fs');

async function runMigration() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_HKXlEiWM9BF2@ep-mute-recipe-ahsibut8-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'
  });

  try {
    await client.connect();
    console.log('Connected to Neon');

    const sql = fs.readFileSync('migrations/2026-02-13-missing-tables-bond-ai-alerts-timeline-scorecards.sql', 'utf8');
    await client.query(sql);
    console.log('Missing tables migration completed');

    // Verify tables exist
    const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('bond_ai_alerts','bond_ai_alert_rules','call_timeline_events','scorecard_templates')`);
    console.log('Created tables:', result.rows.map(r => r.table_name));

  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
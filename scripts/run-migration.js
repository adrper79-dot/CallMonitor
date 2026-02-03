import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '../.env.local') })
console.log('NEON_PG_CONN:', process.env.NEON_PG_CONN)
import { query } from '../lib/pgClient.ts'

async function runMigration() {
  try {
    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tool_id UUID;
    `)
    console.log('Migration completed')
  } catch (err) {
    console.error('Migration failed', err)
  } finally {
    process.exit(0)
  }
}

runMigration()
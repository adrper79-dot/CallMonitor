const { Pool } = require('pg')

require('dotenv').config({ path: './tests/.env.production' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

async function main() {
  // Get calls columns
  const calls = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'calls' ORDER BY ordinal_position
  `)
  console.log('=== CALLS COLUMNS ===')
  console.log(calls.rows.map(r => r.column_name).join(', '))

  // Get voice_configs columns
  const vc = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'voice_configs' ORDER BY ordinal_position
  `)
  console.log('\n=== VOICE_CONFIGS COLUMNS ===')
  console.log(vc.rows.map(r => r.column_name).join(', '))

  await pool.end()
}

main().catch(console.error)

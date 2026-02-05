#!/usr/bin/env node
/**
 * Setup Test Accounts - Direct Node.js Script
 * Creates test accounts with correct SHA-256 password hashing
 * Makes them owners of their organizations
 * 
 * Usage: node scripts/setup-test-accounts.mjs
 */

import pg from 'pg'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Pool } = pg
const NEON_CONN = process.env.NEON_PG_CONN

if (!NEON_CONN) {
  console.error('❌ NEON_PG_CONN not set in .env.local')
  process.exit(1)
}

const pool = new Pool({ connectionString: NEON_CONN })

// Password hashing functions matching auth.ts
function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const saltHex = salt.toString('hex')
  const data = Buffer.from(saltHex + password, 'utf8')
  const hashBuffer = crypto.createHash('sha256').update(data).digest()
  const hash = hashBuffer.toString('hex')
  return `${saltHex}:${hash}`
}

function verifyPassword(password, hash) {
  if (!hash || !hash.includes(':')) return false
  const [saltHex, storedHash] = hash.split(':')
  const data = Buffer.from(saltHex + password, 'utf8')
  const computedHash = crypto.createHash('sha256').update(data).digest('hex')
  return computedHash === storedHash
}

async function main() {
  console.log('\n' + '='.repeat(70))
  console.log('🔐 Setting Up Test Accounts')
  console.log('='.repeat(70))

  try {
    // Verify connection
    const result = await pool.query('SELECT NOW()')
    console.log('✅ Connected to database\n')

    const testAccounts = [
      { email: 'test@example.com', password: 'test12345', name: 'Test User' },
      { email: 'demo@wordisbond.com', password: 'demo12345', name: 'Demo User' },
      { email: 'admin@wordisbond.com', password: 'admin12345', name: 'Admin User' },
    ]

    for (const account of testAccounts) {
      console.log(`\n📝 Processing: ${account.email}`)

      const passwordHash = hashPassword(account.password)

      // Check if user exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [account.email.toLowerCase()]
      )

      let userId
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id
        await pool.query(
          'UPDATE users SET password_hash = $1, name = $2, updated_at = NOW() WHERE id = $3',
          [passwordHash, account.name, userId]
        )
        console.log(`   ✓ Updated existing user`)
      } else {
        const result = await pool.query(
          `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
           RETURNING id`,
          [account.email.toLowerCase(), account.name, passwordHash]
        )
        userId = result.rows[0].id
        console.log(`   ✓ Created new user`)
      }

      // Verify password
      const userRow = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      )
      const isValid = verifyPassword(account.password, userRow.rows[0].password_hash)
      console.log(`   ✓ Password verification: ${isValid ? '✅ Valid' : '❌ FAILED'}`)

      // Make owner of organization
      const membership = await pool.query(
        `SELECT o.id FROM org_members om
         JOIN organizations o ON o.id = om.organization_id
         WHERE om.user_id = $1 LIMIT 1`,
        [userId]
      )

      if (membership.rows.length > 0) {
        const orgId = membership.rows[0].id
        await pool.query(
          'UPDATE org_members SET role = $1 WHERE user_id = $2 AND organization_id = $3',
          ['owner', userId, orgId]
        )
        console.log(`   ✓ Made OWNER of existing organization`)
      } else {
        const orgResult = await pool.query(
          `INSERT INTO organizations (name, created_at, updated_at)
           VALUES ($1, NOW(), NOW()) RETURNING id`,
          [`${account.name}'s Organization`]
        )
        const orgId = orgResult.rows[0].id

        await pool.query(
          `INSERT INTO org_members (organization_id, user_id, role, created_at)
           VALUES ($1, $2, 'owner', NOW())`,
          [orgId, userId]
        )
        console.log(`   ✓ Created organization and made OWNER`)
      }

      console.log(`   📝 Credentials: ${account.email} / ${account.password}`)
    }

    console.log('\n' + '='.repeat(70))
    console.log('✅ Setup Complete!')
    console.log('='.repeat(70))
    console.log('\nTest Credentials:')
    testAccounts.forEach(a => {
      console.log(`  • ${a.email} / ${a.password}`)
    })
    console.log('\nNext: Sign in at https://26db2607.wordisbond.pages.dev/signin\n')

  } catch (err) {
    console.error('\n❌ Error:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()

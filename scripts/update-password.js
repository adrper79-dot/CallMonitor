#!/usr/bin/env node
/**
 * Update password utility - uses Workers' hash format
 * Usage: node scripts/update-password.js <email> <new-password>
 */

import { config } from 'dotenv'
import pg from 'pg'
import crypto from 'crypto'

config({ path: '.env.local' })

const { Pool } = pg

async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  
  const encoder = new TextEncoder()
  const data = encoder.encode(saltHex + password)
  
  // Use Node.js crypto for SHA-256
  const hash = crypto.createHash('sha256').update(saltHex + password).digest('hex')
  
  return saltHex + ':' + hash
}

async function updatePassword(email, newPassword) {
  const pool = new Pool({
    connectionString: process.env.NEON_PG_CONN
  })

  try {
    console.log('\n🔑 Update Password Utility')
    console.log('=' .repeat(50))

    // Hash password using Workers format (salt:sha256)
    const passwordHash = await hashPassword(newPassword)

    console.log(`Email: ${email}`)
    console.log(`New Password: ${'*'.repeat(newPassword.length)}`)
    console.log(`Hash Format: ${passwordHash.substring(0, 40)}...`)
    console.log('=' .repeat(50))

    // Update password
    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = NOW()
       WHERE email = $2
       RETURNING id, email, name`,
      [passwordHash, email.toLowerCase()]
    )

    if (result.rows.length === 0) {
      console.log(`\n❌ User not found: ${email}`)
      process.exit(1)
    }

    const user = result.rows[0]
    console.log(`\n✅ Password updated successfully!`)
    console.log(`   User ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.name}`)

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Get command line arguments
const [,, email, password] = process.argv

if (!email || !password) {
  console.error('\n❌ Usage: node scripts/update-password.js <email> <new-password>')
  process.exit(1)
}

updatePassword(email, password)

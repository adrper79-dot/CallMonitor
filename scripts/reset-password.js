#!/usr/bin/env node
/**
 * Reset user password utility
 * Usage: node scripts/reset-password.js <email> <new-password>
 */

import { config } from 'dotenv'
import pg from 'pg'
import bcrypt from 'bcryptjs'

config({ path: '.env.local' })

const { Pool } = pg

async function resetPassword(email, newPassword) {
  const pool = new Pool({
    connectionString: process.env.NEON_PG_CONN
  })

  try {
    // Hash the new password
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(newPassword, salt)

    console.log('\n🔑 Password Reset Utility')
    console.log('=' .repeat(50))
    console.log(`Email: ${email}`)
    console.log(`New password: ${newPassword}`)
    console.log(`Hash: ${passwordHash.substring(0, 20)}...`)
    console.log('=' .repeat(50))

    // Update the user's password
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

    // Verify the password works
    const isValid = await bcrypt.compare(newPassword, passwordHash)
    console.log(`\n🔍 Verification: ${isValid ? '✅ Password is valid' : '❌ Password verification failed'}`)

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Get command line arguments
const [,, email, password] = process.argv

if (!email || !password) {
  console.error('\nUsage: node scripts/reset-password.js <email> <new-password>')
  console.error('\nExample: node scripts/reset-password.js user@example.com MyNewPassword123!')
  process.exit(1)
}

resetPassword(email, password)

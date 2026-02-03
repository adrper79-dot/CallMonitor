#!/usr/bin/env node
/**
 * Create user utility
 * Usage: node scripts/create-user.js <email> <password> [name] [organization]
 */

import { config } from 'dotenv'
import pg from 'pg'
import bcrypt from 'bcryptjs'

config({ path: '.env.local' })

const { Pool } = pg

async function createUser(email, password, name, organizationName) {
  const pool = new Pool({
    connectionString: process.env.NEON_PG_CONN
  })

  try {
    console.log('\n👤 Create User Utility')
    console.log('=' .repeat(50))

    // Check if user exists
    const existingUser = await pool.query(
      `SELECT id, email FROM users WHERE email = $1`,
      [email.toLowerCase()]
    )

    if (existingUser.rows.length > 0) {
      console.log(`\n❌ User already exists: ${email}`)
      console.log(`   User ID: ${existingUser.rows[0].id}`)
      process.exit(1)
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)

    console.log(`Email: ${email}`)
    console.log(`Name: ${name || email.split('@')[0]}`)
    console.log(`Password: ${'*'.repeat(password.length)}`)
    if (organizationName) {
      console.log(`Organization: ${organizationName}`)
    }
    console.log('=' .repeat(50))

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       RETURNING id, email, name`,
      [email.toLowerCase(), name || email.split('@')[0], passwordHash]
    )

    const user = userResult.rows[0]
    console.log(`\n✅ User created successfully!`)
    console.log(`   User ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.name}`)

    // Create organization if provided
    if (organizationName) {
      const orgResult = await pool.query(
        `INSERT INTO organizations (id, name, owner_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
         RETURNING id, name`,
        [organizationName, user.id]
      )

      const org = orgResult.rows[0]

      // Add user as org member
      await pool.query(
        `INSERT INTO org_members (organization_id, user_id, role, created_at, updated_at)
         VALUES ($1, $2, 'owner', NOW(), NOW())`,
        [org.id, user.id]
      )

      console.log(`\n✅ Organization created!`)
      console.log(`   Org ID: ${org.id}`)
      console.log(`   Org Name: ${org.name}`)
      console.log(`   Role: owner`)
    }

    // Verify password works
    const isValid = await bcrypt.compare(password, passwordHash)
    console.log(`\n🔍 Password verification: ${isValid ? '✅ Valid' : '❌ Failed'}`)

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Get command line arguments
const [,, email, password, name, organizationName] = process.argv

if (!email || !password) {
  console.error('\nUsage: node scripts/create-user.js <email> <password> [name] [organization]')
  console.error('\nExample: node scripts/create-user.js user@example.com MyPassword123! "John Doe" "Acme Corp"')
  process.exit(1)
}

createUser(email, password, name, organizationName)

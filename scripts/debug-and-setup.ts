/**
 * Comprehensive Debug & Setup Script
 * 
 * This script:
 * 1. Verifies database connectivity
 * 2. Creates test accounts with CORRECT password hashing (SHA-256, matching auth.ts)
 * 3. Makes test accounts owners
 * 4. Tests the authentication flow
 * 5. Diagnoses any issues
 * 
 * Run with: npx ts-node scripts/debug-and-setup.ts
 */

import { config } from 'dotenv'
import pg from 'pg'
import crypto from 'crypto'

config({ path: '.env.local' })

const API_BASE = 'https://wordisbond-api.adrper79.workers.dev'
const NEON_CONN = process.env.NEON_PG_CONN

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(level: 'info' | 'success' | 'error' | 'warn', message: string, data?: any) {
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
  }
  console.log(`${colorMap[level]}[${level.toUpperCase()}]${colors.reset} ${message}`)
  if (data) {
    console.log(colors.cyan, JSON.stringify(data, null, 2), colors.reset)
  }
}

// Match auth.ts hashPassword function
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const saltHex = salt.toString('hex')
  
  const data = Buffer.from(saltHex + password, 'utf8')
  const hashBuffer = crypto.createHash('sha256').update(data).digest()
  const hash = hashBuffer.toString('hex')
  
  return `${saltHex}:${hash}`
}

// Match auth.ts verifyPassword function
function verifyPassword(password: string, hash: string): boolean {
  if (!hash || !hash.includes(':')) return false
  
  const [saltHex, storedHash] = hash.split(':')
  const data = Buffer.from(saltHex + password, 'utf8')
  const computedHash = crypto.createHash('sha256').update(data).digest('hex')
  
  return computedHash === storedHash
}

async function main() {
  console.log('\n' + '='.repeat(70))
  log('info', 'Authentication Debug & Setup')
  console.log('='.repeat(70) + '\n')

  // Step 1: Verify database connection
  console.log(colors.yellow + '\n📡 Step 1: Verifying Database Connection' + colors.reset)
  console.log('-'.repeat(70))

  if (!NEON_CONN) {
    log('error', 'NEON_PG_CONN environment variable not set')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: NEON_CONN })

  try {
    const result = await pool.query('SELECT NOW() as now, version() as version')
    log('success', 'Database connected successfully')
    console.log(`  PostgreSQL: ${result.rows[0].version.split(',')[0]}`)
    console.log(`  Current time: ${result.rows[0].now}`)
  } catch (error: any) {
    log('error', 'Failed to connect to database')
    console.error(error.message)
    process.exit(1)
  }

  // Step 2: Check tables exist
  console.log(colors.yellow + '\n📋 Step 2: Verifying Database Schema' + colors.reset)
  console.log('-'.repeat(70))

  try {
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name IN ('users', 'organizations', 'org_members', 'sessions')`
    )

    const tableNames = tables.rows.map(r => r.table_name)
    const required = ['users', 'organizations', 'org_members', 'sessions']
    const missing = required.filter(t => !tableNames.includes(t))

    if (missing.length === 0) {
      log('success', 'All required tables exist')
      tableNames.forEach(t => console.log(`  ✓ ${t}`))
    } else {
      log('error', `Missing tables: ${missing.join(', ')}`)
    }
  } catch (error: any) {
    log('error', 'Failed to check schema')
    console.error(error.message)
  }

  // Step 3: Check for existing test users
  console.log(colors.yellow + '\n👥 Step 3: Checking for Existing Test Users' + colors.reset)
  console.log('-'.repeat(70))

  try {
    const testUsers = await pool.query(
      `SELECT id, email, name FROM users WHERE email LIKE '%test%' OR email LIKE '%demo%' LIMIT 10`
    )

    if (testUsers.rows.length > 0) {
      log('info', `Found ${testUsers.rows.length} test users:`)
      testUsers.rows.forEach(u => {
        console.log(`  • ${u.email} (ID: ${u.id.slice(0, 8)}...)`)
      })
    } else {
      log('warn', 'No existing test users found')
    }
  } catch (error: any) {
    log('warn', 'Could not query existing users: ' + error.message)
  }

  // Step 4: Create test accounts with CORRECT password hashing
  console.log(colors.yellow + '\n🔐 Step 4: Creating/Updating Test Accounts with SHA-256 Hashing' + colors.reset)
  console.log('-'.repeat(70))

  const testAccounts = [
    { email: 'test@example.com', password: 'test123', name: 'Test User' },
    { email: 'demo@wordisbond.com', password: 'demo123', name: 'Demo User' },
    { email: 'admin@wordisbond.com', password: 'admin123', name: 'Admin User' },
  ]

  for (const account of testAccounts) {
    try {
      const passwordHash = hashPassword(account.password)
      
      // Check if user exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [account.email.toLowerCase()]
      )

      let userId: string
      
      if (existing.rows.length > 0) {
        // Update existing user
        userId = existing.rows[0].id
        await pool.query(
          `UPDATE users SET password_hash = $1, name = $2, updated_at = NOW() 
           WHERE id = $3`,
          [passwordHash, account.name, userId]
        )
        log('success', `Updated user: ${account.email}`)
      } else {
        // Create new user
        const result = await pool.query(
          `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
           RETURNING id`,
          [account.email.toLowerCase(), account.name, passwordHash]
        )
        userId = result.rows[0].id
        log('success', `Created user: ${account.email}`)
      }

      // Verify password works
      const userRow = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      )
      
      if (userRow.rows[0]) {
        const isValid = verifyPassword(account.password, userRow.rows[0].password_hash)
        console.log(`  Password verification: ${isValid ? '✅ Valid' : '❌ FAILED'}`)
      }

      console.log(`  Credentials: ${account.email} / ${account.password}`)

    } catch (error: any) {
      log('error', `Failed to create user ${account.email}`)
      console.error(error.message)
    }
  }

  // Step 5: Make test accounts owners
  console.log(colors.yellow + '\n👑 Step 5: Making Test Accounts Owners' + colors.reset)
  console.log('-'.repeat(70))

  try {
    for (const account of testAccounts) {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [account.email.toLowerCase()]
      )

      if (userResult.rows.length === 0) continue

      const userId = userResult.rows[0].id

      // Check if user has an organization
      const membership = await pool.query(
        `SELECT o.id as org_id, om.role FROM org_members om
         JOIN organizations o ON o.id = om.organization_id
         WHERE om.user_id = $1
         LIMIT 1`,
        [userId]
      )

      let orgId: string
      
      if (membership.rows.length > 0) {
        // Update existing membership to owner
        orgId = membership.rows[0].org_id
        await pool.query(
          'UPDATE org_members SET role = $1 WHERE user_id = $2 AND organization_id = $3',
          ['owner', userId, orgId]
        )
        log('success', `Updated ${account.email} to OWNER in existing org`)
      } else {
        // Create organization and add user as owner
        const orgResult = await pool.query(
          `INSERT INTO organizations (name, owner_id, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           RETURNING id`,
          [`${account.name}'s Organization`, userId]
        )
        orgId = orgResult.rows[0].id

        await pool.query(
          `INSERT INTO org_members (organization_id, user_id, role, created_at)
           VALUES ($1, $2, 'owner', NOW())`,
          [orgId, userId]
        )
        log('success', `Created organization for ${account.email} (OWNER)`)
      }

      console.log(`  Organization ID: ${orgId.slice(0, 8)}...`)
    }
  } catch (error: any) {
    log('error', 'Failed to make users owners')
    console.error(error.message)
  }

  // Step 6: Test authentication flow
  console.log(colors.yellow + '\n🧪 Step 6: Testing Authentication Flow' + colors.reset)
  console.log('-'.repeat(70))

  try {
    // Get CSRF token
    log('info', 'Requesting CSRF token...')
    const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })

    if (!csrfRes.ok) {
      log('error', `CSRF endpoint returned ${csrfRes.status}`)
      throw new Error(`CSRF failed with ${csrfRes.status}`)
    }

    const csrfData = await csrfRes.json()
    log('success', 'Got CSRF token')

    // Test login with first test account
    const testAccount = testAccounts[0]
    log('info', `Testing login with ${testAccount.email}...`)

    const loginRes = await fetch(`${API_BASE}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username: testAccount.email,
        password: testAccount.password,
        csrfToken: csrfData.csrfToken
      })
    })

    const loginData = await loginRes.json()

    if (loginRes.ok && loginData.sessionToken) {
      log('success', `Login successful! Got session token`)
      console.log(`  Token: ${loginData.sessionToken.slice(0, 8)}...`)
      console.log(`  User: ${loginData.user.email}`)
      console.log(`  Org: ${loginData.user.organization_id || 'N/A'}`)

      // Test with session token
      log('info', 'Testing /api/organizations/current with token...')
      const orgRes = await fetch(`${API_BASE}/api/organizations/current`, {
        headers: {
          'Authorization': `Bearer ${loginData.sessionToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (orgRes.ok) {
        const orgData = await orgRes.json()
        log('success', 'Organization endpoint working!')
        console.log(`  Org: ${orgData.organization.name}`)
        console.log(`  Role: ${orgData.role}`)
      } else {
        log('error', `Organization endpoint returned ${orgRes.status}`)
        const errData = await orgRes.json()
        console.log(JSON.stringify(errData, null, 2))
      }

    } else {
      log('error', `Login failed with ${loginRes.status}`)
      console.log(JSON.stringify(loginData, null, 2))
    }

  } catch (error: any) {
    log('error', 'Failed to test authentication flow')
    console.error(error.message)
  }

  // Summary
  console.log(colors.yellow + '\n📊 Summary' + colors.reset)
  console.log('='.repeat(70))
  
  log('info', 'Test accounts created/updated:')
  testAccounts.forEach(a => {
    console.log(`  • ${a.email}`)
    console.log(`    Password: ${a.password}`)
  })

  log('info', 'Next steps:')
  console.log('  1. Go to https://26db2607.wordisbond.pages.dev/signin')
  console.log('  2. Sign in with one of the test credentials above')
  console.log('  3. Try making a WebRTC call to +17062677235')

  console.log('\n' + '='.repeat(70) + '\n')

  await pool.end()
}

main().catch(error => {
  log('error', 'Script failed')
  console.error(error)
  process.exit(1)
})

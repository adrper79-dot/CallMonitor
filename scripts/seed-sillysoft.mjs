/**
 * Seed script: Create "SillySoft" test org with one user per role.
 * 
 * Password for all users: spacem@n0
 * Hash format: pbkdf2:120000:saltHex:derivedKeyHex (matches auth.ts)
 *
 * Usage: node scripts/seed-sillysoft.mjs
 */

import { webcrypto } from 'node:crypto'

const PBKDF2_ITERATIONS = 100000
const PBKDF2_HASH = 'SHA-256'
const SALT_BYTES = 16
const KEY_BYTES = 32
const PASSWORD = 'spacem@n0'

function hexEncode(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const encoder = new TextEncoder()

  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const derived = await webcrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    KEY_BYTES * 8
  )

  return `pbkdf2:${PBKDF2_ITERATIONS}:${hexEncode(salt.buffer)}:${hexEncode(derived)}`
}

const ROLES = ['owner', 'admin', 'manager', 'compliance', 'agent', 'viewer']

async function main() {
  const hash = await hashPassword(PASSWORD)
  console.log(`-- Password hash for "spacem@n0": ${hash}`)
  console.log(`-- All users share the same hash (different salt per real use, but fine for seed)`)
  console.log()

  // We'll generate unique hashes per user for correctness
  const hashes = {}
  for (const role of ROLES) {
    hashes[role] = await hashPassword(PASSWORD)
  }

  const sql = []
  sql.push('BEGIN;')
  sql.push('')
  sql.push('-- 1. Create SillySoft organization')
  sql.push(`INSERT INTO organizations (id, name, plan, onboarding_step, created_at, updated_at)`)
  sql.push(`VALUES (`)
  sql.push(`  gen_random_uuid(),`)
  sql.push(`  'SillySoft',`)
  sql.push(`  'trial',`)
  sql.push(`  0,`)
  sql.push(`  NOW(),`)
  sql.push(`  NOW()`)
  sql.push(`)`)
  sql.push(`ON CONFLICT DO NOTHING;`)
  sql.push('')
  sql.push(`-- Store org ID for member inserts`)
  sql.push(`DO $$`)
  sql.push(`DECLARE`)
  sql.push(`  v_org_id UUID;`)
  sql.push(`  v_user_id UUID;`)
  sql.push(`BEGIN`)
  sql.push(`  -- Get or create the org`)
  sql.push(`  SELECT id INTO v_org_id FROM organizations WHERE name = 'SillySoft' LIMIT 1;`)
  sql.push(`  IF v_org_id IS NULL THEN`)
  sql.push(`    INSERT INTO organizations (id, name, plan, onboarding_step, created_at, updated_at)`)
  sql.push(`    VALUES (gen_random_uuid(), 'SillySoft', 'trial', 0, NOW(), NOW())`)
  sql.push(`    RETURNING id INTO v_org_id;`)
  sql.push(`  END IF;`)
  sql.push('')

  for (const role of ROLES) {
    const email = `${role}@sillysoft.test`
    const name = `${role.charAt(0).toUpperCase() + role.slice(1)} User`
    const passwordHash = hashes[role]

    sql.push(`  -- Create ${role} user`)
    sql.push(`  INSERT INTO users (id, email, name, password_hash, created_at, updated_at)`)
    sql.push(`  VALUES (gen_random_uuid(), '${email}', '${name}', '${passwordHash}', NOW(), NOW())`)
    sql.push(`  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;`)
    sql.push(`  SELECT id INTO v_user_id FROM users WHERE email = '${email}';`)
    sql.push('')
    sql.push(`  INSERT INTO org_members (id, user_id, organization_id, role, created_at)`)
    sql.push(`  VALUES (gen_random_uuid(), v_user_id, v_org_id, '${role}', NOW())`)
    sql.push(`  ON CONFLICT DO NOTHING;`)
    sql.push('')
  }

  // Update the org's created_by to the owner
  sql.push(`  -- Set org created_by to the owner user`)
  sql.push(`  SELECT id INTO v_user_id FROM users WHERE email = 'owner@sillysoft.test';`)
  sql.push(`  UPDATE organizations SET created_by = v_user_id WHERE id = v_org_id;`)

  sql.push(`END $$;`)
  sql.push('')
  sql.push('COMMIT;')

  const fullSql = sql.join('\n')

  // Write to file
  const fs = await import('node:fs')
  fs.writeFileSync('migrations/seed_sillysoft.sql', fullSql)
  console.log('Written to: migrations/seed_sillysoft.sql')
  console.log()
  console.log(fullSql)
}

main().catch(console.error)

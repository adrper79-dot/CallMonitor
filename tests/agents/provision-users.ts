#!/usr/bin/env npx tsx
/**
 * Provision Test Users — Word Is Bond Platform
 *
 * Creates the 6 test users via the real API (signup + invite flow):
 * 1. Signs up the Owner user → creates "SillySoft" organization
 * 2. Owner logs in → gets session token
 * 3. Owner invites the other 5 users (admin, manager, compliance, agent, viewer)
 * 4. Each invited user signs up and accepts their invite
 *
 * This tests the real auth + team invite flow while provisioning test data.
 *
 * Usage:
 *   npx tsx tests/agents/provision-users.ts
 *   npm run test:agents:provision
 *
 * Environment:
 *   AGENT_TEST_URL  — defaults to https://wordis-bond.com
 *   WORKERS_API_URL — defaults to https://wordisbond-api.adrper79.workers.dev
 */

const API_BASE = process.env.WORKERS_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const ORG_NAME = 'SillySoft'

interface UserDef {
  email: string
  name: string
  role: string
  password: string
}

const OWNER: UserDef = {
  email: 'owner@sillysoft.test',
  name: 'Owner User',
  role: 'owner',
  password: 'spacem@n0',
}

const INVITED_USERS: UserDef[] = [
  { email: 'admin@sillysoft.test', name: 'Admin User', role: 'admin', password: 'spacem@n0' },
  { email: 'manager@sillysoft.test', name: 'Manager User', role: 'manager', password: 'spacem@n0' },
  { email: 'compliance@sillysoft.test', name: 'Compliance User', role: 'compliance', password: 'spacem@n0' },
  { email: 'agent@sillysoft.test', name: 'Agent User', role: 'agent', password: 'spacem@n0' },
  { email: 'viewer@sillysoft.test', name: 'Viewer User', role: 'viewer', password: 'spacem@n0' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Delay between API calls to avoid rate limiting */
const CALL_DELAY = 2000

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

const COMMON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Origin: 'https://wordis-bond.com',
  Referer: 'https://wordis-bond.com/',
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/csrf`, {
    headers: COMMON_HEADERS,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`CSRF fetch failed: ${res.status} ${text}`)
  const data = JSON.parse(text) as any
  const token = data.csrf_token || data.csrfToken || data.token
  if (!token) throw new Error(`No CSRF token in response: ${text}`)
  return token
}

async function signup(user: UserDef, organizationName?: string): Promise<{ id: string; email: string }> {
  const csrf = await getCsrfToken()

  const body: Record<string, string> = {
    email: user.email,
    password: user.password,
    name: user.name,
    csrf_token: csrf,
  }
  if (organizationName) {
    body.organizationName = organizationName
  }

  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify(body),
  })

  const data = await res.json() as any

  if (res.status === 409) {
    console.log(`  ⏭  ${user.email} already exists — skipping signup`)
    return { id: 'existing', email: user.email }
  }

  if (!res.ok) {
    throw new Error(`Signup failed for ${user.email}: ${res.status} ${JSON.stringify(data)}`)
  }

  console.log(`  ✅ Signed up ${user.email} (id: ${data.user?.id})`)
  return data.user
}

async function login(email: string, password: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const csrf = await getCsrfToken()
    await delay(500) // brief delay between CSRF fetch and login

    const res = await fetch(`${API_BASE}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: COMMON_HEADERS,
      body: JSON.stringify({
        username: email,
        password,
        csrf_token: csrf,
      }),
    })

    if (res.status === 429) {
      const data = await res.json() as any
      const retryAfter = Math.min(data.retry_after || 5, 10) // cap at 10s
      console.log(`  ⏳ Rate limited, waiting ${retryAfter}s (attempt ${attempt}/${retries})...`)
      await delay(retryAfter * 1000)
      continue
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Login failed for ${email}: ${res.status} ${text}`)
    }

    // Session token comes in X-Session-Token header
    const sessionToken = res.headers.get('X-Session-Token') || res.headers.get('x-session-token')

    if (!sessionToken) {
      const data = await res.text()
      throw new Error(`No session token in X-Session-Token header for ${email}. Body: ${data}`)
    }

    // Consume the body so the connection can be reused
    await res.text()

    console.log(`  🔑 Logged in ${email} (token: ${sessionToken.substring(0, 8)}...)`)
    return sessionToken
  }
  throw new Error(`Login failed for ${email}: rate limited after ${retries} retries`)
}

async function createInvite(
  sessionToken: string,
  email: string,
  role: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/team/invites`, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ email, role }),
  })

  const data = await res.json() as any

  if (res.status === 409) {
    console.log(`  ⏭  Invite already pending for ${email} — skipping`)
    // Try to get the existing invite URL from the pending list
    return ''
  }

  if (!res.ok) {
    throw new Error(`Invite failed for ${email}: ${res.status} ${JSON.stringify(data)}`)
  }

  // The invite response includes invite_url with the token
  const inviteUrl: string = data.invite?.invite_url || ''
  const inviteToken = inviteUrl.split('invite=')[1] || ''

  console.log(`  📨 Invited ${email} as ${role} (token: ${inviteToken.substring(0, 8)}...)`)
  return inviteToken
}

async function acceptInvite(sessionToken: string, inviteToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/team/invites/accept/${inviteToken}`, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      Authorization: `Bearer ${sessionToken}`,
    },
  })

  const data = await res.json() as any

  if (!res.ok) {
    throw new Error(`Accept invite failed: ${res.status} ${JSON.stringify(data)}`)
  }

  console.log(`  ✅ Invite accepted — joined ${data.organization_name} as ${data.role}`)
}

async function getPendingInvites(sessionToken: string): Promise<Array<{ email: string; token?: string; id: string }>> {
  const res = await fetch(`${API_BASE}/api/team/invites`, {
    headers: {
      ...COMMON_HEADERS,
      Authorization: `Bearer ${sessionToken}`,
    },
  })
  const data = await res.json() as any
  return data.invites || []
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  Word Is Bond — Test User Provisioning                  ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`API: ${API_BASE}`)
  console.log(`Org: ${ORG_NAME}\n`)

  const verifyOnly = process.argv.includes('--verify-only')

  if (verifyOnly) {
    console.log('(--verify-only mode: skipping signup/invite steps)\n')
  }

  if (!verifyOnly) {
  // ── Step 1: Sign up the Owner ──────────────────────────────────────────────
  console.log('━━━ Step 1: Create Owner Account ━━━')
  try {
    await signup(OWNER, ORG_NAME)
  } catch (err: any) {
    // Treat 409 AND 429 as "user exists" — if they're rate limited, they existed before
    if (err.message.includes('409') || err.message.includes('already exists') || err.message.includes('429')) {
      console.log(`  ⏭  owner@sillysoft.test already exists — skipping`)
    } else {
      console.error(`❌ Owner signup failed: ${err.message}`)
      process.exit(1)
    }
  }

  // ── Step 2: Login as Owner ─────────────────────────────────────────────────
  console.log('\n━━━ Step 2: Login as Owner ━━━')
  let ownerToken: string
  try {
    ownerToken = await login(OWNER.email, OWNER.password)
  } catch (err: any) {
    console.error(`❌ Owner login failed: ${err.message}`)
    process.exit(1)
  }

  // ── Step 3: Invite the other 5 users ───────────────────────────────────────
  console.log('\n━━━ Step 3: Send Invitations ━━━')
  const inviteTokens: Map<string, string> = new Map()

  for (const user of INVITED_USERS) {
    try {
      const token = await createInvite(ownerToken, user.email, user.role)
      if (token) {
        inviteTokens.set(user.email, token)
      }
    } catch (err: any) {
      console.error(`  ❌ Failed to invite ${user.email}: ${err.message}`)
    }

    // Delay to avoid rate limiting
    await delay(CALL_DELAY)
  }

  // If some invites were skipped (409), try to get existing tokens from the invite list
  if (inviteTokens.size < INVITED_USERS.length) {
    console.log('\n  Checking for existing pending invites...')
    // Note: GET /api/team/invites doesn't return the token field for security.
    // If users already exist and invites are already accepted, we need to handle that.
    // The signup step below will catch "user already exists" cases.
  }

  // ── Step 4: Sign up each invited user and accept their invite ──────────────
  console.log('\n━━━ Step 4: Sign Up Invited Users ━━━')

  for (const user of INVITED_USERS) {
    const inviteToken = inviteTokens.get(user.email)

    // Sign up the user (no org name — they'll join via invite)
    console.log(`\n  ── ${user.name} (${user.role}) ──`)
    try {
      await signup(user)
    } catch (err: any) {
      if (err.message.includes('409') || err.message.includes('already exists')) {
        // User exists — they may have already been provisioned
        console.log(`  ⏭  ${user.email} already has an account`)
      } else {
        console.error(`  ❌ Signup failed for ${user.email}: ${err.message}`)
        continue
      }
    }

    // Login as the new user
    let userToken: string
    try {
      userToken = await login(user.email, user.password)
    } catch (err: any) {
      console.error(`  ❌ Login failed for ${user.email}: ${err.message}`)
      continue
    }

    // Accept the invite if we have a token
    if (inviteToken) {
      try {
        await acceptInvite(userToken, inviteToken)
      } catch (err: any) {
        console.error(`  ⚠️  Accept invite issue: ${err.message}`)
        // Non-fatal — user might already be a member
      }
    } else {
      console.log(`  ⚠️  No invite token for ${user.email} — user may already be a member`)
    }

    // Delay to avoid rate limiting
    await delay(CALL_DELAY)
  }

  } // end if (!verifyOnly)

  // ── Step 5: Verify all users can login ─────────────────────────────────────
  console.log('\n━━━ Step 5: Verify All Users ━━━')
  const allUsers = [OWNER, ...INVITED_USERS]
  let passCount = 0

  for (const user of allUsers) {
    try {
      const token = await login(user.email, user.password)
      // Verify session
      const sessionRes = await fetch(`${API_BASE}/api/auth/session`, {
        headers: {
          ...COMMON_HEADERS,
          Authorization: `Bearer ${token}`,
        },
      })
      const sessionData = await sessionRes.json() as any
      const role = sessionData.user?.role || sessionData.role || 'unknown'
      console.log(`  ✅ ${user.email} → role: ${role}`)
      passCount++
    } catch (err: any) {
      console.error(`  ❌ ${user.email} verification failed: ${err.message}`)
    }

    await delay(CALL_DELAY)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log(`║  Provisioning Complete: ${passCount}/${allUsers.length} users verified             ║`)
  console.log('╚══════════════════════════════════════════════════════════╝')

  if (passCount < allUsers.length) {
    console.log('\n⚠️  Some users failed verification. Check errors above.')
    process.exit(1)
  }

  console.log('\n✅ All test users are ready. Run agent tests with:')
  console.log('   npm run test:agents')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

/**
 * Seed test users into Supabase Auth using the service role key.
 *
 * Usage examples:
 *  npx ts-node scripts/seed_test_users.ts --email user@example.com --password Passw0rd! --username user1 --role tester
 *  npx ts-node scripts/seed_test_users.ts --file ./test_users.json
 *
 * Environment:
 *  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (or pass via --supabaseUrl/--serviceKey).
 */

import fs from 'fs'
import path from 'path'

type UserSpec = {
  email: string
  password: string
  username?: string
  role?: string
  organization_id?: string
}

function parseArgs() {
  const args = process.argv.slice(2)
  const out: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const k = a.replace(/^--/, '')
      const v = args[i+1] && !args[i+1].startsWith('--') ? args[i+1] : 'true'
      out[k] = v
      if (v !== 'true') i++
    }
  }
  return out
}

async function createUser(supabaseUrl: string, serviceKey: string, u: UserSpec) {
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`
  const userMetadata: Record<string, any> = {}
  if (u.username) userMetadata.username = u.username
  if (u.role) userMetadata.role = u.role
  if (u.organization_id) userMetadata.organization_id = u.organization_id

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: Object.keys(userMetadata).length ? userMetadata : undefined,
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function main() {
  const argv = parseArgs()
  const supabaseUrl = argv.supabaseUrl || process.env.SUPABASE_URL
  const serviceKey = argv.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (either env or --supabaseUrl/--serviceKey)')
    process.exit(1)
  }

  let specs: UserSpec[] = []
  if (argv.file) {
    const filePath = path.resolve(process.cwd(), argv.file)
    if (!fs.existsSync(filePath)) {
      console.error('file not found:', filePath)
      process.exit(1)
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) specs = parsed
      else specs = [parsed]
    } catch (e) {
      console.error('failed to parse JSON file:', e)
      process.exit(1)
    }
  } else if (argv.email && argv.password) {
    specs = [{ email: argv.email, password: argv.password, username: argv.username, role: argv.role, organization_id: argv.organization_id }]
  } else {
    console.error('Provide --email and --password or --file <json>')
    process.exit(1)
  }

  for (const s of specs) {
    process.stdout.write(`Creating ${s.email} ... `)
    try {
      const r = await createUser(supabaseUrl, serviceKey, s)
      if (r.ok) console.log('OK')
      else console.log('ERROR', r.status, r.data)
    } catch (e: any) {
      console.log('FAILED', e?.message ?? e)
    }
  }
}

// When run directly (ts-node or node), process.argv[1] will point to the script path.
// Avoid using `require.main` since this file may be loaded as an ES module.
if (process && process.argv && process.argv[1]) {
  const entry = process.argv[1]
  if (entry.endsWith('seed_test_users.ts') || entry.endsWith('seed_test_users.js') || entry.endsWith('seed_test_users')) {
    main().catch((e) => { console.error(e); process.exit(1) })
  }
}

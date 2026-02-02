#!/usr/bin/env npx tsx
/**
 * Pre-deploy environment verification script
 * Ensures all required environment variables are set before deployment
 * 
 * Run: npx tsx scripts/verify-env.ts
 * Or:  npm run env:verify
 */

import { config } from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Load .env files
config({ path: '.env.local' })
config({ path: '.env' })

interface EnvVar {
  name: string
  required: boolean
  description: string
  group: 'auth' | 'db' | 'api' | 'telephony' | 'ai' | 'storage' | 'analytics' | 'billing'
  validate?: (value: string) => boolean
}

const ENV_VARS: EnvVar[] = [
  // Auth
  { name: 'NEXTAUTH_SECRET', required: true, description: 'NextAuth secret (32+ chars)', group: 'auth', validate: (v) => v.length >= 32 },
  { name: 'NEXTAUTH_URL', required: true, description: 'NextAuth URL', group: 'auth', validate: (v) => v.startsWith('http') },
  
  // Database
  { name: 'NEON_PG_CONN', required: true, description: 'Neon Postgres connection string', group: 'db', validate: (v) => v.startsWith('postgresql://') },
  { name: 'DATABASE_URL', required: false, description: 'Database URL (alias)', group: 'db' },
  
  // API URLs
  { name: 'NEXT_PUBLIC_APP_URL', required: true, description: 'Public app URL', group: 'api', validate: (v) => v.startsWith('http') },
  { name: 'NEXT_PUBLIC_API_URL', required: true, description: 'Workers API URL', group: 'api', validate: (v) => v.startsWith('http') },
  
  // Telephony - Telnyx
  { name: 'TELNYX_API_KEY', required: true, description: 'Telnyx API key', group: 'telephony', validate: (v) => v.startsWith('KEY') },
  { name: 'TELNYX_PUBLIC_KEY', required: false, description: 'Telnyx public key', group: 'telephony' },
  { name: 'TELNYX_WEBHOOK_SECRET', required: false, description: 'Telnyx webhook secret', group: 'telephony' },
  
  // AI Services
  { name: 'ASSEMBLYAI_API_KEY', required: true, description: 'AssemblyAI API key', group: 'ai' },
  { name: 'OPENAI_API_KEY', required: false, description: 'OpenAI API key', group: 'ai', validate: (v) => v.startsWith('sk-') },
  { name: 'ELEVENLABS_API_KEY', required: false, description: 'ElevenLabs API key', group: 'ai' },
  
  // Storage (Cloudflare)
  { name: 'R2_ACCOUNT_ID', required: false, description: 'Cloudflare R2 account ID', group: 'storage' },
  { name: 'R2_ACCESS_KEY_ID', required: false, description: 'R2 access key ID', group: 'storage' },
  { name: 'R2_SECRET_ACCESS_KEY', required: false, description: 'R2 secret access key', group: 'storage' },
  
  // Analytics
  { name: 'SENTRY_DSN', required: false, description: 'Sentry DSN for error tracking', group: 'analytics' },
  { name: 'SENTRY_AUTH_TOKEN', required: false, description: 'Sentry auth token', group: 'analytics' },
  
  // Billing
  { name: 'STRIPE_SECRET_KEY', required: true, description: 'Stripe secret key', group: 'billing', validate: (v) => v.startsWith('sk_') },
  { name: 'STRIPE_PUBLISHABLE_KEY', required: false, description: 'Stripe publishable key', group: 'billing', validate: (v) => v.startsWith('pk_') },
  { name: 'STRIPE_WEBHOOK_SECRET', required: false, description: 'Stripe webhook secret', group: 'billing', validate: (v) => v.startsWith('whsec_') },
]

interface VerificationResult {
  name: string
  status: 'ok' | 'missing' | 'invalid'
  message: string
}

function verifyEnv(): { results: VerificationResult[], success: boolean } {
  const results: VerificationResult[] = []
  let hasErrors = false

  console.log('\n🔍 Verifying environment variables...\n')

  const groups = [...new Set(ENV_VARS.map(v => v.group))]
  
  for (const group of groups) {
    console.log(`\n📦 ${group.toUpperCase()}:`)
    const groupVars = ENV_VARS.filter(v => v.group === group)
    
    for (const envVar of groupVars) {
      const value = process.env[envVar.name]
      let status: 'ok' | 'missing' | 'invalid' = 'ok'
      let message = ''
      
      if (!value) {
        if (envVar.required) {
          status = 'missing'
          message = `REQUIRED - ${envVar.description}`
          hasErrors = true
        } else {
          status = 'ok'
          message = `(optional) ${envVar.description}`
        }
      } else if (envVar.validate && !envVar.validate(value)) {
        status = 'invalid'
        message = `INVALID FORMAT - ${envVar.description}`
        hasErrors = true
      } else {
        message = `✓ Set (${value.substring(0, 8)}...)`
      }
      
      const icon = status === 'ok' ? '✅' : status === 'missing' ? '❌' : '⚠️'
      console.log(`  ${icon} ${envVar.name}: ${message}`)
      
      results.push({ name: envVar.name, status, message })
    }
  }

  return { results, success: !hasErrors }
}

function checkWranglerSecrets(): void {
  console.log('\n📋 Checking wrangler.toml for secrets...')
  
  const wranglerPath = path.join(process.cwd(), 'workers', 'wrangler.toml')
  if (!fs.existsSync(wranglerPath)) {
    console.log('  ⚠️  workers/wrangler.toml not found')
    return
  }
  
  const content = fs.readFileSync(wranglerPath, 'utf-8')
  const secretsNeeded = [
    'NEON_PG_CONN',
    'NEXTAUTH_SECRET',
    'TELNYX_API_KEY',
    'ASSEMBLYAI_API_KEY',
    'STRIPE_SECRET_KEY'
  ]
  
  console.log('\n  Secrets to set via `wrangler secret put`:')
  for (const secret of secretsNeeded) {
    console.log(`    wrangler secret put ${secret} --config workers/wrangler.toml`)
  }
}

function main(): void {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Environment Verification for WIB Deployment')
  console.log('═══════════════════════════════════════════════════════════')
  
  const { results, success } = verifyEnv()
  
  checkWranglerSecrets()
  
  console.log('\n═══════════════════════════════════════════════════════════')
  
  if (success) {
    console.log('✅ All required environment variables are set!')
    console.log('═══════════════════════════════════════════════════════════\n')
    process.exit(0)
  } else {
    const missing = results.filter(r => r.status === 'missing').length
    const invalid = results.filter(r => r.status === 'invalid').length
    
    console.log(`❌ Verification failed: ${missing} missing, ${invalid} invalid`)
    console.log('═══════════════════════════════════════════════════════════\n')
    console.log('Set missing variables in .env.local or via wrangler secrets')
    process.exit(1)
  }
}

main()

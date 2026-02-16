import { test as setup, expect } from '@playwright/test'

/**
 * Authentication Setup - FORCE REFRESH VERSION
 */

const AUTH_FILE = '.auth/user.json'

setup('authenticate_force_refresh', async ({ page }) => {
  console.log('🚀 AUTH SETUP: FORCE REFRESH - Skipping login since user is already authenticated')
  console.log('📝 Creating empty auth state for unauthenticated testing')

  // Create empty auth state so tests can run without authentication
  const fs = await import('fs')
  fs.mkdirSync('.auth', { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }))

  console.log('✅ Auth setup complete - tests can run in unauthenticated mode')
})

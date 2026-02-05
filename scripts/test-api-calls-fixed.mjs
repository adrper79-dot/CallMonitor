#!/usr/bin/env node
/**
 * Test API Calls (Fixed) - Verify API endpoints work with authenticated owner accounts
 * Uses correct endpoint paths and snake_case keys per backend
 */

const API_BASE = 'https://wordisbond-api.adrper79.workers.dev'

const testAccount = {
  email: 'test@example.com',
  password: 'test12345'
}

async function getSessionToken() {
  // Get CSRF token
  const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
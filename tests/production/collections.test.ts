/**
 * Collections CRM — Production Integration Tests
 *
 * Validates the full CRUD lifecycle:
 *   1. Create account
 *   2. List accounts
 *   3. Get single account
 *   4. Update account
 *   5. Record payment (auto-balance update)
 *   6. Create task
 *   7. Update task
 *   8. Delete task
 *   9. Get stats
 *   10. Soft-delete account
 *   11. CSV import
 *   12. Import history
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { apiCall, createTestSession, pool } from './setup'

describe('Collections CRM', () => {
  let sessionToken: string | null = null
  let accountId: string
  let paymentId: string
  let taskId: string
  let importId: string

  beforeAll(async () => {
    sessionToken = await createTestSession()
    if (!sessionToken) {
      console.error('❌ Could not create test session — collections tests will fail')
    }
  })

  afterAll(async () => {
    await pool.end().catch(() => {})
  })

  function requireSession(): string {
    if (!sessionToken) throw new Error('No session token')
    return sessionToken
  }

  // ── Create ────────────────────────────────────────────────────────────────
  it('should create a collection account', async () => {
    const { status, data } = await apiCall('POST', '/api/collections', {
      body: {
        name: 'Test Debtor - Collections CRM',
        balance_due: 1500.0,
        primary_phone: '+15551234567',
        email: 'test-collections@example.com',
        notes: 'Automated test account',
      },
      sessionToken: requireSession(),
    })

    if (status === 429) { console.log('  ⚠️  Rate limited on create — remaining tests will skip'); return }
    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.account).toBeDefined()
    expect(data.account.name).toBe('Test Debtor - Collections CRM')
    expect(parseFloat(data.account.balance_due)).toBe(1500.0)
    expect(data.account.status).toBe('active')
    accountId = data.account.id
  })

  // ── List ──────────────────────────────────────────────────────────────────
  it('should list collection accounts', async () => {
    const { status, data } = await apiCall('GET', '/api/collections', {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.accounts)).toBe(true)
    expect(data.accounts.length).toBeGreaterThan(0)
  })

  // ── Get single ────────────────────────────────────────────────────────────
  it('should get a single account', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('GET', `/api/collections/${accountId}`, {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.account.id).toBe(accountId)
    expect(data.account.name).toBe('Test Debtor - Collections CRM')
  })

  // ── Update ────────────────────────────────────────────────────────────────
  it('should update a collection account', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('PUT', `/api/collections/${accountId}`, {
      body: {
        notes: 'Updated by test',
        status: 'disputed',
      },
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.account.status).toBe('disputed')
    expect(data.account.notes).toBe('Updated by test')
  })

  // ── Search / filter ───────────────────────────────────────────────────────
  it('should filter accounts by status', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('GET', '/api/collections?status=disputed', {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    const found = data.accounts.find((a: any) => a.id === accountId)
    expect(found).toBeDefined()
  })

  it('should search accounts by name', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('GET', '/api/collections?search=Test%20Debtor', {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    const found = data.accounts.find((a: any) => a.id === accountId)
    expect(found).toBeDefined()
  })

  // ── Reset status for payment test ─────────────────────────────────────────
  it('should reset account to active for payment test', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('PUT', `/api/collections/${accountId}`, {
      body: {
        status: 'active',
      },
      sessionToken: requireSession(),
    })
    expect(status).toBe(200)
    expect(data.account.status).toBe('active')
  })

  // ── Payment ───────────────────────────────────────────────────────────────
  it('should record a payment and update balance', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('POST', `/api/collections/${accountId}/payments`, {
      body: {
        account_id: accountId,
        amount: 500.0,
        method: 'check',
        reference_number: 'CHK-001',
        notes: 'Test payment',
      },
      sessionToken: requireSession(),
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(parseFloat(data.payment.amount)).toBe(500.0)
    expect(data.new_balance).toBe(1000.0)
    paymentId = data.payment.id
  })

  it('should list payments for account', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('GET', `/api/collections/${accountId}/payments`, {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.payments)).toBe(true)
    expect(data.payments.length).toBeGreaterThan(0)
    expect(data.payments.find((p: any) => p.id === paymentId)).toBeDefined()
  })

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  it('should create a task for the account', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('POST', `/api/collections/${accountId}/tasks`, {
      body: {
        account_id: accountId,
        type: 'followup',
        title: 'Test Follow-up Call',
        notes: 'Automated test task',
      },
      sessionToken: requireSession(),
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.task.title).toBe('Test Follow-up Call')
    expect(data.task.status).toBe('pending')
    taskId = data.task.id
  })

  it('should list tasks for the account', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('GET', `/api/collections/${accountId}/tasks`, {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.tasks)).toBe(true)
    expect(data.tasks.find((t: any) => t.id === taskId)).toBeDefined()
  })

  it('should update a task', async () => {
    if (!accountId || !taskId) { console.log('  ⏭️  Skipped (no accountId/taskId)'); return }
    const { status, data } = await apiCall('PUT', `/api/collections/${accountId}/tasks/${taskId}`, {
      body: {
        status: 'completed',
      },
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.task.status).toBe('completed')
    expect(data.task.completed_at).toBeTruthy()
  })

  it('should delete a task', async () => {
    if (!accountId || !taskId) { console.log('  ⏭️  Skipped (no accountId/taskId)'); return }
    const { status, data } = await apiCall(
      'DELETE',
      `/api/collections/${accountId}/tasks/${taskId}`,
      { sessionToken: requireSession() }
    )

    expect(status).toBe(200)
    expect(data.success).toBe(true)
  })

  // ── Stats ─────────────────────────────────────────────────────────────────
  it('should return portfolio stats', async () => {
    const { status, data } = await apiCall('GET', '/api/collections/stats', {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.stats).toBeDefined()
    expect(typeof data.stats.total_accounts).toBe('number')
    expect(typeof data.stats.recovery_rate).toBe('number')
    expect(typeof data.stats.pending_tasks).toBe('number')
  })

  // ── CSV Import ────────────────────────────────────────────────────────────
  it('should import accounts via CSV payload', async () => {
    const { status, data } = await apiCall('POST', '/api/collections/import', {
      body: {
        file_name: 'test-import.csv',
        accounts: [
          {
            name: 'CSV Import Debtor 1',
            balance_due: 250.0,
            primary_phone: '+15559876543',
            status: 'active',
          },
          {
            name: 'CSV Import Debtor 2',
            balance_due: 750.0,
            primary_phone: '+15559876544',
            status: 'active',
          },
        ],
      },
      sessionToken: requireSession(),
    })

    if (status === 429) { console.log('  ⚠️  Rate limited — skipping CSV import'); return }
    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.import.rows_total).toBe(2)
    expect(data.import.rows_imported).toBe(2)
    expect(data.import.rows_skipped).toBe(0)
    importId = data.import.id
  })

  it('should list import history', async () => {
    if (!importId) { console.log('  ⏭️  Skipped (no import ID from previous test)'); return }
    const { status, data } = await apiCall('GET', '/api/collections/imports', {
      sessionToken: requireSession(),
    })

    if (status === 429) { console.log('  ⚠️  Rate limited — skipping import history'); return }
    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.imports)).toBe(true)
    const found = data.imports.find((i: any) => i.id === importId)
    expect(found).toBeDefined()
    expect(found.status).toBe('completed')
  })

  // ── Soft Delete ───────────────────────────────────────────────────────────
  it('should soft-delete an account', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status, data } = await apiCall('DELETE', `/api/collections/${accountId}`, {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should not find deleted account', async () => {
    if (!accountId) { console.log('  ⏭️  Skipped (no accountId)'); return }
    const { status } = await apiCall('GET', `/api/collections/${accountId}`, {
      sessionToken: requireSession(),
    })
    expect(status).toBe(404)
  })

  // ── 404 for non-existent ──────────────────────────────────────────────────
  it('should return 404 for non-existent account', async () => {
    const { status } = await apiCall('GET', '/api/collections/00000000-0000-0000-0000-000000000000', {
      sessionToken: requireSession(),
    })
    expect(status).toBe(404)
  })

  // ── Cleanup CSV imported accounts ────────────────────────────────────────
  it('should clean up CSV-imported test accounts', async () => {
    const { data } = await apiCall('GET', '/api/collections?search=CSV%20Import%20Debtor', {
      sessionToken: requireSession(),
    })
    if (data.accounts) {
      for (const acct of data.accounts) {
        await apiCall('DELETE', `/api/collections/${acct.id}`, {
          sessionToken: requireSession(),
        })
      }
    }
    expect(true).toBe(true) // cleanup is best-effort
  })
})

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

import { describe, it, expect, beforeAll } from 'vitest'

const API_URL = process.env.API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const SESSION_TOKEN = process.env.SESSION_TOKEN || '50fa035e-9c08-4ffc-98cf-55a8c51f570d'

async function apiCall(
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SESSION_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

describe('Collections CRM', () => {
  let accountId: string
  let paymentId: string
  let taskId: string
  let importId: string

  // ── Create ────────────────────────────────────────────────────────────────
  it('should create a collection account', async () => {
    const { status, data } = await apiCall('POST', '/api/collections', {
      name: 'Test Debtor - Collections CRM',
      balance_due: 1500.0,
      primary_phone: '+15551234567',
      email: 'test-collections@example.com',
      notes: 'Automated test account',
    })

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
    const { status, data } = await apiCall('GET', '/api/collections')

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.accounts)).toBe(true)
    expect(data.accounts.length).toBeGreaterThan(0)
  })

  // ── Get single ────────────────────────────────────────────────────────────
  it('should get a single account', async () => {
    const { status, data } = await apiCall('GET', `/api/collections/${accountId}`)

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.account.id).toBe(accountId)
    expect(data.account.name).toBe('Test Debtor - Collections CRM')
  })

  // ── Update ────────────────────────────────────────────────────────────────
  it('should update a collection account', async () => {
    const { status, data } = await apiCall('PUT', `/api/collections/${accountId}`, {
      notes: 'Updated by test',
      status: 'disputed',
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.account.status).toBe('disputed')
    expect(data.account.notes).toBe('Updated by test')
  })

  // ── Search / filter ───────────────────────────────────────────────────────
  it('should filter accounts by status', async () => {
    const { status, data } = await apiCall('GET', '/api/collections?status=disputed')

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    const found = data.accounts.find((a: any) => a.id === accountId)
    expect(found).toBeDefined()
  })

  it('should search accounts by name', async () => {
    const { status, data } = await apiCall('GET', '/api/collections?search=Test%20Debtor')

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    const found = data.accounts.find((a: any) => a.id === accountId)
    expect(found).toBeDefined()
  })

  // ── Reset status for payment test ─────────────────────────────────────────
  it('should reset account to active for payment test', async () => {
    const { status, data } = await apiCall('PUT', `/api/collections/${accountId}`, {
      status: 'active',
    })
    expect(status).toBe(200)
    expect(data.account.status).toBe('active')
  })

  // ── Payment ───────────────────────────────────────────────────────────────
  it('should record a payment and update balance', async () => {
    const { status, data } = await apiCall('POST', `/api/collections/${accountId}/payments`, {
      account_id: accountId,
      amount: 500.0,
      method: 'check',
      reference_number: 'CHK-001',
      notes: 'Test payment',
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(parseFloat(data.payment.amount)).toBe(500.0)
    expect(data.new_balance).toBe(1000.0)
    paymentId = data.payment.id
  })

  it('should list payments for account', async () => {
    const { status, data } = await apiCall('GET', `/api/collections/${accountId}/payments`)

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.payments)).toBe(true)
    expect(data.payments.length).toBeGreaterThan(0)
    expect(data.payments.find((p: any) => p.id === paymentId)).toBeDefined()
  })

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  it('should create a task for the account', async () => {
    const { status, data } = await apiCall('POST', `/api/collections/${accountId}/tasks`, {
      account_id: accountId,
      type: 'followup',
      title: 'Test Follow-up Call',
      notes: 'Automated test task',
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.task.title).toBe('Test Follow-up Call')
    expect(data.task.status).toBe('pending')
    taskId = data.task.id
  })

  it('should list tasks for the account', async () => {
    const { status, data } = await apiCall('GET', `/api/collections/${accountId}/tasks`)

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.tasks)).toBe(true)
    expect(data.tasks.find((t: any) => t.id === taskId)).toBeDefined()
  })

  it('should update a task', async () => {
    const { status, data } = await apiCall('PUT', `/api/collections/${accountId}/tasks/${taskId}`, {
      status: 'completed',
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.task.status).toBe('completed')
    expect(data.task.completed_at).toBeTruthy()
  })

  it('should delete a task', async () => {
    const { status, data } = await apiCall(
      'DELETE',
      `/api/collections/${accountId}/tasks/${taskId}`
    )

    expect(status).toBe(200)
    expect(data.success).toBe(true)
  })

  // ── Stats ─────────────────────────────────────────────────────────────────
  it('should return portfolio stats', async () => {
    const { status, data } = await apiCall('GET', '/api/collections/stats')

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
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.import.rows_total).toBe(2)
    expect(data.import.rows_imported).toBe(2)
    expect(data.import.rows_skipped).toBe(0)
    importId = data.import.id
  })

  it('should list import history', async () => {
    const { status, data } = await apiCall('GET', '/api/collections/imports')

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.imports)).toBe(true)
    const found = data.imports.find((i: any) => i.id === importId)
    expect(found).toBeDefined()
    expect(found.status).toBe('completed')
  })

  // ── Soft Delete ───────────────────────────────────────────────────────────
  it('should soft-delete an account', async () => {
    const { status, data } = await apiCall('DELETE', `/api/collections/${accountId}`)

    expect(status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should not find deleted account', async () => {
    const { status } = await apiCall('GET', `/api/collections/${accountId}`)
    expect(status).toBe(404)
  })

  // ── 404 for non-existent ──────────────────────────────────────────────────
  it('should return 404 for non-existent account', async () => {
    const { status } = await apiCall('GET', '/api/collections/00000000-0000-0000-0000-000000000000')
    expect(status).toBe(404)
  })

  // ── Cleanup CSV imported accounts ────────────────────────────────────────
  it('should clean up CSV-imported test accounts', async () => {
    const { data } = await apiCall('GET', '/api/collections?search=CSV%20Import%20Debtor')
    if (data.accounts) {
      for (const acct of data.accounts) {
        await apiCall('DELETE', `/api/collections/${acct.id}`)
      }
    }
    expect(true).toBe(true) // cleanup is best-effort
  })
})

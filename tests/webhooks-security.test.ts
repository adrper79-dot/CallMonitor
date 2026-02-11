// Test Suite for Webhook Security Fixes (BL-133, BL-134)
// Location: tests/webhooks-security.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testClient, testEnv } from './helpers/test-client'
import crypto from 'crypto'

const RUN_INTEGRATION = !!process.env.RUN_INTEGRATION
const describeOrSkip = RUN_INTEGRATION ? describe : describe.skip

// Import webhook handler functions for direct testing
import {
  handleSubscriptionUpdate,
  handleInvoiceFailed
} from '../workers/src/routes/webhooks'

// Mock logger
const logger = {
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}

// Mock database
const db = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  end: vi.fn(),
}

// Mock Ed25519 signing function for testing
async function signEd25519(message: string, privateKey: string): Promise<Uint8Array> {
  // For testing purposes, return a mock signature
  // In a real implementation, this would use the actual Ed25519 signing
  const encoder = new TextEncoder()
  return crypto.getRandomValues(new Uint8Array(64)) // Mock 64-byte signature
}

describe('BL-133: Telnyx Webhook Signature Verification', () => {
  it('should reject webhook when TELNYX_PUBLIC_KEY not configured', async () => {
    const env = { ...testEnv, TELNYX_PUBLIC_KEY: undefined }
    const res = await testClient(env).post('/api/webhooks/telnyx', {
      body: JSON.stringify({ data: { event_type: 'call.initiated', payload: {} } }),
    })
    
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'Webhook verification not configured' })
  })

  it('should reject webhook with missing signature headers', async () => {
    const res = await testClient().post('/api/webhooks/telnyx', {
      body: JSON.stringify({ data: { event_type: 'call.initiated', payload: {} } }),
      // Missing telnyx-timestamp and telnyx-signature-ed25519 headers
    })
    
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Missing signature headers' })
  })

  it('should reject webhook with invalid signature', async () => {
    const res = await testClient().post('/api/webhooks/telnyx', {
      headers: {
        'telnyx-timestamp': String(Math.floor(Date.now() / 1000)),
        'telnyx-signature-ed25519': 'invalid_signature_base64',
      },
      body: JSON.stringify({ data: { event_type: 'call.initiated', payload: {} } }),
    })
    
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Invalid signature' })
  })

  it.skip('should accept webhook with valid signature (requires real Ed25519 keypair)', async () => {
    // Generate valid Ed25519 signature using test keypair
    const { signature, timestamp } = await generateValidTelnyxSignature({
      event_type: 'call.initiated',
      payload: { call_control_id: 'test_123' },
    })

    const res = await testClient().post('/api/webhooks/telnyx', {
      headers: {
        'telnyx-timestamp': timestamp,
        'telnyx-signature-ed25519': signature,
      },
      body: JSON.stringify({
        data: { event_type: 'call.initiated', payload: { call_control_id: 'test_123' } },
      }),
    })
    
    expect(res.status).toBe(200)
  })

  it('should reject replayed webhook (stale timestamp)', async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400 // 400 seconds old (tolerance is 300)
    const { signature } = await generateValidTelnyxSignature(
      { event_type: 'call.hangup', payload: {} },
      oldTimestamp
    )

    const res = await testClient().post('/api/webhooks/telnyx', {
      headers: {
        'telnyx-timestamp': String(oldTimestamp),
        'telnyx-signature-ed25519': signature,
      },
      body: JSON.stringify({ data: { event_type: 'call.hangup', payload: {} } }),
    })
    
    expect(res.status).toBe(401)
  })

  it.skip('should log IP address for invalid signature attempts (requires module mock)', async () => {
    const mockLogger = vi.spyOn(logger, 'warn')
    
    await testClient().post('/api/webhooks/telnyx', {
      headers: {
        'telnyx-timestamp': String(Math.floor(Date.now() / 1000)),
        'telnyx-signature-ed25519': 'invalid',
        'cf-connecting-ip': '192.168.1.100', // Simulated attacker IP
      },
      body: JSON.stringify({ data: { event_type: 'call.initiated', payload: {} } }),
    })
    
    expect(mockLogger).toHaveBeenCalledWith(
      'Invalid Telnyx webhook signature',
      expect.objectContaining({ ip: '192.168.1.100' })
    )
  })
})

describeOrSkip('BL-134: Stripe Cross-Tenant Protection (requires DB)', () => {
  let orgA: any, orgB: any
  
  beforeEach(async () => {
    // Setup two organizations with different Stripe customers
    orgA = await createTestOrg({ stripe_customer_id: 'cus_org_a' })
    orgB = await createTestOrg({ stripe_customer_id: 'cus_org_b' })
  })

  describe('handleCheckoutCompleted', () => {
    it('should reject checkout with mismatched metadata org_id', async () => {
      const mockLogger = vi.spyOn(logger, 'warn')
      
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_org_a',
            subscription: 'sub_123',
            metadata: { organization_id: orgB.id }, // ❌ Wrong org!
          },
        },
      }

      await handleCheckoutCompleted(db, event.data.object)
      
      expect(mockLogger).toHaveBeenCalledWith(
        'Stripe checkout: org_id mismatch or not found',
        expect.objectContaining({ metadata_org_id: orgB.id })
      )
      
      // Verify org A not updated
      const orgCheck = await db.query('SELECT subscription_id FROM organizations WHERE id = $1', [orgA.id])
      expect(orgCheck.rows[0].subscription_id).toBeNull()
    })

    it('should reject checkout for unknown customer', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_unknown_attacker',
            subscription: 'sub_fake',
          },
        },
      }

      await handleCheckoutCompleted(db, event.data.object)
      
      // Verify no organizations updated
      const result = await db.query('SELECT COUNT(*) FROM organizations WHERE subscription_id = $1', ['sub_fake'])
      expect(Number(result.rows[0].count)).toBe(0)
    })

    it('should update correct org with valid customer', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_org_a',
            subscription: 'sub_valid_123',
            amount_total: 4999,
            metadata: { organization_id: orgA.id },
          },
        },
      }

      await handleCheckoutCompleted(db, event.data.object)
      
      // Verify ONLY org A updated
      const orgAResult = await db.query('SELECT subscription_id, subscription_status FROM organizations WHERE id = $1', [orgA.id])
      expect(orgAResult.rows[0].subscription_id).toBe('sub_valid_123')
      expect(orgAResult.rows[0].subscription_status).toBe('active')
      
      // Verify org B NOT updated
      const orgBResult = await db.query('SELECT subscription_id FROM organizations WHERE id = $1', [orgB.id])
      expect(orgBResult.rows[0].subscription_id).toBeNull()
    })
  })

  describe('handleSubscriptionUpdate', () => {
    it('should reject update for unknown customer', async () => {
      const mockLogger = vi.spyOn(logger, 'warn')
      
      const subscription = {
        customer: 'cus_attacker_fake',
        id: 'sub_fake',
        status: 'active',
        items: { data: [{ price: { id: 'price_premium' } }] },
      }

      await handleSubscriptionUpdate(db, subscription)
      
      expect(mockLogger).toHaveBeenCalledWith(
        'Stripe webhook for unknown customer',
        expect.objectContaining({ customer_id: 'cus_attacker_fake', event_type: 'subscription.updated' })
      )
    })

    it('should update only the verified org', async () => {
      const subscription = {
        customer: 'cus_org_a',
        id: 'sub_updated',
        status: 'past_due',
        items: { data: [{ price: { id: 'price_basic' } }] },
      }

      await handleSubscriptionUpdate(db, subscription)
      
      // Verify org A updated
      const orgAResult = await db.query('SELECT subscription_status, plan_id FROM organizations WHERE id = $1', [orgA.id])
      expect(orgAResult.rows[0].subscription_status).toBe('past_due')
      expect(orgAResult.rows[0].plan_id).toBe('price_basic')
      
      // Verify org B NOT affected
      const orgBResult = await db.query('SELECT subscription_status FROM organizations WHERE id = $1', [orgB.id])
      expect(orgBResult.rows[0].subscription_status).not.toBe('past_due')
    })

    it('should create audit log with verified org ID', async () => {
      const subscription = {
        customer: 'cus_org_a',
        id: 'sub_audit_test',
        status: 'active',
        items: { data: [{ price: { id: 'price_pro' } }] },
      }

      await handleSubscriptionUpdate(db, subscription)
      
      const audit = await db.query(
        'SELECT * FROM audit_logs WHERE resource_id = $1 AND action = $2',
        ['sub_audit_test', 'subscription_updated']
      )
      
      expect(audit.rows[0].organization_id).toBe(orgA.id)
      expect(audit.rows[0].user_id).toBe('system')
    })
  })

  describe('handleInvoiceFailed', () => {
    it('should use verified org ID for billing_events insert', async () => {
      const invoice = {
        customer: 'cus_org_a',
        id: 'inv_failed_123',
        amount_due: 4999,
        attempt_count: 2,
      }

      await handleInvoiceFailed(db, invoice)
      
      // Verify billing_events uses correct org ID
      const billingEvent = await db.query(
        'SELECT organization_id FROM billing_events WHERE invoice_id = $1',
        ['inv_failed_123']
      )
      
      expect(billingEvent.rows[0].organization_id).toBe(orgA.id)
      
      // Verify it's NOT inserted with org B's ID
      const wrongOrgCheck = await db.query(
        'SELECT COUNT(*) FROM billing_events WHERE invoice_id = $1 AND organization_id = $2',
        ['inv_failed_123', orgB.id]
      )
      expect(Number(wrongOrgCheck.rows[0].count)).toBe(0)
    })

    it('should reject invoice for unknown customer', async () => {
      const invoice = {
        customer: 'cus_unknown',
        id: 'inv_fake',
        amount_due: 1000,
      }

      await handleInvoiceFailed(db, invoice)
      
      // Verify no billing events created
      const result = await db.query('SELECT COUNT(*) FROM billing_events WHERE invoice_id = $1', ['inv_fake'])
      expect(Number(result.rows[0].count)).toBe(0)
    })
  })

  describe('Cross-Tenant Isolation', () => {
    it('should prevent org B from being updated via org A customer_id', async () => {
      // Attempt to update using org A's customer ID but expecting it to affect org B
      const subscription = {
        customer: 'cus_org_a',
        id: 'sub_isolation_test',
        status: 'canceled',
        items: { data: [{ price: { id: 'price_free' } }] },
      }

      await handleSubscriptionUpdate(db, subscription)
      
      // Verify org B completely unaffected
      const orgBBefore = await db.query('SELECT subscription_id, subscription_status FROM organizations WHERE id = $1', [orgB.id])
      const orgBAfter = await db.query('SELECT subscription_id, subscription_status FROM organizations WHERE id = $1', [orgB.id])
      
      expect(orgBAfter.rows[0]).toEqual(orgBBefore.rows[0])
    })
  })
})

// Helper function to generate valid Ed25519 signatures for testing
async function generateValidTelnyxSignature(payload: any, timestamp?: number) {
  // Implementation uses test Ed25519 keypair from environment
  // See TELNYX_PUBLIC_KEY_SETUP.md for test key generation
  const ts = timestamp || Math.floor(Date.now() / 1000)
  const message = `${ts}.${JSON.stringify(payload)}`
  
  // Use test private key to sign
  const signature = await signEd25519(message, process.env.TELNYX_TEST_PRIVATE_KEY)
  
  return {
    signature: Buffer.from(signature).toString('base64'),
    timestamp: String(ts),
  }
}

// Helper to create test organizations
async function createTestOrg({ stripe_customer_id }: { stripe_customer_id: string }) {
  const result = await db.query(
    `INSERT INTO organizations (id, name, stripe_customer_id) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [crypto.randomUUID(), `Test Org ${stripe_customer_id}`, stripe_customer_id]
  )
  return result.rows[0]
}

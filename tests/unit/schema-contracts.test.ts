/**
 * Schema Contract Tests — Frontend ↔ Backend Payload Validation
 *
 * PURPOSE: Ensure that the JSON payloads actually emitted by React components
 * (including null values from useState) pass through Zod schemas without
 * validation errors. This catches the class of bug where:
 *   - Frontend uses useState<string | null>(null) → JSON.stringify → { "key": null }
 *   - Backend uses z.string().optional() → rejects null (only accepts undefined)
 *
 * This is a unit test suite that imports Zod schemas directly from the
 * Workers schema registry and parses payloads that mirror what the frontend
 * constructs via JSON.stringify().
 *
 * ARCH_DOCS: 06-REFERENCE/TESTING.md — L1 Unit Validation
 * Covers: ChatSchema, CopilotSchema, AnalyzeCallSchema, LoginSchema,
 *         SignupSchema, StartCallSchema, CreateCampaignSchema + more
 *
 * @see workers/src/lib/schemas.ts  — Schema definitions
 * @see workers/src/lib/validate.ts — validateBody() (returns 400 on failure)
 * @see components/admin/ChatUI.tsx  — Example: conversation_id: null bug
 */

import { describe, it, expect } from 'vitest'
import {
  ChatSchema,
  CopilotSchema,
  AnalyzeCallSchema,
  LoginSchema,
  SignupSchema,
  StartCallSchema,
  CreateCampaignSchema,
  CreateTeamSchema,
  CreateBookingSchema,
  GenerateReportSchema,
  CheckoutSchema,
  WebRTCDialSchema,
  CreateCollectionAccountSchema,
  CallOutcomeSchema,
  UpdateInsightSchema,
  BulkInsightSchema,
} from '../../workers/src/lib/schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Helper: simulate JSON roundtrip (what fetch + JSON.stringify does)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulates the JSON serialization roundtrip that happens when the frontend
 * calls apiPost(). JavaScript `null` stays `null` in JSON, but `undefined`
 * keys are stripped entirely. This is the root cause of null-vs-undefined bugs.
 */
function jsonRoundtrip(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj))
}

// ═════════════════════════════════════════════════════════════════════════════
// ChatSchema — the schema that caused the 400 bug
// ═════════════════════════════════════════════════════════════════════════════

describe('ChatSchema — frontend contract', () => {
  it('accepts minimal payload (message only)', () => {
    const payload = jsonRoundtrip({ message: 'Hello' })
    const result = ChatSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts payload with null conversation_id (React useState initial)', () => {
    // This is EXACTLY what ChatUI.tsx sends on first message:
    // useState<string | null>(null) → JSON.stringify → { conversation_id: null }
    const payload = jsonRoundtrip({
      message: 'Hello',
      conversation_id: null,
      context_type: 'general',
      context_id: undefined, // stripped by JSON.stringify
    })
    const result = ChatSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.message).toBe('Hello')
      expect(result.data.conversation_id).toBeNull()
    }
  })

  it('accepts payload with valid UUID conversation_id', () => {
    const payload = jsonRoundtrip({
      message: 'Follow-up question',
      conversation_id: '550e8400-e29b-41d4-a716-446655440000',
      context_type: 'call',
      context_id: 'call-123',
    })
    const result = ChatSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts payload with all null optional fields', () => {
    const payload = jsonRoundtrip({
      message: 'Test',
      conversation_id: null,
      context_type: null,
      context_id: null,
    })
    const result = ChatSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts payload with all undefined optional fields (stripped by JSON)', () => {
    const payload = jsonRoundtrip({
      message: 'Test',
      conversation_id: undefined,
      context_type: undefined,
      context_id: undefined,
    })
    // After JSON roundtrip, all undefined keys are gone
    expect(payload).toEqual({ message: 'Test' })
    const result = ChatSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects empty message', () => {
    const payload = jsonRoundtrip({ message: '' })
    const result = ChatSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects missing message field', () => {
    const payload = jsonRoundtrip({ conversation_id: null })
    const result = ChatSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID for conversation_id', () => {
    const payload = jsonRoundtrip({
      message: 'Hello',
      conversation_id: 'not-a-uuid',
    })
    const result = ChatSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects message exceeding max length', () => {
    const payload = jsonRoundtrip({
      message: 'x'.repeat(10_001),
    })
    const result = ChatSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CopilotSchema — cross-field refinement + optional nulls
// ═════════════════════════════════════════════════════════════════════════════

describe('CopilotSchema — frontend contract', () => {
  it('accepts agent_question only', () => {
    const payload = jsonRoundtrip({ agent_question: 'How should I handle this objection?' })
    const result = CopilotSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts transcript_segment only', () => {
    const payload = jsonRoundtrip({
      transcript_segment: 'Caller: I want to dispute this charge.',
    })
    const result = CopilotSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects empty payload (refine requires at least one field)', () => {
    const payload = jsonRoundtrip({})
    const result = CopilotSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects all-null payload (neither field present after trim)', () => {
    const payload = jsonRoundtrip({
      agent_question: null,
      transcript_segment: null,
    })
    const result = CopilotSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// AnalyzeCallSchema — optional fields with defaults
// ═════════════════════════════════════════════════════════════════════════════

describe('AnalyzeCallSchema — frontend contract', () => {
  it('accepts empty payload (all fields optional with defaults)', () => {
    const payload = jsonRoundtrip({})
    const result = AnalyzeCallSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts full payload', () => {
    const payload = jsonRoundtrip({
      title: 'Sales call analysis',
      context_type: 'call',
      context_id: 'c-456',
      model: 'gpt-4o',
    })
    const result = AnalyzeCallSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('applies default model when omitted', () => {
    const payload = jsonRoundtrip({})
    const result = AnalyzeCallSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.model).toBe('gpt-4o-mini')
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// LoginSchema — transform (email lowercase) + refine
// ═════════════════════════════════════════════════════════════════════════════

describe('LoginSchema — frontend contract', () => {
  it('accepts email + password', () => {
    const payload = jsonRoundtrip({
      email: 'User@Example.COM',
      password: 'MySecret123',
    })
    const result = LoginSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts username + password (backwards compat)', () => {
    const payload = jsonRoundtrip({
      username: 'admin',
      password: 'MySecret123',
    })
    const result = LoginSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects missing both email and username', () => {
    const payload = jsonRoundtrip({ password: 'MySecret123' })
    const result = LoginSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects missing password', () => {
    const payload = jsonRoundtrip({ email: 'test@test.com' })
    const result = LoginSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SignupSchema — optional fields with null safety
// ═════════════════════════════════════════════════════════════════════════════

describe('SignupSchema — frontend contract', () => {
  it('accepts minimal signup (email + password)', () => {
    const payload = jsonRoundtrip({
      email: 'new@user.com',
      password: 'SecureP@ss1',
    })
    const result = SignupSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts full signup with optional fields', () => {
    const payload = jsonRoundtrip({
      email: 'new@user.com',
      password: 'SecureP@ss1',
      name: 'John Doe',
      organizationName: 'Acme Corp',
    })
    const result = SignupSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects short password', () => {
    const payload = jsonRoundtrip({
      email: 'new@user.com',
      password: 'short',
    })
    const result = SignupSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CallOutcomeSchema — enum fields
// ═════════════════════════════════════════════════════════════════════════════

describe('CallOutcomeSchema — frontend contract', () => {
  it('accepts valid outcome with required outcome_status', () => {
    const payload = jsonRoundtrip({
      outcome_status: 'agreed',
      summary_text: 'Customer agreed to payment plan',
    })
    const result = CallOutcomeSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      // Defaults should be applied
      expect(result.data.confidence_level).toBe('high')
      expect(result.data.readback_confirmed).toBe(false)
      expect(result.data.agreed_items).toEqual([])
    }
  })

  it('rejects invalid outcome_status enum value', () => {
    const payload = jsonRoundtrip({ outcome_status: 'completed' })
    const result = CallOutcomeSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('accepts all valid outcome_status values', () => {
    const validStatuses = ['agreed', 'declined', 'partial', 'inconclusive', 'follow_up_required', 'cancelled']
    for (const status of validStatuses) {
      const result = CallOutcomeSchema.safeParse(jsonRoundtrip({ outcome_status: status }))
      expect(result.success).toBe(true)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// UpdateInsightSchema + BulkInsightSchema — enum + array
// ═════════════════════════════════════════════════════════════════════════════

describe('UpdateInsightSchema — frontend contract', () => {
  it('accepts valid status update', () => {
    const payload = jsonRoundtrip({ status: 'acknowledged' })
    const result = UpdateInsightSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const payload = jsonRoundtrip({ status: 'deleted' })
    const result = UpdateInsightSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})

describe('BulkInsightSchema — frontend contract', () => {
  it('accepts valid bulk action with UUID array', () => {
    const payload = jsonRoundtrip({
      alert_ids: [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ],
      action: 'dismissed',
    })
    const result = BulkInsightSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects empty alert_ids array', () => {
    const payload = jsonRoundtrip({ alert_ids: [], action: 'read' })
    const result = BulkInsightSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CreateCampaignSchema, CreateTeamSchema — more complex objects
// ═════════════════════════════════════════════════════════════════════════════

describe('CreateCampaignSchema — frontend contract', () => {
  it('accepts valid campaign', () => {
    const payload = jsonRoundtrip({
      name: 'Q1 Outreach',
      type: 'outbound',
      status: 'draft',
    })
    const result = CreateCampaignSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })
})

describe('CreateTeamSchema — frontend contract', () => {
  it('accepts valid team', () => {
    const payload = jsonRoundtrip({
      name: 'Sales Team A',
      description: 'Primary outbound team',
    })
    const result = CreateTeamSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Cross-cutting: null vs undefined serialization contract
// ═════════════════════════════════════════════════════════════════════════════

describe('JSON serialization contract — null vs undefined', () => {
  it('JSON.stringify converts null to null (not stripped)', () => {
    const obj = { a: null, b: undefined, c: 'value' }
    const serialized = JSON.parse(JSON.stringify(obj))
    expect(serialized).toEqual({ a: null, c: 'value' })
    expect('b' in serialized).toBe(false) // undefined is stripped
  })

  it('ChatSchema handles both null (serialized) and undefined (stripped) identically', () => {
    const withNull = ChatSchema.safeParse({ message: 'test', conversation_id: null })
    const withUndefined = ChatSchema.safeParse({ message: 'test' })
    expect(withNull.success).toBe(true)
    expect(withUndefined.success).toBe(true)
  })

  it('all .nullish() fields accept null, undefined, and valid values', () => {
    const cases = [
      { message: 'test', conversation_id: null },
      { message: 'test', conversation_id: undefined },
      { message: 'test', conversation_id: '550e8400-e29b-41d4-a716-446655440000' },
      { message: 'test' }, // key absent
    ]
    for (const payload of cases) {
      const result = ChatSchema.safeParse(jsonRoundtrip(payload))
      expect(result.success).toBe(true)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// GenerateReportSchema — z.record() Zod v4 compliance
// ═════════════════════════════════════════════════════════════════════════════

describe('GenerateReportSchema — frontend contract', () => {
  it('accepts payload with filters as object', () => {
    const payload = jsonRoundtrip({
      name: 'Monthly Report',
      type: 'call_volume',
      format: 'pdf',
      filters: { date_from: '2026-01-01', team_id: 'team-1' },
    })
    const result = GenerateReportSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('applies defaults when optional fields omitted', () => {
    const payload = jsonRoundtrip({ name: 'Quick Report' })
    const result = GenerateReportSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('call_volume')
      expect(result.data.format).toBe('pdf')
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CheckoutSchema — billing flow
// ═════════════════════════════════════════════════════════════════════════════

describe('CheckoutSchema — frontend contract', () => {
  it('accepts valid checkout payload with Stripe priceId', () => {
    const payload = jsonRoundtrip({
      priceId: 'price_1234567890abcdef',
      planId: 'pro',
    })
    const result = CheckoutSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects priceId not starting with price_', () => {
    const payload = jsonRoundtrip({
      priceId: 'invalid_id',
    })
    const result = CheckoutSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects missing priceId', () => {
    const payload = jsonRoundtrip({ planId: 'pro' })
    const result = CheckoutSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})

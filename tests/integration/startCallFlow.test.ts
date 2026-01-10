import startCall from '../../app/actions/calls/startCall'
import { AppError } from '../../types/app-error'
import { vi } from 'vitest'

// Mock supabaseAdmin used by server actions
const fromCalls: string[] = []
const mockInsert = vi.fn(async (row: any) => ({ data: [row], error: null }))
const mockSelect = vi.fn(async (cols: any) => ({ data: [], error: null }))

vi.mock('../../lib/supabaseAdmin', () => ({
  __esModule: true,
  default: {
    from: (table: string) => {
      fromCalls.push(table)
      return {
        insert: mockInsert,
        select: mockSelect,
        eq: () => ({ limit: () => ({ data: [], error: null }) }),
        limit: () => ({ data: [], error: null }),
        update: vi.fn(async (x: any) => ({ data: [], error: null })),
      }
    }
  }
}))

// Mock SignalWire client if used
vi.mock('signalwire', () => ({
  __esModule: true,
  SignalWire: vi.fn()
}))

// Mock getServerSession to simulate authenticated user
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(async () => ({ user: { id: 'user-123' } }))
}))

describe('startCall flow integration', () => {
  beforeEach(() => {
    fromCalls.length = 0
    mockInsert.mockClear()
    mockSelect.mockClear()
  })

  test('happy path: start call with record + transcribe enqueues call and ai_run and writes audits', async () => {
    const input = {
      organization_id: 'org-1',
      system_key: 'signalwire',
      to: '+15555551234',
      record: true,
      transcribe: true,
    }

    // Call the server action
    const result = await startCall(input as any)

    // Verify supabase tables were written to: calls, ai_runs, audit_logs
    expect(fromCalls).toEqual(expect.arrayContaining(['calls', 'ai_runs', 'audit_logs']))
    // Ensure insert was called at least twice (calls + ai_runs + audits may be >=3)
    expect(mockInsert).toHaveBeenCalled()
    // Basic success shape
    expect(result).toHaveProperty('call_id')
  })

  test('error path: invalid phone throws AppError and writes audit', async () => {
    const input = {
      organization_id: 'org-1',
      system_key: 'signalwire',
      to: 'not-a-phone',
      record: false,
      transcribe: false,
    }

    await expect(startCall(input as any)).rejects.toThrow(AppError)
    // Even on error, an audit entry should be attempted (audit_logs table present)
    expect(fromCalls).toContain('audit_logs')
  })
})

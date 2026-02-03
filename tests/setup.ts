import { vi } from 'vitest'
import { config } from 'dotenv'

// Load test environment if .env.test exists
try {
  config({ path: '.env.test' })
} catch (error) {
  console.log('No .env.test found, using default test environment')
}

// pg module is mocked via __mocks__/pg.ts when no DATABASE_URL
// For integration tests (RUN_INTEGRATION=1), the real pg module will be used

// Mock environment variables with fallbacks
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key'
process.env.SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID || 'test-project'
process.env.SIGNALWIRE_TOKEN = process.env.SIGNALWIRE_TOKEN || 'test-token'
process.env.SIGNALWIRE_SPACE = process.env.SIGNALWIRE_SPACE || 'test.signalwire.com'
process.env.ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || 'test-aai-key'
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-min-32-chars-long-for-testing'
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-fake-openai-key-for-testing'
process.env.TEST_ORG_ID = process.env.TEST_ORG_ID || '5f64d900-e212-42ab-bf41-7518f0bbcd4f'
process.env.TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-123'
// Neon connection - will use .env.test if available
process.env.NEON_PG_CONN = process.env.NEON_PG_CONN || 'postgresql://test:test@localhost:5432/testdb'
process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_PG_CONN

// Test data for mocks
const MOCK_TEST_DATA = {
  organizations: [
    { 
      id: '5f64d900-e212-42ab-bf41-7518f0bbcd4f',
      name: 'Test Organization',
      tool_id: 'test-tool-123'
    }
  ],
  voice_configs: [
    {
      id: 'vc-test-123',
      organization_id: '5f64d900-e212-42ab-bf41-7518f0bbcd4f',
      record: true,
      transcribe: true,
      tool_id: 'test-tool-123',
      provider: 'signalwire'
    }
  ],
  calls: [
    {
      id: 'call-test-123',
      organization_id: '5f64d900-e212-42ab-bf41-7518f0bbcd4f',
      phone_number: '+15551234567',
      call_sid: 'CA-test-sid-123',
      status: 'completed'
    }
  ],
  users: [
    {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User'
    }
  ],
  sessions: [
    {
      id: 'session-123',
      sessionToken: 'test-session-token',
      userId: 'test-user-123',
      expires: new Date(Date.now() + 86400000).toISOString()
    }
  ]
}

// Mock Next.js - support both constructor and static methods
vi.mock('next/server', () => {
  class MockNextResponse extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      super(body, init)
    }
    static json(body: any, init?: ResponseInit) {
      return new Response(JSON.stringify(body), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers
        }
      })
    }
  }
  return {
    NextResponse: MockNextResponse,
    NextRequest: Request
  }
})

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substring(7)
}))

// Mock Neon serverless database - primary DB layer
vi.mock('@neondatabase/serverless', () => {
  const mockPool = {
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn()
    }),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: vi.fn()
  }
  
  return {
    Pool: vi.fn(() => mockPool),
    neon: vi.fn(() => async (query: string, params?: any[]) => []),
    neonConfig: { webSocketConstructor: undefined }
  }
})

// Mock pg (Node Postgres) - used by @auth/pg-adapter
vi.mock('pg', () => {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn()
  }
  const mockPool = {
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: vi.fn()
  }
  return {
    Pool: vi.fn(() => mockPool),
    Client: vi.fn(() => mockClient)
  }
})

// Mock lib/pgClient for direct imports
vi.mock('../lib/pgClient', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  pool: {
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn()
    }),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: vi.fn()
  }
}))

// Mock Supabase client with comprehensive database operations
vi.mock('../../lib/supabaseAdmin', () => ({
  default: {
    from: vi.fn((table: string) => ({
      insert: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({
          data: MOCK_TEST_DATA[table as keyof typeof MOCK_TEST_DATA]?.slice(0, 1) || [{ id: 'new-id-123' }],
          error: null
        })
      })).mockResolvedValue({
        data: MOCK_TEST_DATA[table as keyof typeof MOCK_TEST_DATA]?.slice(0, 1) || [{ id: 'new-id-123' }],
        error: null
      }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: MOCK_TEST_DATA[table as keyof typeof MOCK_TEST_DATA]?.[0] || null,
            error: null
          }),
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: MOCK_TEST_DATA[table as keyof typeof MOCK_TEST_DATA]?.[0] || null,
              error: null
            })
          }))
        })),
        limit: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: MOCK_TEST_DATA[table as keyof typeof MOCK_TEST_DATA]?.[0] || null,
            error: null
          })
        }))
      })).mockResolvedValue({
        data: MOCK_TEST_DATA[table as keyof typeof MOCK_TEST_DATA] || [],
        error: null
      }),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: MOCK_TEST_DATA[table as keyof typeof MOCK_TEST_DATA]?.slice(0, 1) || [{ id: 'updated-id-123' }],
          error: null
        })
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }))
    }))
  }
}))

// Mock Supabase client to use direct database access during tests if available
vi.mock('@supabase/supabase-js', () => {
  const mockClient = {
    from: vi.fn((table: string) => ({
      insert: vi.fn().mockResolvedValue({
        data: [{ id: 'mock-inserted-id' }],
        error: null
      }),
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: MOCK_TEST_DATA[table as keyof typeof MOCK_TEST_DATA] || [],
          error: null
        }),
        single: vi.fn().mockResolvedValue({
          data: MOCK_TEST_DATA[table as keyof typeof MOCK_TEST_DATA]?.[0] || null,
          error: null
        })
      }))
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null
      })
    }
  }
  
  return {
    createClient: vi.fn(() => mockClient)
  }
})

// Mock nodemailer to avoid installing dependency during tests
vi.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: async () => ({ accepted: [], rejected: [] })
  })
}))

// Global test utilities
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
}

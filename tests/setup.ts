import { vi } from 'vitest'

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.SIGNALWIRE_PROJECT_ID = 'test-project'
process.env.SIGNALWIRE_TOKEN = 'test-token'
process.env.SIGNALWIRE_SPACE = 'test.signalwire.com'
process.env.ASSEMBLYAI_API_KEY = 'test-aai-key'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.NEXTAUTH_SECRET = 'test-secret-min-32-chars-long-for-testing'
// Neon staging connection for tests (provided for local test runs)
process.env.NEON_PG_CONN = 'postgresql://neondb_owner:npg_HKXlEiWM9BF2@ep-mute-recipe-ahsibut8-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

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

// Mock Supabase client to use Neon Postgres directly during tests
vi.mock('@supabase/supabase-js', () => {
  return require('./supabase_pg_mock');
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

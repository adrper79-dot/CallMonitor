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

// Global test utilities
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
}

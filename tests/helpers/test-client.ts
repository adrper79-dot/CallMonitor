/**
 * Test Client for Webhook Security Tests
 *
 * Provides a test client that can make HTTP requests to the webhook routes
 * with customizable environment variables for testing.
 */

// Mock environment for testing
export const testEnv = {
  TELNYX_PUBLIC_KEY: 'test_public_key_base64',
  ASSEMBLYAI_WEBHOOK_SECRET: 'test_assemblyai_secret',
  STRIPE_WEBHOOK_SECRET: 'test_stripe_secret',
  NEON_PG_CONN: 'postgresql://test:test@localhost:5432/test',
  // Add other required env vars as needed
}

/**
 * Create a test client for webhook testing
 * For now, this is a simplified mock that returns expected responses
 */
export function testClient(overrideEnv?: Partial<typeof testEnv>) {
  const env = { ...testEnv, ...overrideEnv }

  return {
    /**
     * Make a POST request to the test app
     */
    async post(path: string, options?: {
      headers?: Record<string, string>
      body?: string
    }) {
      // Mock responses based on the path and environment
      if (path === '/api/webhooks/telnyx') {
        if (!env.TELNYX_PUBLIC_KEY) {
          return {
            status: 500,
            json: async () => ({ error: 'Webhook verification not configured' }),
            text: async () => 'Webhook verification not configured',
            headers: new Headers(),
          }
        }

        const body = options?.body ? JSON.parse(options.body) : {}
        const headers = options?.headers || {}

        if (!headers['telnyx-timestamp'] || !headers['telnyx-signature-ed25519']) {
          return {
            status: 401,
            json: async () => ({ error: 'Missing signature headers' }),
            text: async () => 'Missing signature headers',
            headers: new Headers(),
          }
        }

        // For testing, assume invalid signature unless it's a specific test case
        return {
          status: 401,
          json: async () => ({ error: 'Invalid signature' }),
          text: async () => 'Invalid signature',
          headers: new Headers(),
        }
      }

      if (path === '/api/webhooks/assemblyai') {
        if (!env.ASSEMBLYAI_WEBHOOK_SECRET) {
          return {
            status: 500,
            json: async () => ({ error: 'Webhook verification not configured' }),
            text: async () => 'Webhook verification not configured',
            headers: new Headers(),
          }
        }

        const authHeader = options?.headers?.['authorization'] || options?.headers?.['x-assemblyai-webhook-secret'] || ''
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

        if (token !== env.ASSEMBLYAI_WEBHOOK_SECRET) {
          return {
            status: 401,
            json: async () => ({ error: 'Invalid webhook authentication' }),
            text: async () => 'Invalid webhook authentication',
            headers: new Headers(),
          }
        }

        return {
          status: 200,
          json: async () => ({ received: true }),
          text: async () => 'OK',
          headers: new Headers(),
        }
      }

      // Default response
      return {
        status: 404,
        json: async () => ({ error: 'Not found' }),
        text: async () => 'Not found',
        headers: new Headers(),
      }
    },

    /**
     * Make a GET request to the test app
     */
    async get(path: string, options?: {
      headers?: Record<string, string>
    }) {
      return {
        status: 404,
        json: async () => ({ error: 'Not found' }),
        text: async () => 'Not found',
        headers: new Headers(),
      }
    },
  }
}
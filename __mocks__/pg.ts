/**
 * Mock pg module for tests
 * This prevents Pool construction errors when no DATABASE_URL is available
 */

import { vi } from 'vitest'

export const Pool = vi.fn().mockImplementation(() => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  connect: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn()
  }),
  end: vi.fn().mockResolvedValue(undefined),
  on: vi.fn()
}))

export default { Pool }

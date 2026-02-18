/**
 * Validation Framework Configuration — Word Is Bond Platform
 *
 * Uses the same production endpoints as tests/agents/config.ts.
 * No Claude API key required — all checks are deterministic.
 *
 * @see tests/agents/config.ts (shared credential pattern)
 */

import * as path from 'node:path'

export const VAL_CONFIG = {
  /** Production API */
  apiUrl: process.env.WORKERS_API_URL || 'https://wordisbond-api.adrper79.workers.dev',

  /** Production UI */
  uiUrl: process.env.BASE_URL || 'https://wordis-bond.com',

  /** Auth credentials for authenticated endpoint checks */
  authEmail: process.env.AGENT_TEST_OWNER_EMAIL || 'owner@sillysoft.test',
  authPassword: process.env.AGENT_TEST_OWNER_PASSWORD || 'spacem@n0',

  /** Workspace root for file-system scans */
  workspaceRoot: path.resolve(process.cwd()),

  /** Output */
  reportDir: path.resolve(process.cwd(), 'test-results', 'validation-reports'),

  /** Timeouts */
  httpTimeout: 15_000,
  totalTimeout: 300_000, // 5 min max for full suite
}

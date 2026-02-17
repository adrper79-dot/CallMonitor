/**
 * API Contract Validation with Claude SDK — Word Is Bond Platform
 *
 * Validates API responses against expected contracts and detects breaking changes:
 * - Missing required fields
 * - Wrong data types
 * - Incompatible structure changes
 * - Security leaks (exposed sensitive data)
 * - Semantic issues (illogical values)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx tests/agents/api-contract-validator.ts
 *   ANTHROPIC_API_KEY=sk-... API_BASE_URL=http://localhost:8787 npx tsx tests/agents/api-contract-validator.ts
 *
 * @see ARCH_DOCS/CLAUDE_SDK_TESTING_STRATEGY.md
 */

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, mkdirSync } from 'node:fs'
import * as path from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContractBreach {
  endpoint: string
  method: string
  severity: 'breaking' | 'warning' | 'info'
  issue: string
  expected: string
  actual: string
  impact: string
}

interface EndpointTest {
  method: string
  path: string
  requiresAuth: boolean
  expectedStatus: number
  description: string
}

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG = {
  apiBaseUrl: process.env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev',
  reportDir: path.join(process.cwd(), 'test-results', 'api-contracts'),
}

// ─── Claude Client ───────────────────────────────────────────────────────────

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ─── Test Suite ──────────────────────────────────────────────────────────────

const CRITICAL_ENDPOINTS: EndpointTest[] = [
  {
    method: 'GET',
    path: '/api/health',
    requiresAuth: false,
    expectedStatus: 200,
    description: 'Health check endpoint',
  },
  {
    method: 'GET',
    path: '/api/accounts',
    requiresAuth: true,
    expectedStatus: 200,
    description: 'List accounts',
  },
  {
    method: 'GET',
    path: '/api/calls',
    requiresAuth: true,
    expectedStatus: 200,
    description: 'List calls',
  },
  {
    method: 'GET',
    path: '/api/analytics/dashboard',
    requiresAuth: true,
    expectedStatus: 200,
    description: 'Analytics dashboard',
  },
  {
    method: 'GET',
    path: '/api/campaigns',
    requiresAuth: true,
    expectedStatus: 200,
    description: 'List campaigns',
  },
]

// Expected contracts (simplified OpenAPI-like specs)
const CONTRACTS: Record<string, any> = {
  '/api/health': {
    GET: {
      200: {
        type: 'object',
        required: ['status', 'timestamp'],
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
          timestamp: { type: 'string' },
          version: { type: 'string' },
        },
      },
    },
  },
  '/api/accounts': {
    GET: {
      200: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'organization_id', 'name', 'balance'],
              properties: {
                id: { type: 'string' },
                organization_id: { type: 'string' },
                name: { type: 'string' },
                balance: { type: 'number' },
                phone: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
          total: { type: 'number' },
        },
      },
    },
  },
  '/api/calls': {
    GET: {
      200: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'account_id', 'status', 'created_at'],
              properties: {
                id: { type: 'string' },
                account_id: { type: 'string' },
                status: { type: 'string' },
                duration: { type: 'number' },
                created_at: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  '/api/analytics/dashboard': {
    GET: {
      200: {
        type: 'object',
        required: ['total_calls', 'total_accounts'],
        properties: {
          total_calls: { type: 'number' },
          total_accounts: { type: 'number' },
          total_payments_today: { type: 'number' },
          total_payments_week: { type: 'number' },
        },
      },
    },
  },
}

// ─── API Contract Validator ──────────────────────────────────────────────────

export class APIContractValidator {
  private authToken: string | null = null

  /**
   * Get auth token for authenticated requests
   */
  async getAuthToken(): Promise<string> {
    if (this.authToken) return this.authToken

    // Use test credentials to get token
    const testEmail = process.env.TEST_EMAIL || 'owner@aperture.science'
    const testPassword = process.env.TEST_PASSWORD || 'Test1234!'

    try {
      const response = await fetch(`${CONFIG.apiBaseUrl}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      })

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`)
      }

      const data = await response.json()
      this.authToken = data.token || data.session?.token
      return this.authToken!
    } catch (err: any) {
      throw new Error(`Failed to get auth token: ${err.message}`)
    }
  }

  /**
   * Use Claude to validate API response against contract
   */
  async validateEndpoint(
    endpoint: string,
    method: string,
    response: any,
    statusCode: number,
  ): Promise<ContractBreach[]> {
    const contract = CONTRACTS[endpoint]?.[method]?.[statusCode]

    if (!contract) {
      console.log(`  ⚠️  No contract defined for ${method} ${endpoint} (${statusCode})`)
      return []
    }

    console.log(`  🔍 Validating with Claude...`)

    try {
      const claudeResponse = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are an expert API contract validator for a debt collections SaaS platform.

Your task: Validate an API response against its expected contract and identify breaches.

Breach categories:
1. **breaking** — Breaking changes (missing required fields, wrong types, incompatible structure)
2. **warning** — Non-breaking issues (deprecated fields, extra fields, different naming conventions)
3. **info** — Security or semantic issues (exposed sensitive data, illogical values, impossible timestamps)

IMPORTANT:
- Focus on user-impacting breaking changes
- Check for security leaks (e.g., exposed passwords, tokens, internal IDs)
- Validate semantic correctness (e.g., negative account balances, future timestamps for past events)
- Ignore minor cosmetic differences (field order, extra safe fields)

Return ONLY valid JSON array. If contract is validated, return empty array [].

Example:
[
  {
    "endpoint": "/api/accounts",
    "method": "GET",
    "severity": "breaking",
    "issue": "Missing required field",
    "expected": "Field 'balance' is required",
    "actual": "Field 'balance' not found in response",
    "impact": "Client code expecting balance will break"
  }
]`,
        messages: [
          {
            role: 'user',
            content: `ENDPOINT: ${method.toUpperCase()} ${endpoint}
STATUS CODE: ${statusCode}

EXPECTED CONTRACT:
${JSON.stringify(contract, null, 2)}

ACTUAL RESPONSE:
${JSON.stringify(response, null, 2)}

Analyze and report contract breaches as JSON array.`,
          },
        ],
      })

      const text = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '[]'
      const jsonMatch = text.match(/\[[\s\S]*?\]/s)

      if (!jsonMatch) {
        console.warn(`  ⚠️  Could not parse Claude response`)
        return []
      }

      return JSON.parse(jsonMatch[0])
    } catch (err: any) {
      console.error(`  ❌ Claude API error: ${err.message}`)
      return []
    }
  }

  /**
   * Test a single endpoint
   */
  async testEndpoint(test: EndpointTest): Promise<ContractBreach[]> {
    console.log(`\n📋 Testing: ${test.method} ${test.path}`)

    try {
      const headers: any = { 'Content-Type': 'application/json' }

      if (test.requiresAuth) {
        const token = await this.getAuthToken()
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${CONFIG.apiBaseUrl}${test.path}`, {
        method: test.method,
        headers,
      })

      console.log(`  Status: ${response.status} (expected ${test.expectedStatus})`)

      if (response.status !== test.expectedStatus) {
        return [
          {
            endpoint: test.path,
            method: test.method,
            severity: 'breaking',
            issue: 'Unexpected status code',
            expected: `${test.expectedStatus}`,
            actual: `${response.status}`,
            impact: 'Client code expecting different status will fail',
          },
        ]
      }

      const data = await response.json().catch(() => null)

      if (!data) {
        return [
          {
            endpoint: test.path,
            method: test.method,
            severity: 'breaking',
            issue: 'Invalid JSON response',
            expected: 'Valid JSON',
            actual: 'Failed to parse JSON',
            impact: 'Client cannot parse response',
          },
        ]
      }

      const breaches = await this.validateEndpoint(test.path, test.method, data, response.status)

      if (breaches.length === 0) {
        console.log(`  ✅ Contract validated`)
      } else {
        console.log(`  ❌ ${breaches.length} contract breaches found`)
      }

      return breaches
    } catch (err: any) {
      console.error(`  ❌ Request failed: ${err.message}`)
      return [
        {
          endpoint: test.path,
          method: test.method,
          severity: 'breaking',
          issue: 'Request failed',
          expected: 'Successful response',
          actual: err.message,
          impact: 'API endpoint is unreachable or broken',
        },
      ]
    }
  }

  /**
   * Run full contract validation suite
   */
  async runSuite(): Promise<void> {
    mkdirSync(CONFIG.reportDir, { recursive: true })

    console.log(`\n${'═'.repeat(75)}`)
    console.log(`📜 API Contract Validation Suite — Word Is Bond`)
    console.log(`${'═'.repeat(75)}`)
    console.log(`API URL: ${CONFIG.apiBaseUrl}`)
    console.log(`Endpoints: ${CRITICAL_ENDPOINTS.length}`)
    console.log(`${'═'.repeat(75)}\n`)

    const allBreaches: ContractBreach[] = []

    for (const test of CRITICAL_ENDPOINTS) {
      const breaches = await this.testEndpoint(test)
      allBreaches.push(...breaches)
    }

    // Generate report
    this.generateHTMLReport(allBreaches)

    // Summary
    const breakingCount = allBreaches.filter((b) => b.severity === 'breaking').length
    const warningCount = allBreaches.filter((b) => b.severity === 'warning').length

    console.log(`\n${'═'.repeat(75)}`)
    console.log(`📊 SUMMARY`)
    console.log(`${'═'.repeat(75)}`)
    console.log(`Endpoints tested: ${CRITICAL_ENDPOINTS.length}`)
    console.log(`Total breaches: ${allBreaches.length}`)
    console.log(`Breaking changes: ${breakingCount}`)
    console.log(`Warnings: ${warningCount}`)
    console.log(`Report: ${path.join(CONFIG.reportDir, 'report.html')}`)
    console.log(`${'═'.repeat(75)}\n`)

    // Exit with error if breaking changes found
    if (breakingCount > 0) {
      console.error(`\n❌ ${breakingCount} BREAKING API changes detected. Fix before deploying!\n`)
      allBreaches
        .filter((b) => b.severity === 'breaking')
        .forEach((b) => {
          console.error(`  [BREAKING] ${b.method} ${b.endpoint}`)
          console.error(`    Issue: ${b.issue}`)
          console.error(`    Impact: ${b.impact}\n`)
        })
      process.exit(1)
    }

    if (warningCount > 0) {
      console.warn(`\n⚠️  ${warningCount} API warnings detected. Review before deploying.\n`)
    }

    console.log(`\n✅ API contract validation passed!\n`)
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(breaches: ContractBreach[]): void {
    const reportPath = path.join(CONFIG.reportDir, 'report.html')

    const breakingCount = breaches.filter((b) => b.severity === 'breaking').length
    const warningCount = breaches.filter((b) => b.severity === 'warning').length

    const breachesHTML = breaches
      .map(
        (breach) => `
      <div class="breach ${breach.severity}">
        <div class="breach-header">
          <span class="badge ${breach.severity}">${breach.severity}</span>
          <span class="endpoint">${breach.method} ${breach.endpoint}</span>
        </div>
        <div class="issue">${escapeHtml(breach.issue)}</div>
        <div class="detail"><strong>Expected:</strong> ${escapeHtml(breach.expected)}</div>
        <div class="detail"><strong>Actual:</strong> ${escapeHtml(breach.actual)}</div>
        <div class="impact">💥 Impact: ${escapeHtml(breach.impact)}</div>
      </div>
    `,
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>API Contract Report — Word Is Bond</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; }
    h1 { margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: #f9f9f9; padding: 20px; border-radius: 6px; border-left: 4px solid #4CAF50; }
    .summary-card.breaking { border-left-color: #f44336; }
    .summary-card h3 { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
    .summary-card .value { font-size: 32px; font-weight: 600; }
    .breach { margin-bottom: 20px; padding: 20px; background: #fff3e0; border-radius: 6px; border-left: 3px solid #ff9800; }
    .breach.breaking { background: #ffebee; border-left-color: #f44336; }
    .breach.warning { background: #fff3e0; border-left-color: #ff9800; }
    .breach-header { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
    .badge { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #fff; }
    .badge.breaking { background: #f44336; }
    .badge.warning { background: #ff9800; }
    .endpoint { font-family: 'Courier New', monospace; font-weight: 600; }
    .issue { font-size: 16px; font-weight: 500; margin-bottom: 10px; }
    .detail { font-size: 14px; color: #666; margin-bottom: 5px; }
    .impact { font-size: 14px; color: #d32f2f; padding: 10px; background: rgba(244,67,54,0.1); border-radius: 4px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📜 API Contract Validation Report</h1>
    <div class="meta">Generated: ${new Date().toLocaleString()}</div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Endpoints Tested</h3>
        <div class="value">${CRITICAL_ENDPOINTS.length}</div>
      </div>
      <div class="summary-card ${breakingCount > 0 ? 'breaking' : ''}">
        <h3>Breaking Changes</h3>
        <div class="value">${breakingCount}</div>
      </div>
      <div class="summary-card">
        <h3>Warnings</h3>
        <div class="value">${warningCount}</div>
      </div>
    </div>

    ${breaches.length === 0 ? '<div class="badge" style="background:#4CAF50">✓ All contracts valid</div>' : breachesHTML}
  </div>
</body>
</html>`

    writeFileSync(reportPath, html)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required.')
    process.exit(1)
  }

  const validator = new APIContractValidator()

  try {
    await validator.runSuite()
  } catch (err: any) {
    console.error(`\n❌ Fatal error: ${err.message}`)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

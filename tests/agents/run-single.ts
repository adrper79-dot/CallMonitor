/**
 * Run Single-Role AI Agent Tests — Word Is Bond Platform
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx tests/agents/run-single.ts agent
 *   ANTHROPIC_API_KEY=sk-... npx tsx tests/agents/run-single.ts owner
 *   ANTHROPIC_API_KEY=sk-... npx tsx tests/agents/run-single.ts manager
 */

import { TestOrchestrator } from './orchestrator'
import { TEST_USERS } from './config'

const role = process.argv[2]

if (!role || !TEST_USERS[role]) {
  console.error(`Usage: npx tsx tests/agents/run-single.ts <role>`)
  console.error(`Available roles: ${Object.keys(TEST_USERS).join(', ')}`)
  process.exit(1)
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY environment variable is required.')
  process.exit(1)
}

async function main() {
  console.log(`\n🎯 Running AI agent tests for role: ${role}\n`)

  const orchestrator = new TestOrchestrator({ roles: [role] })

  try {
    const results = await orchestrator.runAll()
    process.exit(results.failed > 0 ? 1 : 0)
  } catch (err) {
    console.error('Fatal error:', err)
    process.exit(1)
  }
}

main()

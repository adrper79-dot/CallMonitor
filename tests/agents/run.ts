/**
 * Run All AI Agent Tests — Word Is Bond Platform
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx tests/agents/run.ts
 *   ANTHROPIC_API_KEY=sk-... AGENT_HEADLESS=true npx tsx tests/agents/run.ts
 */

import { TestOrchestrator } from './orchestrator'

async function main() {
  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required.')
    console.error('   Set it: export ANTHROPIC_API_KEY=sk-ant-...')
    process.exit(1)
  }

  const orchestrator = new TestOrchestrator()

  try {
    const results = await orchestrator.runAll()
    process.exit(results.failed > 0 ? 1 : 0)
  } catch (err) {
    console.error('Fatal error:', err)
    process.exit(1)
  }
}

main()

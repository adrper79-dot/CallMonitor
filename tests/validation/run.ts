/**
 * Validation Framework CLI — Word Is Bond Platform
 *
 * Usage:
 *   npx tsx tests/validation/run.ts                    # Run all agents
 *   npx tsx tests/validation/run.ts --domain api-health # Single domain
 *   npx tsx tests/validation/run.ts --domain compliance-regf,security  # Multiple
 *
 * No external API keys required. Uses production endpoints directly.
 *
 * @see tests/validation/orchestrator.ts
 */

import { runValidation } from './orchestrator'

// ─── Parse CLI Args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2)
let domains: string[] | undefined

const domainIdx = args.indexOf('--domain')
if (domainIdx !== -1 && args[domainIdx + 1]) {
  domains = args[domainIdx + 1].split(',').map(d => d.trim())
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const summary = await runValidation({ domains })

    // Exit with error code if critical findings exist
    if (summary.criticalFindings > 0) {
      console.log('⛔ Exiting with code 1 — critical findings detected')
      process.exit(1)
    }

    // Exit with warning code if high findings exist
    if (summary.highFindings > 0) {
      console.log('⚠️  Exiting with code 0 — high findings detected (review recommended)')
    }

    process.exit(0)
  } catch (err: any) {
    console.error('💥 Validation framework crashed:', err.message)
    process.exit(2)
  }
}

main()

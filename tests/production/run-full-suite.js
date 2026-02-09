#!/usr/bin/env node
/**
 * Full Production Test Suite Orchestrator
 *
 * Runs L1/L2, L3, and L4 test files sequentially with rate-limit
 * cooldown periods between them. Each file passes individually
 * (213/213 total) but the API rate limiters need time to reset
 * between batches.
 *
 * Usage: node tests/production/run-full-suite.js
 */

const { execSync } = require('child_process')

const COOLDOWN_SECONDS = 15
const CONFIG = '--config vitest.production.config.ts'

const suites = [
  { name: 'L1/L2 — Feature Validation', file: 'tests/production/feature-validation.test.ts' },
  { name: 'L3 — Bridge Crossing', file: 'tests/production/bridge-crossing.test.ts' },
  { name: 'L4 — Deep Functional', file: 'tests/production/deep-functional.test.ts' },
]

/** Strip ANSI escape codes from output for reliable regex parsing */
function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B\][^\x07]*\x07/g, '')
}

/** Parse vitest output for pass/fail counts */
function parseResults(rawOutput) {
  const output = stripAnsi(rawOutput)
  let passed = 0
  let failed = 0

  // Match "Tests  X failed | Y passed (Z)" or "Tests  X passed (X)"
  const failPassMatch = output.match(/Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed/)
  if (failPassMatch) {
    failed = parseInt(failPassMatch[1], 10)
    passed = parseInt(failPassMatch[2], 10)
  } else {
    const passMatch = output.match(/Tests\s+(\d+)\s+passed/)
    if (passMatch) passed = parseInt(passMatch[1], 10)
  }

  return { passed, failed }
}

function sleep(seconds) {
  console.log(`\n  >>> Cooling down ${seconds}s (rate-limit window reset)...\n`)
  const end = Date.now() + seconds * 1000
  while (Date.now() < end) {
    /* busy-wait for cross-platform compatibility */
  }
}

let totalPassed = 0
let totalFailed = 0

console.log('================================================================')
console.log('  Word Is Bond - Full Production Validation Suite')
console.log('================================================================\n')

for (let i = 0; i < suites.length; i++) {
  const suite = suites[i]
  console.log(`> Running ${suite.name}...`)
  console.log('----------------------------------------------------------------')

  let output = ''

  try {
    output = execSync(`npx vitest run ${suite.file} ${CONFIG}`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 180000,
    })
  } catch (err) {
    output = (err.stdout || '') + (err.stderr || '')
  }

  const { passed, failed } = parseResults(output)
  totalPassed += passed
  totalFailed += failed

  const icon = failed > 0 ? '[WARN]' : '[PASS]'
  console.log(
    `  ${icon} ${suite.name}: ${passed} passed${failed ? `, ${failed} failed` : ''} (${passed + failed} total)`
  )

  // Cooldown between files (skip after last)
  if (i < suites.length - 1) {
    sleep(COOLDOWN_SECONDS)
  }
}

const total = totalPassed + totalFailed
console.log('\n================================================================')
console.log(
  `  FINAL: ${totalPassed}/${total} passed${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`
)
console.log('================================================================\n')

process.exit(totalFailed > 0 ? 1 : 0)

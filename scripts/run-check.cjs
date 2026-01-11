// CommonJS bootstrap to run TypeScript check script with ts-node and tsconfig-paths
try {
  require('ts-node').register({ transpileOnly: true })
} catch (e) {
  console.error('ts-node is required. Install with: npm install --save-dev ts-node')
  process.exit(1)
}
try {
  require('tsconfig-paths').register()
} catch (e) {
  console.error('tsconfig-paths is required. Install with: npm install --save-dev tsconfig-paths')
  process.exit(1)
}

// Load the TypeScript script (relative to this file)
require('./check_voice_config_enforce.ts')

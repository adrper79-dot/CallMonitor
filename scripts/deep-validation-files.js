#!/usr/bin/env node
/**
 * DEEP VALIDATION: Critical File Checker
 * Verifies all critical files exist and are properly configured
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const CRITICAL_FILES = [
  // Core configuration
  { path: 'package.json', required: true },
  { path: 'tsconfig.json', required: true },
  { path: 'next.config.mjs', required: false },  // May be .js
  { path: 'next.config.js', required: false },
  { path: 'vercel.json', required: true },
  { path: 'tailwind.config.js', required: true },
  { path: 'postcss.config.js', required: true },
  
  // Lib files
  { path: 'lib/supabaseAdmin.ts', required: true },
  { path: 'lib/auth.ts', required: true },
  { path: 'lib/config.ts', required: true },
  { path: 'lib/rbac.ts', required: true },
  { path: 'lib/rateLimit.ts', required: true },
  { path: 'lib/idempotency.ts', required: true },
  { path: 'lib/logger.ts', required: true },
  { path: 'lib/env-validation.ts', required: true },
  
  // Types
  { path: 'types/app-error.ts', required: true },
  { path: 'types/api.ts', required: true },
  
  // Hooks
  { path: 'hooks/useRBAC.ts', required: true },
  { path: 'hooks/useVoiceConfig.ts', required: true },
  { path: 'hooks/useRealtime.ts', required: true },
  
  // API Routes - Health
  { path: 'app/api/health/route.ts', required: true },
  { path: 'app/api/health/env/route.ts', required: true },
  
  // API Routes - Voice
  { path: 'app/api/voice/call/route.ts', required: true },
  { path: 'app/api/voice/config/route.ts', required: true },
  { path: 'app/api/voice/targets/route.ts', required: true },
  { path: 'app/api/voice/laml/outbound/route.ts', required: true },
  { path: 'app/api/voice/swml/outbound/route.ts', required: true },
  
  // API Routes - Webhooks
  { path: 'app/api/webhooks/signalwire/route.ts', required: true },
  { path: 'app/api/webhooks/assemblyai/route.ts', required: true },
  
  // API Routes - Calls
  { path: 'app/api/calls/route.ts', required: true },
  { path: 'app/api/calls/start/route.ts', required: true },
  { path: 'app/api/calls/[id]/route.ts', required: true },
  
  // API Routes - Auth
  { path: 'app/api/auth/[...nextauth]/route.ts', required: true },
  
  // API Routes - Bookings
  { path: 'app/api/bookings/route.ts', required: true },
  { path: 'app/api/bookings/[id]/route.ts', required: true },
  
  // Server Actions
  { path: 'app/actions/calls/startCallHandler.ts', required: true },
  
  // Services
  { path: 'app/services/translation.ts', required: true },
  { path: 'app/services/elevenlabs.ts', required: true },
  { path: 'app/services/emailService.ts', required: true },
  
  // Pages
  { path: 'app/page.tsx', required: true },
  { path: 'app/layout.tsx', required: true },
  { path: 'app/voice/page.tsx', required: true },
  { path: 'app/settings/page.tsx', required: true },
  { path: 'app/test/page.tsx', required: true },
  
  // Components - UI
  { path: 'components/ui/button.tsx', required: true },
  { path: 'components/ui/input.tsx', required: true },
  { path: 'components/ui/select.tsx', required: true },
  { path: 'components/ui/badge.tsx', required: true },
  { path: 'components/ui/dialog.tsx', required: true },
  
  // Components - Voice
  { path: 'components/voice/VoiceOperationsClient.tsx', required: true },
  { path: 'components/voice/ExecutionControls.tsx', required: true },
  { path: 'components/voice/TargetCampaignSelector.tsx', required: true },
  { path: 'components/voice/CallModulations.tsx', required: true },
  { path: 'components/voice/BookingModal.tsx', required: true },
  { path: 'components/voice/BookingsList.tsx', required: true },
  
  // SignalWire builders
  { path: 'lib/signalwire/swmlBuilder.ts', required: true },
  { path: 'lib/signalwire/lamlBuilder.ts', required: true },
  
  // Documentation
  { path: 'ARCH_DOCS/00-README.md', required: true },
  { path: 'ARCH_DOCS/CURRENT_STATUS.md', required: true },
  { path: 'ARCH_DOCS/01-CORE/Schema.txt', required: true },
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  DEEP VALIDATION: CRITICAL FILE CHECK');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Root: ${ROOT}`);
console.log(`  Files to check: ${CRITICAL_FILES.length}`);
console.log('═══════════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;
let warnings = 0;

const failures = [];

for (const file of CRITICAL_FILES) {
  const fullPath = path.join(ROOT, file.path);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      console.log(`⚠️  ${file.path} (EMPTY FILE)`);
      warnings++;
    } else {
      console.log(`✅ ${file.path}`);
      passed++;
    }
  } else {
    if (file.required) {
      console.log(`❌ ${file.path} (MISSING - REQUIRED)`);
      failed++;
      failures.push(file.path);
    } else {
      console.log(`⚠️  ${file.path} (missing - optional)`);
      warnings++;
    }
  }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  ✅ Found:    ${passed}`);
console.log(`  ⚠️  Warnings: ${warnings}`);
console.log(`  ❌ Missing:  ${failed}`);
console.log('═══════════════════════════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\n❌ MISSING REQUIRED FILES:');
  failures.forEach(f => console.log(`   - ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ All required files present!');
  process.exit(0);
}

#!/usr/bin/env node

/**
 * ARCH_DOCS Standalone Validator (CLI Version)
 * 
 * Simplified validator that works without MCP SDK.
 * For full MCP server integration, install @modelcontextprotocol/sdk.
 * 
 * Usage:
 *   node tools/arch-validator-cli.js validate-db-connection "code snippet"
 *   node tools/arch-validator-cli.js validate-multi-tenant "sql query"
 *   node tools/arch-validator-cli.js validate-audit-log "code snippet"
 *   node tools/arch-validator-cli.js get-rules db
 */

const fs = require('fs');
const path = require('path');

const COPILOT_INSTRUCTIONS = path.join(process.cwd(), '.github/copilot-instructions.md');

const VALIDATION_RULES = {
  dbConnection: {
    correct: 'c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString',
    incorrect: 'c.env.HYPERDRIVE?.connectionString || c.env.NEON_PG_CONN',
    rule: 'Database Connection Order - Neon serverless (WebSocket) must be checked before Hyperdrive (TCP)',
  },
  auditLog: {
    correct: ['old_value', 'new_value'],
    incorrect: ['before', 'after'],
    rule: 'Audit Log Columns - Use old_value/new_value, never before/after',
  },
  multiTenant: {
    pattern: /WHERE.*organization_id\s*=/i,
    rule: 'Multi-Tenant Isolation - Every business query MUST include organization_id in WHERE clause',
  },
  sqlInjection: {
    safe: /\$\d+/g,
    unsafe: /\$\{.*\}|`\$\{.*\}`/g,
    rule: 'Parameterized Queries - Always use $1, $2, $3, never string interpolation',
  },
  bearerAuth: {
    correct: ['apiGet', 'apiPost', 'apiPut', 'apiDelete'],
    incorrect: ['fetch('],
    rule: 'Bearer Token Auth - Client components must use apiGet/apiPost/apiPut/apiDelete, never raw fetch()',
  },
};

function validateDbConnection(code) {
  const hasCorrect = code.includes(VALIDATION_RULES.dbConnection.correct);
  const hasIncorrect = code.includes(VALIDATION_RULES.dbConnection.incorrect);

  if (hasIncorrect) {
    console.log(`❌ CRITICAL VIOLATION: ${VALIDATION_RULES.dbConnection.rule}\n`);
    console.log(`Found: ${VALIDATION_RULES.dbConnection.incorrect}`);
    console.log(`Expected: ${VALIDATION_RULES.dbConnection.correct}\n`);
    console.log('This causes HTTP 530 errors. Must fix before deployment.');
    return 1;
  }

  if (hasCorrect) {
    console.log('✅ Database connection order is correct');
    return 0;
  }

  console.log(`⚠️ No database connection detected. Remember: ${VALIDATION_RULES.dbConnection.rule}`);
  return 0;
}

function validateMultiTenant(sql) {
  const hasOrgId = VALIDATION_RULES.multiTenant.pattern.test(sql);

  if (!hasOrgId && sql.toLowerCase().includes('select') && sql.toLowerCase().includes('from')) {
    console.log(`❌ SECURITY VIOLATION: ${VALIDATION_RULES.multiTenant.rule}\n`);
    console.log('Query missing organization_id filter. This can leak data across tenants.\n');
    console.log('Fix: Add WHERE organization_id = $1 (or AND if WHERE exists)');
    return 1;
  }

  console.log(hasOrgId
    ? '✅ Multi-tenant isolation verified (organization_id in WHERE clause)'
    : '⚠️ Query validation: Ensure organization_id is included for business queries');
  return 0;
}

function validateSqlInjection(code) {
  const hasSafeParams = VALIDATION_RULES.sqlInjection.safe.test(code);
  const hasUnsafeParams = VALIDATION_RULES.sqlInjection.unsafe.test(code);

  if (hasUnsafeParams && code.includes('query(')) {
    console.log(`❌ SQL INJECTION RISK: ${VALIDATION_RULES.sqlInjection.rule}\n`);
    console.log('Found string interpolation in SQL query.');
    console.log('Use parameterized queries: db.query(\'SELECT * WHERE id = $1\', [id])');
    return 1;
  }

  if (hasSafeParams) {
    console.log('✅ Parameterized queries detected (safe from SQL injection)');
    return 0;
  }

  console.log('⚠️ No SQL detected or unable to verify parameterization');
  return 0;
}

function validateAuditLog(code) {
  const hasIncorrect = VALIDATION_RULES.auditLog.incorrect.some((term) => code.includes(term));
  const hasCorrect = VALIDATION_RULES.auditLog.correct.some((term) => code.includes(term));

  if (hasIncorrect) {
    console.log(`❌ AUDIT LOG ERROR: ${VALIDATION_RULES.auditLog.rule}\n`);
    console.log('Found: before/after');
    console.log('Expected: old_value/new_value');
    return 1;
  }

  if (hasCorrect) {
    console.log('✅ Audit log columns correct (old_value/new_value)');
    return 0;
  }

  console.log('⚠️ No audit log detected');
  return 0;
}

function validateBearerAuth(code) {
  const hasCorrect = VALIDATION_RULES.bearerAuth.correct.some((fn) => code.includes(fn));
  const hasIncorrect = VALIDATION_RULES.bearerAuth.incorrect.some((fn) => code.includes(fn));

  if (hasIncorrect && code.includes('/api/')) {
    console.log(`❌ AUTH VIOLATION: ${VALIDATION_RULES.bearerAuth.rule}\n`);
    console.log('Use: import { apiGet, apiPost } from \'@/lib/apiClient\'');
    console.log('Then: await apiGet(\'/api/endpoint\')');
    return 1;
  }

  if (hasCorrect) {
    console.log('✅ Bearer token auth correctly implemented');
    return 0;
  }

  console.log('⚠️ No API calls detected');
  return 0;
}

function getArchitectureRules(topic) {
  try {
    const instructions = fs.readFileSync(COPILOT_INSTRUCTIONS, 'utf-8');
    
    const sections = {
      db: '### 1. Database Connection Order',
      auth: '### 4. Bearer Token Auth',
      'multi-tenant': '### 5. Multi-Tenant Isolation',
      audit: '### 3. Audit Log Columns',
      sql: '### 6. Parameterized Queries Only',
      cors: '### CORS Custom Headers',
      'ai-role': '## AI Role Policy',
    };

    const startMarker = sections[topic];
    if (!startMarker) {
      console.log(`Available topics: ${Object.keys(sections).join(', ')}`);
      return 1;
    }

    const startIndex = instructions.indexOf(startMarker);
    const nextSection = instructions.indexOf('\n### ', startIndex + 1);
    const section = instructions.substring(startIndex, nextSection > 0 ? nextSection : undefined);

    console.log(section);
    return 0;
  } catch (error) {
    console.error(`Error reading architecture rules: ${error.message}`);
    return 1;
  }
}

// CLI handler
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const input = args.slice(1).join(' ');

  if (!command) {
    console.log('ARCH_DOCS Validator CLI');
    console.log('\nCommands:');
    console.log('  validate-db-connection <code>   - Check DB connection order');
    console.log('  validate-multi-tenant <sql>     - Check organization_id in queries');
    console.log('  validate-sql-injection <code>   - Check for parameterized queries');
    console.log('  validate-audit-log <code>       - Check audit log columns');
    console.log('  validate-bearer-auth <code>     - Check Bearer token usage');
    console.log('  get-rules <topic>               - Get ARCH_DOCS rules (db, auth, etc.)');
    console.log('\nExamples:');
    console.log('  node tools/arch-validator-cli.js get-rules db');
    console.log('  node tools/arch-validator-cli.js validate-multi-tenant "SELECT * FROM accounts WHERE id = 1"');
    process.exit(0);
  }

  let exitCode = 0;

  switch (command) {
    case 'validate-db-connection':
      exitCode = validateDbConnection(input);
      break;
    case 'validate-multi-tenant':
      exitCode = validateMultiTenant(input);
      break;
    case 'validate-sql-injection':
      exitCode = validateSqlInjection(input);
      break;
    case 'validate-audit-log':
      exitCode = validateAuditLog(input);
      break;
    case 'validate-bearer-auth':
      exitCode = validateBearerAuth(input);
      break;
    case 'get-rules':
      exitCode = getArchitectureRules(input);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      exitCode = 1;
  }

  process.exit(exitCode);
}

main();

#!/usr/bin/env node

/**
 * Architecture Compliance Validator
 * 
 * Validates code files against Word Is Bond ARCH_DOCS standards.
 * Can be run manually or as a pre-commit hook.
 * 
 * Usage:
 *   node tools/validate-arch-compliance.js [file-path]
 *   node tools/validate-arch-compliance.js --all
 * 
 * Exit codes:
 *   0 - All checks passed
 *   1 - Violations found
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const VALIDATION_RULES = [
  {
    name: 'Database Connection Order',
    pattern: /HYPERDRIVE\?\.connectionString\s*\|\|\s*NEON_PG_CONN/,
    message: 'CRITICAL: Wrong DB connection order. Use NEON_PG_CONN || HYPERDRIVE (not reversed)',
    severity: 'error',
    files: ['workers/src/**/*.ts'],
  },
  {
    name: 'Audit Log Columns',
    pattern: /(?:before|after)(?=\s*:)/,
    antiPattern: /old_value|new_value/,
    message: 'ERROR: Use old_value/new_value in audit logs, not before/after',
    severity: 'error',
    files: ['workers/src/**/*.ts'],
  },
  {
    name: 'Multi-Tenant Isolation',
    pattern: /db\.query\([^)]*SELECT[^)]*FROM[^)]*(?!.*organization_id)/i,
    message: 'WARNING: Query may be missing organization_id for multi-tenant isolation',
    severity: 'warning',
    files: ['workers/src/routes/**/*.ts'],
  },
  {
    name: 'Parameterized Queries',
    pattern: /db\.query\([^)]*\$\{[^}]+\}/,
    message: 'CRITICAL: SQL injection risk. Use parameterized queries ($1, $2) not string interpolation',
    severity: 'error',
    files: ['workers/src/**/*.ts'],
  },
  {
    name: 'Bearer Token Auth',
    pattern: /fetch\(['"`]\/api\//,
    message: 'ERROR: Use apiGet/apiPost from @/lib/apiClient, not raw fetch()',
    severity: 'error',
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
  },
  {
    name: 'Server-Side Next.js Code',
    pattern: /getServerSideProps|cookies\(\)|headers\(\)|export\s+const\s+(?:config|metadata|generateMetadata)\s*=/,
    message: 'CRITICAL: No server-side Next.js code allowed (static export only)',
    severity: 'error',
    files: ['app/**/*.tsx', 'app/**/*.ts'],
  },
];

class ComplianceValidator {
  constructor() {
    this.violations = [];
    this.warnings = [];
  }

  async validateFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.relative(process.cwd(), filePath);

    for (const rule of VALIDATION_RULES) {
      // Check if rule applies to this file
      const applies = rule.files.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        return regex.test(filePath);
      });

      if (!applies) continue;

      // Check for violations
      if (rule.pattern.test(content)) {
        // If there's an antiPattern, check if it exists (makes violation okay)
        if (rule.antiPattern && rule.antiPattern.test(content)) {
          continue;
        }

        const violation = {
          file: fileName,
          rule: rule.name,
          message: rule.message,
          severity: rule.severity,
        };

        if (rule.severity === 'error') {
          this.violations.push(violation);
        } else {
          this.warnings.push(violation);
        }
      }
    }
  }

  async validateAll() {
    const patterns = [...new Set(VALIDATION_RULES.flatMap((r) => r.files))];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { ignore: ['node_modules/**', '.next/**', 'out/**'] });
      
      for (const file of files) {
        await this.validateFile(file);
      }
    }
  }

  report() {
    console.log('\n🔍 Architecture Compliance Report\n');

    if (this.violations.length === 0 && this.warnings.length === 0) {
      console.log('✅ All checks passed! Code complies with ARCH_DOCS standards.\n');
      return 0;
    }

    // Report errors
    if (this.violations.length > 0) {
      console.log(`❌ ${this.violations.length} CRITICAL VIOLATION(S) FOUND:\n`);
      this.violations.forEach((v, i) => {
        console.log(`${i + 1}. ${v.file}`);
        console.log(`   Rule: ${v.rule}`);
        console.log(`   ${v.message}\n`);
      });
    }

    // Report warnings
    if (this.warnings.length > 0) {
      console.log(`⚠️  ${this.warnings.length} WARNING(S):\n`);
      this.warnings.forEach((v, i) => {
        console.log(`${i + 1}. ${v.file}`);
        console.log(`   Rule: ${v.rule}`);
        console.log(`   ${v.message}\n`);
      });
    }

    console.log('📖 See .github/copilot-instructions.md for architecture rules\n');

    return this.violations.length > 0 ? 1 : 0;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const validator = new ComplianceValidator();

  if (args.includes('--all') || args.length === 0) {
    console.log('Validating all files...');
    await validator.validateAll();
  } else {
    for (const filePath of args) {
      await validator.validateFile(path.resolve(filePath));
    }
  }

  const exitCode = validator.report();
  process.exit(exitCode);
}

main().catch((error) => {
  console.error('Validation error:', error);
  process.exit(1);
});

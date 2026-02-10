#!/usr/bin/env tsx
/**
 * Deep Schema Drift Validation
 * Compares DATABASE_SCHEMA_REGISTRY.md with actual Neon database schema
 * 
 * Usage: tsx scripts/validate-schema-drift.ts
 */

import { Client } from 'pg';

const NEON_CONNECTION_STRING = process.env.NEON_PG_CONN;

if (!NEON_CONNECTION_STRING) {
  console.error('❌ NEON_PG_CONN environment variable not set');
  process.exit(1);
}

interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

interface ConstraintInfo {
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  column_name: string | null;
  foreign_table_name: string | null;
  foreign_column_name: string | null;
}

interface IndexInfo {
  table_name: string;
  index_name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
}

interface DriftIssue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  table: string;
  issue: string;
  details?: any;
}

const issues: DriftIssue[] = [];

async function validateSchema() {
  const client = new Client({ connectionString: NEON_CONNECTION_STRING });
  
  try {
    await client.connect();
    console.log('✅ Connected to Neon database\n');

    // 1. Check for snake_case violations
    await checkSnakeCaseCompliance(client);

    // 2. Validate critical tables exist
    await validateCriticalTables(client);

    // 3. Check for missing columns in documented tables
    await validateTableColumns(client);

    // 4. Check for orphaned foreign keys
    await validateForeignKeys(client);

    // 5. Check for missing indexes on frequently queried columns
    await validateIndexes(client);

    // 6. Check for RLS policies
    await validateRLSPolicies(client);

    // 7. Check for audit log columns
    await validateAuditColumns(client);

    // 8. Check for multi-tenant isolation columns
    await validateMultiTenantColumns(client);

    // 9. Validate data types consistency
    await validateDataTypes(client);

    // 10. Check for undocumented tables
    await checkUndocumentedTables(client);

    // Generate report
    generateReport();

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function checkSnakeCaseCompliance(client: Client) {
  console.log('🔍 Checking snake_case compliance...');
  
  const result = await client.query<ColumnInfo>(`
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name ~ '[A-Z]'  -- Contains uppercase letters
    ORDER BY table_name, column_name;
  `);

  if (result.rows.length > 0) {
    result.rows.forEach(row => {
      issues.push({
        severity: 'CRITICAL',
        category: 'NAMING_CONVENTION',
        table: row.table_name,
        issue: `Column "${row.column_name}" violates snake_case convention`,
        details: { column: row.column_name, type: row.data_type }
      });
    });
    console.log(`  ❌ Found ${result.rows.length} snake_case violations\n`);
  } else {
    console.log('  ✅ All columns use snake_case\n');
  }
}

async function validateCriticalTables(client: Client) {
  console.log('🔍 Validating critical tables exist...');
  
  const criticalTables = [
    'users', 'organizations', 'sessions', 'accounts',
    'calls', 'recordings', 'transcriptions', 'ai_summaries',
    'audit_logs', 'org_members', 'scorecards'
  ];

  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
  `);

  const existingTables = new Set(result.rows.map(r => r.table_name));

  criticalTables.forEach(table => {
    if (!existingTables.has(table)) {
      issues.push({
        severity: 'CRITICAL',
        category: 'MISSING_TABLE',
        table: table,
        issue: `Critical table "${table}" does not exist in database`
      });
    }
  });

  const missingCount = criticalTables.filter(t => !existingTables.has(t)).length;
  if (missingCount > 0) {
    console.log(`  ❌ Missing ${missingCount} critical tables\n`);
  } else {
    console.log('  ✅ All critical tables exist\n');
  }
}

async function validateTableColumns(client: Client) {
  console.log('🔍 Validating documented table columns...');

  // Check sessions table (documented in schema registry)
  const sessionsColumns = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'sessions'
    ORDER BY ordinal_position;
  `);

  const expectedSessionsColumns = [
    'id', 'session_token', 'user_id', 'expires', 'created_at', 'updated_at'
  ];

  const actualSessionsColumns = new Set(sessionsColumns.rows.map(r => r.column_name));
  
  expectedSessionsColumns.forEach(col => {
    if (!actualSessionsColumns.has(col)) {
      issues.push({
        severity: 'HIGH',
        category: 'MISSING_COLUMN',
        table: 'sessions',
        issue: `Expected column "${col}" missing from sessions table`
      });
    }
  });

  // Check users table
  const usersColumns = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'users'
    ORDER BY ordinal_position;
  `);

  const expectedUsersColumns = [
    'id', 'name', 'email', 'email_verified', 'image', 'password_hash',
    'organization_id', 'role', 'is_admin', 'created_at', 'updated_at'
  ];

  const actualUsersColumns = new Set(usersColumns.rows.map(r => r.column_name));

  expectedUsersColumns.forEach(col => {
    if (!actualUsersColumns.has(col)) {
      issues.push({
        severity: 'HIGH',
        category: 'MISSING_COLUMN',
        table: 'users',
        issue: `Expected column "${col}" missing from users table`
      });
    }
  });

  console.log('  ✅ Documented columns validated\n');
}

async function validateForeignKeys(client: Client) {
  console.log('🔍 Checking foreign key constraints...');

  const result = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
  `);

  // Check for orphaned foreign keys (referencing non-existent tables)
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  const existingTables = new Set(tables.rows.map(r => r.table_name));

  result.rows.forEach(fk => {
    if (!existingTables.has(fk.foreign_table_name)) {
      issues.push({
        severity: 'CRITICAL',
        category: 'ORPHANED_FK',
        table: fk.table_name,
        issue: `Foreign key references non-existent table "${fk.foreign_table_name}"`,
        details: { column: fk.column_name, constraint: fk.constraint_name }
      });
    }
  });

  console.log(`  ℹ️  Found ${result.rows.length} foreign key constraints\n`);
}

async function validateIndexes(client: Client) {
  console.log('🔍 Validating critical indexes...');

  // Check for indexes on frequently queried columns
  const criticalIndexes = [
    { table: 'sessions', column: 'session_token', expected: true },
    { table: 'sessions', column: 'user_id', expected: true },
    { table: 'sessions', column: 'expires', expected: true },
    { table: 'users', column: 'email', expected: true },
    { table: 'calls', column: 'organization_id', expected: true },
    { table: 'audit_logs', column: 'organization_id', expected: true },
  ];

  const indexes = await client.query(`
    SELECT
      t.relname AS table_name,
      i.relname AS index_name,
      a.attname AS column_name,
      ix.indisunique AS is_unique,
      ix.indisprimary AS is_primary
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relkind = 'r'
    ORDER BY t.relname, i.relname;
  `);

  const indexMap = new Map<string, Set<string>>();
  indexes.rows.forEach(idx => {
    const key = idx.table_name;
    if (!indexMap.has(key)) {
      indexMap.set(key, new Set());
    }
    indexMap.get(key)!.add(idx.column_name);
  });

  criticalIndexes.forEach(({ table, column, expected }) => {
    const tableIndexes = indexMap.get(table) || new Set();
    if (expected && !tableIndexes.has(column)) {
      issues.push({
        severity: 'MEDIUM',
        category: 'MISSING_INDEX',
        table,
        issue: `Missing index on frequently queried column "${column}"`,
        details: { column }
      });
    }
  });

  console.log(`  ℹ️  Found ${indexes.rows.length} indexes\n`);
}

async function validateRLSPolicies(client: Client) {
  console.log('🔍 Checking Row Level Security policies...');

  const result = await client.query(`
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  const tablesWithRLS = new Set(result.rows.map(r => r.tablename));

  // Critical tables that should have RLS policies
  const criticalRLSTables = [
    'calls', 'recordings', 'transcriptions', 'ai_summaries',
    'audit_logs', 'scorecards', 'org_members'
  ];

  criticalRLSTables.forEach(table => {
    if (!tablesWithRLS.has(table)) {
      issues.push({
        severity: 'HIGH',
        category: 'MISSING_RLS',
        table,
        issue: `Critical table "${table}" missing RLS policies for multi-tenant isolation`
      });
    }
  });

  console.log(`  ℹ️  Found RLS policies on ${tablesWithRLS.size} tables\n`);
}

async function validateAuditColumns(client: Client) {
  console.log('🔍 Checking audit columns (old_value/new_value)...');

  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'audit_logs'
    ORDER BY ordinal_position;
  `);

  const columns = new Set(result.rows.map(r => r.column_name));

  if (columns.has('before') || columns.has('after')) {
    issues.push({
      severity: 'CRITICAL',
      category: 'SCHEMA_VIOLATION',
      table: 'audit_logs',
      issue: 'Audit logs using deprecated column names "before"/"after" instead of "old_value"/"new_value"'
    });
  }

  if (!columns.has('old_value') || !columns.has('new_value')) {
    issues.push({
      severity: 'CRITICAL',
      category: 'MISSING_COLUMN',
      table: 'audit_logs',
      issue: 'Audit logs missing required columns "old_value" and/or "new_value"'
    });
  }

  console.log('  ✅ Audit columns validated\n');
}

async function validateMultiTenantColumns(client: Client) {
  console.log('🔍 Validating multi-tenant isolation columns...');

  const businessTables = [
    'calls', 'recordings', 'transcriptions', 'ai_summaries',
    'scorecards', 'campaigns', 'test_configs', 'dialer_campaigns'
  ];

  for (const table of businessTables) {
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = $1
        AND column_name = 'organization_id';
    `, [table]);

    if (result.rows.length === 0) {
      // Check if table exists first
      const tableExists = await client.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [table]);

      if (tableExists.rows.length > 0) {
        issues.push({
          severity: 'CRITICAL',
          category: 'MISSING_TENANT_COLUMN',
          table,
          issue: `Business table "${table}" missing organization_id column for tenant isolation`
        });
      }
    }
  }

  console.log('  ✅ Multi-tenant columns validated\n');
}

async function validateDataTypes(client: Client) {
  console.log('🔍 Validating data type consistency...');

  // Check that all ID columns use consistent types
  const idColumns = await client.query(`
    SELECT 
      table_name,
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('id', 'user_id', 'organization_id', 'call_id')
    ORDER BY column_name, table_name;
  `);

  const idTypeMap = new Map<string, Map<string, string[]>>();

  idColumns.rows.forEach(row => {
    const columnName = row.column_name;
    if (!idTypeMap.has(columnName)) {
      idTypeMap.set(columnName, new Map());
    }
    const typeMap = idTypeMap.get(columnName)!;
    const dataType = row.udt_name; // Use UDT name for accurate type
    if (!typeMap.has(dataType)) {
      typeMap.set(dataType, []);
    }
    typeMap.get(dataType)!.push(row.table_name);
  });

  // Report inconsistencies
  idTypeMap.forEach((typeMap, columnName) => {
    if (typeMap.size > 1) {
      issues.push({
        severity: 'MEDIUM',
        category: 'TYPE_INCONSISTENCY',
        table: 'MULTIPLE',
        issue: `Column "${columnName}" has inconsistent data types across tables`,
        details: Object.fromEntries(typeMap)
      });
    }
  });

  console.log('  ✅ Data types validated\n');
}

async function checkUndocumentedTables(client: Client) {
  console.log('🔍 Checking for undocumented tables...');

  const result = await client.query(`
    SELECT 
      table_name,
      (SELECT COUNT(*) FROM information_schema.columns 
       WHERE table_schema = 'public' AND columns.table_name = tables.table_name) as column_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE 'sql_%'
    ORDER BY table_name;
  `);

  // Tables documented in DATABASE_SCHEMA_REGISTRY.md
  const documentedTables = new Set([
    'users', 'sessions', 'accounts', 'verification_tokens',
    'organizations', 'org_members', 'team_invites',
    'calls', 'recordings', 'transcriptions', 'ai_summaries',
    'audit_logs', 'scorecards', 'call_outcomes',
    'campaigns', 'test_configs', 'test_results',
    'voice_configs', 'live_translations', 'webrtc_sessions',
    'evidence_bundles', 'custody_chains', 'retention_policies',
    'dialer_agents', 'dialer_campaigns', 'ivr_configs'
  ]);

  const undocumented: string[] = [];
  result.rows.forEach(row => {
    if (!documentedTables.has(row.table_name)) {
      undocumented.push(row.table_name);
      issues.push({
        severity: 'LOW',
        category: 'UNDOCUMENTED_TABLE',
        table: row.table_name,
        issue: `Table "${row.table_name}" exists but not documented in DATABASE_SCHEMA_REGISTRY.md`,
        details: { column_count: row.column_count }
      });
    }
  });

  if (undocumented.length > 0) {
    console.log(`  ⚠️  Found ${undocumented.length} undocumented tables\n`);
  } else {
    console.log('  ✅ All tables are documented\n');
  }
}

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 SCHEMA DRIFT VALIDATION REPORT');
  console.log('='.repeat(80) + '\n');

  const severityCounts = {
    CRITICAL: issues.filter(i => i.severity === 'CRITICAL').length,
    HIGH: issues.filter(i => i.severity === 'HIGH').length,
    MEDIUM: issues.filter(i => i.severity === 'MEDIUM').length,
    LOW: issues.filter(i => i.severity === 'LOW').length,
    INFO: issues.filter(i => i.severity === 'INFO').length,
  };

  console.log('Summary:');
  console.log(`  🔴 CRITICAL: ${severityCounts.CRITICAL}`);
  console.log(`  🟠 HIGH:     ${severityCounts.HIGH}`);
  console.log(`  🟡 MEDIUM:   ${severityCounts.MEDIUM}`);
  console.log(`  🟢 LOW:      ${severityCounts.LOW}`);
  console.log(`  ℹ️  INFO:     ${severityCounts.INFO}`);
  console.log(`  📋 TOTAL:    ${issues.length}\n`);

  if (issues.length === 0) {
    console.log('✅ No schema drift detected! Database matches documented schema.\n');
    return;
  }

  // Group by severity
  ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].forEach(severity => {
    const filtered = issues.filter(i => i.severity === severity);
    if (filtered.length === 0) return;

    console.log(`\n${severity} Issues (${filtered.length}):`);
    console.log('-'.repeat(80));

    filtered.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. [${issue.category}] ${issue.table}`);
      console.log(`   ${issue.issue}`);
      if (issue.details) {
        console.log(`   Details: ${JSON.stringify(issue.details, null, 2)}`);
      }
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log(`Total Issues Found: ${issues.length}`);
  console.log('='.repeat(80) + '\n');

  // Write to file
  const fs = require('fs');
  const reportPath = 'SCHEMA_DRIFT_REPORT.md';
  
  let markdown = `# Schema Drift Validation Report\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}\n`;
  markdown += `**Database:** Neon PostgreSQL 17 (WordIsBond Production)\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `| Severity | Count |\n`;
  markdown += `|----------|-------|\n`;
  markdown += `| 🔴 CRITICAL | ${severityCounts.CRITICAL} |\n`;
  markdown += `| 🟠 HIGH | ${severityCounts.HIGH} |\n`;
  markdown += `| 🟡 MEDIUM | ${severityCounts.MEDIUM} |\n`;
  markdown += `| 🟢 LOW | ${severityCounts.LOW} |\n`;
  markdown += `| ℹ️  INFO | ${severityCounts.INFO} |\n`;
  markdown += `| **TOTAL** | **${issues.length}** |\n\n`;

  ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].forEach(severity => {
    const filtered = issues.filter(i => i.severity === severity);
    if (filtered.length === 0) return;

    markdown += `## ${severity} Issues (${filtered.length})\n\n`;
    
    filtered.forEach((issue, idx) => {
      markdown += `### ${idx + 1}. [${issue.category}] ${issue.table}\n\n`;
      markdown += `**Issue:** ${issue.issue}\n\n`;
      if (issue.details) {
        markdown += `**Details:**\n\`\`\`json\n${JSON.stringify(issue.details, null, 2)}\n\`\`\`\n\n`;
      }
    });
  });

  fs.writeFileSync(reportPath, markdown);
  console.log(`📄 Report saved to: ${reportPath}\n`);
}

// Run validation
validateSchema().catch(console.error);

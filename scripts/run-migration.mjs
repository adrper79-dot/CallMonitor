// Migration runner — executes SQL files against Neon via @neondatabase/serverless
// Usage: node scripts/run-migration.mjs <migration-file>

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CONN = process.env.NEON_PG_CONN || 'postgresql://neondb_owner:npg_HKXlEiWM9BF2@ep-mute-recipe-ahsibut8-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/run-migration.mjs <migration-file>');
  process.exit(1);
}

const sql = neon(CONN);
const filePath = resolve(file);
const content = readFileSync(filePath, 'utf-8');

console.log(`\n=== Running migration: ${file} ===\n`);

// Split on semicolons, filter empty, run each statement
// But handle DO $$ blocks properly
const statements = [];
let current = '';
let inDollarBlock = false;

for (const line of content.split('\n')) {
  const trimmed = line.trim();
  
  // Skip pure comments and empty lines at statement boundaries
  if (!inDollarBlock && !current.trim() && (trimmed.startsWith('--') || trimmed === '')) {
    continue;
  }

  current += line + '\n';

  // Track $$ blocks (DO $$ ... END $$;)
  const dollarCount = (line.match(/\$\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
    inDollarBlock = !inDollarBlock;
  }

  // Statement ends with ; outside of $$ blocks
  if (!inDollarBlock && trimmed.endsWith(';')) {
    const stmt = current.trim();
    if (stmt && !stmt.startsWith('--') && stmt !== ';') {
      statements.push(stmt);
    }
    current = '';
  }
}

console.log(`Parsed ${statements.length} statements\n`);

let success = 0;
let skipped = 0;
let errors = 0;

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.substring(0, 120).replace(/\n/g, ' ');
  
  // Skip BEGIN/COMMIT for neon serverless (auto-commits)
  if (stmt.trim() === 'BEGIN;' || stmt.trim() === 'COMMIT;') {
    console.log(`[${i+1}/${statements.length}] SKIP: ${stmt.trim()}`);
    skipped++;
    continue;
  }

  // Skip CREATE INDEX CONCURRENTLY - neon serverless doesn't support it in HTTP mode
  // These need to be run via psql or the Neon SQL Editor
  if (stmt.includes('CREATE INDEX CONCURRENTLY')) {
    console.log(`[${i+1}/${statements.length}] SKIP (CONCURRENTLY - run via SQL Editor): ${preview.substring(0, 80)}...`);
    skipped++;
    continue;
  }

  try {
    await sql.query(stmt);
    console.log(`[${i+1}/${statements.length}] OK: ${preview.substring(0, 100)}...`);
    success++;
  } catch (err) {
    // IF NOT EXISTS / already exists errors are OK
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log(`[${i+1}/${statements.length}] SKIP (already exists): ${preview.substring(0, 80)}...`);
      skipped++;
    } else {
      console.error(`[${i+1}/${statements.length}] ERROR: ${err.message}`);
      console.error(`  Statement: ${preview.substring(0, 100)}...`);
      errors++;
    }
  }
}

console.log(`\n=== Migration complete: ${success} OK, ${skipped} skipped, ${errors} errors ===\n`);
if (errors > 0) process.exit(1);

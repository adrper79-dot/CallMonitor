#!/usr/bin/env node

/**
 * ARCH_DOCS MCP Server — Architecture Compliance Validator
 * 
 * This MCP server provides Claude with tools to validate code against
 * Word Is Bond architecture standards defined in ARCH_DOCS/.
 * 
 * Tools provided:
 * - validate_db_connection: Check database connection order
 * - validate_auth: Verify Bearer token usage
 * - validate_multi_tenant: Check organization_id in queries
 * - validate_audit_log: Verify audit log column names
 * - validate_sql: Check for parameterized queries
 * - get_architecture_rules: Retrieve specific ARCH_DOCS rules
 * 
 * Requirements:
 * - Install MCP SDK: npm install -g @modelcontextprotocol/sdk
 * 
 * Usage:
 * Add to .claude/settings.local.json:
 * "arch-docs-validator": {
 *   "command": "node",
 *   "args": ["tools/arch-docs-mcp-server.js"]
 * }
 * 
 * Note: This is a simplified standalone validator that doesn't require MCP SDK.
 * For full MCP integration, install the SDK and use the ES module version.
 */

const fs = require('fs');
const path = require('path');

const ARCH_DOCS_PATH = path.join(process.cwd(), 'ARCH_DOCS');
const COPILOT_INSTRUCTIONS = path.join(process.cwd(), '.github/copilot-instructions.md');

// Architecture validation rules
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

class ArchDocsServer {
  constructor() {
    this.server = new Server(
      {
        name: 'arch-docs-validator',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'validate_db_connection',
          description: 'Validate database connection order (NEON_PG_CONN before HYPERDRIVE)',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Code snippet to validate',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'validate_multi_tenant',
          description: 'Check if SQL query includes organization_id for multi-tenant isolation',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'SQL query to validate',
              },
            },
            required: ['sql'],
          },
        },
        {
          name: 'validate_sql_injection',
          description: 'Check for SQL injection vulnerabilities (parameterized queries)',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Code snippet containing SQL',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'validate_audit_log',
          description: 'Verify audit log uses old_value/new_value (not before/after)',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Code snippet with audit logging',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'validate_bearer_auth',
          description: 'Check if client code uses apiGet/apiPost instead of raw fetch()',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Client-side code to validate',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'get_architecture_rules',
          description: 'Retrieve specific architecture rules from ARCH_DOCS',
          inputSchema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Topic: db, auth, multi-tenant, audit, sql, cors, ai-role',
              },
            },
            required: ['topic'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'validate_db_connection':
          return this.validateDbConnection(args.code);
        case 'validate_multi_tenant':
          return this.validateMultiTenant(args.sql);
        case 'validate_sql_injection':
          return this.validateSqlInjection(args.code);
        case 'validate_audit_log':
          return this.validateAuditLog(args.code);
        case 'validate_bearer_auth':
          return this.validateBearerAuth(args.code);
        case 'get_architecture_rules':
          return this.getArchitectureRules(args.topic);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  validateDbConnection(code) {
    const hasCorrect = code.includes(VALIDATION_RULES.dbConnection.correct);
    const hasIncorrect = code.includes(VALIDATION_RULES.dbConnection.incorrect);

    if (hasIncorrect) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ CRITICAL VIOLATION: ${VALIDATION_RULES.dbConnection.rule}\n\n` +
                  `Found: ${VALIDATION_RULES.dbConnection.incorrect}\n` +
                  `Expected: ${VALIDATION_RULES.dbConnection.correct}\n\n` +
                  `This causes HTTP 530 errors. Must fix before deployment.`,
          },
        ],
      };
    }

    if (hasCorrect) {
      return {
        content: [
          {
            type: 'text',
            text: '✅ Database connection order is correct',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `⚠️ No database connection detected. Remember: ${VALIDATION_RULES.dbConnection.rule}`,
        },
      ],
    };
  }

  validateMultiTenant(sql) {
    const hasOrgId = VALIDATION_RULES.multiTenant.pattern.test(sql);

    if (!hasOrgId && sql.toLowerCase().includes('select') && sql.toLowerCase().includes('from')) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ SECURITY VIOLATION: ${VALIDATION_RULES.multiTenant.rule}\n\n` +
                  `Query missing organization_id filter. This can leak data across tenants.\n\n` +
                  `Fix: Add WHERE organization_id = $1 (or AND if WHERE exists)`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: hasOrgId
            ? '✅ Multi-tenant isolation verified (organization_id in WHERE clause)'
            : '⚠️ Query validation: Ensure organization_id is included for business queries',
        },
      ],
    };
  }

  validateSqlInjection(code) {
    const hasSafeParams = VALIDATION_RULES.sqlInjection.safe.test(code);
    const hasUnsafeParams = VALIDATION_RULES.sqlInjection.unsafe.test(code);

    if (hasUnsafeParams && code.includes('query(')) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ SQL INJECTION RISK: ${VALIDATION_RULES.sqlInjection.rule}\n\n` +
                  `Found string interpolation in SQL query.\n` +
                  `Use parameterized queries: db.query('SELECT * WHERE id = $1', [id])`,
          },
        ],
      };
    }

    if (hasSafeParams) {
      return {
        content: [
          {
            type: 'text',
            text: '✅ Parameterized queries detected (safe from SQL injection)',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: '⚠️ No SQL detected or unable to verify parameterization',
        },
      ],
    };
  }

  validateAuditLog(code) {
    const hasIncorrect = VALIDATION_RULES.auditLog.incorrect.some((term) => code.includes(term));
    const hasCorrect = VALIDATION_RULES.auditLog.correct.some((term) => code.includes(term));

    if (hasIncorrect) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ AUDIT LOG ERROR: ${VALIDATION_RULES.auditLog.rule}\n\n` +
                  `Found: before/after\n` +
                  `Expected: old_value/new_value`,
          },
        ],
      };
    }

    if (hasCorrect) {
      return {
        content: [
          {
            type: 'text',
            text: '✅ Audit log columns correct (old_value/new_value)',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: '⚠️ No audit log detected',
        },
      ],
    };
  }

  validateBearerAuth(code) {
    const hasCorrect = VALIDATION_RULES.bearerAuth.correct.some((fn) => code.includes(fn));
    const hasIncorrect = VALIDATION_RULES.bearerAuth.incorrect.some((fn) => code.includes(fn));

    if (hasIncorrect && code.includes('/api/')) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ AUTH VIOLATION: ${VALIDATION_RULES.bearerAuth.rule}\n\n` +
                  `Use: import { apiGet, apiPost } from '@/lib/apiClient'\n` +
                  `Then: await apiGet('/api/endpoint')`,
          },
        ],
      };
    }

    if (hasCorrect) {
      return {
        content: [
          {
            type: 'text',
            text: '✅ Bearer token auth correctly implemented',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: '⚠️ No API calls detected',
        },
      ],
    };
  }

  getArchitectureRules(topic) {
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
        return {
          content: [
            {
              type: 'text',
              text: `Available topics: ${Object.keys(sections).join(', ')}`,
            },
          ],
        };
      }

      const startIndex = instructions.indexOf(startMarker);
      const nextSection = instructions.indexOf('\n### ', startIndex + 1);
      const section = instructions.substring(startIndex, nextSection > 0 ? nextSection : undefined);

      return {
        content: [
          {
            type: 'text',
            text: section,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading architecture rules: ${error.message}`,
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('ARCH_DOCS MCP server running on stdio');
  }
}

const server = new ArchDocsServer();
server.run().catch(console.error);

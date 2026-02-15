# Claude Skills Configuration Guide

**Project:** Word Is Bond v4.66  
**Date:** February 14, 2026  
**Setup Level:** Production-Grade with MCP Integration

---

## 🎯 Overview

Your Claude skills are now configured for **high-autonomy development** with comprehensive automation and architecture compliance enforcement.

### Capabilities Enabled

✅ **Auto-approved workflows:** Testing, building, deployments, read operations  
✅ **MCP Server Integration:** Neon DB, GitHub, Custom ARCH_DOCS validator  
✅ **Architecture Compliance:** Real-time validation against ARCH_DOCS standards  
✅ **Smart Permissions:** 40+ safe commands whitelisted, destructive ops blocked  

---

## 📁 Configuration Files

### `.claude/settings.local.json`

**Features:**
- **3 MCP Servers** configured (Neon, GitHub, ARCH_DOCS)
- **60+ whitelisted commands** (testing, builds, deploys, monitoring)
- **10 blocked operations** (destructive commands)
- **3 custom skills** (arch-compliance-check, test-runner, deployment-workflow)

**Critical Permissions:**
```json
{
  "allow": [
    "npm test*",           // All test commands
    "npm run build*",      // Build processes
    "npx wrangler deploy*" // Cloudflare deployments
  ],
  "deny": [
    "rm -rf*",            // Prevent accidental deletions
    "DROP DATABASE*",      // Block destructive DB ops
    "git push --force*"    // Prevent force pushes
  ]
}
```

---

## 🔧 MCP Servers

### 1. **Neon Database MCP**

**Purpose:** Direct PostgreSQL access for schema inspection, query optimization

**Tools Available:**
- `neon_list_databases` - Show all databases
- `neon_execute_query` - Run SELECT queries
- `neon_explain_query` - Get query execution plans
- `neon_list_tables` - Show table schemas

**Environment Required:**
```bash
# Add to .env.local
NEON_API_KEY=napi_YOUR_NEON_API_KEY_HERE
```

**Get API Key:**
1. Go to https://console.neon.tech
2. Navigate to Account Settings → API Keys
3. Create new API key
4. Copy to `.env.local`

### 2. **GitHub MCP**

**Purpose:** PR management, issue tracking, code review automation

**Tools Available:**
- `create_pull_request` - Create PRs from Claude
- `list_issues` - Search issues
- `create_issue` - File bugs/features
- `add_pr_review` - Comment on PRs

**Environment Required:**
```bash
# Add to .env.local
GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE
```

**Get Token:**
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Scopes: `repo`, `workflow`, `write:discussion`
4. Copy to `.env.local`

### 3. **ARCH_DOCS Validator MCP** (Custom)

**Purpose:** Real-time architecture compliance checking

**Tools Available:**
- `validate_db_connection` - Check DB connection order
- `validate_multi_tenant` - Verify organization_id in queries
- `validate_sql_injection` - Detect parameterization issues
- `validate_audit_log` - Check old_value/new_value usage
- `validate_bearer_auth` - Verify apiGet/apiPost usage
- `get_architecture_rules` - Retrieve ARCH_DOCS rules

**Implementation:**
- File: [`tools/arch-docs-mcp-server.js`](tools/arch-docs-mcp-server.js)
- No environment variables needed (reads local ARCH_DOCS/)

---

## 🚀 Usage Examples

### Running Tests

```bash
# Claude can now auto-approve these:
npm test
npm run test:production
npm run test:dialer:e2e
npx vitest tests/production/dialer-integration.test.ts
```

### Deployment Workflow

```bash
# Full deployment sequence (auto-approved):
npm run build
npm run api:deploy
npm run pages:deploy
npm run health-check
```

### Architecture Validation

Ask Claude:
- "Validate this code against ARCH_DOCS standards"
- "Check if my SQL query uses parameterized queries"
- "Does this route have multi-tenant isolation?"

Claude will use the ARCH_DOCS MCP to validate in real-time.

### Database Operations

Ask Claude:
- "Show me the schema for the messages table"
- "Explain this slow query"
- "Compare database schemas between branches"

Claude will use Neon MCP server directly.

### GitHub Integration

Ask Claude:
- "Create a PR for this feature"
- "List open issues labeled 'bug'"
- "Review the latest PR and add comments"

---

## ⚙️ Setup Instructions

### Step 1: Install MCP Dependencies

```bash
# Install MCP SDK (if not already installed)
npm install -g @modelcontextprotocol/sdk

# Install Neon MCP
npm install -g @neondatabase/mcp-server-neon

# Install GitHub MCP
npm install -g @modelcontextprotocol/server-github
```

### Step 2: Configure Environment Variables

Create or update `.env.local`:

```bash
# Neon MCP
NEON_API_KEY=napi_YOUR_NEON_API_KEY_HERE

# GitHub MCP
GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE
```

### Step 3: Verify MCP Servers

```bash
# Test Neon MCP
npx @neondatabase/mcp-server-neon --help

# Test GitHub MCP
npx @modelcontextprotocol/server-github --help

# Test ARCH_DOCS MCP
node tools/arch-docs-mcp-server.js
```

### Step 4: Test Architecture Validator

```bash
# Validate all files
node tools/validate-arch-compliance.js --all

# Validate specific file
node tools/validate-arch-compliance.js workers/src/routes/calls.ts
```

### Step 5: Restart Claude

1. Close VS Code
2. Reopen workspace
3. Claude will auto-load MCP servers from `.claude/settings.local.json`

---

## 📋 Skill Definitions

### 1. **arch-compliance-check**

**Trigger:** Before every commit  
**Action:** Runs `tools/validate-arch-compliance.js`  
**Purpose:** Prevent ARCH_DOCS violations from being committed

### 2. **test-runner**

**Commands:**
- `unit` → `npm run test:production`
- `e2e` → `npm run test:dialer:e2e`
- `all` → `npm run test:dialer:all`

**Purpose:** Intelligent test suite selection

### 3. **deployment-workflow**

**Steps:**
1. `npm run build` - Build Next.js static export
2. `npm run api:deploy` - Deploy Cloudflare Workers
3. `npm run pages:deploy` - Deploy Cloudflare Pages
4. `npm run health-check` - Verify deployment

**Purpose:** Safe, repeatable deployment sequence

---

## 🔒 Security & Safety

### Blocked Operations

These commands are **ALWAYS denied** even if Claude tries to run them:

```bash
rm -rf *                    # Recursive delete
DROP DATABASE               # Database deletion
DELETE FROM * WHERE 1=1     # Full table delete
TRUNCATE                    # Table truncation
git push --force            # Force push
git reset --hard            # Hard reset
npm publish                 # Package publish
wrangler secret put         # Secret modification
```

### Safe Operations (Auto-Approved)

These are **ALWAYS safe** and auto-approved:

```bash
cat, ls, find, grep         # Read operations
npm test, vitest            # Testing
npm run build, tsc          # Building
git status, git log         # Git read
psql -c 'SELECT...'         # Read-only DB queries
```

---

## 🎓 Advanced Usage

### Custom Skill Creation

Add new skills to `.claude/settings.local.json`:

```json
{
  "skills": {
    "my-custom-skill": {
      "description": "What this skill does",
      "trigger": "when-to-run",
      "script": "npm run custom-script"
    }
  }
}
```

### Pre-Commit Hook Integration

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Architecture compliance check
node tools/validate-arch-compliance.js --all

# If errors found, abort commit
if [ $? -ne 0 ]; then
  echo "❌ Commit blocked: Architecture violations detected"
  exit 1
fi
```

### CI/CD Integration

Add to GitHub Actions `.github/workflows/ci.yml`:

```yaml
- name: Validate Architecture Compliance
  run: node tools/validate-arch-compliance.js --all
```

---

## 📊 Monitoring & Metrics

### Track Skill Usage

Ask Claude:
- "How many commands did you auto-approve today?"
- "Show me the last 10 architecture validations"
- "What's my deployment success rate?"

### Adjust Permissions

If Claude needs a new command:

1. Add to `.claude/settings.local.json` in `permissions.allow`
2. Restart Claude (reload VS Code)
3. Command will be auto-approved next time

If too permissive:

1. Move command from `allow` to `deny`
2. Restart Claude
3. Command will require manual approval

---

## 🐛 Troubleshooting

### MCP Server Not Loading

**Symptom:** Claude doesn't have Neon/GitHub tools available

**Fix:**
```bash
# Check MCP installation
npm list -g @neondatabase/mcp-server-neon
npm list -g @modelcontextprotocol/server-github

# Reinstall if missing
npm install -g @neondatabase/mcp-server-neon
npm install -g @modelcontextprotocol/server-github

# Reload VS Code
Ctrl+Shift+P → "Developer: Reload Window"
```

### Environment Variables Not Found

**Symptom:** `NEON_API_KEY` or `GITHUB_TOKEN` undefined

**Fix:**
```bash
# Verify .env.local exists
cat .env.local | grep NEON_API_KEY
cat .env.local | grep GITHUB_TOKEN

# If missing, add them
echo "NEON_API_KEY=your_key" >> .env.local
echo "GITHUB_TOKEN=your_token" >> .env.local

# Restart Claude
```

### Architecture Validator False Positives

**Symptom:** Valid code flagged as violation

**Fix:** Update `tools/validate-arch-compliance.js` validation rules to exclude specific patterns:

```javascript
{
  name: 'Rule Name',
  pattern: /violation-pattern/,
  antiPattern: /exception-pattern/,  // Add this to whitelist
  // ...
}
```

---

## 📚 References

- **MCP Documentation:** https://modelcontextprotocol.io/docs
- **Neon MCP:** https://github.com/neondatabase/mcp-server-neon
- **GitHub MCP:** https://github.com/modelcontextprotocol/servers
- **ARCH_DOCS:** `.github/copilot-instructions.md`

---

## ✅ Next Steps

1. **Install MCP servers** (Step 1 above)
2. **Configure environment variables** (Step 2)
3. **Test architecture validator** (Step 4)
4. **Restart Claude** (Step 5)
5. **Try asking Claude:** "Validate my code against ARCH_DOCS" or "Run the test suite"

Your skills setup is now **production-ready** for high-velocity development with automated compliance checking! 🚀

---

**Questions?** Ask Claude: "Explain my current skills configuration" or "How do I use the ARCH_DOCS MCP server?"

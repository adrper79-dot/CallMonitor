# 🎯 AI Prompt Template for Bug-Free Development

Use this template when requesting features or fixes to ensure completeness.

---

## 📋 **STANDARD PROMPT TEMPLATE**

```
[ACTION]: Add/Fix/Update [Feature Name]

CONTEXT:
- Environment: Production (voxsouth.online)
- Organization ID: 143a4ad7-403c-4933-a0e6-553b05ca77a2
- User: stepdadstrong@gmail.com

REQUIREMENTS:
1. Functional: [What should it do?]
2. Data Source: [Database tables, API endpoints]
3. Authentication: [Who can access?]
4. UI Location: [Where does it appear?]

VALIDATION REQUIREMENTS (DO NOT SKIP):
✓ Check database tables exist
✓ Verify environment variables are set
✓ Test with real data (NO MOCKS)
✓ Confirm RLS policies allow access
✓ Verify no console errors
✓ Use logger.* instead of console.*
✓ Validate all env vars through lib/env-validation.ts
✓ No 'as any' type casts without comments
✓ Proper error handling (no empty catch blocks)

DELIVERABLES:
- Working code (no TODOs/placeholders)
- Migration file (if new tables needed)
- Diagnostic verification script
- Test commands to verify
- Environment variable checklist

TEST ACCEPTANCE:
Provide commands to verify:
- [ ] Database schema aligned
- [ ] API returns real data (curl command)
- [ ] UI renders without errors
- [ ] No console warnings/errors
- [ ] All env vars validated
```

---

## 🚀 **QUICK REFERENCE CHECKLIST**

### Before Requesting a Feature:
```
□ I know which database tables are needed
□ I know what environment variables are required
□ I know who should have access (RBAC)
□ I have the organization ID for testing
□ I can test on the live site (voxsouth.online)
```

### What to Include in Every Prompt:
```
✓ Organization ID: 143a4ad7-403c-4933-a0e6-553b05ca77a2
✓ Environment: Production URL
✓ Specific user email for testing
✓ "NO MOCK DATA" requirement
✓ "DEEP VALIDATION MODE" phrase
✓ Request for diagnostic script
```

---

## 📝 **EXAMPLE PROMPTS**

### ✅ **GOOD PROMPT** (Complete)

```
[FIX]: Voice Operations Console Errors

CONTEXT:
- Environment: Production (voxsouth.online)
- User: stepdadstrong@gmail.com  
- Org: 143a4ad7-403c-4933-a0e6-553b05ca77a2

CURRENT ISSUES:
- React errors #425, #422 in console
- Logo image returns 404
- /api/campaigns returns 500

REQUIREMENTS:
1. Fix all console errors
2. All APIs return 200 (empty array if no data)
3. Verify database tables exist
4. Use logger.* not console.*
5. Validate all env vars

DEEP VALIDATION MODE:
- Check live database schema
- Test all APIs with curl commands
- Verify no type errors ('as any')
- Create diagnostic script
- Confirm zero console errors

DELIVERABLES:
- Fixed code (deployed)
- Diagnostic SQL + API test script
- Verification checklist
- Curl commands to test

TEST COMMANDS:
Provide commands to verify each fix works.
```

### ❌ **BAD PROMPT** (Incomplete)

```
Add a surveys feature
```

**Why it's bad:**
- No context (which environment?)
- No validation requirements
- No test criteria
- No mention of data source
- Will likely have mock data
- Missing error handling requirements

---

## 🎯 **MAGIC PHRASES**

Add these to your prompts for thoroughness:

### **"DEEP VALIDATION MODE"**
Triggers comprehensive checking:
- Database schema verification
- Environment variable validation  
- Real data testing
- Error handling review
- Type safety check

### **"NO MOCK DATA"**
Ensures real implementations:
- All data from database/APIs
- No hardcoded values
- No placeholder text
- Real authentication checks

### **"PRODUCTION READY"**
Enforces quality standards:
- Logger instead of console
- Validated env vars
- Proper error handling
- Type safety
- RLS policies

---

## 🛠️ **SPECIFIC USE CASES**

### For Database Changes:
```
[DATABASE]: Add [table name]

BEFORE CODING:
✓ Check if table exists in schema
✓ Verify RLS policies needed
✓ Check foreign key constraints
✓ Identify missing indexes

DELIVERABLES:
- Migration file with RLS
- Rollback script
- Verification SQL query
- Updated Schema.txt documentation
```

### For API Endpoints:
```
[API]: Add/Fix /api/[route]

VALIDATION:
✓ Authentication required?
✓ Database tables exist?
✓ Environment vars needed?
✓ Rate limiting needed?
✓ Error handling complete?
✓ Logging with context?

DELIVERABLES:
- API route implementation
- Curl command to test
- Error response examples
- Rate limit configuration
```

### For UI Components:
```
[UI]: Add/Fix [Component Name]

REQUIREMENTS:
✓ No hardcoded data
✓ Load from API
✓ Handle loading state
✓ Handle empty state  
✓ Handle error state
✓ No console statements

DELIVERABLES:
- Component implementation
- API integration confirmed
- Screenshots of states
- Zero console errors
```

---

## 🔍 **VERIFICATION TEMPLATE**

After AI completes work, use this checklist:

```bash
# 1. Check for console statements
rg "console\.(log|error|warn)" [files] && echo "❌ FAILED" || echo "✅ PASSED"

# 2. Check for unvalidated env vars
rg "process\.env\.[A-Z_]+" [files] --type ts | grep -v "env-validation" && echo "❌ FAILED" || echo "✅ PASSED"

# 3. Check for type safety issues
rg "as any" [files] && echo "⚠️  WARNING: Review needed"

# 4. Check for mock data
rg -i "mock|fake|dummy|placeholder" [files] --type ts && echo "❌ FAILED" || echo "✅ PASSED"

# 5. Check for empty catch blocks
rg "catch \(e\) \{\}|catch \(\) \{\}" [files] && echo "❌ FAILED" || echo "✅ PASSED"

# 6. Run diagnostic script
node scripts/deep-validation-api.js

# 7. Check database alignment
psql [DB_URL] < scripts/deep-validation.sql
```

---

## 💡 **PRO TIPS**

1. **Always provide org ID** - Enables real testing
2. **Specify environment** - Production vs development 
3. **Request diagnostic scripts** - Independent verification
4. **Ask for before/after checks** - Ensures alignment
5. **Include test commands** - Makes validation easy
6. **Use "DEEP VALIDATION MODE"** - Triggers thoroughness
7. **Mention "NO MOCK DATA"** - Forces real implementations
8. **Reference BUG_REPORT.md** - Learn from past issues

---

## 📚 **STANDARD REFERENCES**

Include these in complex prompts:

```
STANDARDS TO FOLLOW:
- Logging: Use lib/logger.ts (NO console.*)
- Env Vars: Validate via lib/env-validation.ts
- Errors: Use types/app-error.ts (AppError)
- Auth: Check via lib/middleware/rbac.ts
- Database: Enable RLS on all tables
- Types: No 'as any' without comment

DOCUMENTATION TO UPDATE:
- ARCH_DOCS/01-CORE/Schema.txt (if DB changes)
- ARCH_DOCS/CURRENT_STATUS.md (if features added)
- migrations/ (if schema changes)

BUG PATTERNS TO AVOID:
- See BUG_REPORT.md for known issues
- 830+ console statements found (use logger!)
- 161+ unvalidated env vars (use config!)
- 294+ 'as any' casts (use proper types!)
```

---

## ✅ **SUCCESS CRITERIA**

A prompt is complete when it specifies:

1. ✅ **Context** (environment, user, org ID)
2. ✅ **Requirements** (functional, data, auth, UI)
3. ✅ **Validation** (database, env vars, real data, no errors)
4. ✅ **Deliverables** (code, migrations, diagnostics, tests)
5. ✅ **Test Commands** (how to verify it works)

---

**Template Version:** 1.0  
**Last Updated:** January 14, 2026  
**Maintained By:** Latimer Woods Tech LLC

# AI Features Diagnostic Test — 2026-02-11

## Context

- User added GROQ_API_KEY and OPENAI_API_KEY to Cloudflare yesterday
- AI features still not functioning
- Translation pipeline still not working
- Mysterious "Claude 4.6" prompts appearing in logs (source unknown)

## Test Commands

### 1. Verify Secrets Are Set (without revealing values)

```powershell
wrangler secret list --config workers/wrangler.toml
```

**Expected:** Should see `GROQ_API_KEY` and `OPENAI_API_KEY` in list

---

### 2. Test AI Endpoint (requires valid session token)

**Get session token:**

1. Login to https://wordis-bond.com/signin
2. Open DevTools → Application → Cookies → find `wib_session`
3. Copy value

**Test OpenAI chat:**

```powershell
$token = "YOUR_SESSION_TOKEN_HERE"
curl -s "https://wordisbond-api.adrper79.workers.dev/api/ai/llm/chat" `
  -X POST `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"messages":[{"role":"user","content":"What is 2+2?"}],"model":"gpt-4o-mini"}' `
  | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

**Expected Success Response:**

```json
{
  "content": "4",
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 1,
    "total_tokens": 13
  },
  "model": "gpt-4o-mini"
}
```

**Expected Error Responses:**

- `{"error":"Authentication required"}` → Token invalid/expired
- `{"error":"LLM service not configured"}` → `OPENAI_API_KEY` missing
- `{"error":"LLM service error"}` → OpenAI API key invalid or rate-limited
- `{"error":"Upgrade required"}` → User on free plan (needs Pro)

---

### 3. Test Translation Endpoint

```powershell
$token = "YOUR_SESSION_TOKEN_HERE"
curl -s "https://wordisbond-api.adrper79.workers.dev/api/ai/llm/summarize" `
  -X POST `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"text":"Hello, how are you doing today?","max_length":100}' `
  | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

---

### 4. Tail Live Logs (capture 2 minutes)

```powershell
# Run this for 2 minutes while testing AI features
wrangler tail --config workers/wrangler.toml --format pretty > ai_test_logs.txt
# Ctrl+C to stop

# Then search for errors:
Get-Content ai_test_logs.txt | Select-String -Pattern "error|failed|503|500|Claude" -Context 3
```

---

### 5. Check AI Router Behavior

The AI router at [`workers/src/lib/ai-router.ts`](workers/src/lib/ai-router.ts) routes tasks based on complexity:

| Task Type           | Complexity Score | Router Decision                   |
| ------------------- | ---------------- | --------------------------------- |
| translation         | 2                | ✅ Groq (Llama 4 Scout, $0.10/1M) |
| simple_chat         | 3                | ✅ Groq                           |
| sentiment_analysis  | 2                | ✅ Groq                           |
| summarization       | 5                | ⚖️ Groq (under threshold 7)       |
| compliance_analysis | 9                | ❌ OpenAI (GPT-4o-mini, $0.30/1M) |
| complex_reasoning   | 9                | ❌ OpenAI                         |
| bond_ai_chat        | 6                | ⚖️ Groq                           |

**Potential Issue:** If Groq API key is valid but Groq API is down/rate-limiting, the router should fallback to OpenAI. Check if fallback is working:

```typescript
// From ai-router.ts:226-247
if (allowFallback) {
  const fallbackProvider = routing.provider === 'groq' ? 'openai' : 'groq'
  logger.info('Falling back to alternative provider', { from, to })

  if (fallbackProvider === 'openai') {
    return await executeWithOpenAI(...)
  } else {
    return await executeWithGroq(...)
  }
}
```

---

## Hypothesis Testing

### Hypothesis 1: Groq API Key Invalid

**Test:** Check Groq API directly

```powershell
$groqKey = "YOUR_GROQ_KEY"  # Get from Cloudflare dashboard
curl -s "https://api.groq.com/openai/v1/chat/completions" `
  -X POST `
  -H "Authorization: Bearer $groqKey" `
  -H "Content-Type: application/json" `
  -d '{"model":"llama-4-scout","messages":[{"role":"user","content":"test"}]}' `
  | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

**Expected:** Valid response with `choices` array

---

### Hypothesis 2: OpenAI API Key Invalid

**Test:** Check OpenAI API directly

```powershell
$openaiKey = "YOUR_OPENAI_KEY"  # Get from Cloudflare dashboard
curl -s "https://api.openai.com/v1/chat/completions" `
  -X POST `
  -H "Authorization: Bearer $openaiKey" `
  -H "Content-Type: application/json" `
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"test"}]}' `
  | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

**Expected:** Valid response with `choices` array

---

### Hypothesis 3: Rate Limiting

**Evidence:** Check logs for "rate limit exceeded" or 429 status codes

---

### Hypothesis 4: Plan Gating

**Evidence:** Bond AI chat requires Pro plan: [`bond-ai.ts:114`](workers/src/routes/bond-ai.ts#L114)

```typescript
bondAiRoutes.post('/chat', authMiddleware, requirePlan('pro'), aiLlmRateLimit, async (c) => {
```

**Test:** User must be on Pro plan to access Bond AI chat

---

## Mysterious "Claude 4.6" Prompt Investigation

### Already Searched (NOT FOUND):

- ✅ All `.ts`, `.tsx`, `.js` files in codebase
- ✅ `.github/copilot-instructions.md` (only contains proper Copilot instructions)
- ✅ `workers/src/lib/bond-ai.ts` system prompts (clean "Bond AI" prompts only)
- ✅ Environment variable names (no `CLAUDE_` or `SYSTEM_PROMPT` vars visible)

### Possible Sources:

#### 1. Database `ai_configs` Table (Most Likely)

```sql
-- Check if user has custom AI config with unexpected prompt
SELECT
  organization_id,
  config->>'system_prompt' as custom_prompt,
  config->>'model' as model,
  updated_at
FROM ai_configs
WHERE config->>'system_prompt' IS NOT NULL
  AND LENGTH(config->>'system_prompt') > 100;
```

#### 2. Browser Extension or Development Tool

- **Cursor IDE:** Has built-in AI prompts
- **VS Code Copilot:** Uses custom instructions
- **Browser extensions:** AI assistants, page analyzers
- **Check:** Disable all extensions and test again

#### 3. Telnyx/External Webhook

- **Scenario:** External service sending unexpected data in webhook payload
- **Check:** Tail webhook logs:
  ```powershell
  wrangler tail --config workers/wrangler.toml | Select-String "webhooks/telnyx"
  ```

#### 4. Local Environment Variable

- **Check:** Your local `.env` file
  ```powershell
  Get-Content .env.local | Select-String "CLAUDE|SYSTEM_PROMPT"
  ```

---

## Expected Next Steps

1. **Run Test #1** → Confirm secrets exist
2. **Run Test #2** → Get actual error message from AI endpoint
3. **Run Test #4** → Capture live logs showing failures
4. **Answer:** Where are you seeing the "Claude 4.6" prompts exactly?

Then I can provide targeted fixes based on actual error messages.

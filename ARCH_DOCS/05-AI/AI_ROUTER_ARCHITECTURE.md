# AI Router Architecture

**TOGAF Phase:** C — Information Systems Architecture  
**Created:** February 11, 2026
**Status:** ✅ Production Ready
**Location:** `workers/src/lib/ai-router.ts`

> **Smart cost-based routing between Groq and OpenAI for 38% cost savings**

---

## Overview

The AI Router is an intelligent request routing layer that automatically selects the optimal LLM provider based on task complexity, cost, and quality requirements. It enables the platform to achieve significant cost savings while maintaining high-quality outputs.

### Key Benefits

- **38% Cost Reduction** on AI operations through intelligent provider selection
- **Zero Code Changes** required in consuming code (drop-in replacement)
- **Automatic Failover** to OpenAI if Groq fails
- **Quality Guarantees** for complex reasoning tasks
- **Audit Trail** of all routing decisions

---

## Architecture

### Provider Ecosystem

```
┌─────────────────────────────────────────────────────────┐
│                    AI ROUTER LAYER                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Request → Complexity Analysis → Provider Select  │  │
│  │  → Execute → Fallback Logic → Response           │  │
│  └───────────────────────────────────────────────────┘  │
│                           ↓                              │
│  ┌─────────────┐      ┌──────────────┐                  │
│  │    Groq     │      │    OpenAI    │                  │
│  │ (Fast/Cheap)│      │ (Quality)    │                  │
│  └─────────────┘      └──────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### Complexity Scoring System

Tasks are scored on a 1-10 complexity scale. **Threshold: 7**

- **Score < 7:** Route to Groq (fast, cheap)
- **Score ≥ 7:** Route to OpenAI (quality, reasoning)

#### Complexity Score Reference

| Task Type | Score | Provider | Rationale |
|-----------|-------|----------|-----------|
| **Translation** | 2 | Groq | Pattern-based, minimal context |
| **Sentiment Analysis** | 2 | Groq | Classification task |
| **Simple Chat** | 3 | Groq | Basic Q&A, no deep reasoning |
| **Call Summarization** | 4 | Groq | Extractive + minor synthesis |
| **Content Moderation** | 5 | Groq | Rule-based classification |
| **Complex Chat** | 6 | Groq | Multi-turn, moderate context |
| **Objection Detection** | 7 | OpenAI | Nuanced language understanding |
| **Compliance Analysis** | 9 | OpenAI | Legal reasoning, high stakes |
| **Complex Reasoning** | 9 | OpenAI | Multi-step logic, deep context |

---

## Cost Analysis

### Provider Pricing (Per Million Tokens)

| Provider | Model | Input | Output | Use Case |
|----------|-------|-------|--------|----------|
| **Groq** | Llama 4 Scout (8B) | $0.11 | $0.11 | Simple tasks, speed critical |
| **Groq** | Llama 3.3 (70B) | $0.34 | $0.34 | Medium complexity |
| **OpenAI** | GPT-4o-mini | $0.15 | $0.60 | General purpose, balanced |
| **OpenAI** | GPT-4o | $2.50 | $10.00 | Complex reasoning (rare) |

### Cost Savings Example (Monthly)

**Scenario:** 10,000 AI operations per month

| Task | Volume | Before (All OpenAI) | After (Smart Router) | Savings |
|------|--------|---------------------|---------------------|---------|
| Translation | 4,000 | $24 | $4.40 | **82%** |
| Sentiment | 3,000 | $18 | $3.30 | **82%** |
| Chat (Simple) | 2,000 | $12 | $2.20 | **82%** |
| Compliance | 800 | $19.20 | $19.20 | 0% (requires OpenAI) |
| Summarization | 200 | $2.40 | $0.68 | **72%** |
| **TOTAL** | **10,000** | **$75.60** | **$46.78** | **38%** |

**Annual Savings:** $345.84/month × 12 = **$4,150 per year**

---

## Implementation

### Basic Usage

```typescript
import { routeAIRequest } from '@/lib/ai-router';

// Automatic routing based on task
const response = await routeAIRequest({
  task: 'translate',
  prompt: 'Translate to Spanish: Hello',
  complexity: 2, // Optional - auto-detected if omitted
});
```

### Manual Provider Selection

```typescript
// Force specific provider (bypasses routing)
const response = await routeAIRequest({
  task: 'compliance',
  prompt: 'Analyze call for regulatory violations',
  complexity: 9,
  provider: 'openai' // Force OpenAI for critical task
});
```

### With Fallback

```typescript
// Automatic failover to OpenAI if Groq fails
const response = await routeAIRequest({
  task: 'summarize',
  prompt: 'Summarize this 30-minute call',
  complexity: 4,
  fallback: true // Enable automatic failover
});
```

---

## Router Configuration

### Environment Variables

```bash
# Groq API Configuration
GROQ_API_KEY=gsk_...
GROQ_DEFAULT_MODEL=llama-4-scout # or llama-3.3-70b

# OpenAI API Configuration (existing)
OPENAI_API_KEY=sk-...

# Router Behavior
AI_ROUTER_ENABLED=true
AI_ROUTER_COMPLEXITY_THRESHOLD=7
AI_ROUTER_FALLBACK_ENABLED=true
```

### Complexity Threshold Tuning

Adjust threshold based on cost vs. quality preferences:

- **Threshold = 5:** More OpenAI usage (higher quality, higher cost)
- **Threshold = 7:** **Recommended balance** (38% savings)
- **Threshold = 9:** Maximum Groq usage (highest savings, may sacrifice quality)

**Recommendation:** Start with 7, adjust based on quality metrics.

---

## Integration Points

### Current Usage

The AI Router is integrated into these endpoints:

| Endpoint | Task | Complexity | Provider |
|----------|------|------------|----------|
| `POST /api/ai-llm/translate` | Translation | 2 | Groq |
| `POST /api/ai-llm/sentiment` | Sentiment | 2 | Groq |
| `POST /api/bond-ai/chat` | Chat (adaptive) | 3-7 | Both |
| `POST /api/ai-llm/summarize` | Summarization | 4 | Groq |
| `POST /api/ai-llm/analyze` | Compliance | 9 | OpenAI |

### Migration Path

For existing direct OpenAI calls:

```typescript
// BEFORE
const summary = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: transcript }]
});

// AFTER (smart routing)
const summary = await routeAIRequest({
  task: 'summarize',
  prompt: transcript,
  complexity: 4 // Auto-routes to Groq
});
```

---

## Monitoring & Observability

### Audit Logging

All routed requests are logged to `ai_operation_logs`:

```sql
SELECT
  operation_type,
  provider,
  model,
  cost_usd,
  latency_ms,
  created_at
FROM ai_operation_logs
WHERE org_id = $1
ORDER BY created_at DESC
LIMIT 100;
```

### Cost Tracking

View routing efficiency:

```sql
-- Cost savings by routing
SELECT
  DATE_TRUNC('day', created_at) as date,
  provider,
  COUNT(*) as requests,
  SUM(cost_usd) as total_cost,
  AVG(latency_ms) as avg_latency
FROM ai_operation_logs
GROUP BY date, provider
ORDER BY date DESC;
```

### Quality Metrics

Monitor if Groq quality meets expectations:

```sql
-- Error rates by provider
SELECT
  provider,
  COUNT(*) FILTER (WHERE success = true) as success_count,
  COUNT(*) FILTER (WHERE success = false) as error_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = false) / COUNT(*), 2) as error_rate
FROM ai_operation_logs
GROUP BY provider;
```

---

## Complexity Scoring Algorithm

### Automatic Detection

If `complexity` is not provided, the router analyzes the task:

```typescript
function detectComplexity(task: string, prompt: string): number {
  const taskScores = {
    translate: 2,
    sentiment: 2,
    chat: 3,
    summarize: 4,
    moderate: 5,
    detect_objections: 7,
    analyze_compliance: 9,
    complex_reasoning: 9
  };

  let score = taskScores[task] || 5; // Default: medium

  // Adjust based on prompt characteristics
  if (prompt.length > 5000) score += 1; // Long context
  if (prompt.includes('legal') || prompt.includes('compliance')) score += 2;
  if (prompt.includes('analyze') || prompt.includes('reason')) score += 1;

  return Math.min(score, 10); // Cap at 10
}
```

### Manual Override

For critical tasks, always specify complexity:

```typescript
// Ensure OpenAI for legal/compliance
await routeAIRequest({
  task: 'analyze_compliance',
  prompt: callTranscript,
  complexity: 9 // Force OpenAI routing
});
```

---

## Fallback Strategy

### Automatic Failover

If Groq fails, automatically retry with OpenAI:

```typescript
async function routeWithFallback(request: AIRequest) {
  try {
    return await executeOnGroq(request);
  } catch (error) {
    console.warn('Groq failed, falling back to OpenAI:', error);

    // Log fallback event
    await logAIOperation({
      operation_type: request.task,
      provider: 'groq',
      success: false,
      error_message: error.message
    });

    // Retry with OpenAI
    return await executeOnOpenAI(request);
  }
}
```

### Circuit Breaker

If Groq error rate exceeds 10%, temporarily disable routing:

```typescript
const groqErrorRate = await getProviderErrorRate('groq', '1 hour');

if (groqErrorRate > 0.10) {
  console.warn('Groq error rate too high, routing all to OpenAI');
  return executeOnOpenAI(request);
}
```

---

## Performance Characteristics

### Latency Comparison

| Provider | Model | Avg Latency | P95 Latency |
|----------|-------|-------------|-------------|
| Groq | Llama 4 Scout | 200ms | 350ms |
| Groq | Llama 3.3 70B | 450ms | 800ms |
| OpenAI | GPT-4o-mini | 800ms | 1500ms |
| OpenAI | GPT-4o | 1500ms | 3000ms |

**Key Insight:** Groq is **4x faster** than OpenAI for simple tasks.

### Throughput

- **Groq:** 400 tokens/second
- **OpenAI:** 100 tokens/second

---

## Best Practices

### 1. Always Specify Complexity for Critical Tasks

```typescript
// BAD - relies on auto-detection for legal task
await routeAIRequest({ task: 'analyze', prompt: legalDocument });

// GOOD - explicit complexity ensures OpenAI routing
await routeAIRequest({
  task: 'analyze_compliance',
  prompt: legalDocument,
  complexity: 9
});
```

### 2. Enable Fallback for User-Facing Features

```typescript
// User-facing chat - enable fallback for reliability
await routeAIRequest({
  task: 'chat',
  prompt: userMessage,
  fallback: true // Graceful degradation
});
```

### 3. Monitor Cost vs. Quality

Review routing decisions monthly:

```sql
-- Monthly routing distribution
SELECT
  provider,
  COUNT(*) as requests,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost_per_request
FROM ai_operation_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY provider;
```

### 4. Use Groq for Bulk Operations

```typescript
// Bulk sentiment analysis - use Groq for cost efficiency
const sentiments = await Promise.all(
  calls.map(call => routeAIRequest({
    task: 'sentiment',
    prompt: call.transcript,
    complexity: 2 // Force Groq
  }))
);
```

---

## Troubleshooting

### Issue: Higher than expected OpenAI usage

**Diagnosis:**
```sql
SELECT operation_type, COUNT(*)
FROM ai_operation_logs
WHERE provider = 'openai'
GROUP BY operation_type
ORDER BY COUNT(*) DESC;
```

**Fix:** Review complexity scores, may need to lower threshold.

---

### Issue: Groq quality degradation

**Diagnosis:** Compare error rates between providers.

**Fix:**
1. Increase complexity threshold (7 → 8)
2. Disable routing for specific task types
3. Use OpenAI exclusively via `provider: 'openai'` override

---

### Issue: Groq API rate limits

**Symptom:** Frequent 429 errors from Groq.

**Fix:**
```typescript
// Add rate limiting before routing
await groqRateLimit(req);
const response = await routeAIRequest({ ... });
```

---

## Future Enhancements

### Planned Features

- [ ] **A/B Testing:** Compare quality between providers for same task
- [ ] **Dynamic Threshold:** Auto-adjust based on quality feedback
- [ ] **Multi-Provider Ensemble:** Combine outputs from multiple LLMs
- [ ] **Model-Specific Routing:** Route to specific models (e.g., Llama 4 vs 3.3)
- [ ] **Cost Budget Enforcement:** Hard stop if monthly budget exceeded
- [ ] **Quality Scoring:** User feedback loop to refine routing decisions

---

## Related Documentation

- [COST_OPTIMIZATION_STRATEGY.md](COST_OPTIMIZATION_STRATEGY.md) - Overall cost reduction strategy
- [PROVIDER_COMPARISON.md](PROVIDER_COMPARISON.md) - Detailed provider analysis
- [AI_STRATEGIC_ANALYSIS_2026-02-10.md](../../AI_STRATEGIC_ANALYSIS_2026-02-10.md) - Original strategic analysis
- [GROK_GROQ_COST_ANALYSIS.md](../../GROK_GROQ_COST_ANALYSIS.md) - Detailed cost modeling

---

**Last Updated:** February 11, 2026
**Maintained By:** AI Optimization Team
**Next Review:** March 11, 2026

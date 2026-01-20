
# Profitability & Risk Analysis

## Executive Summary
**Verdict: High Risk of "Infinite Debt" (Fail Open Logic). Good Unit Economics.**

The system is designed with healthy unit economics (Pro/Business plans cover costs), but the current implementation of usage limits **fails open**. If the database is slow, under attack, or misconfigured, users can make unlimited calls, racking up infinite bills with SignalWire/AssemblyAI while paying you nothing.

## 1. Unit Economics (Profitability)

### Costs (Estimated)
*   **SignalWire (Outbound)**: ~$0.005/min (variable) + Number leasing.
*   **AssemblyAI (Transcription)**: ~$0.002/min (approx $0.12/hour).
*   **LLM (OpenAI/Anthropic)**: Variable, approx $0.01 - $0.03 per call depending on length.
*   **Total Variable Cost**: Approx **$0.02 - $0.04 per minute** of active call time.

### Revenue (Plans defined in DB)
*   **Free**: $0/mo (0 calls, 0 mins). **SAFE**.
*   **Pro**: 500 Calls / 5000 Mins.
    *   Max Cost Risk: 5000 mins * $0.04 = **$200/mo**.
    *   *Requirement*: Price must be > $200/mo to be strictly safe, or assume <100% utilization.
*   **Business**: 2000 Calls / 20000 Mins.
    *   Max Cost Risk: 20000 mins * $0.04 = **$800/mo**.

**Profitability Conclusion**: As long as your Stripe prices for "Pro" and "Business" are set appropriately (e.g., $299+ for Pro, $999+ for Business), the unit economics are solid.

## 2. Risk Analysis: "Infinite Debt"

> [!WARNING]
> **CRITICAL VULNERABILITY DETECTED**

### The "Fail Open" Flaw
In `lib/services/usageTracker.ts`, the `checkUsageLimits` function has this logic:

```typescript
} catch (err: any) {
  logger.error('Error checking usage limits', err, ...)
  // Fail open to avoid breaking calls per ARCH_DOCS graceful degradation
  return { allowed: true } 
}
```

**Scenario**:
1.  Attacker creates a Free account.
2.  Attacker scripts 10,000 concurrent calls.
3.  Database gets overwhelmed (connection limit reached) or is slow.
4.  `checkUsageLimits` throws an error (connection timeout).
5.  **Code returns `allowed: true`**.
6.  10,000 calls launch via SignalWire.
7.  **Result**: You owe SignalWire thousands of dollars instantly.

### Missing Hard Stop
There is no "Circuit Breaker" at the SignalWire level. If your app says "Go", SignalWire dials.

### Recommendation
**Switch to "Fail Closed" for Free/Low-Tier tiers.**
Only Enterprise clients with contracts should "Fail Open". For automated SaaS plans, if you can't verify balance, **do not dial**.

## 3. Deployment Safety
*   **Stripe Integration**: Robust. Handles cancellations/deletions correctly (downgrades to free/cancels).
*   **Database Seeding**: Good. Migration `20260116_usage_metering.sql` ensures limits exist.

## Action Plan
1.  **Immediate**: Change `usageTracker.ts` to **Fail Closed** by default.
2.  **Pricing**: Ensure Pro Price > $200 and Business Price > $800 to cover worst-case usage.
3.  **Circuit Breaker**: Implement a Redis or memory-based rate limiter that is independent of the main DB to prevent rapid-fire attacks.

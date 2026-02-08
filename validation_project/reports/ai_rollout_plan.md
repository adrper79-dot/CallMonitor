# AI Closed-Loop Rollout Plan (Agentic)

## Overview
Agentic rollout: Orchestrator coordinates 5 sub-agents for closed-loop AI learning (human → data → analyze → fine-tune → test → deploy).

**Timeline**: 4 weeks pilot, iterative.

## Workflow Architecture
```
ORCHESTRATOR
  ↓
Data Agent → Analysis Agent → FineTune Agent → Test Agent → Deploy Agent
  ↓
SYNTHESIS (report/approval)
```

## Sub-Agents & Tasks

### 1. DataCollection Agent
- Scan ai_runs/calls for human-handled (handled_by_human flag).
- Anonymize PII (OpenAI).
- Extract snippets (transcript pairs).
- Store training_data (Neon).

### 2. Analysis Agent
- OpenAI score transcripts (rubrics).
- Pattern detection (escalation triggers).
- Human tag UI (/review).
- Output labeled JSONL R2.

### 3. FineTune Agent
- Upload JSONL OpenAI fine-tune.
- Update Bond AI model ID (Neon ai_agent_configs).
- Generate SWML intents (patterns → utterances).

### 4. Test Agent
- A/B route calls AI vs human.
- Metrics: resolution/CSAT/escalation (Neon views).
- RTI escalate low-conf.

### 5. Deploy Agent
- Workers cron redeploy models.
- Monitor audit_logs.
- Rollback if KPIs drop.

## Rollout Phases
1. **Week 1**: Data/Analysis agents (pilot 100 calls).
2. **Week 2**: FineTune/Test (custom model).
3. **Week 3**: Deploy A/B 20%.
4. **Week 4**: Scale 50%, human review.

**Metrics**: Escalation -50%, CSAT +10%.

Approve to ACT.
# OSI-Aligned Test Plan (Live Testing)

Scope: Live testing across layers (edge/front, transport, session, application) for critical functions.

## Priority Targets
- Workers: productivity routes (note templates, objection rebuttals, daily planner, likelihood scoring)
- Workers: audio/transcription submission (AssemblyAI payload parity)
- Workers: post-transcription processor (entities, content safety, auto-task creation)
- Security: RLS isolation (transcriptions, ai_summaries), auth/session flows
- Audit: writeAuditLog coverage for new routes

## Layered Checks (per function/route)
- Edge/Transport: CORS, auth headers, rate limits, 2xx/4xx/5xx correctness
- Session: token validity, org scoping, correlation-id propagation
- Application: business logic, audit logging, DB effects, RLS enforcement

## Test Types
- Integration (vitest + live DB):
  - Productivity CRUD with auth + org_id filters; verify audit rows.
  - Audio submit → verify AssemblyAI payload flags.
  - Post-transcription: simulate webhook payload → expect entities/content_safety persisted + auto-task insert.
  - RLS denial: cross-org access blocked for transcriptions/ai_summaries.
- Unit:
  - likelihood-scorer weights/bounds.
  - post-transcription parsing branches.
- Regression:
  - sessions.user_id lookup uses idx_sessions_user_id (exists, not dropped).

## Success Criteria
- All priority routes have at least one integration test asserting auth, org scoping, and audit log write.
- Payload parity for audio/transcription requests verified.
- Cross-org reads/writes denied for protected tables.
- sessions.user_id index present and used.

## Next Actions
1) Add vitest integration suites for productivity routes, audio submit, post-transcription flow, RLS denial.
2) Add unit suites for likelihood-scorer and post-transcription parser.
3) Add regression test that checks idx_sessions_user_id existence.

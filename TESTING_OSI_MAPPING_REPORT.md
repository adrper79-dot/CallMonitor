# OSI Model Testing Mapping & Gaps Report

**Date**: 2026-02-11  
**Scope**: All workers/src/routes/*.ts + key lib/*.ts functions.

## Methodology
- Functions from routes (40+), lib.
- OSI layers adapted: L1 API reach, L2 auth/DB, L3 logic, L4 external, L5 session, L6 data format, L7 business.
- Current tests from production/*.
- Gaps: Missing → build.

## Function-Test Mapping

### Routes (from index.ts)
| Route File | Main Function | Current Tests | OSI Coverage | Gaps/Results |
|------------|---------------|---------------|--------------|--------------|
| health.ts | healthRoutes | feature-validation L1 | L1 | Full |
| calls.ts | callsRoutes | calls.test.ts? bridge-crossing | L1-4 | External Telnyx |
| auth.ts | authRoutes | auth.setup.ts e2e | L1-3 | L4 none |
| ... (40+) | ... | feature-validation (0 endpoints issue) | Partial | Registry update |
| collections.ts | collectionsRoutes | collections.test.ts | L1-4 | Schema fixed |

### Lib Functions (example)
| File | Function | Tests | OSI | Gaps |
|------|----------|-------|-----|------|
| translation-processor.ts | translateAndStore | translation-pipeline.test.ts | L3-7 | L4 OpenAI/Eleven mock test missing → build |
| | insertTranslation | DB tests | L3 | Confidence edge |
| tts-processor.ts | synthesizeSpeech | ? | L6-7 | Build unit |
| audio-injector.ts | queueAudioInjection | ? | L4-6 | Build |

## Gaps Identified
1. Registry outdated (0 endpoints) – update FEATURE_REGISTRY.
2. Lib functions under-tested (unit gaps).
3. OSI L4 externals no mocks/chaos.
4. L6 audio formats no validation.

## Next: Build missing tests
- translation-pipeline-osi.test.ts
- Update registry.

Live suite running validates current state.
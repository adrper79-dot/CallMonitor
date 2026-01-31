---
globs: "['app/api/voice/swml/**/*.ts','lib/signalwire/*.ts']"
description: Apply to all app/api/voice/swml/**/route.ts files and any new SWML
  generation code. Ensures consistent Content-Type (application/json),
  validation (version/sections.main), and no duplication.
alwaysApply: true
---

ALWAYS use swmlJsonResponse(obj) or swmlResponse for SWML endpoints. NEVER use direct NextResponse(JSON.stringify(swml)) or manual Content-Type headers. Prefer swmlJsonResponse for object inputs (includes validation). Use swmlResponse(string) only for explicit XML/legacy. All SWML routes import from '@/lib/api/utils'.
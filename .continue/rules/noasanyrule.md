---
description: Enforce type safety across all TS files to eliminate the 86+ as any debt."
alwaysApply: true
---

NEVER use `as any` or `as unknown`. Define proper TypeScript interfaces for session.user, Supabase clients, WebRTC objects, etc. Use Zod for runtime validation where types are dynamic (e.g., webhooks). Prefer type guards over casts.
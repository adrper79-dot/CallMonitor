# Feature Gating

**Plans gate features** (org.plan check).

**Code**:
- lib/rbac.ts: `hasFeature(plan, 'live_translation')`.
- /api/call-capabilities: Returns enabled features.

**Tiers** (QUICK_REFERENCE):
- Free: Basic.
- Pro: +Recording/Transcribe.
- Business: +Translation.
- Enterprise: All.

**Impl**: RBAC middleware checks plan before route.
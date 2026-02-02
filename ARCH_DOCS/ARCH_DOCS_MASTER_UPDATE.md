# ARCH_DOCS Master Update — Canonicalization Notice

This repository has been consolidated to a single canonical architecture and migration plan. Maintain these files as the authoritative sources for engineering and infra decisions:

- `ARCH_DOCS/FINAL_STACK.md` — Canonical final stack and high-level flows
- `ARCH_DOCS/CLI_CHECKS.md` — CLI connectivity tests and quick checks
- `ARCH_DOCS/MIGRATION_PLAN.md` — Phased migration and compliance plan

Action Requested:
1. Treat `FINAL_STACK.md` as the only source of truth for architecture choices going forward.
2. Archive other conflicting architecture docs under `ARCH_DOCS/archive/` or append `._archived` suffix.
3. Update `ARCH_DOCS/00-README.md` to point to `FINAL_STACK.md` as the canonical doc (I can patch this if you want).

Maintainer: Architecture Team
Date: 2026-01-29

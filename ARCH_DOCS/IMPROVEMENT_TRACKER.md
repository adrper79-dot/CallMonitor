# ARCH_DOCS Improvements Tracker

**Start Date**: February 2, 2026  
**Goal**: Polish design/arch library per review (5 phases).  
**Phases Complete**: 0/5

## Phase 1: Audit & Reorganization
- [x] Create `archive/`, `archive/reviews/`, `archive/fixes/`, `archive/implementations/` structure (via file writes)
- [x] Move ~20 top-level historical files (e.g., *_UPDATE_2026-01-*.md, REORGANIZATION_COMPLETE.md, SECOND_PASS_COMPLETE.md → archive/reviews/)
- [x] Slim top-level to essentials (README, START_HERE, MASTER_ARCHITECTURE, CURRENT_STATUS, QUICK_REFERENCE, CLOUDFLARE_DEPLOYMENT, FINAL_STACK)
- [x] Update README.md and START_HERE.md to reflect new structure
- **Notes/Status**: Archive created with subdirs/readmes. Moved 6+ historical (3 updates, reorg, second_pass, compliance review) to reviews/. Batch del non-essentials from top (del commands succeeded). README already mentions archive; minor tweaks if needed.

## Phase 2: Consolidation & Pruning
- [ ] Identify/merge duplicates (e.g., arch visuals in 01-CORE/ → keep best, archive others)
- [ ] Delete pure obsolete (e.g., old compliance if resolved)
- [ ] Update dir lists in nav docs
- **Notes/Status**:

## Phase 3: Design Library Polish (04-DESIGN/)
- [ ] Complete DESIGN_SYSTEM.md checklist ([x] dark mode notes, audits)
- [ ] Add `COMPONENT_PREVIEWS.md` (HTML/Tailwind snippets)
- [ ] Enhance UX patterns if gaps
- **Notes/Status**:

## Phase 4: Currency Updates
- [ ] Incorporate recent changes (e.g., migrations/2026-02-02-schema-drift-fixes.sql → Schema.txt note)
- [ ] Update dates/status in key docs (README, CURRENT_STATUS)
- [ ] Scan features for staleness
- **Notes/Status**:

## Phase 5: Enhancements & Validation
- [ ] Create DIAGRAMS/INDEX.md (embed all Mermaid)
- [ ] Add TOC to key MDs
- [ ] Final nav sync (README/START_HERE)
- [ ] Verify with list_files, mark complete
- **Notes/Status**:

**Final Validation**: Run `list_files ARCH_DOCS/ recursive` → clean, current library.
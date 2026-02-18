/**
 * Comprehensive Validation Framework — Types
 * Word Is Bond Platform
 *
 * TOGAF Phase: G — Implementation Governance
 * Maps to: ARCH_DOCS/VALIDATION_PLAN.md
 *
 * @see ARCH_DOCS/FLOW_MAP_AND_VALIDATION_PLAN.md (BF/WF/FF flows)
 * @see ARCH_DOCS/MASTER_ARCHITECTURE.md (canonical architecture)
 */

// ─── Finding Severity ────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

// ─── Validation Domains ──────────────────────────────────────────────────────
// Each domain maps to a section in the generic suggestion, adapted to our stack

export type ValidationDomain =
  | 'api-health'           // Technical: health + latency baselines
  | 'api-coverage'         // Technical: all documented routes exist
  | 'security'             // Technical: tenant isolation, RBAC, parameterized SQL
  | 'compliance-regf'      // Compliance: FDCPA Reg F enforcement
  | 'compliance-tcpa'      // Compliance: TCPA/DNC compliance
  | 'audit-completeness'   // Compliance: all mutations have audit trail
  | 'arch-alignment'       // Architecture: ARCH_DOCS ↔ codebase sync
  | 'integration-health'   // Feature: 12-provider integration health
  | 'flow-completeness'    // Feature: BF/WF flows have matching routes

// ─── Individual Finding ──────────────────────────────────────────────────────

export interface ValidationFinding {
  domain: ValidationDomain
  severity: Severity
  title: string
  detail: string
  file?: string          // e.g. 'workers/src/routes/payments.ts'
  line?: number
  remediation?: string   // suggested fix
}

// ─── Agent Result ────────────────────────────────────────────────────────────

export interface AgentResult {
  domain: ValidationDomain
  agentName: string
  passed: number
  failed: number
  warnings: number
  findings: ValidationFinding[]
  durationMs: number
}

// ─── Orchestrator Summary ────────────────────────────────────────────────────

export interface ValidationSummary {
  timestamp: string
  version: string
  targetApi: string
  targetUi: string
  totalAgents: number
  totalChecks: number
  totalPassed: number
  totalFailed: number
  totalWarnings: number
  criticalFindings: number
  highFindings: number
  durationMs: number
  agentResults: AgentResult[]
  allFindings: ValidationFinding[]
}

// ─── Validation Agent Interface ──────────────────────────────────────────────

export interface ValidationAgent {
  name: string
  domain: ValidationDomain
  description: string
  run(ctx: ValidationContext): Promise<AgentResult>
}

// ─── Context passed to every agent ───────────────────────────────────────────

export interface ValidationContext {
  apiUrl: string
  uiUrl: string
  authToken: string | null
  workspaceRoot: string
}

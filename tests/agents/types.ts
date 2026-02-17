/**
 * Shared Types — AI Agent Testing System
 * Word Is Bond Platform
 */

export interface TestStep {
  stepNumber: number
  action: string
  reasoning: string
  screenshot: string
  timestamp: Date
  success: boolean
  url: string
  error?: string
}

export interface TestScenario {
  name: string
  goal: string
  startUrl?: string
  maxSteps?: number
  requiredRole: string
}

export interface TestResult {
  scenario: string
  user: string
  role: string
  shell: string
  goal: string
  success: boolean
  totalSteps: number
  steps: TestStep[]
  duration: number
  reportPath?: string
  error?: string
}

export interface OrchestratorResult {
  totalScenarios: number
  passed: number
  failed: number
  duration: number
  results: TestResult[]
}

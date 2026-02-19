/**
 * AI Agent Test Scenarios — Word Is Bond Platform
 *
 * Each scenario maps to actual platform flows from:
 *   - ARCH_DOCS/01-CORE/FLOW_CATALOG.md (BF/WF/FF flows)
 *   - docs/PERMISSION_MATRIX.md (RBAC permissions)
 *   - lib/navigation.ts (shell routes)
 *
 * Routes are real — verified against app/ directory structure.
 * Goals are written for Claude to interpret and act on realistically.
 */

import type { TestScenario } from './types'

export const TEST_SCENARIOS: TestScenario[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT SCENARIOS (agent shell → /work/*)
  // Maps to: WF-AGENT-01, WF-AGENT-02, BF-02, BF-03
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Agent — Navigate Daily Planner',
    goal: 'Navigate to the daily work planner at /work and verify the page loads with any available tasks, accounts, or quick actions. Confirm the work queue and navigation sidebar are visible.',
    startUrl: '/work',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Work Queue Browse',
    goal: 'Navigate to /work/queue, verify the queue page loads, look for any account cards or filters. Browse the queue interface and confirm it is functional.',
    startUrl: '/work/queue',
    maxSteps: 10,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Open Dialer',
    goal: 'Navigate to the dialer at /work/dialer. Verify the dialer interface loads with phone controls. Do NOT attempt to make an actual call — just confirm the UI elements are present.',
    startUrl: '/work/dialer',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — View Accounts Portfolio',
    goal: 'Navigate to /accounts, verify the accounts list loads. Search for "APs TESTING" in the search bar if available. Click on an account to view its detail page and confirm tabs (Overview, Calls, Payments, Compliance, Notes) are visible.',
    startUrl: '/accounts',
    maxSteps: 12,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Payment Links Page',
    goal: 'Navigate to /work/payments and verify the payment links page loads. Check for any existing payment links or the ability to create new ones.',
    startUrl: '/work/payments',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Settlement Calculator',
    goal: 'Navigate to /tools/calculator. Verify the settlement calculator loads. If there are input fields for balance or settlement percentage, enter test values to confirm the calculator responds.',
    startUrl: '/tools/calculator',
    maxSteps: 10,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Schedule & Callbacks',
    goal: 'Navigate to /schedule/callbacks and verify the callbacks page loads with a list or calendar view. Check that scheduled callbacks are visible or the empty state shows.',
    startUrl: '/schedule/callbacks',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Inbox Messages',
    goal: 'Navigate to /inbox and verify the unified inbox loads. Check for message threads, filters, or channel tabs (SMS, Email, Chat). Confirm the empty state or message list is displayed.',
    startUrl: '/inbox',
    maxSteps: 10,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Voice Operations',
    goal: 'Navigate to /voice-operations and verify the voice operations page loads. Check for call controls, active call monitoring panels, or soft-phone UI. Do NOT initiate a call.',
    startUrl: '/voice-operations',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Bond AI Alerts',
    goal: 'Navigate to /bond-ai/alerts and verify the Bond AI alerts page loads. Check for AI-generated alerts, severity flags, or notification cards.',
    startUrl: '/bond-ai/alerts',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Bookings',
    goal: 'Navigate to /bookings and verify the bookings page loads. Check for appointment cards, calendar view, or booking creation interface.',
    startUrl: '/bookings',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Tools: Note Templates',
    goal: 'Navigate to /tools/templates and verify the note templates page loads. Check for template cards, search functionality, or preview capability.',
    startUrl: '/tools/templates',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — Tools: Objection Library',
    goal: 'Navigate to /tools/objections and verify the objection handler library loads. Check for objection categories, response scripts, or search functionality.',
    startUrl: '/tools/objections',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  {
    name: 'Agent — My Performance Analytics',
    goal: 'Navigate to /analytics/me and verify the personal performance analytics page loads. Check for KPI cards, call metrics, or performance charts.',
    startUrl: '/analytics/me',
    maxSteps: 8,
    requiredRole: 'agent',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGER SCENARIOS (manager shell → /command/*)
  // Maps to: WF-MANAGER-01, BF-05
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Manager — Command Center Overview',
    goal: 'Navigate to /command and verify the command center dashboard loads with live metrics, agent status cards, or team overview widgets.',
    startUrl: '/command',
    maxSteps: 10,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Live Board',
    goal: 'Navigate to /command/live and verify the live monitoring board loads. Check for active call indicators, agent availability status, or queue metrics.',
    startUrl: '/command/live',
    maxSteps: 8,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Scorecards Review',
    goal: 'Navigate to /command/scorecards and verify the scorecards page loads. Look for agent performance metrics, quality scores, or scorecard templates.',
    startUrl: '/command/scorecards',
    maxSteps: 10,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Team Analytics',
    goal: 'Navigate to /analytics and verify the analytics dashboard loads with charts, KPIs, or data visualizations. Then navigate to /analytics/agents for agent-specific metrics.',
    startUrl: '/analytics',
    maxSteps: 12,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Campaign Management',
    goal: 'Navigate to /campaigns. Verify the campaigns list loads. Check for campaign cards showing status (active, paused, completed) or the ability to create new campaigns.',
    startUrl: '/campaigns',
    maxSteps: 10,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Reports Generation',
    goal: 'Navigate to /reports. Verify the reports page loads with available report types. Check for options to generate or download reports.',
    startUrl: '/reports',
    maxSteps: 10,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Team Overview',
    goal: 'Navigate to /manager and verify the team overview dashboard loads. Check for agent cards, availability status, or performance summaries.',
    startUrl: '/manager',
    maxSteps: 8,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — QA Review',
    goal: 'Navigate to /review and verify the QA review page loads. Check for call recordings eligible for review, scorecard forms, or QA queue items.',
    startUrl: '/review',
    maxSteps: 10,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Voice Operations Monitor',
    goal: 'Navigate to /voice-operations and verify the voice operations monitoring page loads. Check for live call indicators, agent status, or queue depth metrics.',
    startUrl: '/voice-operations',
    maxSteps: 8,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Sentiment Analytics',
    goal: 'Navigate to /analytics/sentiment and verify the sentiment analytics page loads. Check for sentiment trend charts, positive/negative indicators, or call-level sentiment scores.',
    startUrl: '/analytics/sentiment',
    maxSteps: 8,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Bond AI Alerts',
    goal: 'Navigate to /bond-ai/alerts and verify the Bond AI alerts page loads. Check for AI-generated compliance or performance alerts.',
    startUrl: '/bond-ai/alerts',
    maxSteps: 8,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Payment Plans',
    goal: 'Navigate to /payments/plans and verify the payment plans page loads. Check for plan cards, status indicators, or plan creation functionality.',
    startUrl: '/payments/plans',
    maxSteps: 10,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Create Campaign',
    goal: 'Navigate to /campaigns/new and verify the campaign creation page loads. Check for campaign name input, channel selection (SMS, email, voice), audience targeting, or scheduling options.',
    startUrl: '/campaigns/new',
    maxSteps: 12,
    requiredRole: 'manager',
  },

  {
    name: 'Manager — Unified Inbox',
    goal: 'Navigate to /inbox and verify the unified inbox loads. Check for message threads across channels (SMS, email, chat). Confirm filtering and channel navigation are available.',
    startUrl: '/inbox',
    maxSteps: 10,
    requiredRole: 'manager',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLIANCE SCENARIOS (manager shell with compliance permissions)
  // Maps to: BF-04, FF-08
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Compliance — Violations Dashboard',
    goal: 'Navigate to /compliance/violations and verify the violations page loads. Check for any violation logs, severity indicators, or filtering options.',
    startUrl: '/compliance/violations',
    maxSteps: 8,
    requiredRole: 'compliance',
  },

  {
    name: 'Compliance — DNC Management',
    goal: 'Navigate to /compliance/dnc and verify the Do Not Contact list management page loads. Check for DNC entries, search functionality, or add/import options.',
    startUrl: '/compliance/dnc',
    maxSteps: 8,
    requiredRole: 'compliance',
  },

  {
    name: 'Compliance — Disputes Review',
    goal: 'Navigate to /compliance/disputes and verify the disputes page loads. Look for dispute entries, status tracking, or queue management controls.',
    startUrl: '/compliance/disputes',
    maxSteps: 10,
    requiredRole: 'compliance',
  },

  {
    name: 'Compliance — Audit Log',
    goal: 'Navigate to /compliance/audit and verify the audit log page loads. Check for event entries with timestamps, user actions, and filterable columns.',
    startUrl: '/compliance/audit',
    maxSteps: 8,
    requiredRole: 'compliance',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN SCENARIOS (admin shell → /admin/*, /settings/*)
  // Maps to: WF-ADMIN-01, BF-06
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Admin — Admin Dashboard',
    goal: 'Navigate to /admin and verify the admin panel loads with system health, configuration panels, or administrative controls.',
    startUrl: '/admin',
    maxSteps: 10,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — Team Settings',
    goal: 'Navigate to /settings/team and verify the team management page loads. Check for user list, role assignments, invite functionality, or member cards.',
    startUrl: '/settings/team',
    maxSteps: 10,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — Call Configuration',
    goal: 'Navigate to /settings/call-config and verify the call configuration page loads. Check for voice provider settings, recording toggles, or compliance rules.',
    startUrl: '/settings/call-config',
    maxSteps: 8,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — Integration Settings',
    goal: 'Navigate to /settings/integrations and verify the integrations page loads. Check for CRM connections (HubSpot, Salesforce), helpdesk integrations, or webhook configurations.',
    startUrl: '/settings/integrations',
    maxSteps: 10,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — Platform Metrics',
    goal: 'Navigate to /admin/metrics and verify the platform metrics page loads. Check for system health indicators, usage statistics, or operational KPIs.',
    startUrl: '/admin/metrics',
    maxSteps: 8,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — AI Configuration',
    goal: 'Navigate to /admin/ai and verify the AI configuration page loads. Check for AI model settings, transcription config, sentiment analysis toggles, or Bond AI feature controls.',
    startUrl: '/admin/ai',
    maxSteps: 8,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — Data Retention Policy',
    goal: 'Navigate to /admin/retention and verify the data retention page loads. Check for retention period settings, deletion schedules, or legal hold configurations.',
    startUrl: '/admin/retention',
    maxSteps: 8,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — API Keys Management',
    goal: 'Navigate to /admin/api and verify the API keys management page loads. Check for existing API key entries, create new key functionality, or key scope configuration.',
    startUrl: '/admin/api',
    maxSteps: 8,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — Feature Flags',
    goal: 'Navigate to /admin/feature-flags and verify the feature flags page loads. Check for feature toggles, per-org overrides, or flag state indicators (on/off).',
    startUrl: '/admin/feature-flags',
    maxSteps: 8,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — Dialer Settings',
    goal: 'Navigate to /settings/dialer and verify the dialer settings page loads. Check for dialer mode selection, predictive/power/manual settings, or compliance dial rules.',
    startUrl: '/settings/dialer',
    maxSteps: 8,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — Quality Settings',
    goal: 'Navigate to /settings/quality and verify the quality assurance settings page loads. Check for QA scorecard templates, evaluation criteria, or auto-scoring configuration.',
    startUrl: '/settings/quality',
    maxSteps: 8,
    requiredRole: 'admin',
  },

  {
    name: 'Admin — AI Settings',
    goal: 'Navigate to /settings/ai and verify the AI settings page loads. Check for Bond AI configuration, transcription provider selection, or AI feature toggles.',
    startUrl: '/settings/ai',
    maxSteps: 8,
    requiredRole: 'admin',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OWNER SCENARIOS (admin shell → full platform access)
  // Maps to: BF-01, BF-06, FF-06
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Owner — Platform Analytics Overview',
    goal: 'Navigate to /analytics and verify the analytics dashboard loads. Then navigate through /analytics/collections and /analytics/agents to review platform-wide metrics.',
    startUrl: '/analytics',
    maxSteps: 15,
    requiredRole: 'owner',
  },

  {
    name: 'Owner — Billing Review',
    goal: 'Navigate to /admin/billing and verify the billing page loads with subscription status, plan details, or invoice history.',
    startUrl: '/admin/billing',
    maxSteps: 8,
    requiredRole: 'owner',
  },

  {
    name: 'Owner — Voice Configuration',
    goal: 'Navigate to /admin/voice and verify the voice configuration page loads. Check for Telnyx/SignalWire provider settings, phone number management, or WebRTC configuration.',
    startUrl: '/admin/voice',
    maxSteps: 8,
    requiredRole: 'owner',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEWER SCENARIOS (agent shell, view-only permissions)
  // Tests that viewers canNOT perform write actions
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Viewer — View-Only Access Verification',
    goal: 'Navigate to /work, then /dashboard, then /work/queue. Verify all pages load correctly with data or empty-state visible. Confirm that no create/edit/delete buttons are actionable — the viewer should only be able to read data.',
    startUrl: '/work',
    maxSteps: 12,
    requiredRole: 'viewer',
  },
]

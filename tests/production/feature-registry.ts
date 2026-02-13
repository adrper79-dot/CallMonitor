/**
 * Feature Registry — Single Source of Truth
 *
 * Maps every Workers route file to its endpoints, auth requirements,
 * and validation metadata. Used by the agentic validation runner.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type FeatureCategory =
  | 'core'
  | 'voice'
  | 'ai'
  | 'analytics'
  | 'compliance'
  | 'billing'
  | 'admin'
  | 'integrations'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface EndpointDef {
  method: HttpMethod
  path: string
  requiresAuth: boolean
  /** Expected status code without auth: 401 if protected, 200/etc if public */
  unauthStatus: number[]
  description: string
}

export interface FeatureDefinition {
  id: string
  name: string
  category: FeatureCategory
  routeFile: string
  endpoints: EndpointDef[]
  status: 'active' | 'beta' | 'deprecated'
}

// ─── Feature Registry ───────────────────────────────────────────────────────

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  // ═══ CORE ═══════════════════════════════════════════════════════════════

  {
    id: 'health',
    name: 'Health Check',
    category: 'core',
    routeFile: 'health.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/health',
        requiresAuth: false,
        unauthStatus: [200],
        description: 'Service health + dependency checks',
      },
    ],
  },
  {
    id: 'auth',
    name: 'Authentication',
    category: 'core',
    routeFile: 'auth.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/auth/session',
        requiresAuth: false,
        unauthStatus: [200, 401],
        description: 'Session status',
      },
      {
        method: 'POST',
        path: '/api/auth/callback/credentials',
        requiresAuth: false,
        unauthStatus: [400, 422, 429],
        description: 'Login with email/password',
      },
      {
        method: 'GET',
        path: '/api/auth/csrf',
        requiresAuth: false,
        unauthStatus: [200, 404],
        description: 'CSRF token',
      },
      {
        method: 'POST',
        path: '/api/auth/signout',
        requiresAuth: false,
        unauthStatus: [200, 401],
        description: 'Sign out',
      },
    ],
  },
  {
    id: 'organizations',
    name: 'Organizations',
    category: 'core',
    routeFile: 'organizations.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/organizations/current',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Current org details',
      },
    ],
  },
  {
    id: 'users',
    name: 'Users',
    category: 'core',
    routeFile: 'users.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/users/me',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Current user profile',
      },
    ],
  },
  {
    id: 'rbac',
    name: 'RBAC',
    category: 'core',
    routeFile: 'rbac-v2.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/rbac/context',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'RBAC context for current user',
      },
      {
        method: 'GET',
        path: '/api/rbac/roles',
        requiresAuth: false,
        unauthStatus: [200, 401],
        description: 'Role definitions',
      },
    ],
  },
  {
    id: 'teams',
    name: 'Teams',
    category: 'core',
    routeFile: 'teams.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/teams',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'List teams',
      },
      {
        method: 'GET',
        path: '/api/teams/my-orgs',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'User org memberships',
      },
    ],
  },
  {
    id: 'team',
    name: 'Team Management',
    category: 'core',
    routeFile: 'team.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/team/members',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Team members list',
      },
    ],
  },
  {
    id: 'audit',
    name: 'Audit Logs',
    category: 'core',
    routeFile: 'audit.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/audit',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Audit log entries',
      },
    ],
  },

  // ═══ VOICE ══════════════════════════════════════════════════════════════

  {
    id: 'voice',
    name: 'Voice Config',
    category: 'voice',
    routeFile: 'voice.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/voice/config',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Voice configuration',
      },
      {
        method: 'PUT',
        path: '/api/voice/config',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Update voice config',
      },
      {
        method: 'GET',
        path: '/api/voice/targets',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Voice targets list',
      },
      {
        method: 'POST',
        path: '/api/voice/call',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Initiate call',
      },
    ],
  },
  {
    id: 'calls',
    name: 'Calls',
    category: 'voice',
    routeFile: 'calls.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/calls',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'List calls',
      },
      {
        method: 'POST',
        path: '/api/calls/start',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Start a call',
      },
    ],
  },
  {
    id: 'webrtc',
    name: 'WebRTC',
    category: 'voice',
    routeFile: 'webrtc.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/webrtc/token',
        requiresAuth: true,
        unauthStatus: [401, 403],
        description: 'Generate WebRTC token',
      },
      {
        method: 'POST',
        path: '/api/webrtc/dial',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'WebRTC dial',
      },
    ],
  },
  {
    id: 'recordings',
    name: 'Recordings',
    category: 'voice',
    routeFile: 'recordings.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/recordings',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'List recordings',
      },
    ],
  },
  {
    id: 'caller-id',
    name: 'Caller ID',
    category: 'voice',
    routeFile: 'caller-id.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/caller-id',
        requiresAuth: true,
        unauthStatus: [401, 403],
        description: 'Caller ID list',
      },
    ],
  },
  {
    id: 'call-capabilities',
    name: 'Call Capabilities',
    category: 'voice',
    routeFile: 'call-capabilities.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/call-capabilities',
        requiresAuth: false,
        unauthStatus: [200, 401, 403],
        description: 'Call capability matrix',
      },
    ],
  },
  {
    id: 'capabilities',
    name: 'Capabilities',
    category: 'voice',
    routeFile: 'capabilities.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/capabilities',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Feature capabilities',
      },
    ],
  },
  {
    id: 'live-translation',
    name: 'Live Translation',
    category: 'voice',
    routeFile: 'live-translation.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/voice/translate/stream',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Translation stream (SSE)',
      },
      {
        method: 'GET',
        path: '/api/voice/translate/history',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Translation history',
      },
    ],
  },

  // ═══ AI ═════════════════════════════════════════════════════════════════

  {
    id: 'bond-ai',
    name: 'Bond AI',
    category: 'ai',
    routeFile: 'bond-ai.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/bond-ai/conversations',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'AI conversations',
      },
      {
        method: 'GET',
        path: '/api/bond-ai/alerts',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'AI alerts',
      },
      {
        method: 'POST',
        path: '/api/bond-ai/copilot',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'AI copilot query',
      },
      {
        method: 'GET',
        path: '/api/bond-ai/insights',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'AI insights',
      },
    ],
  },
  {
    id: 'ai-config',
    name: 'AI Config',
    category: 'ai',
    routeFile: 'ai-config.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/ai-config',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'AI configuration',
      },
    ],
  },
  {
    id: 'ai-llm',
    name: 'AI LLM',
    category: 'ai',
    routeFile: 'ai-llm.ts',
    status: 'active',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ai/llm/chat',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'LLM chat inference',
      },
    ],
  },
  {
    id: 'ai-transcribe',
    name: 'AI Transcription',
    category: 'ai',
    routeFile: 'ai-transcribe.ts',
    status: 'active',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ai/transcribe/transcribe',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Audio transcription',
      },
    ],
  },
  {
    id: 'tts',
    name: 'Text-to-Speech',
    category: 'ai',
    routeFile: 'tts.ts',
    status: 'active',
    endpoints: [
      {
        method: 'POST',
        path: '/api/tts/generate',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Text-to-speech synthesis',
      },
    ],
  },
  {
    id: 'audio',
    name: 'Audio Processing',
    category: 'ai',
    routeFile: 'audio.ts',
    status: 'active',
    endpoints: [
      {
        method: 'POST',
        path: '/api/audio/upload',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Audio upload',
      },
    ],
  },

  // ═══ ANALYTICS & REPORTS ════════════════════════════════════════════════

  {
    id: 'analytics',
    name: 'Analytics',
    category: 'analytics',
    routeFile: 'analytics.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/analytics/kpis',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Analytics KPIs',
      },
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    category: 'analytics',
    routeFile: 'reports.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/reports',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Report data',
      },
    ],
  },
  {
    id: 'scorecards',
    name: 'Scorecards',
    category: 'analytics',
    routeFile: 'scorecards.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/scorecards',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Call scorecards',
      },
    ],
  },
  {
    id: 'usage',
    name: 'Usage',
    category: 'analytics',
    routeFile: 'usage.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/usage',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Usage metrics',
      },
    ],
  },

  // ═══ COMPLIANCE ═════════════════════════════════════════════════════════

  {
    id: 'compliance',
    name: 'Compliance',
    category: 'compliance',
    routeFile: 'compliance.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/compliance/violations',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Compliance violations',
      },
    ],
  },
  {
    id: 'retention',
    name: 'Retention',
    category: 'compliance',
    routeFile: 'retention.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/retention',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Data retention policies',
      },
    ],
  },
  {
    id: 'reliability',
    name: 'Reliability',
    category: 'compliance',
    routeFile: 'reliability.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/reliability/webhooks',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Webhook reliability metrics',
      },
    ],
  },

  // ═══ BILLING ════════════════════════════════════════════════════════════

  {
    id: 'billing',
    name: 'Billing',
    category: 'billing',
    routeFile: 'billing.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/billing',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Billing overview',
      },
    ],
  },
  {
    id: 'surveys',
    name: 'Surveys',
    category: 'billing',
    routeFile: 'surveys.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/surveys',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Post-call surveys',
      },
    ],
  },
  {
    id: 'bookings',
    name: 'Bookings',
    category: 'billing',
    routeFile: 'bookings.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/bookings',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Demo bookings',
      },
    ],
  },
  {
    id: 'campaigns',
    name: 'Campaigns',
    category: 'billing',
    routeFile: 'campaigns.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/campaigns',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Campaign management',
      },
    ],
  },

  // ═══ INTEGRATIONS ═══════════════════════════════════════════════════════

  {
    id: 'webhooks',
    name: 'Webhooks',
    category: 'integrations',
    routeFile: 'webhooks.ts',
    status: 'active',
    endpoints: [
      {
        method: 'POST',
        path: '/api/webhooks/telnyx',
        requiresAuth: false,
        unauthStatus: [200, 400, 500],
        description: 'Telnyx webhook receiver',
      },
      {
        method: 'POST',
        path: '/api/webhooks/stripe',
        requiresAuth: false,
        unauthStatus: [200, 400, 500],
        description: 'Stripe webhook receiver',
      },
      {
        method: 'POST',
        path: '/api/webhooks/assemblyai',
        requiresAuth: false,
        unauthStatus: [200, 400, 500],
        description: 'AssemblyAI webhook receiver',
      },
    ],
  },
  {
    id: 'shopper',
    name: 'Mystery Shopper',
    category: 'integrations',
    routeFile: 'shopper.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/shopper/scripts',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Mystery shopper scripts',
      },
    ],
  },

  // ═══ ADMIN ══════════════════════════════════════════════════════════════

  {
    id: 'admin',
    name: 'Admin',
    category: 'admin',
    routeFile: 'admin.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/_admin/auth-providers',
        requiresAuth: true,
        unauthStatus: [401, 403],
        description: 'Admin auth providers',
      },
    ],
  },

  // ═══ TEST RUNNER ════════════════════════════════════════════════════════

  {
    id: 'test-runner',
    name: 'Test Runner',
    category: 'core',
    routeFile: 'test.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/test/catalog',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Test catalog',
      },
      {
        method: 'GET',
        path: '/api/test/health',
        requiresAuth: false,
        unauthStatus: [200, 503],
        description: 'Infrastructure probes',
      },
      {
        method: 'POST',
        path: '/api/test/run',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Run single test',
      },
      {
        method: 'POST',
        path: '/api/test/run-all',
        requiresAuth: false,
        unauthStatus: [200, 401, 403],
        description: 'Run all tests',
      },
    ],
  },

  // ═══ MISSING ROUTES — Added Session 19 Multi-Agent Audit ═══════════════

  {
    id: 'collections',
    name: 'Collections Management',
    category: 'billing',
    routeFile: 'collections.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/collections/accounts',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'List collection accounts',
      },
    ],
  },
  {
    id: 'dialer',
    name: 'Predictive Dialer',
    category: 'voice',
    routeFile: 'dialer.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/dialer/stats/default',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Get dialer stats',
      },
      {
        method: 'POST',
        path: '/api/dialer/start',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Start dialer campaign',
      },
    ],
  },
  {
    id: 'ivr',
    name: 'IVR Flow Engine',
    category: 'voice',
    routeFile: 'ivr.ts',
    status: 'active',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ivr/start',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Start IVR flow',
      },
    ],
  },
  {
    id: 'manager',
    name: 'Manager Dashboard',
    category: 'admin',
    routeFile: 'manager.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/manager/team-members',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Get manager team members',
      },
    ],
  },
  {
    id: 'onboarding',
    name: 'Onboarding Flow',
    category: 'core',
    routeFile: 'onboarding.ts',
    status: 'active',
    endpoints: [
      {
        method: 'POST',
        path: '/api/onboarding/setup',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Begin onboarding setup',
      },
    ],
  },
  {
    id: 'productivity',
    name: 'Agent Productivity Suite',
    category: 'voice',
    routeFile: 'productivity.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/productivity/note-templates',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'List note templates',
      },
      {
        method: 'GET',
        path: '/api/productivity/objection-rebuttals',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'List objection rebuttals',
      },
    ],
  },
  {
    id: 'sentiment',
    name: 'Sentiment Analysis',
    category: 'ai',
    routeFile: 'sentiment.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/sentiment/config',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Get sentiment configuration',
      },
    ],
  },
  {
    id: 'ai-toggle',
    name: 'AI Feature Toggles',
    category: 'ai',
    routeFile: 'ai-toggle.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/ai-toggle/prompt-config',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Get AI prompt configuration',
      },
    ],
  },
  {
    id: 'ai-router',
    name: 'AI Multi-Provider Router',
    category: 'ai',
    routeFile: 'ai-router.ts',
    status: 'active',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ai/router/chat',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Route AI chat to optimal provider',
      },
    ],
  },
  {
    id: 'organizations',
    name: 'Organizations',
    category: 'core',
    routeFile: 'organizations.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/organizations/current',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Get current organization',
      },
    ],
  },
  {
    id: 'retention',
    name: 'Data Retention',
    category: 'compliance',
    routeFile: 'retention.ts',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/retention',
        requiresAuth: true,
        unauthStatus: [401],
        description: 'Get retention policies',
      },
    ],
  },
]

// ─── Helper Functions ───────────────────────────────────────────────────────

/** Get all endpoints across all features */
export function getAllEndpoints(): (EndpointDef & { featureId: string; featureName: string })[] {
  return FEATURE_REGISTRY.flatMap((f) =>
    f.endpoints.map((ep) => ({
      ...ep,
      featureId: f.id,
      featureName: f.name,
    }))
  )
}

/** Get features by category */
export function getFeaturesByCategory(category: FeatureCategory): FeatureDefinition[] {
  return FEATURE_REGISTRY.filter((f) => f.category === category)
}

/** Get a specific feature */
export function getFeature(id: string): FeatureDefinition | undefined {
  return FEATURE_REGISTRY.find((f) => f.id === id)
}

/** Get total endpoint count */
export function getTotalEndpoints(): number {
  return FEATURE_REGISTRY.reduce((sum, f) => sum + f.endpoints.length, 0)
}

/** Get features that require auth on ALL endpoints */
export function getFullyProtectedFeatures(): FeatureDefinition[] {
  return FEATURE_REGISTRY.filter((f) => f.endpoints.every((ep) => ep.requiresAuth))
}

/** Get all unique categories */
export function getCategories(): FeatureCategory[] {
  return [...new Set(FEATURE_REGISTRY.map((f) => f.category))]
}

/** Summary stats */
export function getRegistryStats() {
  const totalFeatures = FEATURE_REGISTRY.length
  const totalEndpoints = getTotalEndpoints()
  const byCategory = getCategories().map((cat) => ({
    category: cat,
    features: getFeaturesByCategory(cat).length,
    endpoints: getFeaturesByCategory(cat).reduce((s, f) => s + f.endpoints.length, 0),
  }))
  return { totalFeatures, totalEndpoints, byCategory }
}

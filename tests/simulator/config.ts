/**
 * Simulator Configuration & Constants
 * Word Is Bond Workplace Person Simulator
 */

export const SIMULATOR_CONFIG = {
  // Test data settings
  TEST_DATA: {
    USER_COUNT: 1,
    ACCOUNT_COUNT: 5,
    CALL_SCENARIOS: 3,
    MAX_WAIT_TIME: 30000,
    ASYNC_TIMEOUT: 60000
  },

  // Feature flags for testing
  FEATURES: {
    CALL_PLACEMENT: true,
    TRANSCRIPTION: true,
    LIVE_TRANSLATION: false, // Requires Business plan
    POST_TRANSLATION: true,
    ANALYTICS: true,
    CAMPAIGNS: true,
    REPORTS: true,
    SURVEYS: false, // Requires Insights plan
    SECRET_SHOPPER: false // Requires Business plan
  },

  // Onboarding flow steps
  ONBOARDING_STEPS: {
    SIGNUP: 'signup',
    CONFIGURE: 'configure',
    FIRST_DATA: 'first-data',
    TEST_CALL: 'test-call',
    TOUR: 'tour',
    COMPLETE: 'complete'
  },

  // Kink detection thresholds
  KINK_THRESHOLDS: {
    SLOW_OPERATION_MS: 5000,
    VERY_SLOW_OPERATION_MS: 15000,
    MISSING_ELEMENT_TIMEOUT_MS: 5000,
    BROKEN_FLOW_TIMEOUT_MS: 10000
  },

  // Evidence capture settings
  EVIDENCE: {
    SCREENSHOT_ON_STEP: true,
    SCREENSHOT_ON_ERROR: true,
    TIMING_TRACKING: true,
    METADATA_CAPTURE: true,
    RETENTION_DAYS: 30
  },

  // Report generation
  REPORTING: {
    JSON_FORMAT: true,
    HTML_FORMAT: false,
    PDF_FORMAT: false,
    SCREENSHOT_EMBEDDING: true,
    TIMING_ANALYSIS: true,
    KINK_SUMMARY: true
  }
} as const

// Test selectors (data-testid attributes)
export const SELECTORS = {
  // Auth
  EMAIL_INPUT: '[data-testid="email"]',
  PASSWORD_INPUT: '[data-testid="password"]',
  CONFIRM_PASSWORD_INPUT: '[data-testid="confirm-password"]',
  SIGNUP_SUBMIT: '[data-testid="signup-submit"]',
  LOGIN_SUBMIT: '[data-testid="login-submit"]',

  // Onboarding
  COMPANY_NAME_INPUT: '[data-testid="company-name"]',
  INDUSTRY_SELECT: '[data-testid="industry"]',
  TEAM_SIZE_SELECT: '[data-testid="team-size"]',
  CONFIGURE_SUBMIT: '[data-testid="configure-submit"]',

  ACCOUNT_NAME_INPUT: '[data-testid="account-name"]',
  ACCOUNT_PHONE_INPUT: '[data-testid="account-phone"]',
  ACCOUNT_EMAIL_INPUT: '[data-testid="account-email"]',
  FIRST_DATA_SUBMIT: '[data-testid="first-data-submit"]',

  TEST_PHONE_INPUT: '[data-testid="test-phone"]',
  START_TEST_CALL: '[data-testid="start-test-call"]',
  END_TEST_CALL: '[data-testid="end-test-call"]',

  TOUR_STEP: '[data-testid="tour-step"]',
  TOUR_COMPLETE: '[data-testid="tour-complete"]',

  // Voice Operations
  TARGET_NUMBER_INPUT: '[data-testid="target-number"]',
  START_CALL: '[data-testid="start-call"]',
  END_CALL: '[data-testid="end-call"]',
  CALL_STATUS: '[data-testid="call-status"]',

  // Features
  RECORDING_TOGGLE: '[data-testid="recording-toggle"]',
  TRANSCRIPT_TOGGLE: '[data-testid="transcript-toggle"]',
  TRANSLATION_TOGGLE: '[data-testid="translation-toggle"]',
  TRANSCRIPT_READY: '[data-testid="transcript-ready"]',
  TRANSLATION_READY: '[data-testid="translation-ready"]',

  // Analytics
  ANALYTICS_DASHBOARD: '[data-testid="analytics-dashboard"]',
  CALL_VOLUME_CHART: '[data-testid="call-volume-chart"]',
  PERFORMANCE_METRICS: '[data-testid="performance-metrics"]',
  SENTIMENT_ANALYSIS: '[data-testid="sentiment-analysis"]',

  // Navigation
  VOICE_NAV: '[data-testid="nav-voice"]',
  ANALYTICS_NAV: '[data-testid="nav-analytics"]',
  DASHBOARD_NAV: '[data-testid="nav-dashboard"]',
  SETTINGS_NAV: '[data-testid="nav-settings"]'
} as const

// Expected URLs for navigation validation
export const URLS = {
  SIGNUP: '/signup',
  ONBOARDING_CONFIGURE: '/onboarding/configure',
  ONBOARDING_FIRST_DATA: '/onboarding/first-data',
  ONBOARDING_TEST_CALL: '/onboarding/test-call',
  ONBOARDING_TOUR: '/onboarding/tour',
  WORK: '/work',
  VOICE: '/voice',
  ANALYTICS: '/analytics',
  DASHBOARD: '/dashboard',
  SETTINGS: '/settings'
} as const

// Test data templates
export const TEST_DATA_TEMPLATES = {
  INDUSTRIES: ['collections', 'sales', 'support', 'surveys', 'other'],
  TEAM_SIZES: ['solo', 'small', 'medium', 'large'],
  ACCOUNT_TYPES: ['residential', 'business', 'commercial'],
  CALL_PURPOSES: [
    'Account verification',
    'Payment collection',
    'Customer service',
    'Survey response',
    'Appointment confirmation'
  ]
} as const

// Performance benchmarks
export const PERFORMANCE_BENCHMARKS = {
  PAGE_LOAD_MAX_MS: 3000,
  API_RESPONSE_MAX_MS: 1000,
  CALL_CONNECT_MAX_MS: 5000,
  TRANSCRIPT_READY_MAX_MS: 60000, // 1 minute
  ONBOARDING_STEP_MAX_MS: 10000
} as const
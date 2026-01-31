/**
 * Tour Step Definitions
 * 
 * Define the steps for each page's tutorial tour.
 * Each step references a DOM element by data-tour attribute.
 * 
 * Per ARCH_DOCS/04-DESIGN/TUTORIAL_OVERLAY_IMPLEMENTATION.md
 */

export interface TourStepDefinition {
  targetSelector: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Voice Operations Page Tour
 * Guides users through the call execution workflow
 */
export const VOICE_TOUR: TourStepDefinition[] = [
  {
    targetSelector: '[data-tour="target-selector"]',
    title: 'Choose Who to Call',
    content: 'Select a saved target from your list or enter a phone number directly. Recent numbers appear below for quick access.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="call-options"]',
    title: 'Configure Your Call',
    content: 'Enable recording, transcription, translation, and survey features. These options control what happens during and after the call.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="place-call"]',
    title: 'Place Your Call',
    content: 'Once configured, click this button to start the call. You\'ll see real-time status updates as the call connects.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="call-list"]',
    title: 'Call History',
    content: 'All your calls appear here with status indicators. Click any call to see details, play recordings, and view transcripts.',
    position: 'left',
  },
  {
    targetSelector: '[data-tour="activity-feed"]',
    title: 'Activity Feed',
    content: 'Real-time updates on call progress, transcription completion, and other events. Stay informed without refreshing.',
    position: 'left',
  },
]

/**
 * Dashboard Page Tour
 * Introduces key metrics and navigation
 */
export const DASHBOARD_TOUR: TourStepDefinition[] = [
  {
    targetSelector: '[data-tour="metrics"]',
    title: 'Your Metrics',
    content: 'Key stats at a glance: total calls, average sentiment scores, and scheduled calls. These update in real-time.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="quick-actions"]',
    title: 'Quick Actions',
    content: 'Common tasks are one click away. Start a new call, schedule one for later, or jump to voice operations.',
    position: 'right',
  },
  {
    targetSelector: '[data-tour="recent-calls"]',
    title: 'Recent Activity',
    content: 'Jump back into any recent call to review recordings and transcripts. Click to see full details.',
    position: 'left',
  },
  {
    targetSelector: '[data-tour="activity-feed"]',
    title: 'Team Visibility',
    content: 'Real-time activity and QA alerts help your team spot issues early.',
    position: 'top',
  },
]

/**
 * Settings Page Tour
 * Explains settings organization
 */
export const SETTINGS_TOUR: TourStepDefinition[] = [
  {
    targetSelector: '[data-tour="settings-tabs"]',
    title: 'Settings Categories',
    content: 'Settings are organized by task: Call Configuration, AI features, Quality Assurance, Team management, and Billing.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="tab-call-config"]',
    title: 'Voice Settings',
    content: 'Configure default recording, transcription, and translation options. these apply to all new calls.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="tab-team"]',
    title: 'Team Management',
    content: 'Invite team members, assign roles, and manage permissions.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="tab-billing"]',
    title: 'Billing & Plans',
    content: 'Manage your subscription, view invoices, and upgrade your plan.',
    position: 'bottom',
  },
]

/**
 * Review Mode Tour
 * Explains evidence review workflow
 */
export const REVIEW_TOUR: TourStepDefinition[] = [
  {
    targetSelector: '[data-tour="recording-player"]',
    title: 'Recording Playback',
    content: 'Listen to the full call recording. Use the timeline below to jump to specific moments.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="transcript-view"]',
    title: 'Transcript',
    content: 'Read the full conversation transcript. Click any line to jump to that moment in the recording.',
    position: 'left',
  },
  {
    targetSelector: '[data-tour="evidence-actions"]',
    title: 'Evidence Actions',
    content: 'Export recordings, download transcripts, or share with your team. All actions are logged for compliance.',
    position: 'top',
  },
]

/**
 * Get tour by ID
 */
export function getTourById(tourId: string): TourStepDefinition[] {
  switch (tourId) {
    case 'voice':
      return VOICE_TOUR
    case 'dashboard':
      return DASHBOARD_TOUR
    case 'settings':
      return SETTINGS_TOUR
    case 'review':
      return REVIEW_TOUR
    default:
      return []
  }
}

/**
 * Confirmation Prompt Definitions
 * 
 * Per AI Role Policy (ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md):
 * - These prompts GUIDE the operator on what to ASK
 * - The OPERATOR asks the customer, not the AI
 * - The CUSTOMER responds verbally
 * - The OPERATOR marks the confirmation as captured
 * 
 * "People speak the commitments. The system ensures those commitments are captured correctly."
 */

// ============================================================================
// TYPES
// ============================================================================

export type ConfirmationType =
  | 'disclosure_accepted'
  | 'recording_consent'
  | 'terms_agreed'
  | 'price_confirmed'
  | 'scope_confirmed'
  | 'identity_verified'
  | 'authorization_given'
  | 'understanding_confirmed'
  | 'custom'

export type ConfirmerRole =
  | 'customer'
  | 'operator'
  | 'third_party'
  | 'both'

export type VerificationMethod =
  | 'verbal'
  | 'keypress'
  | 'biometric'
  | 'document'
  | 'other'

export type CapturedBy = 'human' | 'system'

export type ChecklistStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'skipped'
  | 'not_applicable'

export type UseCase =
  | 'general'
  | 'sales'
  | 'support'
  | 'compliance'
  | 'legal'
  | 'healthcare'
  | 'finance'

// ============================================================================
// CONFIRMATION TEMPLATE
// ============================================================================

export interface ConfirmationTemplate {
  id: string
  type: ConfirmationType
  label: string
  promptText: string
  description: string
  isRequired: boolean
  useCases: UseCase[]
  icon: string
  displayOrder: number
}

// ============================================================================
// CONFIRMATION RECORD
// ============================================================================

export interface CallConfirmation {
  id: string
  callId: string
  organizationId: string
  confirmationType: ConfirmationType
  confirmationLabel?: string
  promptText: string
  confirmerRole: ConfirmerRole
  confirmedAt: string
  recordingTimestampSeconds?: number
  capturedBy: CapturedBy
  capturedByUserId?: string
  verificationMethod?: VerificationMethod
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// CHECKLIST ITEM
// ============================================================================

export interface ConfirmationChecklistItem {
  id: string
  callId: string
  templateId: string
  template: ConfirmationTemplate
  status: ChecklistStatus
  confirmationId?: string
  confirmation?: CallConfirmation
  skipReason?: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// DEFAULT CONFIRMATION TEMPLATES
// ============================================================================

/**
 * Standard confirmation prompts for operators.
 * These guide the OPERATOR on what to ASK the customer.
 * 
 * IMPORTANT: The AI does NOT ask these questions.
 * The operator reads/paraphrases and asks the customer.
 */
export const DEFAULT_CONFIRMATION_TEMPLATES: ConfirmationTemplate[] = [
  {
    id: 'tpl_disclosure',
    type: 'disclosure_accepted',
    label: 'Recording Disclosed',
    promptText: 'Confirm that the customer was informed this call is being recorded',
    description: 'The recording disclosure was played at call start. Mark confirmed when customer continues.',
    isRequired: true,
    useCases: ['general'],
    icon: 'Volume2',
    displayOrder: 1,
  },
  {
    id: 'tpl_recording_consent',
    type: 'recording_consent',
    label: 'Recording Consent',
    promptText: 'Ask: "Do you consent to this call being recorded?"',
    description: 'Obtain explicit verbal consent to record the call.',
    isRequired: true,
    useCases: ['compliance', 'legal', 'healthcare'],
    icon: 'Mic',
    displayOrder: 2,
  },
  {
    id: 'tpl_identity',
    type: 'identity_verified',
    label: 'Identity Verified',
    promptText: 'Ask: "Can you please confirm your name and [verification question]?"',
    description: 'Verify the caller\'s identity before discussing sensitive information.',
    isRequired: false,
    useCases: ['finance', 'healthcare', 'compliance'],
    icon: 'BadgeCheck',
    displayOrder: 3,
  },
  {
    id: 'tpl_terms',
    type: 'terms_agreed',
    label: 'Terms Acknowledged',
    promptText: 'Ask: "Do you understand and agree to the terms as I\'ve explained them?"',
    description: 'Confirm the customer understands and agrees to terms.',
    isRequired: false,
    useCases: ['sales', 'legal', 'finance'],
    icon: 'FileText',
    displayOrder: 4,
  },
  {
    id: 'tpl_price',
    type: 'price_confirmed',
    label: 'Price Confirmed',
    promptText: 'Ask: "To confirm, you\'re agreeing to [price/amount]. Is that correct?"',
    description: 'Obtain verbal confirmation of pricing or amounts.',
    isRequired: false,
    useCases: ['sales', 'finance'],
    icon: 'DollarSign',
    displayOrder: 5,
  },
  {
    id: 'tpl_scope',
    type: 'scope_confirmed',
    label: 'Scope Confirmed',
    promptText: 'Ask: "Can you confirm you understand the scope of [service/work]?"',
    description: 'Confirm understanding of what is included/excluded.',
    isRequired: false,
    useCases: ['sales', 'support'],
    icon: 'ClipboardList',
    displayOrder: 6,
  },
  {
    id: 'tpl_authorization',
    type: 'authorization_given',
    label: 'Authorization Given',
    promptText: 'Ask: "Do you authorize us to proceed with [action]?"',
    description: 'Obtain explicit authorization for an action.',
    isRequired: false,
    useCases: ['finance', 'healthcare', 'legal'],
    icon: 'CheckCircle',
    displayOrder: 7,
  },
  {
    id: 'tpl_understanding',
    type: 'understanding_confirmed',
    label: 'Understanding Confirmed',
    promptText: 'Ask: "Do you have any questions about what we\'ve discussed?"',
    description: 'Confirm the customer understands the key points.',
    isRequired: false,
    useCases: ['general', 'compliance'],
    icon: 'Lightbulb',
    displayOrder: 8,
  },
]

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get templates for a specific use case
 */
export function getTemplatesForUseCase(useCase: UseCase): ConfirmationTemplate[] {
  return DEFAULT_CONFIRMATION_TEMPLATES.filter(
    t => t.useCases.includes(useCase) || t.useCases.includes('general')
  ).sort((a, b) => a.displayOrder - b.displayOrder)
}

/**
 * Get required templates (must be completed before call end)
 */
export function getRequiredTemplates(): ConfirmationTemplate[] {
  return DEFAULT_CONFIRMATION_TEMPLATES.filter(t => t.isRequired)
    .sort((a, b) => a.displayOrder - b.displayOrder)
}

/**
 * Get template by type
 */
export function getTemplateByType(type: ConfirmationType): ConfirmationTemplate | undefined {
  return DEFAULT_CONFIRMATION_TEMPLATES.find(t => t.type === type)
}

/**
 * Get status color for checklist display
 */
export function getStatusColor(status: ChecklistStatus): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800'
    case 'declined':
      return 'bg-red-100 text-red-800'
    case 'skipped':
      return 'bg-yellow-100 text-yellow-800'
    case 'not_applicable':
      return 'bg-gray-100 text-gray-600'
    case 'pending':
    default:
      return 'bg-blue-50 text-blue-800'
  }
}

/**
 * Get status icon for checklist display
 */
export function getStatusIcon(status: ChecklistStatus): string {
  switch (status) {
    case 'confirmed':
      return '✓'
    case 'declined':
      return '✗'
    case 'skipped':
      return '→'
    case 'not_applicable':
      return '—'
    case 'pending':
    default:
      return '○'
  }
}

// ============================================================================
// CONFIRMATION TYPE METADATA
// ============================================================================

export const CONFIRMATION_TYPE_CONFIG: Record<ConfirmationType, {
  label: string
  description: string
  icon: string
  color: string
}> = {
  disclosure_accepted: {
    label: 'Disclosure Accepted',
    description: 'Recording disclosure was acknowledged',
    icon: 'Volume2',
    color: 'bg-blue-100 text-blue-800',
  },
  recording_consent: {
    label: 'Recording Consent',
    description: 'Explicit consent to record',
    icon: 'Mic',
    color: 'bg-purple-100 text-purple-800',
  },
  terms_agreed: {
    label: 'Terms Agreed',
    description: 'Terms and conditions accepted',
    icon: 'FileText',
    color: 'bg-indigo-100 text-indigo-800',
  },
  price_confirmed: {
    label: 'Price Confirmed',
    description: 'Pricing/amount confirmed',
    icon: 'DollarSign',
    color: 'bg-green-100 text-green-800',
  },
  scope_confirmed: {
    label: 'Scope Confirmed',
    description: 'Scope of work confirmed',
    icon: 'ClipboardList',
    color: 'bg-orange-100 text-orange-800',
  },
  identity_verified: {
    label: 'Identity Verified',
    description: 'Caller identity confirmed',
    icon: 'BadgeCheck',
    color: 'bg-cyan-100 text-cyan-800',
  },
  authorization_given: {
    label: 'Authorization Given',
    description: 'Action authorized',
    icon: 'CheckCircle',
    color: 'bg-emerald-100 text-emerald-800',
  },
  understanding_confirmed: {
    label: 'Understanding Confirmed',
    description: 'Comprehension verified',
    icon: 'Lightbulb',
    color: 'bg-yellow-100 text-yellow-800',
  },
  custom: {
    label: 'Custom',
    description: 'Custom confirmation type',
    icon: 'MoreHorizontal',
    color: 'bg-gray-100 text-gray-800',
  },
}

// ============================================================================
// CONFIRMER ROLE METADATA
// ============================================================================

export const CONFIRMER_ROLE_CONFIG: Record<ConfirmerRole, {
  label: string
  description: string
}> = {
  customer: {
    label: 'Customer',
    description: 'The called party confirmed',
  },
  operator: {
    label: 'Operator',
    description: 'The operator confirmed',
  },
  third_party: {
    label: 'Third Party',
    description: 'A third party on the call confirmed',
  },
  both: {
    label: 'Both Parties',
    description: 'Both operator and customer confirmed',
  },
}

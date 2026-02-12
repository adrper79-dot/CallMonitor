/**
 * Compliance guide snippets for debt collection and call-center operations.
 * Provides lightweight, citeable guidance for inline UI hints and audits.
 */

export interface ComplianceRule {
  id: string
  title: string
  citation: string
  description: string
  requiredActions: string[]
  prohibited: string[]
  appliesTo: Array<'outbound' | 'inbound' | 'sms' | 'email'>
  jurisdictions: string[]
}

export const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    id: 'fdcpa-mini-miranda',
    title: 'Mini-Miranda disclosure',
    citation: 'FDCPA 15 U.S.C. § 1692e(11)',
    description: 'State that this is an attempt to collect a debt and any information obtained will be used for that purpose.',
    requiredActions: [
      'Include the disclosure on first communication and meaningful subsequent contacts',
      'Use clear, non-deceptive language',
    ],
    prohibited: ['Omitting disclosure on initial call', 'Implying affiliation with government or attorneys'],
    appliesTo: ['outbound', 'inbound'],
    jurisdictions: ['US', 'FDCPA'],
  },
  {
    id: 'fdcpa-call-time',
    title: 'Call times and time zones',
    citation: 'FDCPA 15 U.S.C. § 1692c(a)(1)',
    description: 'Do not call before 8am or after 9pm local time of the consumer unless consent is documented.',
    requiredActions: [
      'Detect consumer local time zone before dialing',
      'Honor any documented consent outside default window',
    ],
    prohibited: ['Calling outside 8am–9pm local time without consent'],
    appliesTo: ['outbound'],
    jurisdictions: ['US', 'FDCPA', 'TCPA'],
  },
  {
    id: 'fdcpa-no-harassment',
    title: 'Harassment and abuse prohibition',
    citation: 'FDCPA 15 U.S.C. § 1692d',
    description: 'No threats, profanity, or excessive call frequency.',
    requiredActions: [
      'Throttle repeat attempts and respect cease-and-desist flags',
      'Use neutral, professional tone; avoid coercive language',
    ],
    prohibited: ['Threats of arrest or legal action without basis', 'Profanity', 'Call spamming'],
    appliesTo: ['outbound', 'inbound'],
    jurisdictions: ['US', 'FDCPA'],
  },
  {
    id: 'tcpa-consent',
    title: 'Prior express consent for autodialed/prerecorded calls',
    citation: 'TCPA 47 U.S.C. § 227; 47 CFR § 64.1200',
    description: 'Autodialed or prerecorded calls to wireless numbers require documented prior express consent.',
    requiredActions: [
      'Verify and store consent status per contact before dialing',
      'Honor opt-outs immediately and log them with timestamp',
    ],
    prohibited: ['Dialing wireless numbers with autodialer without consent', 'Ignoring opt-out requests'],
    appliesTo: ['outbound'],
    jurisdictions: ['US', 'TCPA'],
  },
  {
    id: 'cfpb-limited-content',
    title: 'Limited content voicemail',
    citation: 'CFPB Reg F 12 CFR § 1006.2(j)',
    description: 'Leave only limited-content messages to avoid third-party disclosure.',
    requiredActions: [
      'State business name that does not indicate debt collection',
      'Provide a request to reply and contact info without debt details',
    ],
    prohibited: ['Mentioning debt amount or status in voicemail'],
    appliesTo: ['outbound'],
    jurisdictions: ['US', 'CFPB'],
  },
  {
    id: 'data-minimization',
    title: 'PII minimization and redaction',
    citation: 'SOC2 / HIPAA Minimum Necessary',
    description: 'Share only the minimum necessary PII in prompts, logs, and transcripts.',
    requiredActions: [
      'Redact SSN, DOB, card numbers before LLM calls',
      'Store audit trails without sensitive fields where possible',
    ],
    prohibited: ['Sending full SSN or card data to LLM/TTS providers', 'Logging sensitive data in plaintext'],
    appliesTo: ['outbound', 'inbound', 'sms', 'email'],
    jurisdictions: ['US', 'HIPAA', 'SOC2'],
  },
]

export interface ComplianceChecklistItem {
  id: string
  label: string
  ruleIds: string[]
}

export const COMPLIANCE_CHECKLIST: ComplianceChecklistItem[] = [
  {
    id: 'pre-call',
    label: 'Pre-call checks',
    ruleIds: ['fdcpa-call-time', 'tcpa-consent'],
  },
  {
    id: 'in-call',
    label: 'In-call disclosures',
    ruleIds: ['fdcpa-mini-miranda', 'fdcpa-no-harassment'],
  },
  {
    id: 'post-call',
    label: 'Post-call compliance',
    ruleIds: ['cfpb-limited-content', 'data-minimization'],
  },
]

export interface ComplianceModeDescriptor {
  id: 'coach' | 'compliance';
  title: string;
  description: string;
  behaviors: string[];
}

export const COMPLIANCE_MODES: ComplianceModeDescriptor[] = [
  {
    id: 'coach',
    title: 'Coach Mode',
    description: 'Advisory feedback and skill-building suggestions without blocking calls.',
    behaviors: [
      'Post-call scorecard with 3 targeted improvements',
      'Tone and empathy coaching, not policy blocking',
      'Inline tips pulled from applicable rules per checklist stage',
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance Mode',
    description: 'Strict enforcement with blocking guidance and citations.',
    behaviors: [
      'Hard stops on missing disclosures or consent gaps',
      'Red/yellow/green status with rule citations',
      'Escalation to supervisor on repeated violations',
    ],
  },
]

export interface ComplianceGuidePayload {
  modes: ComplianceModeDescriptor[]
  rules: ComplianceRule[]
  checklist: ComplianceChecklistItem[]
}

export function buildComplianceGuidePayload(): ComplianceGuidePayload {
  return {
    modes: COMPLIANCE_MODES,
    rules: COMPLIANCE_RULES,
    checklist: COMPLIANCE_CHECKLIST,
  }
}

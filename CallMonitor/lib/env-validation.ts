/**
 * Environment Variable Validation
 * 
 * Validates all required environment variables at startup.
 * Per PRODUCTION_READINESS_TASKS.md
 */

import { logger } from '@/lib/logger'

interface EnvVar {
  name: string
  required: boolean
  description: string
  validate?: (value: string) => boolean | string
}

const ENV_VARS: EnvVar[] = [
  {
    name: 'SIGNALWIRE_PROJECT_ID',
    required: true,
    description: 'SignalWire project ID for call execution',
    validate: (v) => v.length > 0 || 'Must not be empty'
  },
  {
    name: 'SIGNALWIRE_TOKEN',
    required: true,
    description: 'SignalWire API token',
    validate: (v) => v.length > 0 || 'Must not be empty'
  },
  {
    name: 'SIGNALWIRE_SPACE',
    required: true,
    description: 'SignalWire space URL',
    validate: (v) => v.includes('signalwire.com') || 'Must be a valid SignalWire space URL'
  },
  {
    name: 'ASSEMBLYAI_API_KEY',
    required: true,
    description: 'AssemblyAI API key for transcription',
    validate: (v) => v.length > 0 || 'Must not be empty'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    validate: (v) => v.startsWith('https://') || 'Must be a valid HTTPS URL'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key',
    validate: (v) => v.length > 0 || 'Must not be empty'
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (server-side only)',
    validate: (v) => v.length > 0 || 'Must not be empty'
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    description: 'Public application URL for webhooks',
    validate: (v) => (v.startsWith('https://') || v.startsWith('http://localhost')) || 'Must be a valid URL'
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    description: 'NextAuth secret for session encryption',
    validate: (v) => v.length >= 32 || 'Must be at least 32 characters'
  },
  {
    name: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key for translation (optional)',
    validate: (v) => v.length > 0 || 'Must not be empty if provided'
  },
  {
    name: 'ELEVENLABS_API_KEY',
    required: false,
    description: 'ElevenLabs API key for text-to-speech (optional)',
    validate: (v) => v.startsWith('sk_') || 'Must start with "sk_"'
  },
  {
    name: 'TRANSLATION_LIVE_ASSIST_PREVIEW',
    required: false,
    description: 'Enable live translation preview feature (SignalWire AI Agents)',
    validate: (v) => v === 'true' || v === 'false' || 'Must be "true" or "false"'
  }
]

export interface ValidationResult {
  valid: boolean
  errors: Array<{ name: string; message: string }>
  warnings: Array<{ name: string; message: string }>
}

/**
 * Validate all environment variables
 */
export function validateEnvVars(): ValidationResult {
  const errors: Array<{ name: string; message: string }> = []
  const warnings: Array<{ name: string; message: string }> = []

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name]

    if (!value) {
      if (envVar.required) {
        errors.push({
          name: envVar.name,
          message: `Required environment variable missing: ${envVar.description}`
        })
      } else {
        warnings.push({
          name: envVar.name,
          message: `Optional environment variable not set: ${envVar.description}`
        })
      }
    } else if (envVar.validate) {
      const validationResult = envVar.validate(value)
      if (validationResult !== true) {
        const message = typeof validationResult === 'string' ? validationResult : 'Invalid value'
        if (envVar.required) {
          errors.push({
            name: envVar.name,
            message: `${envVar.description}: ${message}`
          })
        } else {
          warnings.push({
            name: envVar.name,
            message: `${envVar.description}: ${message}`
          })
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate and throw if invalid (for startup)
 */
export function validateEnvVarsOrThrow(): void {
  const result = validateEnvVars()

  if (!result.valid) {
    const errorMessages = result.errors.map(e => `  - ${e.name}: ${e.message}`).join('\n')
    throw new Error(`Environment variable validation failed:\n${errorMessages}`)
  }

  if (result.warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    const warningMessages = result.warnings.map(w => `  - ${w.name}: ${w.message}`).join('\n')
    logger.warn(`Environment variable warnings:\n${warningMessages}`)
  }
}

/**
 * Check if live translation preview feature is enabled
 */
export function isLiveTranslationPreviewEnabled(): boolean {
  return process.env.TRANSLATION_LIVE_ASSIST_PREVIEW === 'true'
}

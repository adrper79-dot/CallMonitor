/**
 * Centralized Configuration Management
 * 
 * All environment variables are validated and accessed through this module.
 * Provides type-safe access to configuration with runtime validation.
 */

import { logger } from './logger'

interface Config {
  // Node environment
  nodeEnv: 'development' | 'production' | 'test'
  
  // Supabase
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  
  // SignalWire
  signalwire: {
    projectId: string
    token: string
    space: string
    number: string
  }
  
  // NextAuth
  nextAuth: {
    secret: string
    url: string
  }
  
  // Optional services
  assemblyAI?: {
    apiKey: string
  }
  
  elevenlabs?: {
    apiKey: string
  }
  
  resend?: {
    apiKey: string
  }
  
  // Feature flags
  features: {
    translationLiveAssistPreview: boolean
  }
}

function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    logger.error(`Missing required environment variable: ${key}`)
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getOptionalEnv(key: string): string | undefined {
  return process.env[key]
}

function validateConfig(): Config {
  // Validate required variables
  const config: Config = {
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
    
    supabase: {
      url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      anonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    },
    
    signalwire: {
      projectId: getRequiredEnv('SIGNALWIRE_PROJECT_ID'),
      token: getRequiredEnv('SIGNALWIRE_TOKEN') || getRequiredEnv('SIGNALWIRE_API_TOKEN'),
      space: getRequiredEnv('SIGNALWIRE_SPACE'),
      number: getRequiredEnv('SIGNALWIRE_NUMBER'),
    },
    
    nextAuth: {
      secret: getRequiredEnv('NEXTAUTH_SECRET'),
      url: getRequiredEnv('NEXTAUTH_URL'),
    },
    
    features: {
      translationLiveAssistPreview: getOptionalEnv('TRANSLATION_LIVE_ASSIST_PREVIEW') === 'true',
    },
  }
  
  // Add optional services
  const assemblyAIKey = getOptionalEnv('ASSEMBLYAI_API_KEY')
  if (assemblyAIKey) {
    config.assemblyAI = { apiKey: assemblyAIKey }
  }
  
  const elevenlabsKey = getOptionalEnv('ELEVENLABS_API_KEY')
  if (elevenlabsKey) {
    config.elevenlabs = { apiKey: elevenlabsKey }
  }
  
  const resendKey = getOptionalEnv('RESEND_API_KEY')
  if (resendKey) {
    config.resend = { apiKey: resendKey }
  }
  
  return config
}

// Validate and export configuration
let config: Config

try {
  config = validateConfig()
  logger.info('Configuration validated successfully')
} catch (error) {
  logger.error('Configuration validation failed', error)
  throw error
}

export { config }

// Helper functions for backward compatibility
export function getSupabaseUrl(): string {
  return config.supabase.url
}

export function getSupabaseAnonKey(): string {
  return config.supabase.anonKey
}

export function getSupabaseServiceKey(): string {
  return config.supabase.serviceRoleKey
}

export function getSignalWireConfig() {
  return config.signalwire
}

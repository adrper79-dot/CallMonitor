// cloudflare-env.d.ts - Type definitions for Cloudflare Workers environment
declare global {
  interface CloudflareEnv {
    // Database
    NEON_PG_CONN: string
    DATABASE_URL: string

    // Authentication
    NEXTAUTH_SECRET: string
    NEXTAUTH_URL: string
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string

    // AI Services
    OPENAI_API_KEY: string
    ASSEMBLYAI_API_KEY: string

    // Voice Services (SignalWire)
    SIGNALWIRE_PROJECT_ID: string
    SIGNALWIRE_TOKEN: string
    SIGNALWIRE_SPACE: string
    SIGNALWIRE_NUMBER?: string
    SIGNALWIRE_SIP_USERNAME?: string
    SIGNALWIRE_SIP_PASSWORD?: string
    SIGNALWIRE_SIP_DOMAIN?: string
    SIGNALWIRE_WEBSOCKET_URL?: string
    SIGNALWIRE_AI_AGENT_ID?: string

    // Alternative Voice Services
    TELNYX_API_KEY?: string

    // Email Services
    RESEND_API_KEY: string
    RESEND_FROM_EMAIL: string

    // Payment Processing
    STRIPE_SECRET_KEY: string
    STRIPE_WEBHOOK_SECRET: string
    STRIPE_PRICE_STARTER?: string
    STRIPE_PRICE_PRO?: string
    STRIPE_PRICE_ENTERPRISE?: string

    // Text-to-Speech
    ELEVENLABS_API_KEY?: string

    // CRM Integrations
    HUBSPOT_CLIENT_ID?: string
    HUBSPOT_CLIENT_SECRET?: string
    SALESFORCE_CLIENT_ID?: string
    SALESFORCE_CLIENT_SECRET?: string

    // Supabase (Legacy)
    NEXT_PUBLIC_SUPABASE_URL?: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
    SUPABASE_SERVICE_ROLE_KEY?: string

    // Security & Admin
    ADMIN_API_KEY?: string
    SERVICE_API_KEY?: string
    CRON_SECRET?: string

    // Monitoring
    SENTRY_DSN?: string

    // Feature Flags
    ENABLE_LIVE_TRANSLATION_PREVIEW?: string
    TRANSLATION_LIVE_ASSIST_PREVIEW?: string
    ASSEMBLYAI_SKIP_SIGNATURE_VALIDATION?: string
    SIGNALWIRE_SKIP_SIGNATURE_VALIDATION?: string

    // R2 Storage (S3-compatible API)
    R2_ENDPOINT?: string
    R2_ACCESS_KEY_ID?: string
    R2_SECRET_ACCESS_KEY?: string
    R2_BUCKET_NAME?: string
  }

  interface CloudflareBindings {
    // Cloudflare Worker Bindings
    KV: KVNamespace
    RECORDINGS_BUCKET: R2Bucket
    HYPERDRIVE: Hyperdrive
    
    // Environment variables (available as env in Workers)
    env: CloudflareEnv
  }

  // Make bindings available globally in Workers runtime
  const KV: KVNamespace | undefined
  const RECORDINGS_BUCKET: R2Bucket | undefined
  const HYPERDRIVE: Hyperdrive | undefined
  const env: CloudflareEnv | undefined
}

// Cloudflare-specific types
interface KVNamespace {
  get(key: string, options?: KVGetOptions): Promise<string | null>
  put(key: string, value: string, options?: KVPutOptions): Promise<void>
  delete(key: string): Promise<void>
  list(options?: KVListOptions): Promise<KVListResult>
}

interface KVGetOptions {
  type?: 'text' | 'json' | 'arrayBuffer' | 'stream'
  cacheTtl?: number
}

interface KVPutOptions {
  expirationTtl?: number
  expiration?: number
  metadata?: Record<string, string | number | boolean>
}

interface KVListOptions {
  limit?: number
  prefix?: string
  cursor?: string
}

interface KVListResult {
  keys: Array<{
    name: string
    expiration?: number
    metadata?: Record<string, string | number | boolean>
  }>
  list_complete: boolean
  cursor?: string
}

interface R2Bucket {
  get(key: string, options?: R2GetOptions): Promise<R2Object | null>
  put(key: string, value: ArrayBuffer | ReadableStream, options?: R2PutOptions): Promise<R2Object>
  delete(key: string): Promise<void>
  list(options?: R2ListOptions): Promise<R2Objects>
}

interface R2Object {
  key: string
  version: string
  size: number
  etag: string
  httpEtag: string
  uploaded: Date
  httpMetadata?: Record<string, string>
  customMetadata?: Record<string, string>
  body?: ReadableStream
}

interface R2GetOptions {
  onlyIf?: R2Conditional
  range?: R2Range
}

interface R2PutOptions {
  httpMetadata?: {
    contentType?: string
    contentDisposition?: string
    contentEncoding?: string
    contentLanguage?: string
    cacheControl?: string
    expires?: Date
  }
  customMetadata?: Record<string, string>
}

interface R2ListOptions {
  limit?: number
  prefix?: string
  cursor?: string
  delimiter?: string
  startAfter?: string
}

interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
  delimitedPrefixes?: string[]
}

interface R2Conditional {
  etagMatches?: string
  etagDoesNotMatch?: string
  uploadedBefore?: Date
  uploadedAfter?: Date
}

interface R2Range {
  offset?: number
  length?: number
  suffix?: number
}

interface Hyperdrive {
  connectionString: string
}

export {}

// Extend the global namespace for Node.js environments
declare global {
  namespace NodeJS {
    interface ProcessEnv extends CloudflareEnv {}
  }
}
// cloudflare-env.d.ts - Type definitions for Cloudflare Workers environment
declare global {
  interface CloudflareEnv {
    // Database
    NEON_PG_CONN: string
    DATABASE_URL: string

    // Authentication (Custom Workers Auth)
    AUTH_SECRET: string
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string

    // AI Services
    OPENAI_API_KEY: string
    ASSEMBLYAI_API_KEY: string

    // Voice Services (Telnyx)
    TELNYX_API_KEY: string
    TELNYX_PUBLIC_KEY?: string
    TELNYX_CONNECTION_ID?: string

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

    // Security & Admin
    ADMIN_API_KEY?: string
    SERVICE_API_KEY?: string
    CRON_SECRET?: string

    // App URLs
    NEXT_PUBLIC_API_URL?: string
    API_BASE_URL?: string

    // Feature Flags
    TRANSLATION_LIVE_ASSIST_PREVIEW?: string
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
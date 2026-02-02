/*
Server-side storage adapter.
- Uses Cloudflare R2 bindings in Workers environment
- Falls back to AWS S3 client for R2 in other environments
- Otherwise expects SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and delegates to Supabase Storage SDK.

Usage:
  import storage from 'lib/storage';
  await storage.upload(bucket, key, buffer, contentType);
  const url = await storage.getPublicUrl(bucket, key);
*/

import { Readable } from 'stream';
import { uploadToR2, downloadFromR2, createR2SignedUrl, isR2Enabled } from './storageAdapter';

// R2 Storage Service using Cloudflare bindings
class CloudflareR2Service {
  private bucket: any

  constructor() {
    // Access R2 bucket through Cloudflare binding
    this.bucket = (globalThis as any).RECORDINGS_BUCKET
  }

  isAvailable(): boolean {
    return !!this.bucket
  }

  async upload(key: string, data: ArrayBuffer | ReadableStream, contentType?: string): Promise<void> {
    if (!this.bucket) {
      throw new Error('R2 bucket binding RECORDINGS_BUCKET not found')
    }

    await this.bucket.put(key, data, {
      httpMetadata: {
        contentType: contentType || 'application/octet-stream'
      }
    })
  }

  async getPublicUrl(key: string): Promise<string> {
    // Generate URL through our API proxy since R2 doesn't support direct public URLs
    return `/api/recordings/${encodeURIComponent(key)}`
  }
}

const cloudflareR2 = new CloudflareR2Service()

// This project now uses Cloudflare R2 exclusively for server-side object storage.
// In Workers: uses R2 bindings
// Elsewhere: uses AWS S3 client to talk to Cloudflare R2
function ensureR2() {
  if (!cloudflareR2.isAvailable() && !isR2Enabled()) {
    throw new Error('R2 not configured: ensure RECORDINGS_BUCKET binding exists or set R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY')
  }
}

export async function upload(bucket: string, key: string, body: Buffer | string | Readable, contentType?: string) {
  // Try Cloudflare R2 binding first
  if (cloudflareR2.isAvailable()) {
    const data = body instanceof Buffer ? body : 
                 typeof body === 'string' ? new TextEncoder().encode(body) : 
                 body // Assume ReadableStream for other cases
    await cloudflareR2.upload(key, data, contentType)
    return
  }
  
  // Fall back to S3-compatible R2 API
  ensureR2()
  return uploadToR2(bucket, key, body, contentType)
}

export async function download(bucket: string, key: string) {
  // Try Cloudflare R2 binding first
  if (cloudflareR2.isAvailable()) {
    const object = await (globalThis as any).RECORDINGS_BUCKET.get(key)
    return object ? await object.arrayBuffer() : null
  }
  
  // Fall back to S3-compatible R2 API
  ensureR2()
  return downloadFromR2(bucket, key)
}

export async function getPublicUrl(bucket: string, key: string) {
  // Use Cloudflare R2 binding if available
  if (cloudflareR2.isAvailable()) {
    const url = await cloudflareR2.getPublicUrl(key)
    return { publicURL: url, publicUrl: url }
  }
  
  // Fall back to S3-compatible R2 API
  ensureR2()
  const endpoint = process.env.R2_ENDPOINT
  if (!endpoint) throw new Error('R2_ENDPOINT required to construct public URL')
  const url = `${endpoint.replace(/\/$/, '')}/${bucket}/${encodeURIComponent(key)}`
  return { publicURL: url, publicUrl: url }
}

export async function createSignedUrl(bucket: string, key: string, expiresInSeconds = 3600): Promise<any> {
  ensureR2();
  const url = await createR2SignedUrl(bucket, key, expiresInSeconds);
  // Return an object with `signedUrl` while keeping a flexible return type (any)
  // so existing callers that do `signed?.signedUrl || signed` compile cleanly.
  return { signedUrl: url };
}

export default { upload, download, getPublicUrl, createSignedUrl };
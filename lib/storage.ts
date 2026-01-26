/*
Server-side storage adapter.
- If R2 envs are present, uses AWS S3 client to talk to Cloudflare R2.
- Otherwise expects SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and delegates to Supabase Storage SDK.

Usage:
  import storage from 'lib/storage';
  await storage.upload(bucket, key, buffer, contentType);
  const url = await storage.getPublicUrl(bucket, key);
*/

import { Readable } from 'stream';
import { uploadToR2, downloadFromR2, createR2SignedUrl, isR2Enabled } from './storageAdapter';

// This project now uses Cloudflare R2 exclusively for server-side object storage.
// Ensure R2 envs are set: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
// If R2 is not configured, operations will throw a helpful error.

function ensureR2() {
  if (!isR2Enabled()) throw new Error('R2 client not configured: set R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY');
}

export async function upload(bucket: string, key: string, body: Buffer | string | Readable, contentType?: string) {
  ensureR2();
  return uploadToR2(bucket, key, body, contentType);
}

export async function download(bucket: string, key: string) {
  ensureR2();
  return downloadFromR2(bucket, key);
}

export async function getPublicUrl(bucket: string, key: string) {
  ensureR2();
  const endpoint = process.env.R2_ENDPOINT;
  if (!endpoint) throw new Error('R2_ENDPOINT required to construct public URL');
  const url = `${endpoint.replace(/\/$/, '')}/${bucket}/${encodeURIComponent(key)}`;
  // Return both keys for compatibility with existing callers (`publicURL` and `publicUrl`).
  return { publicURL: url, publicUrl: url };
}

export async function createSignedUrl(bucket: string, key: string, expiresInSeconds = 3600): Promise<any> {
  ensureR2();
  const url = await createR2SignedUrl(bucket, key, expiresInSeconds);
  // Return an object with `signedUrl` while keeping a flexible return type (any)
  // so existing callers that do `signed?.signedUrl || signed` compile cleanly.
  return { signedUrl: url };
}

export default { upload, download, getPublicUrl, createSignedUrl };
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand as AWSGetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

let s3Client: S3Client | null = null;
if (R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    endpoint: R2_ENDPOINT,
    region: process.env.R2_REGION || 'auto',
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
  });
}

export async function uploadToR2(bucket: string, key: string, body: Buffer | string | Readable, contentType?: string) {
  if (!s3Client) throw new Error('R2 client not configured; set R2_* envs');
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return s3Client.send(cmd);
}

export async function downloadFromR2(bucket: string, key: string) {
  if (!s3Client) throw new Error('R2 client not configured; set R2_* envs');
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await s3Client.send(cmd);
  // return a Buffer for convenience
  const stream = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function isR2Enabled() {
  return !!s3Client;
}

export async function createR2SignedUrl(bucket: string, key: string, expiresInSeconds = 3600) {
  if (!s3Client) throw new Error('R2 client not configured; set R2_* envs');
  const cmd = new AWSGetObjectCommand({ Bucket: bucket, Key: key });
  const url = await awsGetSignedUrl(s3Client, cmd, { expiresIn: expiresInSeconds });
  return url;
}

export default {
  uploadToR2,
  downloadFromR2,
  isR2Enabled,
};

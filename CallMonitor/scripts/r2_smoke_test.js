const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const stream = require('stream');
const { promisify } = require('util');

const bucket = process.env.R2_BUCKET_NAME;
const accessKey = process.env.R2_ACCESS_KEY_ID;
const secretKey = process.env.R2_SECRET_ACCESS_KEY;
const endpoint = process.env.R2_ENDPOINT; // e.g. https://<account>.r2.cloudflarestorage.com
const region = process.env.AWS_REGION || 'auto';

if (!bucket || !accessKey || !secretKey || !endpoint) {
  console.error('Missing one of R2_BUCKET_NAME / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT');
  process.exit(2);
}

const client = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  forcePathStyle: false,
});

const key = `r2_smoke_test_${Date.now()}.txt`;
const body = `r2 smoke test ${new Date().toISOString()}`;

async function run() {
  try {
    // upload
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));

    // download
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const pipeline = promisify(stream.pipeline);
    let downloaded = '';
    await pipeline(res.Body, new stream.Writable({
      write(chunk, _enc, cb) { downloaded += chunk.toString(); cb(); }
    }));

    const out = { success: true, bucket, key, uploadedBody: body, downloadedBody: downloaded };
    fs.mkdirSync('migrations', { recursive: true });
    fs.writeFileSync('migrations/r2_smoke_result.json', JSON.stringify(out, null, 2), 'utf8');
    console.log('R2 smoke test succeeded; wrote migrations/r2_smoke_result.json');
    process.exit(0);
  } catch (err) {
    const out = { success: false, error: (err && err.message) ? err.message : String(err) };
    fs.mkdirSync('migrations', { recursive: true });
    fs.writeFileSync('migrations/r2_smoke_result.json', JSON.stringify(out, null, 2), 'utf8');
    console.error('R2 smoke test failed; wrote migrations/r2_smoke_result.json');
    console.error(err);
    process.exit(1);
  }
}

run();

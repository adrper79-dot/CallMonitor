import fs from 'fs';

const token = process.env.CF_TOKEN;
const accountId = process.env.CF_ACCOUNT;

if (!token || !accountId) {
  console.error('Missing CF_TOKEN or CF_ACCOUNT environment variables.');
  process.exit(2);
}

const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`;

(async () => {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    fs.mkdirSync('migrations', { recursive: true });
    fs.writeFileSync('migrations/r2_buckets.json', JSON.stringify(json, null, 2), 'utf8');
    console.log('Wrote migrations/r2_buckets.json');
  } catch (err) {
    console.error('ERROR', err?.message || err);
    process.exit(1);
  }
})();

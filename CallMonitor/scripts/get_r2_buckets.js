import fs from 'fs';
const token = '_Hn99BPfiu3uz4eXcBwTHQEOBsPCBL5yHP76GSIv';
const accountId = 'a1c8a33cbe8a3c9e260480433a0dbb06';
const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`;

(async () => {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    fs.mkdirSync('migrations', { recursive: true });
    fs.writeFileSync('migrations/r2_buckets.json', JSON.stringify(json, null, 2), 'utf8');
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();

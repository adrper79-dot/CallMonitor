const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || (process.env.SUPABASE_PG_CONN && process.env.SUPABASE_PG_CONN.match(/@db\.([^.]+)\.supabase\.co/)? process.env.SUPABASE_PG_CONN.match(/@db\.([^.]+)\.supabase\.co/)[1] : null);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_BUCKET_API_KEY;
const OUT_DIR = path.join('migrations', 'supabase_storage_backup');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async ()=>{
  if (!PROJECT_REF) {
    fs.writeFileSync(path.join(OUT_DIR, 'error.txt'), 'Could not determine PROJECT_REF from SUPABASE_PG_CONN.\n');
    console.error('PROJECT_REF not found; set SUPABASE_PROJECT_REF or ensure SUPABASE_PG_CONN is set');
    process.exit(1);
  }
  const base = `https://${PROJECT_REF}.supabase.co/storage/v1`;
  if (!SERVICE_KEY) {
    fs.writeFileSync(path.join(OUT_DIR, 'missing_key.txt'), 'SUPABASE_SERVICE_ROLE_KEY not set; cannot access storage API.\n');
    console.log('Service key missing; wrote missing_key.txt');
    process.exit(0);
  }

  // list buckets
  try {
    const res = await fetch(`${base}/bucket`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (!res.ok) throw new Error(`List buckets failed: ${res.status}`);
    const buckets = await res.json();
    fs.writeFileSync(path.join(OUT_DIR, 'buckets.json'), JSON.stringify(buckets, null, 2));
    console.log('Wrote buckets.json');
    // For each bucket, list objects (non-recursive) and save metadata; DO NOT download large files automatically.
    for (const b of buckets) {
      try {
        const listRes = await fetch(`${base}/object/list/${encodeURIComponent(b.name)}`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 1000 }) });
        if (!listRes.ok) throw new Error(`list objects ${b.name} failed: ${listRes.status}`);
        const objects = await listRes.json();
        fs.writeFileSync(path.join(OUT_DIR, `${b.name.replace(/[^a-z0-9_-]/gi,'_')}_objects.json`), JSON.stringify(objects, null, 2));
        console.log('Wrote object list for', b.name);
      } catch (err) {
        fs.writeFileSync(path.join(OUT_DIR, `${b.name}_objects.error.txt`), err.message);
        console.error('Failed listing objects for', b.name, err.message);
      }
    }
  } catch (err) {
    fs.writeFileSync(path.join(OUT_DIR, 'buckets.error.txt'), err.message);
    console.error('Storage export failed:', err.message);
  }
})();

const { Pool } = require('pg');
const crypto = require('crypto');

const conn = process.env.NEON_PG_CONN;
if (!conn) {
  console.error('NEON_PG_CONN not set for supabase mock');
}
const pool = new Pool({ connectionString: conn });

async function execQuery(sql, params) {
  const start = Date.now();
  const mapped = (params || []).map(p => {
    if (Array.isArray(p)) return p.map(mapTestId);
    if (p && typeof p === 'object' && !Buffer.isBuffer(p)) return JSON.stringify(p);
    return mapTestId(p);
  });
  console.log('[supabase_pg_mock] execQuery START', { sql, params: mapped });
  try {
    const res = await pool.query(sql, mapped);
    console.log('[supabase_pg_mock] execQuery DONE', { sql, durationMs: Date.now() - start, rowCount: res && res.rowCount });
    return res;
  } catch (err) {
    console.error('[supabase_pg_mock] execQuery ERROR', { sql, durationMs: Date.now() - start, err: err && err.message });
    throw err;
  }
}

function normalizeSelect(cols) {
  if (!cols) return '*';
  return cols.split(',').map(s => s.trim()).join(', ');
}

// Deterministic mapping for test ids like 'test-uuid-...' -> valid UUID string
const _testIdMap = new Map();
function mapTestId(val) {
  if (typeof val !== 'string') return val;
  if (!val.startsWith('test-uuid-')) return val;
  if (_testIdMap.has(val)) return _testIdMap.get(val);
  const hash = crypto.createHash('sha1').update(val).digest('hex').slice(0, 32);
  const uuid = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
  _testIdMap.set(val, uuid);
  return uuid;
}

function findTestIdByUuid(u) {
  for (const [k, v] of _testIdMap.entries()) {
    if (v === u) return k;
  }
  return null;
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this._select = '*';
    this._where = [];
    this._limit = null;
    this._returning = null;
    this._updateObj = null;
  }
  select(cols) { this._select = normalizeSelect(cols); return this; }
  eq(col, val) { this._where.push({ type: 'eq', col, val }); return this; }
  gte(col, val) { this._where.push({ type: 'gte', col, val }); return this; }
  lte(col, val) { this._where.push({ type: 'lte', col, val }); return this; }
  in(col, vals) { this._where.push({ type: 'in', col, val: vals }); return this; }
  contains(col, arr) { this._where.push({ type: 'contains', col, val: arr }); return this; }
  or(str) { this._where.push({ type: 'or', str }); return this; }
  order(col, opts) { this._order = { col, opts }; return this; }
  maybeSingle() { this._limit = 2; return this._execMaybeSingle(); }
  single() { this._limit = 1; return this._execSingle(); }
  limit(n) { this._limit = n; return this; }
  async insert(obj) {
    if (Array.isArray(obj)) {
      const results = [];
      for (const row of obj) {
        const r = await this.insert(row);
        results.push(...(r.data || []));
      }
      return { data: results, error: null };
    }
    // If tests provide a sharedState mock, prefer that to allow tracking
    const state = (global && (global.__testSharedState)) ? global.__testSharedState : null;
    if (state && typeof state.mockInsert === 'function') {
      try {
        return await state.mockInsert(obj);
      } catch (e) {
        return { data: null, error: e };
      }
    }

    // Preserve original test-ids so we can map DB UUIDs back to test ids
    const originalIds = {};
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (typeof v === 'string' && v.startsWith('test-uuid-')) originalIds[k] = v;
    }

    // If id is present but not a valid UUID (many tests use 'test-uuid-...'),
    // translate it deterministically to a UUID for DB writes
    const dbObj = { ...obj };
    if (dbObj && dbObj.id && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(dbObj.id)) {
      dbObj.id = mapTestId(dbObj.id);
    }

    // Coerce common patterns: if a value for a foreign-key-like field is an object
    // with an `id` property, replace it with that id (mapped). Also convert Dates
    // to ISO strings so they aren't treated as jsonb accidentally.
    for (const k of Object.keys(dbObj)) {
      const v = dbObj[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && !Buffer.isBuffer(v)) {
        if (v.id && typeof v.id === 'string' && k.endsWith('_id')) {
          dbObj[k] = mapTestId(v.id);
        } else if (v instanceof Date) {
          dbObj[k] = v.toISOString();
        }
      }
    }

    const keys = Object.keys(dbObj);
    const vals = keys.map((k,i)=> (dbObj[k] !== null && typeof dbObj[k] === 'object' ? `$${i+1}::jsonb` : `$${i+1}`));
    const sql = `INSERT INTO public.${this.table}(${keys.join(',')}) VALUES(${vals.join(',')}) RETURNING *`;
    const params = keys.map(k => (dbObj[k] !== null && typeof dbObj[k] === 'object' ? JSON.stringify(dbObj[k]) : dbObj[k]));
    console.log('[supabase_pg_mock] INSERT SQL:', sql, 'PARAMS:', params);
    // Ensure referenced organization exists whenever an organization_id is supplied
    if (dbObj.organization_id) {
      try {
        await execQuery('INSERT INTO public.organizations(id, name) VALUES($1,$2) ON CONFLICT (id) DO NOTHING', [mapTestId(dbObj.organization_id), 'Test Org (auto-created by mock)']);
      } catch (e) {
        // ignore
      }
    }
    // Ensure referenced users exist for common user reference keys
    const userRefKeys = ['user_id', 'invited_by', 'created_by', 'produced_by_user_id', 'actor_user_id'];
    for (const k of Object.keys(dbObj)) {
      if (userRefKeys.includes(k) && dbObj[k]) {
        try {
          await execQuery('INSERT INTO public.users(id, name, email) VALUES($1,$2,$3) ON CONFLICT (id) DO NOTHING', [mapTestId(dbObj[k]), 'test-user', null]);
        } catch (e) {}
      }
    }
    // For users, prefer returning existing user by email to avoid duplicate-key errors
    if (this.table === 'users' && dbObj && dbObj.email) {
      try {
        const existing = await execQuery('SELECT * FROM public.users WHERE email=$1 LIMIT 1', [dbObj.email]);
        if (existing && existing.rowCount) {
          // Map DB uuids back to original test ids when applicable
          const rows = existing.rows.map(r => mapRowBackToTestIds(r, originalIds));
          return { data: rows, error: null };
        }
      } catch (e) {}
    }

    // Simple uniqueness emulation for external_entity_identifiers
    if (this.table === 'external_entity_identifiers' && dbObj && dbObj.identifier_normalized && dbObj.organization_id) {
      try {
        const exists = await execQuery('SELECT 1 FROM public.external_entity_identifiers WHERE organization_id=$1 AND identifier_normalized=$2 LIMIT 1', [mapTestId(dbObj.organization_id), dbObj.identifier_normalized]);
        if (exists && exists.rowCount && exists.rowCount > 0) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } };
        }
      } catch (e) {}
    }

    try {
      const res = await execQuery(sql, params);
      const rows = res.rows.map(r => mapRowBackToTestIds(r, originalIds));
      return { data: rows, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  }
  async upsert(obj) {
    if (Array.isArray(obj)) {
      const results = [];
      for (const row of obj) {
        const r = await this.upsert(row);
        results.push(...(r.data || []));
      }
      return { data: results, error: null };
    }
    // If tests provide a sharedState mock, prefer that to allow tracking
    const state = (global && (global.__testSharedState)) ? global.__testSharedState : null;
    if (state && typeof state.mockInsert === 'function') {
      try {
        return await state.mockInsert(obj);
      } catch (e) {
        return { data: null, error: e };
      }
    }

    const originalIds = {};
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (typeof v === 'string' && v.startsWith('test-uuid-')) originalIds[k] = v;
    }

    // If id is present but not a valid UUID, map it deterministically for DB write
    const dbObj = { ...obj };
    if (dbObj && dbObj.id && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(dbObj.id)) {
      dbObj.id = mapTestId(dbObj.id);
    }

    // Prefer using native INSERT ... ON CONFLICT DO UPDATE to emulate Supabase upsert
    const keys = Object.keys(dbObj);
    const vals = keys.map((k,i)=> (dbObj[k] !== null && typeof dbObj[k] === 'object' ? `$${i+1}::jsonb` : `$${i+1}`));
    const params = keys.map(k => (dbObj[k] !== null && typeof dbObj[k] === 'object' ? JSON.stringify(dbObj[k]) : dbObj[k]));

    // Choose a conflict target if available (id, email, slug)
    let conflict = null;
    if (dbObj.id) conflict = 'id';
    else if (dbObj.email) conflict = 'email';
    else if (dbObj.slug) conflict = 'slug';

    if (conflict) {
      const setCols = keys.filter(k=>k!==conflict && k!=='id').map(k=>`${k}=EXCLUDED.${k}`).join(', ');
      const sql = `INSERT INTO public.${this.table}(${keys.join(',')}) VALUES(${vals.join(',')}) ON CONFLICT (${conflict}) DO UPDATE SET ${setCols} RETURNING *`;
      try {
        // Ensure referenced organization exists for FK-heavy upserts
        if ((this.table === 'search_documents' || this.table === 'search_events' || this.table === 'org_members' || this.table === 'tool_team_members') && dbObj.organization_id) {
          try { await execQuery('INSERT INTO public.organizations(id, name) VALUES($1,$2) ON CONFLICT (id) DO NOTHING', [mapTestId(dbObj.organization_id), 'Test Org (auto-created by mock)']); } catch(e) {}
        }
        // Ensure referenced users exist for FK-heavy upserts
        if ((this.table === 'org_members' || this.table === 'tool_team_members' || this.table === 'recordings' || this.table === 'audit_logs') && dbObj.user_id) {
          try { await execQuery('INSERT INTO public.users(id, name, email) VALUES($1,$2,$3) ON CONFLICT (id) DO NOTHING', [mapTestId(dbObj.user_id), 'test-user', null]); } catch(e) {}
        }
        if ((this.table === 'tool_team_members' || this.table === 'recordings' || this.table === 'audit_logs') && dbObj.invited_by) {
          try { await execQuery('INSERT INTO public.users(id, name, email) VALUES($1,$2,$3) ON CONFLICT (id) DO NOTHING', [mapTestId(dbObj.invited_by), 'test-user', null]); } catch(e) {}
        }
        console.log('[supabase_pg_mock] UPSERT SQL:', sql, 'PARAMS:', params);
        const res = await execQuery(sql, params);
        const rows = res.rows.map(r => mapRowBackToTestIds(r, originalIds));
        return { data: rows, error: null };
      } catch (e) {
        // If insert failed due to a different unique constraint (e.g., slug/email),
        // attempt to resolve by using that conflict target instead.
        if (e && e.code === '23505') {
          if (dbObj.slug && conflict !== 'slug') {
            const setCols2 = keys.filter(k=>k!=='slug' && k!=='id').map(k=>`${k}=EXCLUDED.${k}`).join(', ');
            const sql2 = `INSERT INTO public.${this.table}(${keys.join(',')}) VALUES(${vals.join(',')}) ON CONFLICT (slug) DO UPDATE SET ${setCols2} RETURNING *`;
            const res2 = await execQuery(sql2, params);
            const rows2 = res2.rows.map(r => mapRowBackToTestIds(r, originalIds));
            return { data: rows2, error: null };
          }
          if (dbObj.email && conflict !== 'email') {
            const setCols3 = keys.filter(k=>k!=='email' && k!=='id').map(k=>`${k}=EXCLUDED.${k}`).join(', ');
            const sql3 = `INSERT INTO public.${this.table}(${keys.join(',')}) VALUES(${vals.join(',')}) ON CONFLICT (email) DO UPDATE SET ${setCols3} RETURNING *`;
            const res3 = await execQuery(sql3, params);
            const rows3 = res3.rows.map(r => mapRowBackToTestIds(r, originalIds));
            return { data: rows3, error: null };
          }
        }
        throw e;
      }
    }

    return this.insert(dbObj);
  }
  update(obj) {
    // Make update chainable like Supabase client: collect update object and execute when awaited
    this._updateObj = obj;
    return this;
  }
  async _doUpdate() {
    if (!this._where.length) throw new Error('update without where not supported');
    const where = [];
    const params = [];
    this._where.forEach((w,idx)=>{
      if (w.type==='eq') { params.push(mapTestId(w.val)); where.push(`${w.col}=$${params.length}`); }
      if (w.type==='contains') { params.push(JSON.stringify(w.val)); where.push(`${w.col} @> $${params.length}::jsonb`); }
      if (w.type==='in') { const placeholders = w.val.map((_,i)=>`$${params.length + i + 1}`); params.push(...w.val.map(mapTestId)); where.push(`${w.col} IN (${placeholders.join(',')})`); }
      if (w.type==='gte') { params.push(mapTestId(w.val)); where.push(`${w.col} >= $${params.length}`); }
      if (w.type==='lte') { params.push(mapTestId(w.val)); where.push(`${w.col} <= $${params.length}`); }
    });
    const keys = Object.keys(this._updateObj || {});
    const set = keys.map((k,i)=>`${k}=$${params.length + i + 1}`).join(',');
    const vals = keys.map(k=>this._updateObj[k]);
    const sql = `UPDATE public.${this.table} SET ${set} WHERE ${where.join(' AND ')} RETURNING *`;
    try {
      const res = await execQuery(sql, [...params, ...vals]);
      const rows = res.rows.map(r => mapRowBackGeneric(r));
      return { data: rows, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  }

  delete() {
    this._deleteFlag = true;
    return this;
  }
  async _doDelete() {
    if (!this._where.length) throw new Error('delete without where not supported');
    const where = [];
    const params = [];
    this._where.forEach((w,idx)=>{
      if (w.type==='eq') { params.push(mapTestId(w.val)); where.push(`${w.col}=$${params.length}`); }
      if (w.type==='in') { const placeholders = w.val.map((_,i)=>`$${params.length + i + 1}`); params.push(...w.val.map(mapTestId)); where.push(`${w.col} IN (${placeholders.join(',')})`); }
      if (w.type==='contains') { params.push(JSON.stringify(w.val)); where.push(`${w.col} @> $${params.length}::jsonb`); }
      if (w.type==='gte') { params.push(mapTestId(w.val)); where.push(`${w.col} >= $${params.length}`); }
      if (w.type==='lte') { params.push(mapTestId(w.val)); where.push(`${w.col} <= $${params.length}`); }
    });
    const sql = `DELETE FROM public.${this.table} WHERE ${where.join(' AND ')} RETURNING *`;
    try {
        const res = await execQuery(sql, params);
        const rows = res.rows.map(r => mapRowBackGeneric(r));
        return { data: rows, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  }
  async _execMaybeSingle() {
    const state = (global && (global.__testSharedState)) ? global.__testSharedState : null;
    if (state && typeof state.mockSelect === 'function') {
      try {
        return await state.mockSelect(this._select, this.table);
      } catch (e) {
        return { data: null, error: e };
      }
    }

    const { sql, params } = this._buildSelect();
    const res = await execQuery(sql, params);
    if (res.rowCount === 0) return { data: null, error: null };
    if (res.rowCount > 1) return { data: res.rows.map(r => mapRowBackGeneric(r)), error: null };
    return { data: mapRowBackGeneric(res.rows[0]), error: null };
  }
  async _execSingle() {
    const state = (global && (global.__testSharedState)) ? global.__testSharedState : null;
    if (state && typeof state.mockSelect === 'function') {
      try {
        return await state.mockSelect(this._select, this.table);
      } catch (e) {
        return { data: null, error: e };
      }
    }

    const { sql, params } = this._buildSelect();
    const res = await execQuery(sql, params);
    if (res.rowCount === 0) return { data: null, error: new Error('No rows') };
    return { data: mapRowBackGeneric(res.rows[0]), error: null };
  }
  _buildSelect() {
    let sql = `SELECT ${this._select} FROM public.${this.table}`;
    const params = [];
    if (this._where.length) {
      const where = this._where.map(w=>{
        if (w.type==='eq') { params.push(mapTestId(w.val)); return `${w.col} = $${params.length}` }
        if (w.type==='gte') { params.push(mapTestId(w.val)); return `${w.col} >= $${params.length}` }
        if (w.type==='lte') { params.push(mapTestId(w.val)); return `${w.col} <= $${params.length}` }
        if (w.type==='contains') { params.push(JSON.stringify(w.val)); return `${w.col} @> $${params.length}::jsonb` }
        if (w.type==='in') { const placeholders = w.val.map((_,i)=>`$${params.length + i + 1}`); params.push(...w.val.map(mapTestId)); return `${w.col} IN (${placeholders.join(',')})` }
        if (w.type==='or') {
          // Supabase-style or string like: "user_id.eq.<id>,user_id.is.null"
          const parts = w.str.split(',').map(s=>s.trim()).map(p=>{
            const [lhs, op, rhs] = p.split(/\.(?=(?:eq|is)\.)/); // split at .eq. or .is.
            if (!lhs) return 'true';
            if (p.includes('.is.null')) return `${lhs} IS NULL`;
            if (p.includes('.eq.')) {
              const val = p.split('.eq.')[1];
              // if value looks like test-uuid preserve mapping via params
              params.push(mapTestId(val));
              return `${lhs} = $${params.length}`;
            }
            return 'true';
          });
          return `(${parts.join(' OR ')})`;
        }
        return 'true'
      });
      sql += ` WHERE ${where.join(' AND ')}`;
    }
    if (this._order) {
      const dir = this._order.opts && this._order.opts.ascending === false ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${this._order.col} ${dir}`;
    }
    if (this._limit) sql += ` LIMIT ${this._limit}`;
    return { sql, params };
  }

  // Default executor so `await supabase.from('tbl').select(...).eq(...)` works
  async _execDefault() {
    // If this builder represents an update or delete, execute those first
    if (this._updateObj) return await this._doUpdate();
    if (this._deleteFlag) return await this._doDelete();

    const { sql, params } = this._buildSelect();
    try {
      const res = await execQuery(sql, params);
      return { data: res.rows, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  }

  // Support awaiting the QueryBuilder directly (Supabase-like behavior)
  then(onFulfilled, onRejected) {
    return this._execDefault().then(onFulfilled, onRejected);
  }
}

function mapRowBackToTestIds(row, originalIds) {
  const out = { ...row };
  // If tests provided an original test-id for a column, restore it
  for (const k of Object.keys(originalIds || {})) {
    if (out[k] && typeof out[k] === 'string') {
      out[k] = originalIds[k];
    }
  }
  // Also reverse-map any uuids created from test-ids
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)) {
      const testKey = findTestIdByUuid(v);
      if (testKey) out[k] = testKey;
    }
  }
  return out;
}

function mapRowBackGeneric(row) {
  const out = { ...row };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)) {
      const testKey = findTestIdByUuid(v);
      if (testKey) out[k] = testKey;
    }
  }
  return out;
}

function createClient() {
  return {
    from: (table) => new QueryBuilder(table),
    auth: {
      // minimal auth stub
      signInWithPassword: async ({ email, password }) => {
        // Attempt to find user
        const res = await execQuery('SELECT * FROM public.users WHERE email=$1 LIMIT 1', [email]);
        if (res.rowCount === 0) return { data: null, error: { message: 'Invalid credentials' } };
        return { data: { user: res.rows[0] }, error: null };
      }
    }
  }
}

module.exports = { createClient };

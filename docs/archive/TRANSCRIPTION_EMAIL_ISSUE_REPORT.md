# Transcription + Email Diagnostic Report

**Date:** 2026-01-16  
**Scope:** Live testing + Vercel logs + Supabase CLI (no code changes)  
**Target:** Transcription and artifact email delivery failures  
**Test User:** stepdadstrong@gmail.com  
**Agent Number:** +17062677235  
**Customer Number:** +12392027345  
**Artifact Email Target:** adrper79@gmail.com  

---

## 1) Live Testing Results

### Authentication Attempt (Credentials Provider)
- **Result:** FAILED
- **Observed response:** `/api/auth/callback/credentials` returned a redirect to `/api/auth/signin?csrf=true`.
- **Interpretation:** Credentials provider rejected login (either invalid credentials or auth service config failure).

### Auth Status Check
- **Endpoint:** `GET /api/health/user?email=stepdadstrong@gmail.com`
- **Result:** FAILED
- **Observed response:**  
  `{"ok":false,"error":"SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set"}`
- **Interpretation:** Server runtime is missing required Supabase env vars, blocking auth and downstream APIs.

### Health Check
- **Endpoint:** `GET /api/health`
- **Result:** PASSED
- **Observed response:** All dependencies reported healthy (database, SignalWire, AssemblyAI, storage).

### Call + Transcription + Email Pipeline
Blocked by authentication failure (cannot place call or trigger emails via API).

---

## 2) Vercel Logs

- **Command:** `vercel logs voxsouth.online --json`
- **Result:** Logs stream opened but **no runtime logs captured** from recent auth attempts.
- **Interpretation:** Either logs are suppressed or requests did not emit logs at runtime.
  - Note: log stream pointed to deployment `callmonitor-ldu1trs8p...` when tests ran.

---

## 3) Supabase CLI

- **CLI Version:** 2.67.1
- **Attempted:** Direct SQL query via CLI
- **Result:** Not supported in this CLI version (`supabase db query` not available).
- **Attempted:** `supabase status`
- **Result:** Failed because local Docker engine not running (expected on this machine).
- **Attempted:** `supabase projects list`
- **Result:** Success; project ref `fiijrhpjpebevfavzlhu` is linked.
- **Impact:** Unable to validate user record or ai_runs directly from CLI without DB URL or Studio.

---

## 4) Root Cause Assessment (Most Likely)

### Primary blocker (High confidence)
**Missing Supabase service-role env vars in Vercel runtime**
- Evidence: `/api/health/user` returns explicit error.
- Effect: Credentials login fails, org lookup fails, all authenticated APIs fail.
- Impact: Calls cannot be created, recordings can’t be linked to transcripts, email triggers fail.

### Likely contributing factor
**`SUPABASE_URL` specifically is required for `/api/health/user`**
- That endpoint checks `process.env.SUPABASE_URL` only (not `NEXT_PUBLIC_SUPABASE_URL`).
- Even if public URL is set, this endpoint still fails if `SUPABASE_URL` is missing.

### Deployment mismatch possibility
- Domain may be pointing to a deployment/environment where the env vars are not present.
- Even if env vars exist in Vercel, a redeploy is required for them to take effect.

### Secondary possible blockers (to verify after auth works)
- `ASSEMBLYAI_API_KEY` missing or webhook misconfigured.
- `RESEND_API_KEY` missing or `EMAIL_FROM` not set.
- AssemblyAI webhook not reaching `/api/webhooks/assemblyai`.

---

## 5) Required Fixes (in order)

1) **Vercel Environment Variables**
   - Confirm **all** of these are set in Vercel:
     - `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXTAUTH_SECRET`
     - `NEXTAUTH_URL`

2) **Verify AssemblyAI**
   - Ensure `ASSEMBLYAI_API_KEY` exists in Vercel.
   - Confirm webhook URL: `/api/webhooks/assemblyai`.

3) **Verify Email**
   - Ensure `RESEND_API_KEY` exists.
   - Ensure `EMAIL_FROM` is set (or default sender is allowed).

---

## 6) Next Live-Test Steps (once env is fixed)

1) Authenticate via `/admin/auth` (Credentials provider).
2) Place a call (record + transcribe enabled).
3) Confirm `ai_runs` transitions to `completed`.
4) Trigger `/api/calls/[id]/email` to `adrper79@gmail.com`.
5) Confirm email delivery.

---

## 7) Status

**Not resolved** — blocked by missing Supabase runtime configuration.


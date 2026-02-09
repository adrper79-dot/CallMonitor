# URGENT: Telnyx Webhook Ed25519 Public Key Setup

**Issue:** Webhooks are failing with `"Webhook processing failed"` because the signature verification was using HMAC instead of Ed25519.

**Status:** ✅ **SECRET SET** — `TELNYX_PUBLIC_KEY` configured with `n054wODrZz4nAuXQvQ9eMrEUf8sJoprK8Hff/Wwl2Jw=`

---

## Steps to Fix

### 1. Get Your Ed25519 Public Key from Telnyx

**Option A: Telnyx Portal (Recommended)**

1. Log into https://portal.telnyx.com
2. Navigate to **Messaging** → **Webhooks** (or **Voice** → **Webhooks**)
3. Find your webhook endpoint: `https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx`
4. Click to view webhook details
5. Look for **"Public Key"** or **"Signing Key"**
6. Copy the base64-encoded public key (looks like: `Cva8MRR5IbU3hb3dRRiIf/tZYKmJvDhPPCiF1BlWUwk=`)

**Option B: From Webhook Request Headers (Current)**

The public key can be derived from your webhook signature if you have access to a known-good signed message. However, **Option A is much easier**.

**Option C: Telnyx API**

```bash
curl -s -H "Authorization: Bearer $TELNYX_API_KEY" \
  "https://api.telnyx.com/v2/webhook_deliveries?filter[status]=completed&page[size]=1" \
  | jq -r '.data[0].public_key'
```

### 2. Set the Secret in Cloudflare Workers

Once you have the public key (base64-encoded string):

```bash
cd workers
npx wrangler secret put TELNYX_PUBLIC_KEY
# Paste your public key when prompted, e.g.:
# Cva8MRR5IbU3hb3dRRiIf/tZYKmJvDhPPCiF1BlWUwk=
```

### 3. Verify It Works

After setting the secret, Telnyx will retry failed webhook deliveries automatically. Or you can trigger a test call:

```bash
# Make a test call
curl -s -X POST "https://wordisbond-api.adrper79.workers.dev/api/voice/call" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ba6be0a2-b5e8-40ee-9d1a-72541f85bcd8" \
  -d '{
    "to_number": "+17062677235",
    "from_number": "+13048534096",
    "flow_type": "webrtc"
  }'
```

Then check the webhook endpoint logs:

```bash
cd c:\Users\Ultimate Warrior\My project\gemini-project
npx wrangler tail --env production
```

You should see: `Telnyx webhook signature verified successfully`

---

## What Was Fixed

### Before (Broken)

```typescript
// Using HMAC-SHA256 (WRONG for Telnyx V2)
async function verifyTelnyxSignature(
  payload: string,
  timestamp: string,
  signature: string,
  secret: string // HMAC secret
): Promise<boolean> {
  // ... HMAC verification logic
}
```

### After (Fixed)

```typescript
// Using Ed25519 (CORRECT for Telnyx V2)
async function verifyTelnyxSignature(
  payload: string,
  timestamp: string,
  signature: string,
  publicKey: string // Base64-encoded Ed25519 public key
): Promise<boolean> {
  const signatureBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))
  const publicKeyBytes = Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0))
  const message = encoder.encode(`${timestamp}.${payload}`)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes,
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    false,
    ['verify']
  )

  return await crypto.subtle.verify('Ed25519', cryptoKey, signatureBytes, message)
}
```

---

## Why This Happened

1. **Telnyx changed signature method** from HMAC to Ed25519 in V2 API
2. **Our code had a TODO** comment saying Ed25519 wasn't implemented yet
3. **Fallback logic** was skipping verification when `TELNYX_WEBHOOK_SECRET` wasn't set
4. **On paid plan**, you probably have webhook signature verification enabled, so it was failing

---

## Current Status

- ✅ **Code deployed** with Ed25519 verification
- ❌ **Public key not set** — webhooks will fail until you set `TELNYX_PUBLIC_KEY` secret
- ⚠️ **Temporary workaround**: If you need webhooks to work IMMEDIATELY while you find the public key, you can disable verification by NOT setting `TELNYX_PUBLIC_KEY` (the code will fall back to accepting unverified webhooks with a warning)

---

## Related

- **Backlog Item:** BL-076 (Telnyx Ed25519 vs HMAC signature mismatch)
- **Lesson Learned:** [LESSONS_LEARNED_2026-02-09_TELNYX_RATE_LIMITS.md](LESSONS_LEARNED_2026-02-09_TELNYX_RATE_LIMITS.md)
- **Telnyx Docs:** https://developers.telnyx.com/docs/v2/development/webhook-signing-and-validation

---

**Next Step:** Get your public key from Telnyx Portal and run `npx wrangler secret put TELNYX_PUBLIC_KEY`

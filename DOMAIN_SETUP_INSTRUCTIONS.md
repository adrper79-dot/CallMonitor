# Custom Domain Setup Instructions - wordis-bond.com

**Status**: 🚨 **URGENT FIX REQUIRED** | Workers Routes Need Correction

---

## 🚨 CRITICAL: Fix Worker Routes FIRST

**Your Dashboard has incorrect routes that are breaking the site!**

### The Problem
Dashboard shows these routes (WRONG):
```
❌ wordis-bond.com/*         → Sends ALL traffic to Worker
❌ www.wordis-bond.com/*     → Sends ALL traffic to Worker  
❌ voxsouth.online/*         → Sends ALL traffic to Worker
❌ www.voxsouth.online/*     → Sends ALL traffic to Worker
```

The `/*` pattern intercepts **ALL requests** (including your static pages), preventing Cloudflare Pages from serving your UI.

### The Correct Configuration
Your `workers/wrangler.toml` has the **correct** patterns:
```
✅ wordis-bond.com/api/*     → Only API traffic to Worker
✅ www.wordis-bond.com/api/* → Only API traffic to Worker
```

### How to Fix (Do This Now)

1. **Go to Dashboard**: Workers & Pages → **wordisbond-production** → **Domains & Routes**

2. **Delete ALL four `/*` routes** (click the X next to each):
   - `wordis-bond.com/*`
   - `www.wordis-bond.com/*`
   - `voxsouth.online/*`
   - `www.voxsouth.online/*`

3. **Redeploy Worker** to apply correct routes:
   ```bash
   cd workers
   wrangler deploy
   ```

4. **Verify** Dashboard now shows:
   ```
   ✅ wordis-bond.com/api/*
   ✅ www.wordis-bond.com/api/*
   ```

See [ROUTES_FIX.md](ROUTES_FIX.md) for detailed explanation.

---

## ✅ What's Already Done

Workers API is configured correctly in code:
- `wordis-bond.com/api/*` → wordisbond-api Worker
- `www.wordis-bond.com/api/*` → wordisbond-api Worker
- CORS configured for `https://wordis-bond.com`

---

## 🎯 Next Steps (Cloudflare Dashboard)

### Step 1: Add Custom Domain to Pages

1. **Open Cloudflare Dashboard:**
   - Go to: https://dash.cloudflare.com/
   - Navigate to: **Workers & Pages**

2. **Select Your Pages Project:**
   - Click on: **wordisbond**

3. **Add Custom Domain:**
   - Click the **Custom domains** tab
   - Click **Set up a custom domain** button
   - Enter: `wordis-bond.com`
   - Click **Continue**
   - Cloudflare will verify domain ownership (should be instant since it's your domain)
   - Click **Activate domain**

4. **Add www Subdomain (Optional):**
   - Click **Set up a custom domain** again
   - Enter: `www.wordis-bond.com`
   - Click **Continue** and **Activate**

**Expected Result:**
- `wordis-bond.com` shows as "Active" in Custom domains list
- DNS records automatically created (CNAME → wordisbond.pages.dev)

---

### Step 2: Verify DNS Records

1. **Check DNS Tab:**
   - In Cloudflare Dashboard, select **wordis-bond.com** domain
   - Go to **DNS** tab
   - Verify these records exist:

```
Type   Name   Target                    Proxy Status  TTL
CNAME  @      wordisbond.pages.dev      Proxied       Auto
CNAME  www    wordisbond.pages.dev      Proxied       Auto
```

**Important:** Proxy Status MUST be **Proxied** (Orange Cloud ☁️) for Workers Routes to work!

2. **If DNS records are missing:**
   - Click **+ Add record**
   - Type: `CNAME`
   - Name: `@` (for root) or `www` (for subdomain)
   - Target: `wordisbond.pages.dev`
   - Proxy status: **Proxied** (toggle orange cloud ON)
   - TTL: Auto
   - Click **Save**

---

### Step 3: Verify SSL Certificate

1. **Check SSL Status:**
   - Go to **SSL/TLS** tab
   - Go to **Edge Certificates** section
   - Verify certificate status is **Active**

2. **If certificate is pending:**
   - Wait 10-15 minutes for automatic provisioning
   - Cloudflare automatically issues Universal SSL certificates
   - No action needed on your part

**Expected:**
- Certificate Type: Universal
- Status: Active
- Hosts: wordis-bond.com, *.wordis-bond.com

---

## 🧪 Testing

### Test 1: UI Loads from Custom Domain

```bash
curl -I https://wordis-bond.com
```

**Expected:**
- Status: `200 OK`
- Content-Type: `text/html`
- Server: `cloudflare`

### Test 2: API Routes Work

```bash
curl https://wordis-bond.com/api/health
```

**Expected:**
```json
{
  "status": "healthy",
  "service": "wordisbond-api",
  "version": "1.0.0",
  "timestamp": "2026-02-02T..."
}
```

### Test 3: CORS Headers Present

```bash
curl -I -H "Origin: https://wordis-bond.com" https://wordis-bond.com/api/health
```

**Expected Headers:**
```
access-control-allow-origin: https://wordis-bond.com
access-control-allow-credentials: true
```

### Test 4: Authentication Endpoints (after Pages domain is active)

Open browser:
1. Go to: `https://wordis-bond.com/signup`
2. Open DevTools → Network tab
3. Try to sign up
4. Check: `/api/auth/*` requests should be 200 or 401 (NOT 404)

---

## ⚠️ Troubleshooting

### Issue: "This site can't be reached"

**Cause:** DNS not propagated yet  
**Fix:** Wait 5-10 minutes, then try again  
**Check DNS:**
```bash
nslookup wordis-bond.com
```

### Issue: Pages shows "Not Found"

**Cause:** Custom domain not added to Pages project  
**Fix:** Complete Step 1 above in Dashboard

### Issue: API returns 404

**Cause:** Workers Routes not applied yet  
**Fix:** 
- Verify routes exist in Workers deployment (they do ✅)
- Wait 1-2 minutes for route propagation
- Clear browser cache

### Issue: SSL Certificate Error

**Cause:** Certificate still provisioning  
**Fix:** Wait 10-15 minutes  
**Force HTTPS:** Dashboard → SSL/TLS → Overview → Set to "Full"

### Issue: Redirect loop

**Cause:** SSL mode misconfigured  
**Fix:** Set SSL/TLS mode to **Full** (not Flexible, not Strict)

---

## 📋 Completion Checklist

- [ ] Custom domain `wordis-bond.com` added to Pages project
- [ ] Custom domain `www.wordis-bond.com` added (optional)
- [ ] DNS CNAME records exist and are **Proxied**
- [ ] SSL certificate shows **Active**
- [ ] `https://wordis-bond.com` loads homepage (Pages)
- [ ] `https://wordis-bond.com/api/health` returns JSON (Workers)
- [ ] No CORS errors in browser console
- [ ] Sign up/Sign in attempts hit API (check Network tab)

---

## 🎉 Success Criteria

When setup is complete:

✅ **Homepage loads:** `https://wordis-bond.com`  
✅ **API works:** `https://wordis-bond.com/api/health`  
✅ **Same origin:** No CORS issues  
✅ **SSL active:** HTTPS with valid certificate  
✅ **Auth functional:** `/api/auth/*` endpoints respond (not 404)

---

## What Happens Next

Once the custom domain is active:

1. **Test authentication** - Try signing up/in
2. **If auth still fails** - We need to implement one of:
   - Migrate NextAuth endpoints to Workers
   - Switch to Clerk/Auth0
   - Build custom JWT auth

The good news: **API routing will be fixed!** Auth is a separate issue.

---

## Need Help?

If you encounter issues:
1. Check Cloudflare Dashboard → Analytics → Check traffic
2. Check Cloudflare Dashboard → Workers & Pages → wordisbond → Logs
3. Share error messages from browser console
4. Run: `curl -v https://wordis-bond.com/api/health` and share output

---

**Last Updated:** Feb 2, 2026  
**Workers Deployment:** ✅ Complete (Version ID: 629f1afa-6e41-4c81-b0d9-98653664d746)  
**Pages Custom Domain:** ⏳ Awaiting Dashboard setup

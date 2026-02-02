# Custom Domain Setup Guide: wordis-bond.com

**Date**: Feb 2, 2026  
**Domain**: wordis-bond.com  
**Goal**: Single domain for UI (Pages) + API (Workers)

---

## Setup Steps

### 1. Add Custom Domain to Pages Project

**Via Cloudflare Dashboard:**

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Select your **wordisbond** Pages project
3. Go to **Custom domains** tab
4. Click **Set up a custom domain**
5. Enter: `wordis-bond.com`
6. Click **Continue**
7. Cloudflare will automatically create DNS records

**Expected DNS Records (auto-created):**
```
wordis-bond.com        CNAME  wordisbond.pages.dev
www.wordis-bond.com    CNAME  wordisbond.pages.dev
```

**Via Wrangler CLI:**
```bash
wrangler pages domain add wordis-bond.com --project-name=wordisbond
```

---

### 2. Add Workers Route for API

**Via Cloudflare Dashboard:**

1. Go to **Cloudflare Dashboard** → **Websites**
2. Select **wordis-bond.com** domain
3. Go to **Workers Routes** section
4. Click **Add route**
5. Configure:
   - **Route**: `wordis-bond.com/api/*`
   - **Worker**: `wordisbond-api` (your Workers API)
   - **Zone**: wordis-bond.com
6. Click **Save**

**Via Wrangler (Alternative):**

Add to `workers/wrangler.toml`:
```toml
[[routes]]
pattern = "wordis-bond.com/api/*"
zone_name = "wordis-bond.com"
```

Then deploy:
```bash
cd workers
wrangler deploy
```

---

### 3. Update Environment Variables (Optional)

If you have `NEXT_PUBLIC_API_URL` in your `.env.local`, you can remove it or set it to empty:

```bash
# .env.local
# NEXT_PUBLIC_API_URL=  # Not needed anymore - same domain
```

The API will be accessible at the same origin: `/api/*`

---

### 4. Update Next.js Config (If needed)

If you have any hardcoded API URLs, update them. But since we're using relative paths (`/api/*`), no changes should be needed.

---

### 5. Redeploy (If needed)

If you made any code changes:

```bash
# Rebuild UI
npm run build

# Redeploy Pages
wrangler pages deploy out --project-name=wordisbond
```

No Workers redeploy needed unless you changed `wrangler.toml`.

---

## How It Works

**Routing Logic:**

```
Request to wordis-bond.com/api/auth/session
  ↓
Cloudflare checks Workers Routes
  ↓
Matches pattern: wordis-bond.com/api/*
  ↓
Routes to Worker: wordisbond-api
  ↓
Workers API handles request and returns JSON
```

```
Request to wordis-bond.com/dashboard
  ↓
Cloudflare checks Workers Routes
  ↓
No match for /dashboard
  ↓
Routes to Pages (default)
  ↓
Serves static HTML from Pages
```

**Result:**
- `wordis-bond.com/` → Pages (Static UI)
- `wordis-bond.com/api/*` → Workers (API)
- **Same origin** → No CORS issues
- **Fast** → Edge routing, no proxy

---

## Verification

After setup, test these URLs:

### UI (Pages)
```bash
curl -I https://wordis-bond.com
# Expected: 200 OK, HTML content

curl -I https://wordis-bond.com/dashboard
# Expected: 200 OK, HTML content
```

### API (Workers)
```bash
curl https://wordis-bond.com/api/health
# Expected: 200 OK, JSON response

curl https://wordis-bond.com/api/auth/session
# Expected: 200 OK, JSON with session info (or null)
```

### Browser Test
1. Open: https://wordis-bond.com
2. Open DevTools → Network tab
3. Try to sign up/sign in
4. Verify: No 404 errors on `/api/auth/*` endpoints
5. Check: Requests show same origin (no CORS)

---

## Troubleshooting

### Issue: DNS not resolving

**Cause:** DNS propagation delay  
**Fix:** Wait 5-10 minutes, or flush DNS cache:
```bash
ipconfig /flushdns  # Windows
```

### Issue: API still returns 404

**Cause:** Workers Route not configured  
**Fix:** Verify route exists in Dashboard → Workers Routes  
**Check:** Pattern is exactly `wordis-bond.com/api/*`

### Issue: SSL certificate error

**Cause:** Cloudflare provisioning SSL cert for custom domain  
**Fix:** Wait 10-15 minutes for automatic SSL provisioning  
**Check:** Dashboard → SSL/TLS → Edge Certificates

### Issue: www subdomain not working

**Cause:** Need separate custom domain for www  
**Fix:** Add `www.wordis-bond.com` as another custom domain  
**Or:** Redirect www → apex in DNS settings

---

## DNS Configuration

If DNS isn't auto-configured, manually add:

```
Type   Name   Content                   Proxy  TTL
CNAME  @      wordisbond.pages.dev      Yes    Auto
CNAME  www    wordisbond.pages.dev      Yes    Auto
```

**Proxied (Orange cloud):** Yes - Required for Workers Routes to work

---

## Next Steps After Setup

1. ✅ Verify custom domain works: `https://wordis-bond.com`
2. ✅ Verify API routing works: `https://wordis-bond.com/api/health`
3. ✅ Test authentication in browser
4. ✅ Update ARCH_DOCS with final configuration
5. ✅ Remove `.pages.dev` URLs from documentation (use custom domain)

---

## Production Checklist

- [ ] Custom domain added to Pages: `wordis-bond.com`
- [ ] DNS records pointing to Pages
- [ ] SSL certificate active (HTTPS working)
- [ ] Workers Route configured: `wordis-bond.com/api/*`
- [ ] API endpoints responding at `/api/*`
- [ ] Authentication working (sign in/sign up)
- [ ] No CORS errors in browser console
- [ ] Documentation updated with custom domain

---

## References

- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [CLOUDFLARE_DEPLOYMENT.md](ARCH_DOCS/CLOUDFLARE_DEPLOYMENT.md)

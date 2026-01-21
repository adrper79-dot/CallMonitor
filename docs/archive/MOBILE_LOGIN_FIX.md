# Mobile Login Fraud/Security Error - Fix Guide

## Problem
Getting fraud/security error when logging in from mobile device.

## Root Causes
1. **OAuth Redirect URI issues**
2. **Cookie SameSite/Secure settings**
3. **CSRF token problems on mobile**
4. **Missing mobile-friendly NextAuth settings**

---

## ✅ Solution 1: Fix OAuth Provider Settings

### **Google OAuth Console**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", ensure you have:
   ```
   https://voxsouth.online/api/auth/callback/google
   ```
4. Save changes

### **Microsoft Azure AD**
1. Go to: https://portal.azure.com
2. Azure Active Directory → App registrations → Your app
3. Authentication → Redirect URIs
4. Add:
   ```
   https://voxsouth.online/api/auth/callback/azure-ad
   ```
5. Save

### **X (Twitter) Developer Portal**
1. Go to: https://developer.twitter.com/en/portal/projects-and-apps
2. Your app → Settings → Authentication settings
3. Callback URLs:
   ```
   https://voxsouth.online/api/auth/callback/twitter
   ```
4. Save

### **Facebook Developers**
1. Go to: https://developers.facebook.com/apps
2. Your app → Facebook Login → Settings
3. Valid OAuth Redirect URIs:
   ```
   https://voxsouth.online/api/auth/callback/facebook
   ```
4. Save Changes

---

## ✅ Solution 2: Update NextAuth Cookie Settings

The issue is likely cookie settings not being mobile-friendly.

### **Required Changes in `lib/auth.ts`:**

```typescript
export const authOptions: AuthOptions = {
  // ... existing config ...
  
  // FIX: Mobile-friendly cookie settings
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',  // Changed from 'strict' - allows cross-site navigation
        path: '/',
        secure: true,      // HTTPS only (production)
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',  // Critical for mobile
        path: '/',
        secure: true,
      },
    },
  },
  
  // FIX: Session strategy
  session: {
    strategy: 'jwt',  // Use JWT for stateless auth (better for mobile)
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // FIX: Trust the proxy (Vercel)
  useSecureCookies: process.env.NODE_ENV === 'production',
  
  // ... rest of config ...
}
```

---

## ✅ Solution 3: Check Environment Variables

Ensure these are set in **Vercel Dashboard → Settings → Environment Variables**:

```bash
# NextAuth
NEXTAUTH_URL=https://voxsouth.online
NEXTAUTH_SECRET=<your-secret-here>

# OAuth Providers
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

AZURE_AD_CLIENT_ID=<your-azure-client-id>
AZURE_AD_CLIENT_SECRET=<your-azure-client-secret>
AZURE_AD_TENANT_ID=<your-tenant-id>

TWITTER_CLIENT_ID=<your-twitter-client-id>
TWITTER_CLIENT_SECRET=<your-twitter-client-secret>

FACEBOOK_CLIENT_ID=<your-facebook-app-id>
FACEBOOK_CLIENT_SECRET=<your-facebook-app-secret>
```

---

## ✅ Solution 4: Add Mobile User-Agent Handling

Some OAuth providers block mobile user-agents. Add this to your auth config:

```typescript
// In lib/auth.ts
export const authOptions: AuthOptions = {
  // ... existing config ...
  
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow all sign-ins (OAuth providers handle fraud detection)
      return true
    },
    
    async redirect({ url, baseUrl }) {
      // Ensure redirects work on mobile
      // Allow relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allow callbacks to same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    
    // ... other callbacks ...
  },
}
```

---

## ✅ Solution 5: Test Mobile Login Flow

### **1. Clear Cookies on Mobile**
- iOS Safari: Settings → Safari → Clear History and Website Data
- Android Chrome: Settings → Privacy → Clear browsing data

### **2. Test Sign In**
1. Open https://voxsouth.online on mobile
2. Click "Sign In"
3. Choose OAuth provider (Google, Microsoft, etc.)
4. Complete OAuth flow
5. Should redirect back successfully

### **3. Check Developer Tools (Desktop)**
Before deploying, test on desktop with mobile emulation:
1. Open Chrome DevTools (F12)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Select iPhone or Android device
4. Test login flow
5. Check Console for errors

---

## 🔧 Quick Fix (Deploy Now)

If you need an immediate fix, add these cookie settings:

```typescript
// In lib/auth.ts - add this to authOptions
cookies: {
  sessionToken: {
    name: `next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: 'lax',  // ← This is the key change
      path: '/',
      secure: true,
    },
  },
},
```

Then deploy:
```bash
git add .
git commit -m "fix: Mobile login - change cookie SameSite to lax"
git push origin main
```

---

## 🐛 Debugging Steps

### **1. Check Actual Error Message**
On mobile, try to capture the exact error:
- Take a screenshot
- Check browser console (if accessible)
- Look for specific error codes

### **2. Check Vercel Logs**
```bash
vercel logs https://voxsouth.online
```
Look for:
- `OAuthCallbackError`
- `CSRF token mismatch`
- `Redirect URI mismatch`

### **3. Common Error Messages & Fixes**

| Error | Cause | Fix |
|-------|-------|-----|
| "CSRF token mismatch" | Cookie SameSite too strict | Change to 'lax' |
| "Redirect URI mismatch" | OAuth provider config | Update redirect URIs |
| "Invalid state parameter" | Session/cookie issue | Clear cookies, use 'lax' |
| "Fraud detection" | Provider blocking mobile | Check provider settings |

---

## 📱 Mobile-Specific Considerations

### **iOS Safari**
- Blocks 3rd-party cookies by default
- Use SameSite: 'lax' (not 'none')
- Ensure HTTPS (secure cookies)

### **Android Chrome**
- More permissive than Safari
- Still needs SameSite: 'lax' for best compatibility

### **Private/Incognito Mode**
- May block all OAuth flows
- Ask users to use normal browsing mode

---

## ✅ Final Checklist

Before considering this fixed:

- [ ] All OAuth providers have correct redirect URIs
- [ ] Cookie SameSite set to 'lax' (not 'strict' or 'none')
- [ ] NEXTAUTH_URL matches production domain
- [ ] NEXTAUTH_SECRET is set and strong
- [ ] useSecureCookies is true in production
- [ ] Session strategy is 'jwt' (not 'database' for mobile)
- [ ] Tested on actual mobile device (not just emulator)
- [ ] Cleared cookies before testing
- [ ] No errors in Vercel logs

---

## 🚀 Deploy & Test

```bash
# 1. Make changes to lib/auth.ts
# 2. Test locally first
npm run dev

# 3. Deploy to production
git add .
git commit -m "fix: Mobile authentication - update cookie settings"
git push origin main

# 4. Wait for Vercel deployment (~1 minute)

# 5. Test on mobile
# - Clear mobile browser cookies
# - Visit https://voxsouth.online
# - Sign in with OAuth provider
# - Verify successful redirect
```

---

## 🆘 Still Having Issues?

### **Get More Info**
Share these details:
1. **Exact error message** (screenshot)
2. **Which OAuth provider** (Google, Microsoft, etc.)
3. **Mobile browser** (Safari, Chrome, Firefox)
4. **Device OS** (iOS 17, Android 14, etc.)
5. **Vercel logs** from the time of error

### **Temporary Workaround**
If OAuth is completely broken on mobile, users can:
1. Use email magic link (if enabled)
2. Use credentials login (if enabled)
3. Sign in on desktop and sync later

---

## Summary

**Most likely fix**: Change `sameSite` cookie setting from `'strict'` to `'lax'` in NextAuth configuration.

**Test after deploy**: Clear cookies, try logging in from mobile, verify redirect works.

**Expected result**: Successful OAuth login on mobile devices without fraud/security errors.

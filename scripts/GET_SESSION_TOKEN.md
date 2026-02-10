# How to Get Your Session Token

## Method 1: Browser DevTools (Recommended)

1. **Sign in to the platform:**
   - Go to https://voxsouth.online
   - Sign in with your credentials

2. **Open Developer Tools:**
   - Press `F12` (or `Ctrl+Shift+I` on Windows/Linux, `Cmd+Option+I` on Mac)

3. **Navigate to Cookies:**
   - Click the **Application** tab (Chrome/Edge)
   - OR **Storage** tab (Firefox)
   - Expand **Cookies** in the left sidebar
   - Click on `https://voxsouth.online`

4. **Find and Copy the Token:**
   - Look for cookie named: `wb-session-token`
   - Copy the **Value** column (long alphanumeric string)

5. **Add to `.dev.vars`:**
   ```bash
   WB_SESSION_TOKEN=your_copied_token_here
   ```

## Method 2: Browser Console

```javascript
// Paste this in browser console while on voxsouth.online
document.cookie
  .split('; ')
  .find((c) => c.startsWith('wb-session-token='))
  .split('=')[1]
```

Copy the output and add to `.dev.vars`.

## Method 3: Network Tab

1. Make any API request on the site (e.g., load dashboard)
2. Open **Network** tab in DevTools
3. Click any request to `wordisbond-api.adrper79.workers.dev`
4. Look at **Request Headers**
5. Find `Cookie: wb-session-token=...`
6. Copy the token value

## Verify Token Works

```bash
# Test the token
curl -H "Cookie: wb-session-token=YOUR_TOKEN" \
  https://wordisbond-api.adrper79.workers.dev/api/auth/session
```

Should return your session data (user info, organization).

## Quick Start (All Steps)

```bash
# 1. Copy example file
cp .dev.vars.example .dev.vars

# 2. Get token from browser (see above)

# 3. Edit .dev.vars and add token
# WB_SESSION_TOKEN=your_token_here

# 4. Run test
npm run test:translation
```

## Security Note

⚠️ **Never commit `.dev.vars` to git!**

- Already in `.gitignore`
- Contains sensitive credentials
- Token grants full access to your account

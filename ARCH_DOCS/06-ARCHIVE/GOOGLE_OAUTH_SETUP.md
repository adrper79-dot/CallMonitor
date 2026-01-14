# Google OAuth Setup Guide

To enable Google sign-in, you need to configure Google OAuth credentials.

## Steps

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in app name, user support email, developer contact
   - Add scopes: `email`, `profile`, `openid`
   - Add test users (if in testing mode)
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: Your app name
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://yourdomain.com/api/auth/callback/google` (for production)
7. Copy the **Client ID** and **Client Secret**

### 2. Add to Environment Variables

Add to your `.env.local` file:
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 3. Add to Vercel

```bash
vercel env add GOOGLE_CLIENT_ID
# Enter your Client ID

vercel env add GOOGLE_CLIENT_SECRET
# Enter your Client Secret
```

### 4. Test

1. Restart your dev server: `npm run dev`
2. Navigate to your app
3. Click "Sign in with Google"
4. You should be redirected to Google's consent screen

## Notes

- The OAuth consent screen may require verification for production use
- Test users can be added during development/testing phase
- Make sure redirect URIs match exactly (including http/https and trailing slashes)

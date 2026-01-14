# Resend Connection & Management Guide

**Note:** Resend doesn't have a traditional CLI like Supabase. Instead, you manage it via:
- **Web Dashboard** (primary method)
- **API** (already integrated in your codebase)
- **Node.js SDK** (package installed: `resend@^6.7.0`)

---

## Current Status

- ✅ **Resend Package Installed:** `resend@^6.7.0` in package.json
- ✅ **Integration:** Used in NextAuth for email sign-in (`app/api/auth/[...nextauth]/route.ts`)
- ❌ **API Key:** Not currently set in environment

---

## Quick Setup

### 1. Get Your Resend API Key

1. Go to [Resend Dashboard](https://resend.com/dashboard)
2. Sign in or create account
3. Navigate to **API Keys** → **Create API Key**
4. Copy the API key (starts with `re_`)

### 2. Configure Environment

Add to your `.env` file:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com  # Must be verified domain
```

### 3. Verify Your Domain

1. Go to [Resend Domains](https://resend.com/domains)
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Configure DNS records as shown
5. Wait for verification (usually a few minutes)

---

## Testing Connection

### Option 1: Use Test Script

```bash
# Set test email (optional, defaults to test@example.com)
export TEST_EMAIL=your-email@example.com

# Run test script
npx ts-node -r tsconfig-paths/register scripts/test-resend-connection.ts
```

### Option 2: Test via NextAuth

1. Start dev server: `npm run dev`
2. Navigate to sign-in page
3. Use email sign-in option
4. Check inbox for verification email

### Option 3: Test via API Directly

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@yourdomain.com",
    "to": ["test@example.com"],
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

---

## Resend Dashboard Access

### Key Dashboard Sections

1. **API Keys** - https://resend.com/api-keys
   - View, create, revoke API keys
   - Monitor key usage

2. **Domains** - https://resend.com/domains
   - Add and verify domains
   - View DNS configuration
   - Check domain status

3. **Emails** - https://resend.com/emails
   - View sent emails
   - Check delivery status
   - See bounce/complaint rates

4. **Analytics** - https://resend.com/analytics
   - Email metrics
   - Delivery rates
   - Open/click rates

---

## Using Resend SDK (Alternative to API)

Your codebase currently uses the HTTP API. You could also use the SDK:

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Send email
const { data, error } = await resend.emails.send({
  from: 'noreply@yourdomain.com',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Email content</p>'
})

if (error) {
  console.error('Error:', error)
} else {
  console.log('Email sent:', data.id)
}
```

---

## Current Implementation

Your codebase uses Resend in:

**File:** `app/api/auth/[...nextauth]/route.ts`

```typescript
async function sendViaResend(to: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `no-reply@${domain}`,
      to: [to],
      subject: 'Your sign-in link',
      html,
    }),
  })
  
  if (!res.ok) throw new Error(`Resend API error: ${res.status}`)
}
```

---

## Troubleshooting

### "RESEND_API_KEY not configured"
- Add `RESEND_API_KEY` to `.env` file
- Restart development server

### "Domain not verified"
- Go to Resend Dashboard > Domains
- Verify domain DNS records are configured
- Wait for verification (can take up to 48 hours)

### "Unauthorized" (401)
- Check API key is correct
- Verify API key hasn't been revoked
- Ensure API key has proper permissions

### "Unprocessable Entity" (422)
- Verify `EMAIL_FROM` domain is verified in Resend
- Check email format is correct
- Ensure recipient email is valid

---

## Next Steps

1. **Get API Key** - Sign up at resend.com
2. **Add to .env** - Set `RESEND_API_KEY` and `EMAIL_FROM`
3. **Verify Domain** - Add domain in Resend Dashboard
4. **Test Connection** - Run test script or use NextAuth email sign-in

---

## Resources

- **Dashboard:** https://resend.com/dashboard
- **API Docs:** https://resend.com/docs/api-reference
- **Node.js SDK:** https://resend.com/docs/send-with-nodejs
- **Domain Setup:** https://resend.com/docs/dashboard/domains/introduction

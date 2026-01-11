# Resend Connection & Usage Guide

**Status:** ✅ Resend is integrated in the codebase for email authentication

---

## Current Integration

Resend is currently used in:
- **NextAuth Email Provider** - Sends sign-in verification emails
- **Location:** `app/api/auth/[...nextauth]/route.ts`
- **Function:** `sendViaResend()` - Sends emails via Resend API

---

## Configuration

### Required Environment Variables

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx  # Your Resend API key
EMAIL_FROM=noreply@yourdomain.com  # Sender email address (must be verified in Resend)
```

### Get Your API Key

1. Go to [Resend Dashboard](https://resend.com/api-keys)
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Create a new API key or copy existing one
5. Add to your `.env` file

---

## Testing Resend Connection

### Option 1: Test via API (Recommended)

Create a test script to verify your Resend connection:

```typescript
// test-resend.ts
const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@yourdomain.com'

async function testResend() {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: ['your-email@example.com'],
      subject: 'Test Email from Resend',
      html: '<p>This is a test email to verify Resend connection.</p>'
    })
  })

  if (res.ok) {
    const data = await res.json()
    console.log('✅ Email sent successfully!', data)
  } else {
    const error = await res.text()
    console.error('❌ Failed to send email:', error)
  }
}

testResend()
```

### Option 2: Test via NextAuth

1. Start your Next.js app: `npm run dev`
2. Navigate to the sign-in page
3. Use the email sign-in option
4. Check if verification email is received

---

## Resend Dashboard Access

Resend doesn't have a CLI, but you can manage everything via their web dashboard:

### Dashboard Features

1. **API Keys Management**
   - View and manage API keys
   - Create new keys
   - Revoke keys

2. **Domains Management**
   - Add and verify domains
   - Configure DNS records
   - View domain status

3. **Email Logs**
   - View sent emails
   - Check delivery status
   - View bounce/complaint rates

4. **Analytics**
   - Email delivery metrics
   - Open rates
   - Click rates

### Access Dashboard

- **URL:** https://resend.com/dashboard
- **Login:** Use your Resend account credentials

---

## API Usage in Codebase

### Current Implementation

```typescript
// From app/api/auth/[...nextauth]/route.ts
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

### Using Resend SDK (Alternative)

The codebase has `resend` package installed. You could also use the SDK:

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'noreply@yourdomain.com',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Email content</p>'
})
```

---

## Verification Steps

1. **Check Environment Variables**
   ```bash
   # Verify RESEND_API_KEY is set
   echo $RESEND_API_KEY  # or check .env file
   ```

2. **Verify Domain in Resend**
   - Go to Resend Dashboard > Domains
   - Ensure your sending domain is verified
   - Check DNS records are configured correctly

3. **Test Email Sending**
   - Use the test script above
   - Or trigger NextAuth email sign-in
   - Check email inbox for delivery

---

## Troubleshooting

### Common Issues

1. **"RESEND_API_KEY not configured"**
   - Add `RESEND_API_KEY` to your `.env` file
   - Restart your development server

2. **"Domain not verified"**
   - Go to Resend Dashboard > Domains
   - Add and verify your sending domain
   - Configure DNS records as shown

3. **"Email not received"**
   - Check spam folder
   - Verify email address is correct
   - Check Resend Dashboard > Logs for delivery status

4. **"Unauthorized" error**
   - Verify API key is correct
   - Check API key hasn't been revoked
   - Ensure API key has proper permissions

---

## Next Steps

1. **Get API Key** - Sign up at resend.com and get your API key
2. **Configure Environment** - Add `RESEND_API_KEY` to `.env`
3. **Verify Domain** - Add and verify your sending domain in Resend Dashboard
4. **Test Connection** - Use the test script or NextAuth email sign-in

---

## Resources

- **Resend Dashboard:** https://resend.com/dashboard
- **Resend API Docs:** https://resend.com/docs/api-reference
- **Resend Node.js SDK:** https://resend.com/docs/send-with-nodejs
- **Domain Verification:** https://resend.com/docs/dashboard/domains/introduction

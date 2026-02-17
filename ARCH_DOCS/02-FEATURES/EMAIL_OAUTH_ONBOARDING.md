# Optional Email OAuth in Onboarding (Gmail + Outlook)

**Status:** Live (v4.69)  
**Updated:** February 17, 2026

## Summary

The onboarding flow includes an **optional** email-channel step:
- Connect **Gmail** via Google Workspace OAuth
- Connect **Outlook** via Microsoft OAuth
- Or **skip** for SMS-only organizations

System emails (password reset/account notices) remain on **Resend**.

## UX Behavior

### Onboarding
- New step: **Email OAuth (Optional)**
- Actions:
  - Connect Gmail
  - Connect Outlook
  - Skip (SMS-only)
- User can continue without email OAuth.

### Later Access
- Users can configure/reconnect from:
  - `/settings/integrations`

## Backend Endpoints

### Google Workspace
- `POST /api/google-workspace/connect` (supports optional `state`)
- `POST /api/google-workspace/callback`
- `GET /api/google-workspace/status`
- `POST /api/google-workspace/disconnect`

### Outlook (Microsoft 365)
- `POST /api/outlook/connect`
- `POST /api/outlook/callback`
- `GET /api/outlook/status`
- `POST /api/outlook/disconnect`

## Frontend Callback Routes

- `/integrations/google-workspace/callback`
- `/integrations/outlook/callback`

These routes complete OAuth server-side and redirect to onboarding or settings.

## Environment Variables

### Required for Outlook OAuth
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_REDIRECT_URI`
- `MICROSOFT_TENANT_ID` (optional, defaults to `common`)

### Existing Google OAuth
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## Database Note

Provider constraint updated to allow `outlook` in `integrations` table:
- `migrations/2026-02-16-add-outlook-provider-to-integrations.sql`

## Compliance/Policy

- Email OAuth is optional for onboarding (supports SMS-only operations).
- Resend remains the source for system/transactional emails.
- OAuth connections are organization-scoped and role-gated in API routes.

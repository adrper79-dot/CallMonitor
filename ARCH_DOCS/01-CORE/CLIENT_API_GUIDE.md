# Client-Side API Development Guide

**Version:** 1.0 | **Date:** January 15, 2026

---

## 🎯 Critical Rule: Session Cookies

**ALL client-side fetch calls MUST include `credentials: 'include'`**

Without this, browsers won't send the NextAuth session cookie, causing 401 errors.

---

## 🛠️ Using the API Client (Recommended)

Import from `lib/apiClient.ts` for automatic credential handling:

```typescript
import { apiGet, apiPost, apiPut, apiDelete, apiFetch } from '@/lib/apiClient'

// GET request
const data = await apiGet('/api/calls?orgId=xxx')

// POST request  
const result = await apiPost('/api/voice/call', {
  phone_number: '+15551234567',
  organization_id: 'xxx'
})

// PUT request
const updated = await apiPut('/api/voice/config', {
  orgId: 'xxx',
  modulations: { record: true }
})

// DELETE request
const deleted = await apiDelete('/api/team/members?member_id=xxx')

// Raw fetch with credentials
const response = await apiFetch('/api/custom-endpoint', {
  method: 'GET',
  headers: { 'X-Custom-Header': 'value' }
})
```

---

## 🔧 Manual Fetch (If Not Using apiClient)

If you must use `fetch()` directly, ALWAYS include credentials:

### GET Request:
```typescript
const res = await fetch('/api/endpoint', {
  credentials: 'include'
})
```

### POST Request:
```typescript
const res = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ← NEVER FORGET THIS
  body: JSON.stringify(data)
})
```

### PUT Request:
```typescript
const res = await fetch('/api/endpoint', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(data)
})
```

### DELETE Request:
```typescript
const res = await fetch('/api/endpoint?id=xxx', {
  method: 'DELETE',
  credentials: 'include'
})
```

---

## ❌ Common Mistakes

### Wrong - Missing credentials:
```typescript
// ❌ Will fail with 401
const res = await fetch('/api/rbac/context')
```

### Wrong - Credentials in wrong place:
```typescript
// ❌ Syntax error
const res = await fetch('/api/endpoint', credentials: 'include')
```

### Correct:
```typescript
// ✅ Credentials in options object
const res = await fetch('/api/endpoint', { credentials: 'include' })
```

---

## 🧪 Testing Checklist

When adding new API calls in client components:

- [ ] Using `apiClient` helpers OR `credentials: 'include'`
- [ ] Test logged in and logged out states
- [ ] Check Network tab for 401 errors
- [ ] Verify session cookie is being sent with request
- [ ] Error handling for failed requests

---

## 📋 API Response Format

All API endpoints return consistent JSON:

### Success:
```json
{
  "success": true,
  "data": { ... }
}
```

### Error:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Error Handling:
```typescript
try {
  const data = await apiGet('/api/endpoint')
  // Handle success
} catch (err) {
  if (err instanceof ApiError) {
    console.error(`API Error ${err.status}: ${err.message}`)
  }
}
```

---

## 🔒 Authentication Flow

1. User logs in via NextAuth.js
2. Session cookie set: `next-auth.session-token`
3. Client makes API call with `credentials: 'include'`
4. Browser sends session cookie
5. Server validates session via `getServerSession()`
6. Server returns data or 401 if unauthenticated

---

## 📊 API Endpoints by Auth Level

### Public (No Auth):
- `GET /api/health` - Health check
- `POST /api/webhooks/*` - External webhooks (use signature validation)

### Authenticated (Any User):
- `GET /api/rbac/context` - User's role/permissions
- `GET /api/calls` - User's calls (scoped by org)
- `GET/PUT /api/voice/config` - Voice configuration

### Admin/Owner Only:
- `POST /api/voice/bulk-upload` - Bulk operations
- `DELETE /api/team/members` - Remove team members
- `PUT /api/features` - Feature flag management

---

## 💡 Best Practices

1. **Use apiClient helpers** - Less error-prone than raw fetch
2. **Handle errors gracefully** - Show user-friendly messages
3. **Check auth before rendering** - Don't show features user can't access
4. **Log API errors** - Use console.error for debugging
5. **Test with fresh session** - Ensure no stale cookie issues

---

**See Also:**
- `lib/apiClient.ts` - API client implementation
- `lib/api/utils.ts` - Server-side auth utilities
- `ARCH_DOCS/archive/fixes/CLIENT_FETCH_CREDENTIALS_FIX.md` - Full fix details

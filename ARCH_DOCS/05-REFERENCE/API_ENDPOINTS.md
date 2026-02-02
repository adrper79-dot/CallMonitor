# API Endpoints Reference

**Last Updated:** January 18, 2026  
**Status:** Complete

> Comprehensive reference for all API endpoints in Wordis Bond
> 
> **AI Role Policy Reference:** [AI_ROLE_POLICY.md](../01-CORE/AI_ROLE_POLICY.md)

---

## 🎯 Overview

This document provides a complete reference for all API endpoints available in the platform. All endpoints require authentication unless otherwise specified.

**Base URL:** `https://your-domain.com/api`

---

## 📞 Voice Operations

### POST /api/voice/call
**Description:** Initiate an outbound call  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Base+

**Request Body:**
```json
{
  "target_phone": "+15551234567",
  "call_flow_type": "outbound",
  "modulations": {
    "recording_enabled": true,
    "transcription_enabled": true,
    "translation_enabled": false
  }
}
```

**Response:**
```json
{
  "call_id": "uuid",
  "status": "initiated",
  "call_sid": "CA..."
}
```

---

### POST /api/voice/bulk-upload
**Description:** Upload CSV for bulk call execution  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

**Request:** Multipart form data with CSV file

---

### GET /api/voice/config
**Description:** Get organization voice configuration  
**Auth:** Required  
**Role:** All  
**Plan:** Base+

**Response:**
```json
{
  "organization_id": "uuid",
  "recording_enabled": true,
  "transcription_enabled": true,
  "translation_enabled": false,
  "translation_from": "en",
  "translation_to": "es",
  "ai_agent_model": "gpt-4o-mini",
  "ai_agent_temperature": 0.3
}
```

---

### PUT /api/voice/config
**Description:** Update voice configuration  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Base+

**Request Body:**
```json
{
  "recording_enabled": true,
  "transcription_enabled": true,
  "translation_enabled": true,
  "translation_from": "en",
  "translation_to": "es"
}
```

---

### GET /api/voice/targets
**Description:** List voice targets for organization  
**Auth:** Required  
**Role:** All  
**Plan:** Base+

---

### POST /api/voice/targets
**Description:** Create new voice target  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Base+

---

### GET /api/voice/script
**Description:** Get LaML script for call execution  
**Auth:** Internal  
**Plan:** N/A

---

### POST /api/voice/laml/outbound
**Description:** LaML callback for standard calls  
**Auth:** SignalWire webhook signature  
**Plan:** N/A

---

### POST /api/voice/swml/outbound
**Description:** SWML callback for AI agent calls  
**Auth:** SignalWire webhook signature  
**Plan:** N/A

---

### POST /api/voice/swml/translation
**Description:** SWML script for live translation calls  
**Auth:** SignalWire webhook signature  
**Plan:** Business+

---

### POST /api/voice/swml/survey
**Description:** SWML script for AI survey bot  
**Auth:** SignalWire webhook signature  
**Plan:** Business+

---

### POST /api/voice/swml/shopper
**Description:** SWML script for secret shopper calls  
**Auth:** SignalWire webhook signature  
**Plan:** Insights+

---

### POST /api/voice/config/test
**Description:** Test voice configuration  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Base+

---

## 📋 Call Management

### GET /api/calls
**Description:** List calls for organization  
**Auth:** Required  
**Role:** All  
**Plan:** Base+

**Query Parameters:**
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset
- `status`: Filter by status
- `date_from`: Start date filter
- `date_to`: End date filter

---

### GET /api/calls/[id]
**Description:** Get detailed call information  
**Auth:** Required  
**Role:** All  
**Plan:** Base+

**Response:**
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "status": "completed",
  "started_at": "2026-01-17T10:00:00Z",
  "ended_at": "2026-01-17T10:05:00Z",
  "call_sid": "CA...",
  "recording_url": "https://...",
  "transcript": "...",
  "translations": []
}
```

---

### GET /api/calls/[id]/timeline
**Description:** Get call event timeline  
**Auth:** Required  
**Role:** All  
**Plan:** Base+

---

### GET /api/calls/[id]/notes
**Description:** Get call notes  
**Auth:** Required  
**Role:** All  
**Plan:** Pro+

---

### POST /api/calls/[id]/notes
**Description:** Add note to call  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Pro+

---

### GET /api/calls/[id]/disposition
**Description:** Get call disposition  
**Auth:** Required  
**Role:** All  
**Plan:** Pro+

---

### PUT /api/calls/[id]/disposition
**Description:** Update call disposition  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Pro+

---

### GET /api/call-capabilities
**Description:** Get organization call capabilities based on plan  
**Auth:** Required  
**Role:** All  
**Plan:** Base+

**Response:**
```json
{
  "recording": true,
  "transcription": true,
  "translation": true,
  "translation_live": false,
  "surveys": true,
  "secret_shopper": true,
  "campaigns": true,
  "reports": true
}
```

---

## 🔔 Webhooks

### POST /api/webhooks/signalwire
**Description:** SignalWire status update webhook  
**Auth:** SignalWire signature  
**Plan:** N/A

---

### POST /api/webhooks/assemblyai
**Description:** AssemblyAI transcription webhook  
**Auth:** AssemblyAI signature  
**Plan:** N/A

---

### POST /api/webhooks/survey
**Description:** Survey completion webhook  
**Auth:** Internal  
**Plan:** N/A

---

### POST /api/webhooks/stripe
**Description:** Stripe billing webhook  
**Auth:** Stripe signature  
**Plan:** N/A

**Events Handled:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

### GET /api/webhooks
**Description:** List webhook subscriptions  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### POST /api/webhooks
**Description:** Create webhook subscription  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### PATCH /api/webhooks/[id]
**Description:** Update webhook subscription  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### DELETE /api/webhooks/[id]
**Description:** Delete webhook subscription  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### POST /api/webhooks/[id]/test
**Description:** Test webhook delivery  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### GET /api/webhooks/subscriptions
**Description:** List webhook subscriptions (alias)  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### POST /api/webhooks/subscriptions
**Description:** Create webhook subscription (alias)  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### PATCH /api/webhooks/subscriptions/[id]
**Description:** Update webhook subscription  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### DELETE /api/webhooks/subscriptions/[id]
**Description:** Delete webhook subscription  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### POST /api/webhooks/subscriptions/[id]/test
**Description:** Test webhook subscription  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### GET /api/webhooks/subscriptions/[id]/deliveries
**Description:** Get webhook delivery history  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

## 📊 Campaigns

### GET /api/campaigns
**Description:** List campaigns for organization  
**Auth:** Required  
**Role:** All  
**Plan:** Business+

**Query Parameters:**
- `status`: Filter by status
- `call_flow_type`: Filter by call flow type

**Response:**
```json
{
  "campaigns": [
    {
      "id": "uuid",
      "name": "Q1 2026 Customer Outreach",
      "status": "active",
      "call_flow_type": "outbound",
      "total_targets": 1000,
      "calls_completed": 250,
      "calls_successful": 200,
      "calls_failed": 50
    }
  ]
}
```

---

### POST /api/campaigns
**Description:** Create new campaign  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

**Request Body:**
```json
{
  "name": "Q1 2026 Customer Outreach",
  "description": "Outbound campaign for Q1",
  "call_flow_type": "outbound",
  "target_list": [
    {"phone": "+15551234567", "metadata": {"name": "John"}},
    {"phone": "+15559876543", "metadata": {"name": "Jane"}}
  ],
  "schedule_type": "scheduled",
  "scheduled_at": "2026-01-20T09:00:00Z",
  "call_config": {
    "max_duration": 300,
    "timeout": 30,
    "retry_attempts": 3
  }
}
```

---

### GET /api/campaigns/[id]
**Description:** Get campaign details  
**Auth:** Required  
**Role:** All  
**Plan:** Business+

---

### PATCH /api/campaigns/[id]
**Description:** Update campaign  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### DELETE /api/campaigns/[id]
**Description:** Delete campaign  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### POST /api/campaigns/[id]/execute
**Description:** Execute campaign (start calling targets)  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Business+

---

### GET /api/campaigns/[id]/stats
**Description:** Get campaign performance statistics  
**Auth:** Required  
**Role:** All  
**Plan:** Business+

**Response:**
```json
{
  "total_targets": 1000,
  "calls_completed": 250,
  "calls_successful": 200,
  "calls_failed": 50,
  "calls_pending": 750,
  "average_duration": 180,
  "success_rate": 0.8
}
```

---

## 📈 Reports

### GET /api/reports
**Description:** List report templates  
**Auth:** Required  
**Role:** All  
**Plan:** Business+

---

### POST /api/reports
**Description:** Create report template and generate report  
**Auth:** Required  
**Role:** Owner, Admin, Analyst  
**Plan:** Business+

**Request Body:**
```json
{
  "name": "Weekly Call Volume",
  "report_type": "call_volume",
  "data_source": "calls",
  "filters": {
    "date_range": "last_7_days",
    "status": ["completed"]
  },
  "metrics": ["call_count", "average_duration", "success_rate"],
  "dimensions": ["date", "user"],
  "file_format": "pdf"
}
```

---

### GET /api/reports/[id]/export
**Description:** Export generated report  
**Auth:** Required  
**Role:** All  
**Plan:** Business+

**Response:** File download (PDF, CSV, XLSX, JSON)

---

### GET /api/reports/schedules/[id]
**Description:** Get scheduled report details  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### PATCH /api/reports/schedules/[id]
**Description:** Update scheduled report  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### DELETE /api/reports/schedules/[id]
**Description:** Delete scheduled report  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

## 📝 Surveys

### GET /api/surveys
**Description:** List surveys for organization  
**Auth:** Required  
**Role:** All  
**Plan:** Insights+

---

### POST /api/surveys
**Description:** Create or update survey  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Insights+

---

### DELETE /api/surveys
**Description:** Delete survey  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Insights+

---

### POST /api/survey/ai-results
**Description:** Process AI survey results  
**Auth:** Internal  
**Plan:** N/A

---

## � AI Quality Evaluation (formerly Secret Shopper)

> **AI Role Policy:** QA evaluation is for internal purposes only. See [AI_ROLE_POLICY.md](../01-CORE/AI_ROLE_POLICY.md)

### GET /api/shopper/scripts
**Description:** List QA evaluation scripts  
**Auth:** Required  
**Role:** All  
**Plan:** Insights+

---

### POST /api/shopper/scripts/manage
**Description:** Create or update QA evaluation script  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Insights+

---

### GET /api/scorecards
**Description:** List scorecards  
**Auth:** Required  
**Role:** All  
**Plan:** Insights+

---

## 💳 Billing & Usage

### GET /api/usage
**Description:** Get organization usage metrics  
**Auth:** Required  
**Role:** All  
**Plan:** Base+

**Response:**
```json
{
  "current_period": {
    "start": "2026-01-01T00:00:00Z",
    "end": "2026-01-31T23:59:59Z"
  },
  "usage": {
    "calls": {"used": 250, "limit": 500},
    "minutes": {"used": 1500, "limit": 3000},
    "transcriptions": {"used": 200, "limit": 500},
    "translations": {"used": 50, "limit": 100}
  },
  "plan": "pro",
  "billing_period": "month"
}
```

---

### POST /api/billing/checkout
**Description:** Create Stripe checkout session  
**Auth:** Required  
**Role:** Owner  
**Plan:** N/A

---

### POST /api/billing/portal
**Description:** Create Stripe customer portal session  
**Auth:** Required  
**Role:** Owner  
**Plan:** N/A

---

### GET /api/billing/subscription
**Description:** Get current subscription status  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** N/A

---

### POST /api/billing/cancel
**Description:** Cancel subscription  
**Auth:** Required  
**Role:** Owner  
**Plan:** N/A

---

### GET /api/billing/invoices
**Description:** Get paginated invoice history  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** N/A

**Query Parameters:**
- `limit`: Number of results (default: 10, max: 100)
- `offset`: Pagination offset

**Response:**
```json
{
  "invoices": [
    {
      "id": "in_...",
      "stripe_invoice_id": "in_...",
      "amount": 4900,
      "currency": "usd",
      "status": "paid",
      "invoice_date": "2026-01-15T00:00:00Z",
      "paid_at": "2026-01-15T10:30:00Z",
      "invoice_pdf": "https://...",
      "hosted_invoice_url": "https://..."
    }
  ],
  "total": 12,
  "limit": 10,
  "offset": 0
}
```

---

### GET /api/billing/payment-methods
**Description:** Get organization payment methods  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** N/A

**Response:**
```json
{
  "paymentMethods": [
    {
      "id": "pm_...",
      "type": "card",
      "card": {
        "brand": "visa",
        "last4": "4242",
        "exp_month": 12,
        "exp_year": 2027
      },
      "is_default": true,
      "created_at": "2026-01-10T00:00:00Z"
    }
  ]
}
```

---

## 🏢 Organizations

### GET /api/organizations/current
**Description:** Get current user's organization with subscription details  
**Auth:** Required  
**Role:** All  
**Plan:** N/A

**Response:**
```json
{
  "organization": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "plan": "pro",
    "created_at": "2026-01-01T00:00:00Z"
  },
  "membership": {
    "role": "owner",
    "joined_at": "2026-01-01T00:00:00Z"
  },
  "subscription": {
    "status": "active",
    "current_period_end": "2026-02-01T00:00:00Z"
  },
  "memberCount": 5
}
```

---

## 🤖 AI Configuration

### GET /api/ai-config
**Description:** Get AI agent configuration  
**Auth:** Required  
**Role:** All  
**Plan:** Business+

**Response:**
```json
{
  "ai_agent_id": "custom-agent-123",
  "ai_agent_model": "gpt-4o-mini",
  "ai_agent_temperature": 0.3,
  "ai_agent_prompt": "Custom system prompt...",
  "ai_post_prompt_url": "https://...",
  "ai_features_enabled": true
}
```

---

### PUT /api/ai-config
**Description:** Update AI agent configuration  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

## 📊 Analytics

### GET /api/analytics/calls
**Description:** Get call analytics  
**Auth:** Required  
**Role:** All  
**Plan:** Pro+

---

### GET /api/analytics/sentiment-trends
**Description:** Get sentiment analysis trends  
**Auth:** Required  
**Role:** All  
**Plan:** Pro+

---

### GET /api/analytics/performance
**Description:** Get performance metrics  
**Auth:** Required  
**Role:** All  
**Plan:** Pro+

---

### GET /api/analytics/export
**Description:** Export analytics data  
**Auth:** Required  
**Role:** Owner, Admin, Analyst  
**Plan:** Pro+

---

## 📞 Bookings

### GET /api/bookings
**Description:** List scheduled call bookings  
**Auth:** Required  
**Role:** All  
**Plan:** Business+

---

### POST /api/bookings
**Description:** Create new booking  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Business+

---

### PATCH /api/bookings/[id]
**Description:** Update booking  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Business+

---

### DELETE /api/bookings/[id]
**Description:** Cancel booking  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Business+

---

## 🔐 Authentication & Users

### POST /api/auth/signup
**Description:** User registration  
**Auth:** Public  
**Plan:** N/A

---

### POST /api/auth/unlock
**Description:** Unlock account  
**Auth:** Public  
**Plan:** N/A

---

### GET /api/users/[userId]/organization
**Description:** Get user's organization  
**Auth:** Required  
**Role:** All  
**Plan:** Base+

---

## 🎙️ Audio Processing

### POST /api/audio/upload
**Description:** Upload audio file  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Pro+

---

### POST /api/audio/transcribe
**Description:** Transcribe uploaded audio  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Pro+

---

### POST /api/tts/generate
**Description:** Generate TTS audio via ElevenLabs  
**Auth:** Internal  
**Plan:** N/A

---

## 🔍 SignalWire

### GET /api/signalwire/numbers
**Description:** List SignalWire phone numbers  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Base+

---

### PATCH /api/signalwire/numbers
**Description:** Update phone number configuration  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Base+

---

## 🌐 WebRTC

### POST /api/webrtc/session
**Description:** Create WebRTC session  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Business+

---

### GET /api/webrtc/session
**Description:** Get WebRTC session status  
**Auth:** Required  
**Role:** All  
**Plan:** Business+

---

### DELETE /api/webrtc/session
**Description:** End WebRTC session  
**Auth:** Required  
**Role:** Owner, Admin, Operator  
**Plan:** Business+

---

## 🏥 Health & Monitoring

### GET /api/health
**Description:** System health check  
**Auth:** Public  
**Plan:** N/A

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T10:00:00Z",
  "services": {
    "database": "healthy",
    "signalwire": "healthy",
    "assemblyai": "healthy",
    "stripe": "healthy"
  }
}
```

---

### GET /api/health/env
**Description:** Environment configuration check  
**Auth:** Admin only  
**Plan:** N/A

---

### GET /api/health/user
**Description:** User lookup for debugging  
**Auth:** Admin only  
**Plan:** N/A

---

### GET /api/health/auth-adapter
**Description:** Auth adapter health check  
**Auth:** Admin only  
**Plan:** N/A

---

### GET /api/health/auth-providers
**Description:** List auth providers  
**Auth:** Admin only  
**Plan:** N/A

---

## 📋 Audit & Compliance

### GET /api/audit-logs
**Description:** Get audit logs  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

### GET /api/errors/metrics
**Description:** Get error metrics  
**Auth:** Required  
**Role:** Owner, Admin  
**Plan:** Business+

---

## 🧪 Testing

### GET /api/test-email
**Description:** Test email delivery (diagnostics)  
**Auth:** Admin only  
**Plan:** N/A

---

### POST /api/test-email
**Description:** Send test email  
**Auth:** Admin only  
**Plan:** N/A

---

### POST /api/test/run
**Description:** Run system test  
**Auth:** Admin only  
**Plan:** N/A

---

### POST /api/test/e2e
**Description:** Run end-to-end test  
**Auth:** Admin only  
**Plan:** N/A

---

### GET /api/test/e2e
**Description:** Get test status  
**Auth:** Admin only  
**Plan:** N/A

---

## 🔧 Features

### GET /api/features
**Description:** Get enabled features for organization  
**Auth:** Required  
**Role:** All  
**Plan:** Base+

**Response:**
```json
{
  "features": {
    "recording": true,
    "transcription": true,
    "translation": true,
    "translation_live": false,
    "surveys": true,
    "secret_shopper": true,
    "campaigns": true,
    "reports": true,
    "webhooks": true
  }
}
```

---

### PUT /api/features
**Description:** Update feature flags  
**Auth:** Required  
**Role:** Owner  
**Plan:** Base+

---

## 📖 OpenAPI

### GET /api/openapi
**Description:** Get OpenAPI specification  
**Auth:** Public  
**Plan:** N/A

**Response:** OpenAPI 3.0 JSON schema

---

## ⏱️ Cron Jobs (Internal)

### GET /api/cron/scheduled-calls
**Description:** Execute scheduled bookings (Vercel Cron)  
**Auth:** Vercel Cron secret  
**Plan:** N/A

---

### POST /api/cron/webhook-retry
**Description:** Retry failed webhooks  
**Auth:** Vercel Cron secret  
**Plan:** N/A

---

### GET /api/cron/webhook-retry
**Description:** Get webhook retry status  
**Auth:** Vercel Cron secret  
**Plan:** N/A

---

### GET /api/cron/scheduled-reports
**Description:** Execute scheduled reports  
**Auth:** Vercel Cron secret  
**Plan:** N/A

---

## 🔍 Debugging

### GET /api/debug/translation-check
**Description:** Check translation configuration  
**Auth:** Admin only  
**Plan:** N/A

---

### GET /api/webrpc
**Description:** WebRPC status  
**Auth:** Public  
**Plan:** N/A

---

### POST /api/webrpc
**Description:** WebRPC endpoint  
**Auth:** SignalWire signature  
**Plan:** N/A

---

## 📊 Retention

### GET /api/retention
**Description:** Get retention analytics  
**Auth:** Required  
**Role:** Owner, Admin, Analyst  
**Plan:** Business+

---

## Authentication

All authenticated endpoints require:
- Valid session cookie (NextAuth)
- Or Bearer token in Authorization header

## Rate Limiting

- Default: 100 requests per minute per IP
- Authenticated: 1000 requests per minute per organization
- Webhook endpoints: No rate limit (verified by signature)

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "message": "Missing required field: target_phone"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit`: Number of results (default: 50, max: 100)
- `offset`: Number of results to skip
- `cursor`: Cursor-based pagination token (alternative to offset)

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1000,
    "has_more": true,
    "next_cursor": "abc123"
  }
}
```

---

## Webhooks Security

All webhook endpoints verify signatures:

**SignalWire/Twilio:** HMAC-SHA1 with Base64 encoding  
**Stripe:** HMAC-SHA256 hex signature in header  
**AssemblyAI:** Bearer token validation

---

## SDK Support

Official SDKs available for:
- JavaScript/TypeScript (npm: `@wordisbond/sdk`)
- Python (pip: `wordisbond-sdk`)
- Ruby (gem: `wordisbond`)

---

## Support

For API support:
- Documentation: https://docs.wordisbond.com
- Email: api@wordisbond.com
- Discord: https://discord.gg/wordisbond

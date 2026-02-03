# API Documentation

## Overview

This document describes the Voice Operations API endpoints for the CallRoute Monitor platform.

**Base URL**: `https://your-domain.com/api`

**Authentication**: All endpoints require authentication via NextAuth session cookie.

---

## Endpoints

### Voice Operations

#### `POST /api/voice/call`

Execute a voice call.

**Request Body:**
```json
{
  "organization_id": "uuid",
  "phone_to": "+1234567890",
  "modulations": {
    "record": true,
    "transcribe": true,
    "translate": false,
    "survey": false,
    "synthetic_caller": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "call_id": "uuid"
}
```

**Errors:**
- `400` - Invalid input
- `401` - Authentication required
- `403` - Insufficient permissions or plan limits
- `500` - Server error

---

#### `GET /api/voice/config`

Get voice configuration for organization.

**Query Parameters:**
- `orgId` (required) - Organization ID

**Response:**
```json
{
  "success": true,
  "config": {
    "record": true,
    "transcribe": true,
    "translate": false,
    "survey": false,
    "synthetic_caller": false
  }
}
```

---

#### `PUT /api/voice/config`

Update voice configuration.

**Request Body:**
```json
{
  "orgId": "uuid",
  "modulations": {
    "record": true,
    "transcribe": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "config": { ... }
}
```

**Permissions:** Owner, Admin only

---

#### `GET /api/voice/targets`

List voice targets for organization.

**Query Parameters:**
- `orgId` (required) - Organization ID

**Response:**
```json
{
  "success": true,
  "targets": [
    {
      "id": "uuid",
      "phone_number": "+1234567890",
      "name": "Main Office",
      "is_active": true
    }
  ]
}
```

---

### Campaigns

#### `GET /api/campaigns`

List campaigns for organization.

**Query Parameters:**
- `orgId` (required) - Organization ID

**Response:**
```json
{
  "success": true,
  "campaigns": [...]
}
```

---

### Surveys

#### `GET /api/surveys`

List surveys for organization.

**Query Parameters:**
- `orgId` (required) - Organization ID

**Response:**
```json
{
  "success": true,
  "surveys": [...]
}
```

**Plan Required:** Insights, Global, Enterprise

---

### Secret Shopper

#### `GET /api/shopper/scripts`

List secret shopper scripts.

**Query Parameters:**
- `orgId` (required) - Organization ID

**Response:**
```json
{
  "success": true,
  "scripts": [...]
}
```

**Plan Required:** Insights, Global, Enterprise

---

### Webhooks

#### `POST /api/webhooks/signalwire`

SignalWire webhook handler (internal).

#### `POST /api/webhooks/assemblyai`

AssemblyAI webhook handler (internal).

---

### Health & Monitoring

#### `GET /api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "checks": [
    {
      "service": "database",
      "status": "healthy"
    }
  ]
}
```

#### `GET /api/health/env`

Environment variable validation (requires auth).

#### `GET /api/errors/metrics`

Error metrics and KPIs (requires auth).

---

### Real-time

#### `POST /api/realtime/subscribe`

Get real-time subscription configuration.

**Request Body:**
```json
{
  "organization_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "supabaseUrl": "...",
    "channels": [...]
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "id": "ERR_20260103_ABC123",
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "severity": "high"
  }
}
```

## Rate Limiting

API endpoints are rate-limited. Rate limit headers:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

**429 Too Many Requests** returned when limit exceeded.

## Idempotency

For `POST /api/voice/call`, include `Idempotency-Key` header to prevent duplicate calls:

```
Idempotency-Key: unique-key-here
```

---

## RBAC & Plan Gating

Endpoints enforce role-based access control and plan limits:

- **Roles**: Owner, Admin, Operator, Analyst, Viewer
- **Plans**: Base, Pro, Insights, Global

See `ARCH_DOCS/MASTER_ARCHITECTURE.txt` for full RBAC matrix.

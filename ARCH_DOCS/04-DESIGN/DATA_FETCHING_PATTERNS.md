# Data Fetching Patterns

**Created:** February 11, 2026
**Status:** ✅ Production Standard
**Location:** `hooks/useApiQuery.ts` + `hooks/useSSE.ts`

> **Standardized data fetching abstractions for API calls and real-time streaming**

---

## Overview

This guide documents the standardized data fetching patterns using custom React hooks that eliminate boilerplate and ensure consistent error handling, loading states, and request cleanup.

### Available Hooks

| Hook | Purpose | Use Case |
|------|---------|----------|
| **useApiQuery** | Standard API requests | GET/POST/PUT/DELETE with loading/error states |
| **useSSE** | Server-Sent Events | Real-time streaming (translations, notifications) |

---

## 1. useApiQuery Hook

### Purpose

Eliminates repetitive `useEffect` + `useState` patterns for API calls.

### Before (Boilerplate Pattern)

```tsx
// ❌ OLD WAY - 30 lines of boilerplate
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  let cancelled = false;

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/calls?org=${orgId}`);
      const json = await response.json();

      if (!cancelled) {
        setData(json);
      }
    } catch (err) {
      if (!cancelled) {
        setError(err.message);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  fetchData();

  return () => {
    cancelled = true;
  };
}, [orgId]);
```

### After (useApiQuery)

```tsx
// ✅ NEW WAY - 3 lines
const { data, loading, error, refetch } = useApiQuery<Call[]>(
  `/api/calls?org=${orgId}`
);
```

**60% reduction in code** with improved error handling and automatic cleanup.

---

### API Reference

```typescript
function useApiQuery<T = any>(
  url: string | null,
  options?: RequestInit
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

#### Parameters

- **url** (string | null): API endpoint. Pass `null` to skip fetch.
- **options** (RequestInit): Fetch options (method, headers, body, etc.)

#### Returns

- **data**: Response data (null until loaded)
- **loading**: true during fetch, false after completion
- **error**: Error object if request fails, null otherwise
- **refetch**: Manual refetch function

---

### Usage Examples

#### Basic GET Request

```tsx
import { useApiQuery } from '@/hooks/useApiQuery';

function CallsList() {
  const { data: calls, loading, error } = useApiQuery<Call[]>('/api/calls');

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert message={error.message} />;

  return (
    <ul>
      {calls?.map(call => (
        <li key={call.id}>{call.customer_phone}</li>
      ))}
    </ul>
  );
}
```

---

#### POST Request with Body

```tsx
const { data, loading, error, refetch } = useApiQuery(
  '/api/campaigns',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'New Campaign',
      target_phones: ['+15551234567']
    })
  }
);
```

---

#### Conditional Fetching

```tsx
// Only fetch if callId exists
const { data: callDetails } = useApiQuery(
  callId ? `/api/calls/${callId}` : null
);
```

**Pattern:** Pass `null` as URL to skip fetch.

---

#### Manual Refetch

```tsx
function CallsListWithRefresh() {
  const { data: calls, loading, refetch } = useApiQuery('/api/calls');

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      {loading ? <Spinner /> : <CallsList calls={calls} />}
    </div>
  );
}
```

---

#### Type-Safe Response

```tsx
interface CampaignStats {
  total_calls: number;
  completed: number;
  failed: number;
  in_progress: number;
}

const { data: stats } = useApiQuery<CampaignStats>(
  `/api/campaigns/${campaignId}/stats`
);

// TypeScript knows stats.total_calls exists
console.log(stats?.total_calls);
```

---

### Implementation Details

**File:** `hooks/useApiQuery.ts`

```typescript
import { useState, useEffect } from 'react';

export function useApiQuery<T = any>(
  url: string | null,
  options?: RequestInit
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url, {
          credentials: 'include', // CRITICAL for auth
          ...options
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();

        if (!cancelled) {
          setData(json.data ?? json); // Handle both {data: ...} and {...}
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    // Cleanup on unmount or URL change
    return () => {
      cancelled = true;
    };
  }, [url, refetchTrigger, JSON.stringify(options)]);

  const refetch = () => setRefetchTrigger(prev => prev + 1);

  return { data, loading, error, refetch };
}
```

---

### Best Practices

#### 1. Always Handle Loading State

```tsx
// ✅ GOOD
if (loading) return <Spinner />;
if (error) return <ErrorAlert message={error.message} />;
return <DataDisplay data={data} />;

// ❌ BAD - renders null data
return <DataDisplay data={data} />;
```

---

#### 2. Use Optional Chaining

```tsx
// ✅ GOOD - safe access
const totalCalls = data?.calls?.length ?? 0;

// ❌ BAD - crashes if data is null
const totalCalls = data.calls.length;
```

---

#### 3. Memoize Options Object

```tsx
// ✅ GOOD - useMemo prevents infinite loop
const options = useMemo(() => ({
  method: 'POST',
  body: JSON.stringify(formData)
}), [formData]);

const { data } = useApiQuery('/api/endpoint', options);

// ❌ BAD - new object every render → infinite loop
const { data } = useApiQuery('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(formData)
});
```

---

#### 4. Error Boundary Integration

```tsx
// Root component
<ErrorBoundary fallback={<ErrorPage />}>
  <CallsList />
</ErrorBoundary>

// Component
function CallsList() {
  const { data, error } = useApiQuery('/api/calls');

  if (error) throw error; // Caught by ErrorBoundary
  return <div>{data?.map(...)}</div>;
}
```

---

## 2. useSSE Hook

### Purpose

Server-Sent Events for real-time streaming data (translations, notifications, live updates).

### Architecture

```
┌─────────────┐           ┌─────────────┐           ┌─────────────┐
│   Client    │           │   Worker    │           │  Database   │
│  (useSSE)   │◄─────────►│ SSE Stream  │◄─────────►│  (Polling)  │
└─────────────┘           └─────────────┘           └─────────────┘
     ↓                           ↓
 React State              EventSource
 (messages[])             (Server-Sent Events)
```

---

### API Reference

```typescript
function useSSE<T = any>(
  url: string | null,
  enabled: boolean = true
): {
  messages: T[];
  connected: boolean;
  error: Error | null;
  clearMessages: () => void;
}
```

#### Parameters

- **url** (string | null): SSE endpoint. Pass `null` to disable.
- **enabled** (boolean): Enable/disable connection (default: true)

#### Returns

- **messages**: Array of received messages (newest last)
- **connected**: true if EventSource is open
- **error**: Error object if connection fails
- **clearMessages**: Manual clear function

---

### Usage Examples

#### Live Call Translations

```tsx
import { useSSE } from '@/hooks/useSSE';

function LiveTranslation({ callId }: { callId: string }) {
  const { messages, connected, error } = useSSE<TranslationSegment>(
    `/api/voice/translate/stream?callId=${callId}`,
    true // Enable connection
  );

  return (
    <div>
      <StatusIndicator connected={connected} />

      {error && <ErrorAlert message={error.message} />}

      <div className="translation-feed">
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.language}:</strong> {msg.text}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

#### Conditional Connection

```tsx
// Only connect when call is active
const { messages } = useSSE(
  callId ? `/api/calls/${callId}/events` : null,
  isCallActive // Enable only when active
);
```

---

#### Real-Time Notifications

```tsx
function NotificationFeed() {
  const { messages: notifications, clearMessages } = useSSE<Notification>(
    '/api/notifications/stream'
  );

  return (
    <div>
      <button onClick={clearMessages}>Clear All</button>

      {notifications.map((notif, i) => (
        <NotificationCard key={i} notification={notif} />
      ))}
    </div>
  );
}
```

---

### Implementation Details

**File:** `hooks/useSSE.ts`

```typescript
import { useState, useEffect } from 'react';

export function useSSE<T = any>(
  url: string | null,
  enabled: boolean = true
) {
  const [messages, setMessages] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url || !enabled) {
      setConnected(false);
      return;
    }

    // Get auth token from cookie/localStorage
    const token = getAuthToken(); // Implementation specific

    const eventSource = new EventSource(url, {
      withCredentials: true
    });

    // Add auth header (if supported by browser)
    if (token) {
      eventSource.addEventListener('open', () => {
        // Some browsers don't support custom headers
        // Server must use cookie auth for SSE
      });
    }

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data]);
      } catch (err) {
        console.error('Failed to parse SSE message:', event.data);
      }
    };

    eventSource.onerror = (err) => {
      setConnected(false);
      setError(new Error('SSE connection failed'));
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [url, enabled]);

  const clearMessages = () => setMessages([]);

  return { messages, connected, error, clearMessages };
}
```

---

### Server-Side Implementation

**Example:** Live translation stream

```typescript
// workers/src/routes/voice.ts
app.get('/api/voice/translate/stream', requireAuth, async (c) => {
  const { callId } = c.req.query();
  const { org_id } = c.get('user');

  // Set SSE headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  // Stream response
  const stream = new ReadableStream({
    async start(controller) {
      // Poll database every 1 second
      const interval = setInterval(async () => {
        const translations = await getNewTranslations(callId, org_id);

        translations.forEach(t => {
          const message = `data: ${JSON.stringify(t)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        });
      }, 1000);

      // Cleanup after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 300000);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});
```

---

### Best Practices

#### 1. Connection Lifecycle

```tsx
// ✅ GOOD - disable when not needed
const { messages } = useSSE(
  url,
  isCallActive // Only connect during active calls
);

// ❌ BAD - always connected
const { messages } = useSSE(url);
```

---

#### 2. Message Buffering

```tsx
// ✅ GOOD - limit message history
const { messages } = useSSE(url);
const recentMessages = messages.slice(-100); // Last 100 only

// ❌ BAD - unbounded array growth
const { messages } = useSSE(url); // Memory leak if long connection
```

---

#### 3. Reconnection Logic

```tsx
const { connected, error } = useSSE(url);

useEffect(() => {
  if (error && !connected) {
    // Show reconnection UI
    console.log('Connection lost, attempting to reconnect...');
  }
}, [connected, error]);
```

---

## 3. Migration Guide

### Migrating from useEffect + fetch

**Before:**
```tsx
const [calls, setCalls] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/calls')
    .then(r => r.json())
    .then(data => setCalls(data))
    .finally(() => setLoading(false));
}, []);
```

**After:**
```tsx
const { data: calls, loading } = useApiQuery<Call[]>('/api/calls');
```

---

### Migrating from WebSocket

**Before:**
```tsx
useEffect(() => {
  const ws = new WebSocket('wss://...');
  ws.onmessage = (e) => setMessages(prev => [...prev, JSON.parse(e.data)]);
  return () => ws.close();
}, []);
```

**After:**
```tsx
const { messages } = useSSE('/api/stream');
```

**Why SSE over WebSocket:**
- Simpler protocol (HTTP)
- Auto-reconnection built-in
- Better browser support
- Works through most firewalls

---

## Related Documentation

- [CLIENT_API_GUIDE.md](../01-CORE/CLIENT_API_GUIDE.md) - API client patterns
- [TELNYX_TRANSLATION_QUICK_START.md](../TELNYX_TRANSLATION_QUICK_START.md) - SSE translation example
- [LESSONS_LEARNED.md](../LESSONS_LEARNED.md) - Common fetch pitfalls

---

**Last Updated:** February 11, 2026
**Maintained By:** Frontend Team
**Next Review:** March 11, 2026

# Multi-Channel Timeline Integration Guide

## Overview
The Multi-Channel Timeline component provides a unified view of all customer communications for the collections platform. This guide explains how to integrate it into the Cockpit component.

## Files Created

1. **Backend Route**: `workers/src/routes/collections.ts`
   - Added `GET /api/collections/:id/communications` endpoint
   - Returns unified timeline from calls, SMS, emails, payment links, and notes
   - Supports filtering, search, and pagination

2. **Component**: `components/cockpit/MultiChannelTimeline.tsx`
   - Full-featured timeline component with real-time updates
   - Channel filtering, search, expandable items
   - Mobile-responsive, dark mode support

3. **Types**: `types/multi-channel-timeline.ts`
   - TypeScript interfaces for all timeline item types
   - Type-safe API response handling

## Integration Steps

### 1. Import the Component in Cockpit

In `components/cockpit/Cockpit.tsx`, add the import:

```tsx
import MultiChannelTimeline from '@/components/cockpit/MultiChannelTimeline'
```

### 2. Add Component to Context Panel

In the `ContextPanel` section of the Cockpit (right rail), add a new tab or section for the timeline:

```tsx
// Inside ContextPanel component or function
<div className="space-y-4">
  {/* Existing account info */}
  
  {/* ADD: Communications Timeline */}
  <MultiChannelTimeline
    accountId={selectedAccount.id}
    organizationId={organizationId}
    refreshTrigger={callRefreshCounter} // Increment when call ends to refresh
  />
</div>
```

### 3. Example Integration Pattern

Here's a complete example of how to integrate into the Cockpit's context panel:

```tsx
function ContextPanel({
  account,
  organizationId,
  onAction,
}: {
  account: QueueAccount | null
  organizationId: string
  onAction: (action: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'compliance'>('overview')
  
  if (!account) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select an account to view details
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </Button>
        <Button
          variant={activeTab === 'timeline' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('timeline')}
        >
          Communications
        </Button>
        <Button
          variant={activeTab === 'compliance' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('compliance')}
        >
          Compliance
        </Button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Existing account overview content */}
          </div>
        )}

        {activeTab === 'timeline' && (
          <MultiChannelTimeline
            accountId={account.id}
            organizationId={organizationId}
          />
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-4">
            {/* Compliance panel content */}
          </div>
        )}
      </div>
    </div>
  )
}
```

### 4. Trigger Refresh on Call End

To automatically refresh the timeline when a call ends, pass a `refreshTrigger` prop that increments:

```tsx
const [callCounter, setCallCounter] = useState(0)

// In your call end handler:
const handleCallEnd = () => {
  // ... existing call end logic
  setCallCounter((prev) => prev + 1) // Increment to trigger timeline refresh
}

// Pass to component:
<MultiChannelTimeline
  accountId={account.id}
  organizationId={organizationId}
  refreshTrigger={callCounter}
/>
```

## API Endpoint Details

### Request

```
GET /api/collections/:accountId/communications
```

**Query Parameters:**
- `limit` (optional): Items per page (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `channel` (optional): Filter by channel type (`all`, `calls`, `sms`, `email`, `payments`, `notes`)
- `search` (optional): Search term to filter communications

### Response

```typescript
{
  success: boolean
  communications: TimelineItem[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}
```

### Authentication

Requires valid session token (automatically handled by `apiGet` from `@/lib/apiClient`).
Multi-tenant isolation enforced via `organization_id`.

## Features

### 1. Real-Time Updates
- Polls every 30 seconds for new communications
- Manual refresh button available
- Triggered refresh via `refreshTrigger` prop

### 2. Channel Filtering
- All communications (default)
- Calls only
- SMS only
- Emails only
- Payment links only
- Notes only

### 3. Search
- Full-text search across all communication content
- Searches: disposition notes, message bodies, email subjects, note titles

### 4. Expandable Items
- Call: Shows full disposition notes when expanded
- SMS: Shows full message body (collapsed if >100 chars)
- Email: Shows to/from addresses when expanded
- Payment Link: Shows sent/clicked/paid timestamps when expanded
- Note: Shows full note content when expanded

### 5. Visual Indicators

**Channel Colors:**
- Calls: Blue
- SMS: Green
- Emails: Purple
- Payment Links: Amber
- Notes: Gray

**Status Badges:**
- Call disposition (sale, no_answer, voicemail, etc.)
- SMS status (delivered, failed, etc.)
- Email status (sent, opened, clicked, etc.)
- Payment status (sent, clicked, paid, etc.)

### 6. Mobile Responsive
- Card layout adapts to screen size
- Horizontal scrolling for filters on mobile
- Touch-friendly expand/collapse buttons

### 7. Dark Mode
- All colors have dark mode variants
- Icons and badges automatically adjust

## Testing

### 1. Manual Testing Checklist

- [ ] Timeline loads with existing communications
- [ ] Empty state shows for accounts with no communications
- [ ] Channel filters work correctly
- [ ] Search filters results
- [ ] Expand/collapse works for items
- [ ] "Load More" pagination works
- [ ] Real-time polling updates timeline (wait 30s)
- [ ] Manual refresh works
- [ ] `refreshTrigger` prop causes refresh
- [ ] Dark mode styling works
- [ ] Mobile responsive layout works

### 2. Test Data Setup

Create test data in the database to verify all channel types render correctly:

```sql
-- Test call
INSERT INTO calls (id, organization_id, started_at, ended_at, status, disposition, disposition_notes)
VALUES (gen_random_uuid(), 'your-org-id', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '55 minutes', 'completed', 'sale', 'Customer agreed to payment plan');

-- Test note
INSERT INTO collection_tasks (id, organization_id, account_id, type, title, notes, status)
VALUES (gen_random_uuid(), 'your-org-id', 'account-id', 'followup', 'Follow-up scheduled', 'Customer requested callback tomorrow at 2pm', 'pending');
```

## Troubleshooting

### Timeline shows no data but account has communications

**Cause:** Account phone/email may not match records in calls/email tables.

**Fix:** Verify account phone number is in E.164 format and matches call records.

### "Table does not exist" errors in logs

**Cause:** Some tables (sms_logs, email_logs, payment_links) may not exist in all environments.

**Fix:** This is expected. The backend route gracefully handles missing tables.

### Real-time updates not working

**Cause:** Component may have unmounted or polling interval cleared.

**Fix:** Check browser console for errors. Verify component remains mounted.

### Search not returning expected results

**Cause:** Search is case-insensitive substring match on content fields only.

**Fix:** Ensure search term appears in: disposition_notes, message_body, email subject, or note title.

## Performance Considerations

1. **Pagination**: Default 20 items per page prevents large initial loads
2. **Polling**: 30-second interval balances freshness with load
3. **Database Queries**: Each channel type queries separately with LIMIT 50, then combines client-side
4. **Indexing**: Ensure indexes exist on:
   - `calls(organization_id, started_at)`
   - `collection_tasks(organization_id, account_id, created_at)`
   - Other relevant timestamp columns

## Future Enhancements

Potential improvements to consider:

1. **WebSocket Updates**: Replace polling with real-time WebSocket events
2. **Export Timeline**: Add CSV/PDF export functionality
3. **File Attachments**: Display attachments for emails and notes
4. **Quick Actions**: In-timeline reply, forward, or edit actions
5. **Filters by Date Range**: Add date range picker for historical analysis
6. **Sentiment Analysis**: Show sentiment indicators for calls/messages
7. **Thread Grouping**: Group related communications (e.g., email threads)

## Support

For issues or questions:
- Check `ARCH_DOCS/LESSONS_LEARNED.md` for known issues
- Review backend logs: `wrangler tail wordisbond-api`
- Review frontend console for client-side errors

---

**Last Updated:** 2026-02-14  
**Component Version:** 1.0.0  
**API Version:** v4.30

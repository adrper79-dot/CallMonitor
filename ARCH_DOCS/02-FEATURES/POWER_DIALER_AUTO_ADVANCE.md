# Power Dialer Auto-Advance — Integration Guide

## Overview
The Power Dialer Auto-Advance feature enables agents to automatically dial the next contact after setting a disposition code, improving productivity in high-volume calling scenarios.

## Files Modified/Created

### 1. QuickDisposition.tsx (Updated)
**Location:** `components/voice/QuickDisposition.tsx`

**New Props:**
- `nextAccountId?: string` — Account ID for next contact (for compliance checks)
- `nextAccountPhone?: string` — Phone number for next contact
- `onCheckCompliance?: (accountId: string, phone: string) => Promise<boolean>` — Compliance checker function

**New Exports:**
- `setAutoAdvancePrefs(enabled: boolean, delay: number)` — Save user preferences

### 2. AutoAdvanceSettings.tsx (New)
**Location:** `components/voice/AutoAdvanceSettings.tsx`

Standalone settings panel component for managing auto-advance preferences.

## Integration Steps

### Step 1: Update Parent Component (e.g., VoiceOperationsClient.tsx)

```tsx
import { apiGet } from '@/lib/apiClient'

// Add state for next account
const [nextAccount, setNextAccount] = useState<{
  id: string
  name: string
  phone: string
  balance: string
} | null>(null)

// Fetch next account from DailyPlanner queue
useEffect(() => {
  async function fetchNextAccount() {
    try {
      const res = await apiGet('/api/productivity/daily-planner')
      const tasks = res.planner?.due_tasks || []
      if (tasks.length > 0) {
        setNextAccount({
          id: tasks[0].account_id,
          name: tasks[0].account_name,
          phone: tasks[0].primary_phone,
          balance: tasks[0].balance_due.toString(),
        })
      }
    } catch (err) {
      console.error('Failed to fetch next account:', err)
    }
  }
  
  if (dispositioned) {
    fetchNextAccount()
  }
}, [dispositioned])

// Add compliance checker function
async function checkCompliance(accountId: string, phone: string): Promise<boolean> {
  try {
    const data = await apiGet(
      `/api/compliance/pre-dial?accountId=${accountId}&phone=${encodeURIComponent(phone)}`
    )
    const checks = data.checks || []
    return checks.every((c: any) => c.status !== 'fail')
  } catch (err) {
    console.error('Compliance check failed:', err)
    return false // Fail-safe: block if can't verify
  }
}

// Update QuickDisposition usage
<QuickDisposition
  callId={activeCallId}
  onDisposition={handleDisposition}
  onDialNext={handleDialNext}
  showDialNext={true}
  nextContactName={nextAccount?.name}
  nextContactBalance={nextAccount?.balance}
  nextAccountId={nextAccount?.id}
  nextAccountPhone={nextAccount?.phone}
  onCheckCompliance={checkCompliance}
  disabled={false}
/>
```

### Step 2: Add Settings Panel to Voice Operations Settings

```tsx
import AutoAdvanceSettings from '@/components/voice/AutoAdvanceSettings'

// In your settings modal or panel
<AutoAdvanceSettings />
```

### Step 3: Update handleDialNext to Clear State

```tsx
const handleDialNext = () => {
  setActiveCallId(null)
  activeCall.reset()
  setDispositioned(false)
  setNextAccount(null) // Clear next account after dial
}
```

## Features

### Core Functionality
- ✅ Auto-advance after disposition with configurable delay (1-5 seconds)
- ✅ Countdown timer with visual feedback
- ✅ Cancel option (ESC key or button click)
- ✅ Compliance checks before auto-dial
- ✅ Toast notifications for errors
- ✅ localStorage persistence for user preferences

### User Experience
- ✅ Keyboard shortcuts preserved (1-7 for dispositions, N for manual dial, ESC to cancel)
- ✅ Visual countdown with spinner
- ✅ Next contact preview during countdown
- ✅ Graceful fallback when queue is empty
- ✅ Disabled state during countdown to prevent conflicts

### Compliance & Safety
- ✅ Pre-dial compliance checks (FDCPA, TCPA, 7-in-7)
- ✅ Fails safe if compliance check errors
- ✅ Manual override always available
- ✅ Clear user notifications

## User Workflow

1. Agent completes call and presses disposition key (1-7)
2. System shows countdown timer (default 2 seconds)
3. During countdown:
   - Agent sees next contact name and balance
   - Can press ESC or click Cancel to stop
   - Can press N to dial immediately
4. After countdown:
   - System runs compliance checks
   - If passed: auto-dials next contact
   - If failed: shows error notification
5. Agent receives next call or manual dial prompt

## Settings Configuration

Users can configure:
- **Enable/Disable:** Toggle auto-advance on/off
- **Delay:** Choose 1-5 seconds delay before auto-dial
- **Per Session:** Settings apply to current browser session

Settings persist in localStorage across sessions.

## Error Handling

- **Empty Queue:** Toast notification — "No next contact — queue is empty"
- **Compliance Failed:** Toast warning — "Auto-dial blocked — contact failed compliance checks"
- **Network Error:** Toast error — "Could not verify compliance — please dial manually"
- **Dial Failed:** Toast error — "Auto-dial failed — could not initiate next call"

All errors are also logged to console for debugging.

## Testing Checklist

- [ ] Disposition triggers countdown
- [ ] Countdown displays correctly (3, 2, 1)
- [ ] ESC key cancels countdown
- [ ] Cancel button cancels countdown
- [ ] N key during countdown cancels and dials immediately
- [ ] Auto-dial works when compliance passes
- [ ] Auto-dial blocks when compliance fails
- [ ] Empty queue shows proper notification
- [ ] Settings toggle saves to localStorage
- [ ] Delay slider updates correctly (1-5s)
- [ ] Manual dial (N key) still works without auto-advance
- [ ] Disabled state during countdown prevents double-disposition

## Architecture Notes

### State Management
- Uses React hooks (useState, useEffect, useCallback, useRef)
- Timers managed with refs to prevent memory leaks
- Cleanup on unmount to prevent orphaned timers

### localStorage Keys
- `wb-auto-advance-enabled`: boolean string
- `wb-auto-advance-delay`: number string (1-5)

### Integration Points
- DailyPlanner for next account queue
- PreDialChecker for compliance validation
- apiClient for API calls
- useToast for notifications

## Future Enhancements (Optional)

- [ ] Configurable auto-advance per campaign
- [ ] Skip auto-advance for specific disposition codes
- [ ] Audio notification before auto-dial
- [ ] Auto-advance statistics tracking
- [ ] Team-level default settings

---

**Version:** 2.0  
**Author:** GitHub Copilot  
**Date:** February 14, 2026

# Word Is Bond — User Training Guide

Audience: frontline users, team leads, and admins.

Goal: get users productive on Day 1 with clear, role-based workflows.

For fast onboarding, use the one-page Agent Quick Card: `docs/AGENT_QUICK_CARD.md`.

---

## 1) What success looks like

By the end of this guide, a user should be able to:

- Complete onboarding
- Use their role shell correctly
- Work accounts in queue/call workflows
- Use quick actions (note, callback, dispute, payment link)
- Resolve common issues without escalation

---

## 2) Onboarding SOP (first login)

### 2.1 Sign in

1. Go to https://wordis-bond.com
2. Sign in with your assigned credentials

If sign-in fails, jump to troubleshooting section 8.1.

### 2.2 Complete onboarding steps

Complete these in order:

1. Plan selection
2. Business configuration
3. Number provisioning setup
4. Compliance settings
5. Email channel setup (optional): Gmail OAuth or Outlook OAuth
6. Import contacts
7. Place test call
8. Invite team and launch

If your org is SMS-only, skip step 5 and continue. Email OAuth can be configured later in `/settings/integrations`.

### 2.3 Number provisioning behavior (important)

Current behavior after setup:

- Platform provisions a **5-number Telnyx pool** for the organization
- Outbound voice and SMS use round-robin selection from the pool
- UI may still display one primary number for compatibility

### 2.4 Onboarding validation checklist

Use this before handing a user to production:

- [ ] User can sign in and reach workspace
- [ ] User sees role-appropriate left navigation
- [ ] User can open `/accounts`
- [ ] User can open `/work/call`
- [ ] Outbound workflow is available
- [ ] Email channel decision is explicit (Gmail connected, Outlook connected, or SMS-only skip)
- [ ] User knows where to configure/reconnect later: `/settings/integrations`

---

## 3) Role shell usage (by job function)

Navigation is role-based. Missing menu items are usually role assignment, not a bug.

## 3.1 Agent shell — execution workflow

Primary pages:

- Work Queue: `/work/queue`
- Call Workspace: `/work/call`
- Accounts: `/accounts`

Daily runbook:

1. Open **Work Queue** and select highest-priority account
2. Open account in **Call Workspace**
3. Run call/outreach
4. Complete one quick action before leaving account:
   - Add note
   - Schedule callback
   - File dispute
   - Send payment link
5. Move to next account

Minimum documentation standard:

- Every completed interaction has a note
- Every unresolved interaction has a callback or explicit status update

## 3.2 Manager shell — coaching and throughput

Primary pages:

- Command: `/command`
- Live Board: `/command/live`
- Scorecards/Coaching: `/command/scorecards`, `/command/coaching`
- Analytics: `/analytics`

Daily runbook:

1. Start in Live Board
2. Check queue completion and unresolved follow-ups
3. Review scorecards/coaching opportunities
4. Validate campaign and outcome trends in analytics

## 3.3 Admin shell — setup and governance

Primary pages:

- Settings: `/settings`
- Teams: `/teams`
- Admin tools: `/admin`

Weekly runbook:

1. Verify users and role assignments
2. Review integrations/notification channels
3. Confirm onboarding and telephony settings for new org/users
4. Confirm optional email OAuth state for each new org (Gmail/Outlook connected or intentionally skipped)

---

## 4) Feature usage SOP

## 4.1 Work Queue and account tabs

Use for account prioritization and case context.

Expected operator behavior:

- Use queue ordering (do not cherry-pick except approved exceptions)
- Review account tabs before call:
  - Overview
  - Calls
  - Payments
  - Compliance
  - Notes

## 4.2 Call Workspace

Use for active outreach and in-call actions.

Expected operator behavior:

- Confirm account context before calling
- Log outcomes immediately after interaction
- Do not leave account without next step recorded

## 4.3 Quick Actions

### Add Note (required habit)

Use this note structure:

1. Interaction summary
2. Customer position/response
3. Next action + owner + timing

### Schedule Callback

Required fields:

- Callback date/time
- Short reason/context

### File Dispute

Use when customer disputes identity, amount, or obligation.

Required fields:

- Dispute type
- Clear reason/context

### Send Payment Link

Use at commitment moments.

Required fields:

- Amount
- Correct account context

---

## 5) Messaging and payment link basics

## 5.1 Messaging

- Keep messages short and actionable
- Prefer templates for consistency
- Use account context to avoid sending from wrong workflow

## 5.2 Payment links

Standard flow:

1. Create link with amount/description
2. Send immediately after agreement
3. Confirm status in payment views

---

## 6) Day-1 quick training script

Use this in live onboarding sessions:

1. Sign in
2. Confirm role shell menus
3. Open Work Queue
4. Open one account
5. Add one note
6. Schedule one callback
7. Send one payment link

If all seven complete, user is operational.

---

## 7) End-of-day quality check

For agents:

- No worked account left without note or next step
- Callback commitments are scheduled, not remembered manually

For managers:

- Exceptions list created for unresolved critical accounts
- Coaching follow-ups assigned where needed

---

## 8) Light troubleshooting (simple, user-level)

## 8.1 Cannot sign in

Check:

- Correct URL (`https://wordis-bond.com`)
- Correct credentials

Then:

- Use reset password
- Ask admin to verify account status

## 8.2 Missing navigation items

Usually role or org context issue.

Check:

- Role assignment (agent/manager/admin)
- Correct organization context

Then:

- Ask admin to verify role/org membership

## 8.3 Calls/messages failing after onboarding

Check:

- Onboarding completed
- Number provisioning completed

Then:

- Retry after short wait
- Escalate to admin/support for telephony verification

## 8.4 Quick action opens but does not complete

Check:

- Required fields are complete
- Correct account is selected

Then:

- Retry once
- Refresh page and retry
- Capture account ID + action + timestamp and escalate if repeated

## 8.5 Payment link not sent

Check:

- Amount entered
- Account context selected

Then:

- Retry in call/account workspace
- Escalate to admin to verify payment configuration

## 8.6 Cannot find account

Check:

- Search by name/phone
- Correct organization context

Then:

- Confirm account exists/imported
- Re-import or create account if missing

---

## 9) Escalation standard

Escalate when any of the following persist:

- Repeated 401/403 access failures
- Calls/messages failing across multiple accounts
- Role shell not matching assigned role
- Data mismatch affecting customer workflow

Include in escalation ticket:

- Role
- Organization
- URL/page
- Account ID (if relevant)
- Local timestamp
- Exact steps taken


If all are complete, the user is operational.

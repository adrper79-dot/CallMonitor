# Word Is Bond: The User's Manual

**For the Discerning Operations Professional**

---

## A Note to the Reader

You're holding the manual for something different.

Not another "cloud platform" promising to "leverage synergies" or "revolutionize workflows." That's for the trade show circuit.

Word Is Bond does exactly one thing, and does it impeccably: **it remembers what happened on your calls — correctly — when it matters.**

Think of us as the flight recorder for business conversations. When everything goes sideways and someone asks "what actually happened on that call?" — you'll have an answer. Not a guess. Not an AI summary. The real thing.

We built this for people who understand that evidence beats opinions, every time.

---

## Part I: What You're Actually Getting

### The Architecture (In Plain English)

Most call tools are tape recorders with ambition. They capture audio, maybe transcribe it, definitely try to sell you "insights."

We're something else entirely.

**Word Is Bond is a system of record.**

Every call creates an immutable chain of artifacts — recording, transcript, translation, evidence manifest — each with full provenance. Who created it. When. From what inputs. Whether it's legally defensible or just helpful.

When your lawyer asks "can you prove that?" — the answer is yes.

### What Makes This Different

Three architectural decisions that matter:

**1. Two-Layer Design**

We separate ephemeral assists from canonical evidence.

Live translation during the call? That's assist. Helpful in the moment, but not recorded. It's the conversation lubricant.

Post-call transcript from AssemblyAI? That's canonical. Immutable, provenance-tracked, legally defensible. That's the evidence.

Most vendors blur this line. We keep it sharp.

**2. Vendor Independence**

SignalWire handles media. AssemblyAI handles intelligence. Either can be swapped tomorrow without touching your data.

No lock-in. No proprietary formats. No "our AI is magic" nonsense.

You own your call records. We just make sure they're correct.

**3. Immutability Where It Counts**

Source recordings? Never modified.  
Canonical transcripts? Append-only.  
Evidence manifests? Cryptographically hashed.

AI can assist, but it never touches the source of truth.

---

## Part II: Getting Started (The Gentleman's Approach)

### Prerequisites

You'll need:
- A Business plan (or higher)
- Owner or Admin role
- A passing familiarity with phone numbers
- Reasonable expectations about AI

If you're expecting magic, buy a wand. If you want authoritative call records, keep reading.

### First Steps

**1. Log In**

Navigate to `voxsouth.online` and authenticate. We support OAuth (Google, Azure, Twitter, Facebook) or classic email/password.

**2. Navigate to Voice Operations**

Click "Voice" in the navigation. You'll see a three-column interface:
- Left: Call history
- Center: Controls
- Right: Activity feed

This is your command center.

**3. Configure Your Preferences**

In the center column, find "Call Features." These aren't your grandmother's checkboxes — each one represents a different artifact in your evidence chain.

---

## Part III: Features (And What They Actually Do)

### Source Recording

**What it says:** "Immutable call audio"

**What it means:** We capture the raw audio stream and store it permanently. No modifications, no enhancements, no "cleaning up background noise."

Why? Because when someone disputes what was said, you need the original, not our interpretation of it.

**Toggle this ON if:** You need evidence.  
**Toggle this OFF if:** You're just testing the dial tone.

---

### Canonical Transcript

**What it says:** "AssemblyAI authoritative transcript"

**What it means:** Post-call, we send your recording to AssemblyAI for transcription. This becomes the authoritative text record. Speaker labels, timestamps, sentiment analysis — the works.

**Why AssemblyAI?** They have 93.4% accuracy on English. That's not marketing fluff; that's Word Error Rate on public benchmarks.

**Processing time:** 2-10 minutes after the call ends.

**Toggle this ON if:** Words matter.  
**Toggle this OFF if:** You're making social calls.

---

### Live Translation (Preview)

**What it says:** "Real-time assist (preview only)"

**What it means:** During the call, an AI listens and translates in real-time. Spanish caller, English listener — everyone hears their own language with 1-3 second latency.

**Critical distinction:** This is assist, not evidence. The live translation isn't recorded. It's ephemeral. It helps you have the conversation; the canonical transcript provides the evidence.

**When to use it:** Multilingual customers, international calls, emergency situations.

**When to skip it:** English-only calls, or when you don't want AI in the loop.

**Business plan required.** This isn't free. SignalWire AI Agents cost us $500/month, and we're not charging you extra — yet.

---

### Post-Call Translation

**What it says:** "Authoritative translation from canonical transcript"

**What it means:** After the call, we translate the canonical transcript into your target language. This one goes in the evidence bundle.

**Difference from live translation:** This is authoritative. This one matters in court.

---

### After-Call Survey

**What it says:** "Automated survey with AI Survey Bot"

**What it means:** When the call ends, an AI-powered voice bot automatically calls back and asks your survey questions. Collects responses. Stores them. Emails you the results.

**How it works:**
1. Call ends
2. 30 seconds later, callback initiated
3. AI bot asks your questions
4. Responses recorded and scored
5. Results in your inbox within 2 minutes

**Insights plan required.** Quality feedback isn't free.

---

### Secret Shopper

**What it says:** "AI caller with scoring"

**What it means:** The AI makes the call, follows your script, evaluates responses, and scores performance.

**Use case:** Mystery shopping, compliance checks, script adherence, competitive intelligence.

**This is Bond. James Bond. But for phone calls.**

---

## Part IV: Making a Call (The Main Event)

### The Standard Approach

**Step 1:** Enter the target number  
Format: E.164 (that's `+12025551234` for the uninitiated)

**Step 2:** Select your features  
Enable what matters. Disable what doesn't.

**Step 3:** Click "Start Call"  
The button is large. It's red. You can't miss it.

**Step 4:** Wait for connection  
2-5 seconds typically. SignalWire is fast.

**Step 5:** Have your conversation  
Say what you need to say. We'll remember it.

**Step 6:** Hang up  
The call ends. Processing begins automatically.

### The Sophisticated Approach (Voice Targets)

If you're calling the same numbers repeatedly, create voice targets.

**Voice target** = phone number + name + default settings.

Save it once, call it forever. Like a phone book, but less obsolete.

**How:**
1. Click "Add Number" in the left sidebar
2. Enter phone, name, description
3. Select as active target
4. Click "Call"

Your target's settings apply automatically. No configuration hunting.

---

## Part V: After the Call (Where the Magic Happens)

### The Artifact Timeline

Every call generates artifacts in a specific order:

```
Call (0 seconds)
  ↓
Recording (1-5 minutes after call)
  ↓
Canonical Transcript (2-10 minutes after recording)
  ↓
Translation (2-5 minutes after transcript)
  ↓
Evidence Manifest (immediately after translation)
```

Each artifact links to its predecessor. Each has provenance. Each is immutable.

This isn't a feature. This is architecture.

### Reviewing Call Details

Click any call in the left sidebar. The center column shows everything:

**Timeline Tab:** Chronological events  
**Transcript Tab:** Full text with speaker labels  
**Translation Tab:** Translated transcript  
**Recording Tab:** Audio player  
**Evidence Tab:** Legal-grade manifest  
**Notes Tab:** Your annotations

Everything you need to reconstruct what happened.

### Evidence Review Mode

When disputes arise (and they will), click "Review Mode."

**What you get:**
- Read-only view (no accidental edits)
- Timeline with full provenance
- Authority badges on each artifact
- "Why this score?" explanations
- One-click evidence export

This is where ops managers become heroes.

### Exporting Evidence

The "Export Evidence Bundle" button creates a ZIP containing:

- `recording.wav` — Source audio (immutable)
- `transcript.txt` — Canonical transcript (AssemblyAI)
- `timeline.json` — Full event timeline with provenance
- `manifest.json` — Evidence manifest (hashed)
- `README.txt` — Human-readable summary

Hand this to legal. Hand this to HR. Hand this to external auditors.

It's complete, it's defensible, and it doesn't require your ops team to explain database schemas.

---

## Part VI: Advanced Topics (For the Ambitious)

### Live Translation: A User's Guide

**When it works brilliantly:**
- One-on-one calls
- Clear speakers
- Structured conversation
- Languages: English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Russian

**When it's merely good:**
- Multiple speakers (if they take turns)
- Heavy accents
- Technical jargon

**When to skip it:**
- Conference calls with 5+ people
- Background noise louder than conversation
- Languages we don't support yet

**The latency question:** 1-3 seconds typical. Noticeable? Yes. Usable? Absolutely. Better than a human interpreter? Usually.

**The voice cloning question:** Experimental. We're testing whether SignalWire can preserve voice characteristics in translation. Try it. Judge for yourself. We're not making promises here.

### Survey Bot: The Art of Automated Feedback

**Writing good survey questions:**

**Bad:** "How did we do?"  
**Good:** "On a scale of 1 to 5, how satisfied were you with today's service?"

**Bad:** "Any feedback?"  
**Good:** "What's one thing we could improve for next time?"

The AI bot is sophisticated, but it's not a therapist. Ask specific questions. Get specific answers.

**Voice selection matters.** Match the bot voice to your brand. Professional services? Use English-Spore. Latin American market? Spanish-Alberto.

**Timing matters.** Survey triggers 30 seconds after call ends. Not immediately (too abrupt). Not hours later (they've forgotten).

### Secret Shopper: Mystery Shopping at Scale

**The script is everything.**

Write it like you're briefing a human. Include:
- What to say
- When to wait for response
- What information to gather
- How to close naturally

**The AI will:**
- Follow your script
- Adapt to responses
- Score performance
- Flag compliance issues

**The AI won't:**
- Wing it
- Make up information
- Pretend to be human (it identifies as AI if asked)

**Ethical note:** Check your local laws on recording. Some jurisdictions require two-party consent. We handle the technical compliance (we identify as recording). You handle the legal compliance.

---

## Part VII: Plans & Capabilities

### What Each Plan Gets You

**Base Plan:**
- Call execution
- Recording
- Basic reporting

**Pro Plan:**
- Everything in Base
- Canonical transcripts
- Email artifacts
- Basic analytics

**Business Plan:**
- Everything in Pro
- **Live translation (preview)**
- Advanced analytics
- Priority support

**Enterprise Plan:**
- Everything in Business
- Custom integrations
- Dedicated support
- SLA guarantees
- Volume pricing

### Feature Gating (And Why It Exists)

We gate features by plan tier.

Not because we're greedy. Because these features cost us real money.

Live translation? $500/month to SignalWire.  
Canonical transcripts? $0.0042/minute to AssemblyAI.  
Evidence manifests? Storage and compute costs.

The math is simple: higher plans subsidize expensive features.

---

## Part VIII: Troubleshooting (When Things Go Sideways)

### "Live Translation toggle isn't visible"

**Check:** Organization plan  
**Fix:** Upgrade to Business plan

**Check:** Database migration  
**Fix:** Admin must run migration

**Check:** Browser cache  
**Fix:** Hard refresh (Ctrl+Shift+R)

### "Call fails immediately"

**Check:** Phone number format  
**Fix:** Use E.164 format: `+12025551234`

**Check:** SignalWire credits  
**Fix:** Top up account

**Check:** From number configured  
**Fix:** Add caller ID in settings

### "No translation during call"

**Check:** Languages selected  
**Fix:** Choose both "From" and "To" languages

**Check:** SignalWire AI Agent enabled  
**Fix:** Contact SignalWire support

**Check:** SWML endpoint logs  
**Fix:** Check Vercel logs for errors

### "Transcript is missing"

**Check:** Time elapsed  
**Fix:** Wait 2-10 minutes, refresh

**Check:** Recording delivered  
**Fix:** Verify recording in database

**Check:** AssemblyAI credits  
**Fix:** Admin checks billing

### "I want to disable all AI"

**Good news:** You can.

Settings → AI Control & Independence → Toggle everything OFF

Source recordings remain. Everything else: manual review.

This is by design. You own your data. We make that real.

---

## Part IX: Best Practices (Hard-Won Lessons)

### On Recording Everything

**Don't.**

Record what matters. Skip internal calls, skip test calls, skip calls with your mom.

Storage is cheap, but not free. More importantly, when you need to find something, you don't want to search through 10,000 recordings.

**Record:** Customer calls, support calls, sales calls, compliance-monitored calls  
**Skip:** Internal status updates, lunch plans, birthday party invites

### On Translation

**Specify languages when you can.**

Auto-detection works, but adds ~500ms latency. If you know the caller speaks Spanish, just select Spanish.

Small optimization. Noticeable difference.

### On Survey Questions

**Three is the magic number.**

One question: You look lazy.  
Three questions: Perfect balance.  
Seven questions: Nobody finishes.

Ask what matters. Skip the rest.

### On Evidence Export

**Export early, export often.**

When a call matters, export the evidence immediately. Don't wait for the dispute to start.

Archive it. Date-stamp the folder. Sleep better knowing you have the proof.

---

## Part X: The Chrome Extension (Click-to-Call for Sophisticates)

### What It Does

Detects phone numbers on any webpage. Hover over them. Two options appear:

**📞 Call:** Initiates call immediately  
**📅 Schedule:** Opens scheduling page

That's it. No bloat. No "AI-powered insights." Just efficient execution.

### Where It Shines

**Use cases:**
- CRM pages (HubSpot, Salesforce)
- Support tickets (Zendesk, Intercom)
- Customer databases
- Contact directories
- Anywhere phone numbers appear

**One click. Call connected. Evidence recorded.**

This is the power of good design.

### Installation

1. Download from Chrome Web Store (or load unpacked if you're feeling adventurous)
2. Grant permissions
3. Sign in to Word Is Bond
4. Start clicking numbers

No configuration. No setup wizard. It just works.

---

## Part XI: Security (Because You Should Ask)

### What We Don't Do

**We don't:**
- Store API keys in the extension
- Write directly to your database
- Bypass your permissions
- Trust the client

The extension is treated as potentially hostile. Every request is authenticated, validated, and audited server-side.

This isn't paranoia. This is architecture.

### What We Do

**We do:**
- Encrypt in transit (TLS/SRTP)
- Hash evidence manifests
- Log every action with actor attribution
- Store recordings with immutability guarantees
- Let you disable any AI component

**Kill-switch philosophy:** You can turn off every piece of AI, and the system still works. Source recordings remain. Manual review is always an option.

### Compliance Notes

**HIPAA:** Not compliant (AI processing involves third parties)  
**GDPR:** Compliant (with proper DPAs)  
**PCI-DSS:** Don't record payment card numbers  
**Two-party consent:** Check local laws, we identify as recording

We're transparent about limitations. That's more valuable than false certifications.

---

## Part XII: The WebRPC API (For Power Users)

### What Is WebRPC?

A privileged, programmatic control surface for automation.

**Not:**
- A public API
- An SDK free-for-all
- A database pass-through

**Is:**
- Authenticated RPC interface
- Maps to existing orchestration actions
- Fully audited and rate-limited

### Supported Methods

```
call.place       — Start a call
call.hangup      — End current call
call.mute        — Mute microphone
call.unmute      — Unmute microphone
call.hold        — Put call on hold
call.resume      — Resume held call
call.dtmf        — Send DTMF tones
session.ping     — Keepalive heartbeat
session.end      — End session
```

Each method maps to existing backend actions. No shortcuts. No bypasses.

### Usage Example

```json
POST /api/webrpc

{
  "id": "req_abc123",
  "method": "call.place",
  "params": {
    "to_number": "+12025551234",
    "from_number": "+17062677235",
    "modulations": {
      "record": true,
      "transcribe": true
    }
  }
}
```

**Response:**
```json
{
  "id": "req_abc123",
  "result": {
    "call_id": "uuid",
    "call_sid": "CAxxxx",
    "status": "initiating"
  }
}
```

### Authentication

**Session-based:** Use `credentials: 'include'` for web clients  
**API key:** Add `X-API-Key` header for automation (planned)

**Rate limit:** 100 requests/minute per user

### When to Use WebRPC

**Good use cases:**
- CI/CD pipelines
- Internal automation
- Custom integrations
- Advanced workflows

**Bad use cases:**
- Replacing the UI entirely
- Building a competitor
- Circumventing rate limits

---

## Part XIII: The Product Philosophy (Why We Built This)

### The Problem We Saw

Every operations team has the same three problems:

**1. "What actually happened on that call?"**  
They have recordings. Maybe transcripts. But connecting dots requires archaeology.

**2. "Can you prove it?"**  
They have AI summaries. Opinion-laden dashboards. Nothing they'd show a judge.

**3. "Why does our call stack have seventeen vendors?"**  
They have RingCentral for phones, Gong for coaching, Rev for transcripts, someone's nephew's startup for "AI insights."

### The Solution We Built

**One system. Clear hierarchy. Evidence over opinions.**

Calls create recordings.  
Recordings create transcripts.  
Transcripts create translations.  
Everything creates evidence manifests.

The chain is clear. The provenance is tracked. The authority is explicit.

When someone asks "what happened?" — you show them. When they ask "can you prove it?" — you export it. When they ask "how do you know?" — you trace the provenance.

### What We're NOT

We're not:
- A phone system replacement
- An AI insights platform
- A CRM
- A magic black box

**We're call memory.** That's it. That's enough.

---

## Part XIV: FAQ (The Questions Everyone Asks)

**Q: Is the AI listening to my calls all the time?**

Only when you enable it. Toggle OFF transcription, and the AI never sees your audio.

**Q: Can I delete recordings?**

Yes, but it's logged. Immutability applies to modifications, not deletion. We're not in the business of forcing you to keep data you don't want.

**Q: How long do you store recordings?**

As long as you want. We don't auto-delete. You control the retention policy.

**Q: What if AssemblyAI shuts down?**

We swap to Deepgram. Or Whisper. Or any other transcription service. That's why we don't own the recordings — you do.

**Q: Can I export everything?**

Yes. ZIP file. One click. Everything.

**Q: Is this overkill for a small business?**

Depends. Do you need to prove what happened, or just remember vaguely? 

If it's the former, this is appropriate. If it's the latter, use RingCentral.

**Q: What happens if I don't pay my bill?**

Your data remains accessible (read-only). No new calls. No new transcripts. But your evidence stays evidence.

We don't hold your data hostage. That's not our style.

---

## Part XV: A Final Word

You bought this because you're serious.

Serious about quality. Serious about evidence. Serious about doing the job correctly.

We built it the same way.

No shortcuts. No fake promises. No "trust our AI" hand-waving.

Just authoritative call records when you need them — which, if you're reading this, is probably often.

**Welcome to Word Is Bond.**

The call will be over before you know it. But we'll remember exactly what was said.

---

## Appendix: Technical Reference

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (obviously)
- JavaScript enabled
- Cookies enabled for authentication

### Supported Browsers
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Supported Phone Formats
- E.164 international format
- US numbers: +1XXXXXXXXXX
- International: +[country code][number]

### Supported Languages (Live Translation)
English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Russian

### Processing Times
- Call initiation: 2-5 seconds
- Recording delivery: 1-5 minutes post-call
- Transcript generation: 2-10 minutes post-recording
- Translation: 2-5 minutes post-transcript

### Support Contacts
- Technical support: support@voxsouth.online
- Billing questions: billing@voxsouth.online
- Sales inquiries: sales@voxsouth.online

---

**Version 1.0** | January 2026 | Word Is Bond, Inc.

*Remember what was said. Prove what happened. That's the promise.*

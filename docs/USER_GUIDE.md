# Word Is Bond: The User's Manual

**For the Discerning Operations Professional Who Knows That Talk Is Cheap, But Proof Is Priceless**

---

## A Note to the Reader

🎯 **Welcome, fellow evidence enthusiast.**

You're not holding a manual. You're holding the keys to a time machine that only goes backward — and only to phone calls you actually made.

Not another "cloud platform" promising to "leverage synergies" or "revolutionize workflows." (If you wanted corporate buzzword bingo, you'd be reading a different doc.)

Word Is Bond does exactly one thing, and does it impeccably: **it remembers what happened on your calls — correctly — when it matters most.**

Think of us as the flight recorder for business conversations. When everything goes sideways and someone asks "what actually happened on that call?" — you'll have an answer. Not a guess. Not an AI fever dream. **The real thing.**

We built this for people who understand that evidence beats opinions, every time. Also, for people who've been burned by the phrase "I never said that."

_(We know you've been burned. They all have.)_

---

## Part I: What You're Actually Getting

### The Architecture (In Plain English)

Most call tools are tape recorders with ambition. They capture audio, maybe transcribe it, definitely try to sell you "insights."

We're something else entirely.

**Word Is Bond is a system of record.** 📜

Every call creates an immutable chain of artifacts — recording, transcript, translation, evidence manifest — each with full provenance. Who created it. When. From what inputs. Whether it's legally defensible or just helpful.

When your lawyer asks "can you prove that?" — the answer is yes.

_(And you get to say it with a confident smile.)_

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

- A Business plan (or higher) — because good evidence isn't free
- Owner or Admin role — with great power comes great recordkeeping
- A passing familiarity with phone numbers — we believe in you
- Reasonable expectations about AI — it's smart, not psychic

If you're expecting magic, buy a wand. If you want authoritative call records, keep reading.

🎪 **Fun fact:** The average user makes their first "I'm so glad I recorded that" statement within 3 days.

### First Steps

**1. Log In** 🔐

Navigate to `wordis-bond.com` and authenticate. We support OAuth (Google, Azure, Twitter, Facebook) or classic email/password.

_Pro tip: If you forget your password, our reset flow is fast. Unlike your memories of that call you didn't record._

**2. Navigate to Voice Operations** 📞

Click "Voice" in the navigation. You'll see a three-column interface:

- **Left:** Call history (your greatest hits)
- **Center:** Controls (mission control)
- **Right:** Activity feed (what's happening now)

This is your command center. Embrace it.

**3. Configure Your Preferences** ⚙️

In the center column, find "Call Features." These aren't your grandmother's checkboxes — each one represents a different artifact in your evidence chain.

Pick wisely. Or pick all of them. We don't judge.

---

## Part III: Features (And What They Actually Do)

### Source Recording 🎙️

**What it says:** "Immutable call audio"

**What it means:** We capture the raw audio stream and store it permanently. No modifications, no enhancements, no "cleaning up background noise."

Why? Because when someone disputes what was said, you need the original, not our interpretation of it.

**Toggle this ON if:** You need evidence. (Spoiler: You need evidence.)  
**Toggle this OFF if:** You're just testing the dial tone. Or calling your mom. Hi, mom!

---

### Canonical Transcript 📝

**What it says:** "AssemblyAI authoritative transcript"

**What it means:** Post-call, we send your recording to AssemblyAI for transcription. This becomes the authoritative text record. Speaker labels, timestamps, sentiment analysis — the works.

**Why AssemblyAI?** They have 93.4% accuracy on English. That's not marketing fluff; that's Word Error Rate on public benchmarks.

**Processing time:** 2-10 minutes after the call ends.

🔄 **NEW: Transcription Status Indicator!** You'll now see a "Transcribing audio..." spinner while we work, instead of staring at an empty void wondering if anything is happening. Because we care about your anxiety levels.

**Toggle this ON if:** Words matter.  
**Toggle this OFF if:** You're making social calls. (Wait, are you using this for social calls? Bold move.)

---

### Live Translation (Preview) 🌍

**What it says:** "Real-time assist (preview only)"

**What it means:** During the call, an AI listens and translates in real-time. Spanish caller, English listener — everyone hears their own language with 1-3 second latency.

**Critical distinction:** This is assist, not evidence. The live translation isn't recorded. It's ephemeral. It helps you have the conversation; the canonical transcript provides the evidence.

🎭 **It's like having a really fast interpreter who never needs bathroom breaks.**

**When to use it:** Multilingual customers, international calls, emergency situations, or anytime you want to feel like you're in a UN summit.

**When to skip it:** English-only calls, or when you don't want AI in the loop.

**Business plan required.** This isn't free. SignalWire AI Agents cost us $500/month, and we're not charging you extra — yet. Enjoy it while it lasts!

---

### Post-Call Translation 🔤

**What it says:** "Authoritative translation from canonical transcript"

**What it means:** After the call, we translate the canonical transcript into your target language. This one goes in the evidence bundle.

**Difference from live translation:** This is authoritative. This one matters in court. The live one helped you have the conversation. This one helps you _prove_ the conversation.

---

### After-Call Survey 📋

**What it says:** "Automated survey with AI Survey Bot"

**What it means:** When the call ends, an AI-powered voice bot automatically calls back and asks your survey questions. Collects responses. Stores them. Emails you the results.

**How it works:**

1. Call ends
2. 30 seconds later, callback initiated _(just enough time for them to think "wait, what?")_
3. AI bot asks your questions
4. Responses recorded and scored
5. Results in your inbox within 2 minutes

**Insights plan required.** Quality feedback isn't free. But neither is guessing.

---

### Secret Shopper 🕵️

**What it says:** "AI caller with scoring"

**What it means:** The AI makes the call, follows your script, evaluates responses, and scores performance.

**Use case:** Mystery shopping, compliance checks, script adherence, competitive intelligence.

**This is Bond. James Bond. But for phone calls.** 🍸

🆕 **Now with improved scoring!** Results stored with `overall_score` and `outcome_results` for better analytics. Your shopper data just got fancier.

---

## Part IV: Making a Call (The Main Event) 📞

### The Standard Approach

**Step 1:** Enter the target number  
Format: E.164 (that's `+12025551234` for the uninitiated). Yes, the plus sign matters. Yes, really.

**Step 2:** Select your features  
Enable what matters. Disable what doesn't. When in doubt, enable more.

**Step 3:** Click "Start Call" 🔴  
The button is large. It's red. You can't miss it. Unless you're colorblind, in which case it's large and has text on it.

**Step 4:** Wait for connection  
2-5 seconds typically. SignalWire is fast. Faster than your old phone system. Faster than your expectations.

**Step 5:** Have your conversation  
Say what you need to say. Make the commitments you'll keep. We'll remember all of it.

**Step 6:** Hang up  
The call ends. Processing begins automatically. You can go grab coffee. ☕

### The Sophisticated Approach (Voice Targets) 🎯

If you're calling the same numbers repeatedly, create voice targets.

**Voice target** = phone number + name + default settings.

Save it once, call it forever. Like a phone book, but actually useful in 2026.

**How:**

1. Click "Add Number" in the left sidebar
2. Enter phone, name, description
3. Select as active target
4. Click "Call"

Your target's settings apply automatically. No configuration hunting. No "wait, what were my settings last time?"

---

## Part V: After the Call (Where the Magic Happens) ✨

### The Artifact Timeline

Every call generates artifacts in a specific order. It's like a production line, but for evidence:

```
Call (0 seconds) — "Hello?"
  ↓
Recording (1-5 minutes after call) — The raw truth
  ↓
Canonical Transcript (2-10 minutes after recording) — Words on paper
  ↓
Translation (2-5 minutes after transcript) — Same words, different language
  ↓
Evidence Manifest (immediately after translation) — The legal wrapper
```

Each artifact links to its predecessor. Each has provenance. Each is immutable.

This isn't a feature. This is architecture. _And honestly, it's kind of beautiful._

### Reviewing Call Details

Click any call in the left sidebar. The center column shows everything:

**Timeline Tab:** Chronological events ⏱️  
**Transcript Tab:** Full text with speaker labels 📄  
**Translation Tab:** Translated transcript 🌐  
**Recording Tab:** Audio player 🎵  
**Evidence Tab:** Legal-grade manifest ⚖️  
**Notes Tab:** Your annotations 📝

Everything you need to reconstruct what happened. CSI: Phone Edition.

### Evidence Review Mode 🔍

When disputes arise (and they will — humans are predictable that way), click "Review Mode."

**What you get:**

- Read-only view (no accidental edits, even when you're stressed)
- Timeline with full provenance
- Authority badges on each artifact
- "Why this score?" explanations
- One-click evidence export

This is where ops managers become heroes. Cape optional.

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

## Part VI-B: New Powerhouse Features 🚀

### Campaign Manager (Bulk Operations)

**What it is:** Mass outbound calling with tracking, retries, and analytics.

**Think of it as:** Mail merge, but for phone calls. And with better results tracking.

**How to use it:**

1. Create a campaign with target phone numbers
2. Choose your call flow (Secret Shopper, Survey, Outbound, or Test)
3. Schedule it (now, later, or recurring)
4. Watch the magic happen
5. Review results in real-time

**Features:**

- 📊 Progress tracking (completed, successful, failed counts)
- 🔄 Automatic retry logic (configurable attempts per target)
- 📈 Performance stats API for analytics
- 📋 Full audit trail of every campaign action

**Use cases:**

- Mass customer outreach
- Compliance call campaigns
- Quality assurance at scale
- "Everyone needs to hear this message" situations

### Report Builder (Analytics on Demand)

**What it is:** Custom reports from your call data. Your way. Your format. Your schedule.

**Think of it as:** SQL queries, but without needing to know SQL. And prettier.

**Data sources:**

- 📞 Calls (the obvious one)
- 🎯 Campaigns (bulk operations)
- 📊 Scorecards (quality scores)
- 📋 Surveys (customer feedback)

**Export formats:**

- PDF (for the executives)
- CSV (for the spreadsheet lovers)
- XLSX (for the Excel wizards)
- JSON (for the developers who can't help themselves)

**Scheduling options:**

- Daily, Weekly, Monthly automated runs
- Email delivery to stakeholders
- Webhook delivery for integrations

**Pro tip:** Set up a weekly performance report and send it to your boss. Look organized without doing extra work. 😎

### Analytics Dashboard

**What it is:** Real-time insights into your call operations.

**Available dashboards:**

- 📊 Call Analytics — Volume, duration, outcomes
- 📈 Performance Metrics — Success rates, processing times
- 💭 Sentiment Trends — How are your calls _feeling_?
- 📋 Survey Analytics — Aggregate survey results

**Why you'll love it:** Because data is beautiful, and "we're doing better than last month" is a sentence you'll want to say.

---

## Part VII: Plans & Capabilities 💰

### What Each Plan Gets You

**Base Plan:** 🌱

- Call execution
- Recording
- Basic reporting
- _The essentials. Respectable._

**Pro Plan:** ⭐

- Everything in Base
- Canonical transcripts
- Email artifacts
- Basic analytics
- _Now we're talking._

**Business Plan:** 🚀

- Everything in Pro
- **Live translation (preview)**
- Advanced analytics
- Campaign Manager
- Report Builder
- AI Agent customization
- Priority support
- _The sweet spot._

**Enterprise Plan:** 👑

- Everything in Business
- Custom integrations
- Dedicated support
- SLA guarantees
- Volume pricing
- Custom AI prompts
- _For the serious operators._

### Feature Gating (And Why It Exists)

We gate features by plan tier.

Not because we're greedy. Because these features cost us real money. Here's the honest math:

| Feature               | Our Cost                     | Your Reaction |
| --------------------- | ---------------------------- | ------------- |
| Live translation      | $500/month to SignalWire     | 😱            |
| Canonical transcripts | $0.0042/minute to AssemblyAI | 🤔            |
| TTS Audio             | ElevenLabs per-character     | 💸            |
| Evidence storage      | S3 + compute                 | 📦            |

Higher plans subsidize expensive features. That's the deal. It's fair.

---

## Part VIII: Troubleshooting (When Things Go Sideways) 🔧

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
**Fix:** Wait 2-10 minutes, refresh. You'll now see a "Transcribing audio..." indicator while we work! 🔄

**Check:** Recording delivered  
**Fix:** Verify recording in database

**Check:** AssemblyAI credits  
**Fix:** Admin checks billing

**Check:** Status shows "Failed"  
**Fix:** You'll see a red warning indicator. Retry via the API or contact support.

### "I want to disable all AI"

**Good news:** You can. We respect your paranoia. (It's probably justified.)

Settings → AI Control & Independence → Toggle everything OFF

Source recordings remain. Everything else: manual review.

This is by design. You own your data. We make that real.

---

## Part IX: Best Practices (Hard-Won Lessons) 🎓

_These aren't suggestions. These are battle scars turned into wisdom._

### On Recording Everything

**Don't.**

Record what matters. Skip internal calls, skip test calls, skip calls with your mom. _(She doesn't need to be in the database.)_

Storage is cheap, but not free. More importantly, when you need to find something, you don't want to search through 10,000 recordings of "hey, where's the TPS report?"

**Record:** Customer calls, support calls, sales calls, compliance-monitored calls  
**Skip:** Internal status updates, lunch plans, birthday party invites

### On Translation

**Specify languages when you can.**

Auto-detection works, but adds ~500ms latency. If you know the caller speaks Spanish, just select Spanish.

Small optimization. Noticeable difference. 0.5 seconds you'll never get back.

### On Survey Questions

**Three is the magic number.** ✨

- One question: You look lazy.
- Three questions: Perfect balance. _Chef's kiss._
- Seven questions: Nobody finishes. They're already ordering pizza.

Ask what matters. Skip the rest. Your customers' time has value.

### On Evidence Export

**Export early, export often.**

When a call matters, export the evidence immediately. Don't wait for the dispute to start.

Archive it. Date-stamp the folder. Sleep better knowing you have the proof.

_Future you will thank present you. Future you always thanks present you for evidence._

### On Campaigns

**Start small.**

New to campaigns? Test with 10 numbers before blasting 10,000.

Check your script. Check your timing. Check your retry settings. Then scale up.

_Nobody wants to explain why 10,000 people got a broken call at 3 AM._

---

## Part X: The Chrome Extension (Click-to-Call for Sophisticates) 🔌

### What It Does

Detects phone numbers on any webpage. Hover over them. Two options appear:

**📞 Call:** Initiates call immediately  
**📅 Schedule:** Opens scheduling page

That's it. No bloat. No "AI-powered insights." Just efficient execution. _The way software should be._

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

## Part XIV: FAQ (The Questions Everyone Asks) ❓

_The questions we get asked every single day. Now you don't have to email support._

**Q: Is the AI listening to my calls all the time?** 👂

Only when you enable it. Toggle OFF transcription, and the AI never sees your audio. It's like it was never there. Because it wasn't.

**Q: Can I delete recordings?** 🗑️

Yes, but it's logged. Immutability applies to modifications, not deletion. We're not in the business of forcing you to keep data you don't want. Just know that deletion is tracked — because evidence of deletion is sometimes also evidence.

**Q: How long do you store recordings?** ⏳

As long as you want. We don't auto-delete. You control the retention policy. Some customers keep calls for 7 years. Some delete after 30 days. Your data, your rules.

**Q: What if AssemblyAI shuts down?** 🏚️

We swap to Deepgram. Or Whisper. Or any other transcription service. That's why we don't own the recordings — you do. Vendor independence is a feature, not an accident.

**Q: Can I export everything?** 📦

Yes. ZIP file. One click. Everything. We're not in the lock-in business.

**Q: Is this overkill for a small business?** 🤷

Depends. Do you need to prove what happened, or just remember vaguely?

If it's the former, this is appropriate. If it's the latter, use RingCentral. No hard feelings.

**Q: What happens if I don't pay my bill?** 💸

Your data remains accessible (read-only). No new calls. No new transcripts. But your evidence stays evidence.

We don't hold your data hostage. That's not our style. That's someone else's style. We have opinions about them.

**Q: Can I use this for personal calls?** 👨‍👩‍👧

Technically yes. Practically... why? This is built for business evidence. If you need to prove what your spouse said about the groceries, we have questions about your marriage.

**Q: How do I know the transcription is accurate?** 🎯

AssemblyAI has 93.4% accuracy on English (public benchmarks). That's industry-leading. But more importantly: the recording is always available. The transcript is for convenience; the recording is for truth.

---

## Part XV: A Final Word 🎤

You bought this because you're serious.

Serious about quality. Serious about evidence. Serious about doing the job correctly.

We built it the same way.

No shortcuts. No fake promises. No "trust our AI" hand-waving.

Just authoritative call records when you need them — which, if you're reading this, is probably often.

**Welcome to Word Is Bond.** 🤝

The call will be over before you know it. But we'll remember exactly what was said.

_And so will you._

---

## Appendix: Technical Reference 📋

### System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (obviously — it's 2026)
- JavaScript enabled
- Cookies enabled for authentication
- A phone number to call (we can't help with that part)

### Supported Browsers

- Chrome/Edge 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Internet Explorer ❌ (it's 2026, come on)

### Supported Phone Formats

- E.164 international format (the only format that matters)
- US numbers: `+1XXXXXXXXXX`
- International: `+[country code][number]`

### Supported Languages (Live Translation)

🌍 English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Russian

_More coming. We're working on it._

### Processing Times

| Step                  | Time         | What's Happening           |
| --------------------- | ------------ | -------------------------- |
| Call initiation       | 2-5 seconds  | SignalWire doing its thing |
| Recording delivery    | 1-5 minutes  | Audio processing + upload  |
| Transcript generation | 2-10 minutes | AssemblyAI magic           |
| Translation           | 2-5 minutes  | Language transformation    |

### Support Contacts

- 🛠️ Technical support: support@wordis-bond.com
- 💰 Billing questions: billing@wordis-bond.com
- 🤝 Sales inquiries: sales@wordis-bond.com

---

**Version 2.0** | January 2026 | Word Is Bond, Inc.

_Remember what was said. Prove what happened. That's the promise._

🎙️ **Your words matter. We make sure they're remembered correctly.**

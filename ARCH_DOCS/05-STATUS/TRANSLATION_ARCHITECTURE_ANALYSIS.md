# Translation Architecture Analysis

**Date:** January 14, 2026  
**Status:** 🔴 **CRITICAL DESIGN GAP IDENTIFIED**  
**Author:** Architecture Review  

---

## 🎯 **Executive Summary**

**You are correct.** The current recording → transcription → translation pipeline has a **critical architectural flaw** that impedes your stated goal of **live translation**.

### **The Problem**

```
Current Flow:
1. Call happens (SignalWire)
2. Call ends
3. SignalWire generates recording (~1-5 min delay)
4. Webhook delivers recording URL
5. Download recording (with auth)
6. Upload to Supabase Storage
7. Submit to AssemblyAI (~30s-2min processing)
8. Get transcript
9. Translate transcript
10. Deliver to user

Total delay: 2-8 minutes AFTER call ends
```

**This is POST-CALL translation, not LIVE translation.**

---

## 📚 **What Your Architecture Says**

According to `ARCH_DOCS/02-FEATURES/Translation_Agent` and `MASTER_ARCHITECTURE.txt`, your system is designed for **TWO translation modes**:

### **Mode 1: Live Translation (DESIGNED, NOT IMPLEMENTED)**
- **Technology:** SignalWire AI Agents
- **Timing:** Real-time during call
- **Authority:** Ephemeral, non-authoritative (for live assist only)
- **Status:** ❌ **NOT IMPLEMENTED**

### **Mode 2: Post-Call Translation (CURRENT)**
- **Technology:** AssemblyAI
- **Timing:** After call ends + recording available
- **Authority:** Canonical, authoritative (for evidence/audit)
- **Status:** ✅ **IMPLEMENTED** (but delayed by recording availability)

---

## 🔍 **Root Cause Analysis**

### **Issue 1: Recording Dependency**
Your current transcription script requires:
1. SignalWire recording URL (delayed)
2. HTTP Basic Auth to download (adds complexity)
3. Re-upload to public storage (adds latency)
4. AssemblyAI processing (adds latency)

**Result:** 2-8 minute delay before transcript available

### **Issue 2: No Live Translation Implementation**
Your architecture DESIGNED live translation via SignalWire AI Agents but:
- ❌ No implementation in codebase
- ❌ No capability gating (`/api/call-capabilities`)
- ❌ No voice config validation for live translation
- ❌ No SignalWire AI Agent integration

**Result:** Only post-call translation possible

---

## 🎯 **Architectural Decision Required**

You have **THREE paths forward**:

---

## **PATH 1: Implement SignalWire AI Agents (RECOMMENDED)**

### **What This Is**
Implement the live translation feature AS DESIGNED in your architecture docs.

### **How It Works**
```
During Call:
┌─────────────────────────────────────────────────────┐
│ 1. User initiates call with "Live Translation" ON  │
│ 2. SignalWire attaches AI Agent to call            │
│ 3. Agent listens → translates → speaks (real-time) │
│ 4. Caller hears translation immediately            │
└─────────────────────────────────────────────────────┘

After Call:
┌─────────────────────────────────────────────────────┐
│ 5. SignalWire delivers recording URL               │
│ 6. AssemblyAI processes (canonical transcript)      │
│ 7. Database updated with authoritative data         │
└─────────────────────────────────────────────────────┘
```

### **Pros**
✅ True live translation (seconds, not minutes)  
✅ Aligned with your documented architecture  
✅ No self-hosted infrastructure (SignalWire handles it)  
✅ Still get post-call canonical transcript (AssemblyAI)  
✅ Preserves vendor independence (AssemblyAI = truth)  
✅ Explicitly designed to be replaceable (FreeSWITCH v2)  

### **Cons**
⚠️ Requires SignalWire Business Plan (~$500/mo)  
⚠️ Additional API integration work (2-3 days)  
⚠️ Ephemeral translation (live assist only, not stored)  
⚠️ Feature-gated (not available to all tiers)  

### **Implementation Effort**
- **Time:** 2-3 days
- **Files to Create/Modify:**
  1. `GET /api/call-capabilities` - Check if org has live translation
  2. `PUT /api/voice/config` - Validate `translation_from`, `translation_to`
  3. `app/actions/calls/startCallHandler.ts` - Attach SignalWire AI Agent
  4. `components/voice/VoiceConfigForm.tsx` - Add live translation toggle
  5. `migrations/add-live-translation.sql` - Add schema fields

### **Architecture Compliance**
✅ **100% Aligned** - This is what your docs specify

---

## **PATH 2: Server-Side Recording (Oreka TR or similar)**

### **What This Is**
Self-host a recording server that captures RTP streams in real-time, independent of SignalWire.

### **How It Works**
```
During Call:
┌─────────────────────────────────────────────────────┐
│ 1. Call goes through SignalWire                    │
│ 2. RTP stream mirrored to Oreka TR server          │
│ 3. Oreka captures audio in real-time               │
│ 4. Audio immediately available (no webhook delay)  │
│ 5. Submit to AssemblyAI as stream completes        │
└─────────────────────────────────────────────────────┘
```

### **Pros**
✅ Eliminates recording delivery delay  
✅ Full control over recording quality/format  
✅ Can process audio in real-time (streaming)  
✅ Works with any carrier (not SignalWire-specific)  

### **Cons**
❌ **VIOLATES your architecture** - moves media intelligence to self-hosted  
❌ Requires infrastructure (server, storage, maintenance)  
❌ Adds operational complexity (uptime, monitoring)  
❌ Still doesn't achieve LIVE translation (only faster post-call)  
❌ Delays your v2 roadmap (premature FreeSWITCH work)  
❌ Costs: hosting, bandwidth, maintenance  

### **Implementation Effort**
- **Time:** 2-4 weeks
- **Infrastructure:**
  - VPS/dedicated server (4GB+ RAM)
  - Storage (1TB+ for recordings)
  - Network bandwidth (high)
  - Monitoring/alerting
  - Backup/redundancy

### **Architecture Compliance**
❌ **Violates v1 Design** - Your architecture explicitly defers self-hosted media to v2+

---

## **PATH 3: Optimize Current Flow (TACTICAL ONLY)**

### **What This Is**
Keep post-call translation but optimize the delay.

### **Optimizations**
1. ✅ **Webhook optimization** - Faster SignalWire → your system delivery
2. ✅ **Parallel processing** - Start AssemblyAI as soon as recording URL arrives
3. ✅ **Storage optimization** - Skip Supabase re-upload, use signed URLs
4. ✅ **User expectations** - Clear messaging "Transcript available in 2-3 minutes"

### **Pros**
✅ Minimal code changes (1 day)  
✅ No new infrastructure  
✅ Improves UX within current architecture  

### **Cons**
❌ **Still 2-5 min delay** - fundamentally limited by recording delivery  
❌ Not live translation - doesn't meet user expectation  
❌ Doesn't scale to high-volume calls (AssemblyAI rate limits)  

### **Implementation Effort**
- **Time:** 1 day
- **Changes:**
  1. Optimize webhook handler (parallel processing)
  2. Use AssemblyAI signed URLs instead of re-uploading
  3. Add real-time progress UI ("Transcript processing...")

### **Architecture Compliance**
✅ **Aligned** - But doesn't solve the core problem

---

## 🏆 **RECOMMENDATION: Path 1 (SignalWire AI Agents)**

### **Why This Is The Right Move**

1. **Aligned with your documented architecture**
   - Your `Translation_Agent` doc ALREADY designed this
   - Your `MASTER_ARCHITECTURE.txt` ALREADY specified this
   - You just haven't implemented it yet

2. **Solves the actual problem**
   - Live translation = seconds, not minutes
   - Post-call transcript = still authoritative (AssemblyAI)
   - Both needs met

3. **Preserves future flexibility**
   - Explicitly designed to be replaced by FreeSWITCH v2
   - SignalWire AI Agent is "execution only" - not vendor lock-in
   - Clear upgrade path documented

4. **Better UX**
   - "Live Translation (Preview)" badge
   - Real-time translation during call
   - Post-call transcript for evidence/audit
   - Clear messaging: "Live is immediate, transcript is authoritative"

5. **ROI**
   - 2-3 days implementation
   - $500/mo SignalWire Business Plan
   - Unlocks premium feature (charge more)
   - Differentiated value prop

---

## 🚨 **Critical Point: Path 2 (Oreka TR) Is A Trap**

### **Why NOT to do server-side recording now:**

1. **Violates your architecture**
   - Your docs explicitly defer self-hosted media to v2
   - "SignalWire-first v1" is your stated design principle

2. **Doesn't solve live translation**
   - Still post-call (just faster post-call)
   - Still 1-2 min delay minimum
   - Doesn't meet user expectation of "live"

3. **Premature optimization**
   - Adds operational burden NOW
   - Delays your v2 roadmap
   - Technical debt without strategic benefit

4. **Wrong timing**
   - Your architecture planned FreeSWITCH for v2
   - Oreka TR is premature v2 work
   - Do SignalWire AI Agents in v1, then FreeSWITCH in v2

---

## 📋 **Immediate Action Plan**

### **Phase 1: Implement Live Translation (SignalWire AI Agents)**
**Duration:** 2-3 days  
**Goal:** Enable true live translation for Business tier

1. **Add schema fields** (1 hour)
   ```sql
   ALTER TABLE recordings ADD COLUMN has_live_translation BOOLEAN DEFAULT FALSE;
   ALTER TABLE recordings ADD COLUMN live_translation_provider TEXT;
   ALTER TABLE voice_configs ADD COLUMN translation_from TEXT;
   ALTER TABLE voice_configs ADD COLUMN translation_to TEXT;
   ```

2. **Create capability endpoint** (2 hours)
   - `GET /api/call-capabilities`
   - Check org plan + feature flag
   - Return `{ translation_live: true }` for Business tier

3. **Update voice config validation** (2 hours)
   - `PUT /api/voice/config`
   - Require `translation_from`, `translation_to` when enabled
   - Validate language codes

4. **Integrate SignalWire AI Agent** (1 day)
   - Update `startCallHandler.ts`
   - Attach agent config when `live_translation: true`
   - Pass language params from `voice_configs`

5. **Update UI** (4 hours)
   - Add "Live Translation (Preview)" toggle
   - Show badge for Business plan users
   - Add tooltip: "Real-time translation during call. Post-call transcript is authoritative."

6. **Test E2E** (4 hours)
   - Make live call with translation ON
   - Verify real-time translation works
   - Verify AssemblyAI still produces canonical transcript
   - Verify database correctly stores both

### **Phase 2: Optimize Post-Call Flow (Existing)**
**Duration:** 1 day  
**Goal:** Faster post-call transcript for non-Business users

1. **Optimize webhook handler** (4 hours)
   - Parallel processing (don't wait for DB write)
   - Use AssemblyAI signed URLs (skip re-upload)

2. **Add progress UI** (2 hours)
   - "Transcript processing..." spinner
   - Estimated time remaining
   - Toast notification on completion

3. **Documentation** (2 hours)
   - Update user docs
   - Clear messaging on delays
   - Upgrade path to Business (live translation)

---

## 📊 **Cost-Benefit Analysis**

| Option | Cost | Time | Benefit | Alignment |
|--------|------|------|---------|-----------|
| **Path 1: SignalWire AI Agents** | $500/mo | 2-3 days | **Live translation** | ✅ 100% |
| **Path 2: Oreka TR** | $200-500/mo + ops | 2-4 weeks | Faster post-call | ❌ Violates v1 |
| **Path 3: Optimize current** | $0 | 1 day | Slightly faster | ✅ Aligned |

---

## 🎯 **Final Recommendation**

**Do Path 1 + Path 3 together.**

1. **Implement SignalWire AI Agents (Path 1)** for Business tier
   - True live translation
   - Premium feature
   - Revenue opportunity

2. **Optimize post-call flow (Path 3)** for all tiers
   - Better UX for Starter/Growth plans
   - Upgrade incentive to Business

3. **Skip Oreka TR (Path 2) for now**
   - Not aligned with v1 architecture
   - Defer to v2 (with FreeSWITCH)
   - Avoid premature infrastructure

---

## 📝 **Next Steps**

1. **Review this analysis** - Confirm strategic direction
2. **Check SignalWire plan** - Verify Business tier access
3. **Prioritize implementation** - Add to sprint
4. **Update docs** - Mark live translation as "in progress"

---

## 🔗 **References**

- `ARCH_DOCS/02-FEATURES/Translation_Agent` - Live translation design
- `ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt` - SignalWire AI Agent boundaries
- `ARCH_DOCS/03-INFRASTRUCTURE/MEDIA_PLANE_ARCHITECTURE.txt` - v1 vs v2 media plane

---

**Conclusion:** Your architecture already solved this problem. You just need to implement what you designed.

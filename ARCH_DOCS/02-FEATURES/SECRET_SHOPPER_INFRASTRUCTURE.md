# Secret Shopper (CallAudit) Infrastructure Requirements

## Overview
Infrastructure requirements for the "Secret Shopper Calling" add-on feature (branded as CallAudit), which extends CallMonitor with automated mystery shopping capabilities: scripted calls, recordings, transcription, and performance analytics.

**Feature Value**: $49-79/mo upsell targeting medical, legal, and property management verticals  
**Market**: $1.5-2.3B mystery shopping industry (phone segment 10-20%)  
**Timeline**: MVP in 2-3 weeks, full launch in Month 2

---

## Database Schema (Supabase)

### 1. `shopper_campaigns` Table
Stores mystery shopper call scripts and configuration.

```sql
CREATE TABLE shopper_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  tool_id UUID NOT NULL REFERENCES tools(id), -- DB_STRATEGY Compliance
  
  -- Scenario Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  script TEXT NOT NULL, -- LaML script content or reference
  phone_to VARCHAR(20) NOT NULL, -- Target phone number to test
  
  -- Scheduling
  schedule_type VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'manual', 'daily', 'weekly', 'monthly'
  schedule_config JSONB, -- Cron expression or schedule details
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  
  -- Expected Outcomes (for auto-scoring)
  expected_outcomes JSONB, -- Array of validation rules
  -- Example: [{"type": "duration_min", "value": 60}, {"type": "keyword", "value": "appointment"}]
  
  -- Feature Tier Controls
  max_duration_seconds INTEGER DEFAULT 300, -- 5 minutes max
  enable_transcription BOOLEAN DEFAULT false, -- Pro tier only
  enable_sentiment BOOLEAN DEFAULT false, -- Pro tier only
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shopper_campaigns_org ON shopper_campaigns(organization_id);
CREATE INDEX idx_shopper_campaigns_next_run ON shopper_campaigns(next_run_at) WHERE is_active = true;

-- RLS Policies
ALTER TABLE shopper_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's campaigns"
  ON shopper_campaigns FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage campaigns"
  ON shopper_campaigns FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
```

### 2. `shopper_results` Table
Stores results from executed mystery shopper calls.

```sql
CREATE TABLE shopper_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES shopper_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE, -- Link to root call
  created_by UUID REFERENCES users(id), -- System or User who triggered
  tool_id UUID NOT NULL REFERENCES tools(id), -- DB_STRATEGY Compliance
  
  -- Note: Core call details (sid, duration, recording_url) live on 
  -- the 'calls' and 'recordings' tables, linked via call_id.
  -- This table stores only Shopper-specific intelligence.

  -- Transcription (Pro tier)
  transcript TEXT,
  transcript_confidence DECIMAL(5,2), -- 0-100 from AssemblyAI
  
  -- Sentiment Analysis (Pro tier)
  sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative'
  sentiment_score DECIMAL(5,2), -- -100 to 100
  sentiment_details JSONB, -- Detailed sentiment breakdown
  
  -- Scoring
  auto_score INTEGER, -- 0-100 calculated from expected_outcomes
  manual_score INTEGER, -- 0-100 from user review
  scoring_notes TEXT,
  
  -- Status
  call_status VARCHAR(50), -- 'completed', 'failed', 'no-answer', 'busy'
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shopper_results_scenario ON shopper_results(scenario_id);
CREATE INDEX idx_shopper_results_org ON shopper_results(organization_id);
CREATE INDEX idx_shopper_results_created ON shopper_results(created_at DESC);

-- RLS Policies
ALTER TABLE shopper_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's results"
  ON shopper_results FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage results"
  ON shopper_results FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM org_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
```

### 3. Migration File
Create: `supabase/migrations/YYYYMMDD_add_secret_shopper_tables.sql`

---

## API Endpoints

### 1. LaML Endpoint: `/api/laml/shopper/[id]`
**Purpose**: Serve dynamic SignalWire LaML XML for scripted calls  
**Method**: GET  
**Authentication**: SignalWire webhook (validate via header or IP)

**Response Format** (LaML XML):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello, I'd like to schedule an appointment for next week.</Say>
  <Pause length="3"/>
  <Say>Do you have any openings on Tuesday afternoon?</Say>
  <Record 
    maxLength="300"
    playBeep="false"
    action="/api/webhooks/signalwire"
    method="POST"
  />
  <Say>Thank you for your time. Goodbye.</Say>
</Response>
```

**Implementation**:
- Fetch scenario by `id` from `shopper_scenarios` table
- Parse `script` field (could be JSON or template string)
- Generate LaML XML with `<Say>`, `<Pause>`, `<Record>` tags
- Include `action` URL for recording webhook
- Log call initiation in `shopper_results` table

**Technology Stack**:
- Next.js API Route
- Supabase JS client (service role key)
- XML builder library (e.g., `xml2js` or template strings)

---

### 2. Cron Scheduler: `/api/cron/shopper`
**Purpose**: Trigger scheduled mystery shopper calls  
**Method**: POST  
**Authentication**: Vercel Cron secret header

**Process**:
1. Query `shopper_scenarios` where `next_run_at <= NOW()` AND `is_active = true`
2. For each scenario:
   - Create outbound call via SignalWire API
   - Update `last_run_at` and `next_run_at` (based on `schedule_config`)
   - Create pending record in `shopper_results`
3. Return summary (calls triggered, errors)

**SignalWire API Call**:
```javascript
const response = await fetch('https://your-space.signalwire.com/api/laml/2010-04-01/Accounts/{AccountSid}/Calls', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    From: process.env.SIGNALWIRE_PHONE_NUMBER,
    To: scenario.phone_to,
    Url: `https://yourdomain.com/api/laml/shopper/${scenario.id}`,
    StatusCallback: `https://yourdomain.com/api/webhooks/signalwire`,
    StatusCallbackEvent: ['completed', 'failed'],
    Record: 'true',
    RecordingStatusCallback: `https://yourdomain.com/api/webhooks/signalwire`
  })
});
```

**Vercel Cron Configuration** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/cron/shopper",
    "schedule": "0 */4 * * *"
  }]
}
```

**Technology Stack**:
- Next.js API Route
- Supabase JS client (service role key)
- SignalWire REST API
- Vercel Cron

---

### 3. Webhook Handler: `/api/webhooks/signalwire`
**Purpose**: Process call status updates and recordings from SignalWire  
**Method**: POST  
**Authentication**: Validate SignalWire signature (optional but recommended)

**Webhook Events**:
- `CallStatus` updates (`completed`, `failed`, `no-answer`, `busy`)
- `RecordingStatus` updates (`completed`)

**Process Flow**:
```
1. Receive webhook POST from SignalWire
2. Parse form data (CallSid, RecordingUrl, CallDuration, etc.)
3. Find matching record in shopper_results by call_sid
4. Update record:
   - call_status, ended_at, duration_seconds
   - recording_url (from RecordingUrl parameter)
5. If RecordingUrl present AND transcription enabled:
   - Download recording from SignalWire
   - Upload to Supabase Storage (/recordings/{org_id}/{result_id}.mp3)
   - Trigger transcription job (AssemblyAI)
6. Calculate auto_score from expected_outcomes
7. Return 200 OK (SignalWire requires quick response)
```

**Supabase Storage Setup**:
- Bucket: `shopper-recordings`
- Path: `{organization_id}/{result_id}.mp3`
- RLS: Authenticated users in same org can access

**Technology Stack**:
- Next.js API Route
- Supabase JS client + Storage
- AssemblyAI SDK (optional, for transcription)

---

### 4. Transcription Processor: `/api/cron/transcribe` (Background Job)
**Purpose**: Process pending recordings through AssemblyAI  
**Method**: POST  
**Authentication**: Vercel Cron secret

**Process**:
1. Query `shopper_results` where `recording_url IS NOT NULL` AND `transcript IS NULL` AND `enable_transcription = true`
2. For each result (limit 10 per run):
   - Submit recording URL to AssemblyAI
   - Poll for completion (or use webhook)
   - Update `transcript`, `sentiment`, `sentiment_score`
3. Calculate `auto_score` based on keyword matching in transcript

**AssemblyAI Integration**:
```javascript
const assemblyai = require('assemblyai');
const client = new assemblyai.AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

const transcript = await client.transcripts.transcribe({
  audio_url: recordingUrl,
  sentiment_analysis: true,
  auto_highlights: true
});

// Update shopper_results
await supabase
  .from('shopper_results')
  .update({
    transcript: transcript.text,
    transcript_confidence: transcript.confidence * 100,
    sentiment: transcript.sentiment_analysis_results[0]?.sentiment,
    sentiment_score: transcript.sentiment_analysis_results[0]?.confidence * 100
  })
  .eq('id', resultId);
```

**Cost**: $0.10/minute (AssemblyAI free tier: 100 mins/month)

**Vercel Cron**: Run every 15 minutes  
```json
{
  "crons": [{
    "path": "/api/cron/transcribe",
    "schedule": "*/15 * * * *"
  }]
}
```

---

## UI Integration (Voice Operations)

**Architectural Alignment:** Per `UX_DESIGN_PRINCIPLES.txt` v2.0, Secret Shopper is not a standalone tool. It is a **Call Modulation** available within the unified Voice Operations surface.

### 1. Configuration (Modulation Drawer)
- **Location**: Inline toggle "Secret Shopper Mode" on any call or test configuration.
- **Settings**:
  - Script selection (LaML)
  - Expected outcomes (JSON rules)
  - Schedule (if recurring)

### 2. Results (Artifact Viewer)
- **Location**: The "Artifacts" tab of the Call Detail view.
- **Components**:
  - **Recording**: Standard audio player.
  - **Transcript**: AssemblyAI output.
  - **Scorecard**: Auto-score vs Manual score.
  - **Evidence**: Sentiment analysis breakdown.

### 3. Analytics (Unified Dashboard)
- Shopper data is aggregated into the main `test_results` and `kpi_logs` streams.
- Filter main dashboard by `tool_id = 'Secret Shopper'` to see specific performance.

---

## Supabase Storage Configuration

### Bucket: `shopper-recordings`
**Purpose**: Store call recordings downloaded from SignalWire

**Configuration**:
```javascript
// Create bucket (run once in migration or setup)
const { data, error } = await supabase.storage.createBucket('shopper-recordings', {
  public: false, // Private bucket
  fileSizeLimit: 52428800, // 50 MB max
  allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3']
});
```

**RLS Policies**:
```sql
-- Users can access their org's recordings
CREATE POLICY "Users can view org recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'shopper-recordings' 
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id::text FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Service role can upload recordings (from webhook)
CREATE POLICY "Service can upload recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shopper-recordings');
```

**File Naming Convention**:
```
{organization_id}/{result_id}.mp3
```

**Signed URL Generation** (for secure playback):
```javascript
const { data } = await supabase.storage
  .from('shopper-recordings')
  .createSignedUrl(`${orgId}/${resultId}.mp3`, 3600); // 1 hour expiry
```

---

## Third-Party Integrations

### 1. SignalWire
**Purpose**: Outbound calling, call control, recording

**Required Credentials** (Environment Variables):
```
SIGNALWIRE_SPACE=your-space.signalwire.com
SIGNALWIRE_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SIGNALWIRE_API_TOKEN=PTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SIGNALWIRE_PHONE_NUMBER=+1234567890
```

**API Endpoints Used**:
- `POST /api/laml/2010-04-01/Accounts/{AccountSid}/Calls` - Create call
- `GET /api/laml/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}` - Download recording

**Costs**:
- Outbound calls: $0.01/minute
- Recording storage: $0.0025/minute
- Estimated: $5/month for 100 calls

**Documentation**: https://developer.signalwire.com/

---

### 2. AssemblyAI
**Purpose**: Speech-to-text transcription, sentiment analysis

**Required Credentials**:
```
ASSEMBLYAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**API Usage**:
```javascript
const assemblyai = require('assemblyai');
const client = new assemblyai.AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

const transcript = await client.transcripts.transcribe({
  audio_url: recordingUrl, // Can be SignalWire URL or Supabase signed URL
  sentiment_analysis: true,
  auto_highlights: true,
  speaker_labels: false // Single speaker (our script)
});
```

**Features Used**:
- Speech-to-text (`transcripts.transcribe`)
- Sentiment analysis (`sentiment_analysis: true`)
- Auto highlights (keyword extraction)

**Costs**:
- $0.10/minute of audio
- Free tier: 100 minutes/month (~20 calls at 5 min each)
- Estimated: $10/month for 100 calls (Pro tier only)

**Documentation**: https://www.assemblyai.com/docs

---

### 3. Optional: Twilio (Alternative to SignalWire)
**When to Use**: If needing advanced AMD (Answering Machine Detection) or Twilio-specific features

**Migration Path**:
- SignalWire uses Twilio-compatible API
- Switch by changing base URL and credentials
- LaML XML remains identical

---

## Feature Tier Configuration

### Basic Tier ($49/mo)
**Limits**:
- 5 calls per month
- Recording only (no transcription)
- Manual scoring only
- 30-day recording retention

**Database Enforcement**:
```sql
-- Add to organizations table
ALTER TABLE organizations ADD COLUMN shopper_tier VARCHAR(20) DEFAULT 'none'; -- 'none', 'basic', 'pro'
ALTER TABLE organizations ADD COLUMN shopper_calls_limit INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN shopper_calls_used INTEGER DEFAULT 0;

-- Check limit before creating call (in /api/cron/shopper)
SELECT shopper_calls_used < shopper_calls_limit 
FROM organizations 
WHERE id = $1 AND shopper_tier IN ('basic', 'pro');
```

---

### Pro Tier ($79/mo)
**Limits**:
- 20 calls per month
- AI transcription enabled
- Sentiment analysis
- Unlimited recording retention
- Advanced analytics

**Feature Flags**:
```javascript
// Check in scenario creation
const org = await supabase.from('organizations').select('shopper_tier').eq('id', orgId).single();
const canEnableTranscription = org.data.shopper_tier === 'pro';
```

---

## Environment Variables Required

Add to `.env.local` and Vercel:

```bash
# SignalWire
SIGNALWIRE_SPACE=your-space.signalwire.com
SIGNALWIRE_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SIGNALWIRE_API_TOKEN=PTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SIGNALWIRE_PHONE_NUMBER=+1234567890

# AssemblyAI (Pro tier only)
ASSEMBLYAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Vercel Cron Secret (for authentication)
CRON_SECRET=your-random-secret-string

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

---

## Testing Plan

### 1. Unit Tests
**Test Files**:
- `__tests__/api/laml-shopper.test.ts` - LaML generation
- `__tests__/api/cron-shopper.test.ts` - Scheduler logic
- `__tests__/api/webhooks-signalwire.test.ts` - Webhook processing

**Mock SignalWire/AssemblyAI**:
```javascript
jest.mock('assemblyai', () => ({
  AssemblyAI: jest.fn().mockImplementation(() => ({
    transcripts: {
      transcribe: jest.fn().mockResolvedValue({
        text: 'Mock transcript',
        sentiment_analysis_results: [{ sentiment: 'positive', confidence: 0.95 }]
      })
    }
  }))
}));
```

---

### 2. Integration Tests
**Test Scenarios**:
1. Create scenario → trigger manual call → verify result stored
2. Scheduled call → cron runs → SignalWire called → webhook received
3. Recording webhook → file uploaded to Storage → transcription queued
4. Transcription completes → sentiment analyzed → auto-score calculated

**Test Environment**:
- Use SignalWire test credentials (sandbox mode)
- Mock AssemblyAI in CI (use real API in staging)

---

### 3. Manual Testing Checklist
- [ ] Create scenario with script
- [ ] Trigger manual call via "Run Now"
- [ ] Answer call, follow script, hang up
- [ ] Verify recording appears in dashboard
- [ ] Play recording via audio player
- [ ] Submit manual score
- [ ] Enable transcription (Pro tier)
- [ ] Verify transcript appears after processing
- [ ] Check sentiment analysis results
- [ ] Schedule recurring call (daily)
- [ ] Wait for cron trigger, verify call made
- [ ] Test tier limits (exceed 5 calls on Basic)
- [ ] Export analytics report

**Test Phone Numbers**:
- Use your own cell phone or VoIP line
- SignalWire test numbers: https://developer.signalwire.com/guides/test-credentials

---

## Cost Breakdown

### Per-Call Costs (Basic Tier)
| Item | Cost | Notes |
|------|------|-------|
| SignalWire outbound call (5 min avg) | $0.05 | $0.01/min |
| Recording storage (5 min) | $0.01 | $0.0025/min |
| **Total per call** | **$0.06** | |

**Monthly** (5 calls): **$0.30**  
**Margin** at $49/mo: **99.4%**

---

### Per-Call Costs (Pro Tier)
| Item | Cost | Notes |
|------|------|-------|
| SignalWire (5 min) | $0.05 | |
| Recording storage | $0.01 | |
| AssemblyAI transcription (5 min) | $0.50 | $0.10/min |
| **Total per call** | **$0.56** | |

**Monthly** (20 calls): **$11.20**  
**Margin** at $79/mo: **85.8%**

---

### Infrastructure Costs
| Service | Cost | Notes |
|---------|------|-------|
| Vercel (already paid) | $0 | Included in Pro plan |
| Supabase Storage (10 GB/mo) | $0 | Free tier |
| SignalWire phone number | $1/mo | Per number |
| AssemblyAI (100 min/mo free) | $0-10 | After free tier |
| **Total** | **$1-11/mo** | Scales with Pro tier usage |

---

## Deployment Checklist

### Phase 1: Database Setup (Week 1)
- [ ] Create `shopper_scenarios` migration file
- [ ] Create `shopper_results` migration file
- [ ] Run migrations via Supabase dashboard or CLI
- [ ] Create `shopper-recordings` storage bucket
- [ ] Configure RLS policies for storage
- [ ] Add tier fields to `organizations` table
- [ ] Smoke test: Insert scenario, insert result, upload test file

### Phase 2: API Development (Week 1-2)
- [ ] Build `/api/laml/shopper/[id]` endpoint
- [ ] Build `/api/cron/shopper` scheduler
- [ ] Build `/api/webhooks/signalwire` handler
- [ ] Build `/api/cron/transcribe` processor (Pro tier)
- [ ] Add environment variables to Vercel
- [ ] Configure Vercel crons in `vercel.json`
- [ ] Manual test: Trigger test call via Postman

### Phase 3: UI Development (Week 2)
- [ ] Build `/dashboard/shopper` page (scenario list)
- [ ] Build scenario create/edit form
- [ ] Build `/dashboard/shopper/results/[id]` page
- [ ] Add audio player component
- [ ] Build manual scoring form
- [ ] Build `/dashboard/shopper/analytics` page
- [ ] Add tier upgrade prompts (Basic → Pro)

### Phase 4: Testing (Week 2-3)
- [ ] Unit tests for all API routes
- [ ] Integration test: End-to-end call flow
- [ ] Manual testing with real phone numbers
- [ ] Test tier limits enforcement
- [ ] Test transcription (Pro tier)
- [ ] Load test: 20 concurrent calls

### Phase 5: Launch Prep (Week 3)
- [ ] Add feature flag to enable/disable Secret Shopper
- [ ] Update pricing page with add-on tiers
- [ ] Create onboarding tutorial
- [ ] Write help documentation
- [ ] Set up monitoring (Vercel logs, Sentry)
- [ ] Configure alerts (failed calls, transcription errors)

### Phase 6: Beta Launch (Month 1)
- [ ] Enable for 5 beta customers (free trial)
- [ ] Collect feedback via in-app survey
- [ ] Monitor costs (SignalWire, AssemblyAI)
- [ ] Iterate on UI based on feedback
- [ ] Fix critical bugs

### Phase 7: Full Launch (Month 2)
- [ ] Enable for all customers (upsell campaign)
- [ ] Publish launch blog post
- [ ] Email announcement to user base
- [ ] Monitor adoption rate (target: 20% upsell)
- [ ] Track churn (target: <10%)

---

## Success Metrics

### Technical KPIs
- **Call success rate**: >95% (completed calls vs. failed)
- **Recording capture rate**: 100% (all completed calls have recordings)
- **Transcription accuracy**: >90% (AssemblyAI confidence score)
- **API uptime**: 99.9%
- **Webhook processing time**: <2 seconds

### Business KPIs
- **Upsell rate**: 20-30% of core users
- **Churn rate**: <10%
- **NPS**: >70
- **Monthly MRR**: $2-5k in first 3 months
- **Cost per call**: <$0.60 (maintain 85%+ margin)

---

## Risk Mitigation

### Technical Risks
1. **SignalWire reliability**: Monitor call completion rates; have Twilio as fallback
2. **Storage costs**: Implement 30-day retention for Basic tier; compress recordings
3. **Transcription costs**: Set monthly limit per org; alert if approaching quota
4. **HIPAA compliance**: Encrypt recordings at rest; use BAA with vendors

### Business Risks
1. **Low demand**: Validate with beta outreach; offer free trial
2. **Privacy concerns**: Add consent language; anonymize data
3. **Competition**: Automate faster/cheaper than manual services; bundle with uptime monitoring

---

## Future Enhancements (Post-MVP)

### Phase 2 Features
- **Video mystery shopping**: Add Zoom/Google Meet integration
- **Multi-language support**: Use AssemblyAI language detection
- **Advanced AMD**: Detect answering machines vs. humans
- **Custom voice**: Use ElevenLabs for realistic caller voices
- **Team collaboration**: Assign scenarios to team members for review

### Integration Opportunities
- **VoIP platforms**: Partner with Nextiva, RingCentral for embedded mystery shopping
- **CRM integration**: Export results to Salesforce, HubSpot
- **Slack/Teams alerts**: Real-time notifications for low scores
- **API access**: Let customers trigger calls via API for their own automation

---

## Documentation Links

**Internal Docs**:
- Supabase Schema: See migration files in `supabase/migrations/`
- API Routes: See `app/api/` directory
- Dashboard Components: See `app/dashboard/shopper/`

**External Docs**:
- SignalWire API: https://developer.signalwire.com/apis/docs/
- AssemblyAI API: https://www.assemblyai.com/docs
- Supabase Storage: https://supabase.com/docs/guides/storage
- Vercel Cron: https://vercel.com/docs/cron-jobs

---

## Support & Maintenance

### Monitoring
- **Vercel Logs**: Track API errors, cron failures
- **Sentry**: Error tracking for frontend/backend
- **Supabase Dashboard**: Query performance, storage usage
- **SignalWire Console**: Call logs, recording errors

### Alerts
- Failed calls (>5% failure rate): Email admin
- Transcription errors: Log to Sentry
- Tier limit exceeded: In-app notification
- High costs (>$50/day): Slack alert

### Backup
- Database: Automated daily backups (Supabase)
- Recordings: Replicate to S3 after 7 days (optional)

---

**End of Infrastructure Requirements**  
**Version**: 1.0  
**Last Updated**: 2025  
**Owner**: CallMonitor Product Team

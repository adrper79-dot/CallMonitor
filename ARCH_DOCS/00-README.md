# CallMonitor Architecture Documentation

**Last Updated:** January 14, 2026  
**Version:** 1.2  
**Status:** ✅ Production Ready

---

## 📖 **Quick Navigation**

### **🎯 Start Here:**
- **[CURRENT_STATUS.md](CURRENT_STATUS.md)** - System overview, health metrics, deployment status
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - One-page cheat sheet
- **[MASTER_ARCHITECTURE.txt](01-CORE/MASTER_ARCHITECTURE.txt)** - Complete system architecture
- **[V4_Issues.txt](../V4_Issues.txt)** - Current status of fixes and issues

### **📁 Folder Structure:**

```
ARCH_DOCS/
├── 00-README.md (this file) - Navigation index
├── CURRENT_STATUS.md - System status & health
├── QUICK_REFERENCE.md - Quick cheat sheet
├── 01-CORE/ - Core architecture & system design
├── 02-FEATURES/ - Feature-specific documentation
├── 03-INFRASTRUCTURE/ - Infrastructure & deployment
├── 04-DESIGN/ - Design principles & UX guidelines
├── 05-REFERENCE/ - Reference materials & samples
└── archive/ - Historical documents & resolved issues
```

---

## 📊 **Current System Status**

| Metric | Value | Status |
|--------|-------|--------|
| **Build** | Clean | ✅ |
| **Tests** | 98.5% (64/65) | ✅ |
| **API Routes** | 38 (all dynamic) | ✅ |
| **Services** | 6 configured | ✅ |
| **Critical Issues** | 0 | ✅ |

**Services Verified:**
- ✅ Supabase (DB + Storage)
- ✅ SignalWire (Voice)
- ✅ AssemblyAI (Transcription)
- ✅ ElevenLabs (TTS)
- ✅ Resend (Email)
- ✅ NextAuth (Auth)

---

## 📚 **Documentation by Category**

### **01-CORE** - System Architecture
Essential documents defining system design:

- **MASTER_ARCHITECTURE.txt** - Complete system architecture, data flow, contracts
- **Schema.txt** - Database schema with all tables and relationships
- **ERROR_HANDLING_PLAN.txt** - Error handling strategy and patterns
- **TOOL_TABLE_ALIGNMENT** - Tool-to-table mapping and boundaries

**When to read:** Understanding system design, onboarding new developers

---

### **02-FEATURES** - Feature Documentation
Detailed guides for major features:

- **AI_SURVEY_BOT.md** - AI-powered inbound survey calls (NEW)
- **Translation_Agent** - Live translation architecture and implementation
- **TRANSLATION_AGENT_IMPLEMENTATION_PLAN.md** - Implementation roadmap
- **SECRET_SHOPPER_INFRASTRUCTURE.md** - Secret shopper feature design
- **SHOPPER_PLAN.md** - Secret shopper implementation plan
- **BULK_UPLOAD_FEATURE.md** - Bulk phone upload for batch calls
- **TEST_DASHBOARD.md** - Test dashboard with visual KPIs
- **NAVIGATION_SETTINGS_IMPLEMENTATION.md** - Nav bar and settings UI

**When to read:** Implementing or debugging specific features

---

### **03-INFRASTRUCTURE** - Infrastructure & Deployment
Infrastructure, media plane, and external integrations:

- **MEDIA_PLANE_ARCHITECTURE.txt** - Media plane design (SignalWire/FreeSWITCH)
- **FREESWITCH_RUNBOOK.md** - FreeSWITCH operations guide (future)
- **media_plane_diagram.md** - Visual architecture diagrams
- **SIGNALWIRE_AI_AGENTS_RESEARCH.md** - SignalWire AI Agent capabilities

**When to read:** Deploying, scaling, or infrastructure changes

---

### **04-DESIGN** - Design & Principles
UX design principles and deployment guidelines:

- **UX_DESIGN_PRINCIPLES.txt** - UI/UX standards and patterns
- **DEPLOYMENT_NOTES.md** - Deployment checklist and configuration

**When to read:** Building UI, deploying to production

---

### **05-REFERENCE** - Reference Materials
Sample data and reference materials:

- **evidence_manifest_sample.json** - Example evidence manifest structure
- **JSON_MAPPING** - JSON field mappings

**When to read:** Understanding data structures

---

### **archive/** - Historical Documents
Historical reviews, fixes, and completed implementations:

#### **archive/reviews/** - Code Reviews (Historical)
- Systematic review documents
- Holistic review iterations
- Test validation results

#### **archive/fixes/** - Issue Fixes (Resolved)
- Authentication 401 fixes
- Type duplication root cause analysis
- Translation toggle visibility fix
- SignalWire number missing fix
- Missed issues analysis

#### **archive/implementations/** - Completed Work
- Live translation completion notes
- Implementation summaries
- Issues fixed summaries

**When to read:** Understanding historical context, troubleshooting similar issues

---

## 🚀 **Quick Start Guides**

### **For New Developers:**
1. Read `CURRENT_STATUS.md` for system overview
2. Read `01-CORE/MASTER_ARCHITECTURE.txt`
3. Review `01-CORE/Schema.txt`
4. Check `QUICK_REFERENCE.md` for common tasks

### **For Feature Development:**
1. Check `02-FEATURES/` for existing feature docs
2. Follow patterns in `01-CORE/MASTER_ARCHITECTURE.txt`
3. Review `01-CORE/ERROR_HANDLING_PLAN.txt`
4. Add `export const dynamic = 'force-dynamic'` to new API routes

### **For Debugging:**
1. Check `V4_Issues.txt` for recent fixes
2. Check feature-specific docs in `02-FEATURES/`
3. Review `archive/fixes/` for similar issues
4. Consult `01-CORE/ERROR_HANDLING_PLAN.txt`

### **For Deployment:**
1. Read `04-DESIGN/DEPLOYMENT_NOTES.md`
2. Check environment variables in `QUICK_REFERENCE.md`
3. Verify via `/api/health` endpoint
4. Check `/test` dashboard

---

## 🎯 **Key Documents Summary**

| Document | Purpose | Audience | Status |
|----------|---------|----------|--------|
| CURRENT_STATUS.md | System status | All | ✅ Current |
| QUICK_REFERENCE.md | Cheat sheet | All | ✅ Current |
| MASTER_ARCHITECTURE.txt | System design | All devs | ✅ Current |
| Schema.txt | Database schema | Backend devs | ✅ Current |
| AI_SURVEY_BOT.md | AI Survey Bot | Feature devs | ✅ Complete |
| Translation_Agent | Live translation | Feature devs | ✅ Complete |
| SECRET_SHOPPER_INFRASTRUCTURE.md | Secret shopper | Feature devs | ✅ Complete |
| UX_DESIGN_PRINCIPLES.txt | UI/UX standards | Frontend devs | ✅ Current |
| V4_Issues.txt | Current fixes | DevOps | ✅ Current |
| FREESWITCH_RUNBOOK.md | Media ops | DevOps | 🟡 Future |

---

## 🔧 **Recent Updates (January 14, 2026)**

### **New Features (v1.2):**
1. ✅ **AI Survey Bot** - Inbound calls with SignalWire AI Agents
   - Dynamic survey prompts, email results, conversation capture
   - New: `AI_SURVEY_BOT.md` documentation
2. ✅ **Voice Cloning** - Clone caller's voice for translations (ElevenLabs)
3. ✅ **Email Artifacts** - Send recordings/transcripts/translations as attachments
4. ✅ **SignalWire Numbers API** - Manage inbound phone numbers

### **Codebase Fixes Applied (January 13):**
1. ✅ Added `export const dynamic = 'force-dynamic'` to all 38 API routes
2. ✅ Fixed Supabase client centralization (3 files)
3. ✅ Fixed NextAuth adapter build-time initialization
4. ✅ Fixed test mock for NextResponse constructor
5. ✅ Verified all service integrations in Vercel

### **Documentation Updates:**
- ✅ Updated `CURRENT_STATUS.md` with new features and metrics
- ✅ Added `AI_SURVEY_BOT.md` feature documentation
- ✅ Updated `Schema.txt` with new voice_configs fields
- ✅ Updated this README with v1.2 status

---

## 📝 **Document Lifecycle**

### **Active Documents:**
- Located in numbered folders (01-05)
- Updated with code changes
- Required reading for development

### **Archived Documents:**
- Located in `archive/`
- Historical reference only
- Not required reading
- Useful for context/troubleshooting

---

## 🔄 **Maintenance**

### **When to Update:**
- Major architecture changes → Update `01-CORE/`
- New features → Add to `02-FEATURES/`
- Infrastructure changes → Update `03-INFRASTRUCTURE/`
- Resolved issues → Move to `archive/fixes/`
- Completed reviews → Move to `archive/reviews/`
- Status changes → Update `CURRENT_STATUS.md`

### **Archive Policy:**
- Code review documents → Archive after addressed
- Fix notes → Archive after merged
- Implementation notes → Archive after deployed
- Iteration documents → Archive after finalized

---

## 🎉 **Changelog**

### **v1.1 - January 13, 2026:**
- ✅ Updated all documentation for current codebase state
- ✅ Added service configuration verification
- ✅ Updated test pass rates (98.5%)
- ✅ Added API route count (38 dynamic routes)
- ✅ Added V4_Issues.txt reference

### **v1.0 - January 12, 2026:**
- ✅ Reorganized ARCH_DOCS into logical structure
- ✅ Archived 20+ historical documents
- ✅ Consolidated duplicate reviews
- ✅ Added comprehensive index

---

## 📞 **Support**

**Questions about:**
- Current status → See `CURRENT_STATUS.md`
- Quick help → See `QUICK_REFERENCE.md`
- Architecture → See `01-CORE/MASTER_ARCHITECTURE.txt`
- Features → See `02-FEATURES/`
- Deployment → See `04-DESIGN/DEPLOYMENT_NOTES.md`
- Recent fixes → See `V4_Issues.txt`
- Historical issues → See `archive/`

---

**Maintained by:** Development Team  
**Last Review:** January 13, 2026  
**Next Review:** Quarterly or on major releases

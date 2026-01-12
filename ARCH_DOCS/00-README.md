# CallMonitor Architecture Documentation

**Last Updated:** January 12, 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready

---

## 📖 **Quick Navigation**

### **🎯 Start Here:**
- **[MASTER_ARCHITECTURE.txt](01-CORE/MASTER_ARCHITECTURE.txt)** - Complete system architecture
- **[Schema.txt](01-CORE/Schema.txt)** - Database schema
- **[Translation_Agent](02-FEATURES/Translation_Agent)** - Live translation feature guide

### **📁 Folder Structure:**

```
ARCH_DOCS/
├── 00-README.md (this file) - Navigation index
├── 01-CORE/ - Core architecture & system design
├── 02-FEATURES/ - Feature-specific documentation
├── 03-INFRASTRUCTURE/ - Infrastructure & deployment
├── 04-DESIGN/ - Design principles & UX guidelines
├── 05-REFERENCE/ - Reference materials & samples
└── archive/ - Historical documents & resolved issues
```

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
- Missed issues analysis

#### **archive/implementations/** - Completed Work
- Live translation completion notes
- Implementation summaries
- Issues fixed summaries

**When to read:** Understanding historical context, troubleshooting similar issues

---

## 🚀 **Quick Start Guides**

### **For New Developers:**
1. Read `01-CORE/MASTER_ARCHITECTURE.txt`
2. Review `01-CORE/Schema.txt`
3. Check `04-DESIGN/UX_DESIGN_PRINCIPLES.txt`

### **For Feature Development:**
1. Check `02-FEATURES/` for existing feature docs
2. Follow patterns in `01-CORE/MASTER_ARCHITECTURE.txt`
3. Review `01-CORE/ERROR_HANDLING_PLAN.txt`

### **For Debugging:**
1. Check feature-specific docs in `02-FEATURES/`
2. Review `archive/fixes/` for similar issues
3. Consult `01-CORE/ERROR_HANDLING_PLAN.txt`

### **For Deployment:**
1. Read `04-DESIGN/DEPLOYMENT_NOTES.md`
2. Review `03-INFRASTRUCTURE/MEDIA_PLANE_ARCHITECTURE.txt`
3. Check environment requirements in feature docs

---

## 🎯 **Key Documents Summary**

| Document | Purpose | Audience | Status |
|----------|---------|----------|--------|
| MASTER_ARCHITECTURE.txt | System design | All devs | ✅ Current |
| Schema.txt | Database schema | Backend devs | ✅ Current |
| Translation_Agent | Live translation | Feature devs | ✅ Complete |
| SECRET_SHOPPER_INFRASTRUCTURE.md | Secret shopper | Feature devs | ✅ Complete |
| UX_DESIGN_PRINCIPLES.txt | UI/UX standards | Frontend devs | ✅ Current |
| FREESWITCH_RUNBOOK.md | Media ops | DevOps | 🟡 Future |

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

### **Archive Policy:**
- Code review documents → Archive after addressed
- Fix notes → Archive after merged
- Implementation notes → Archive after deployed
- Iteration documents → Archive after finalized

---

## 🎉 **Recent Changes**

### **January 12, 2026:**
- ✅ Reorganized ARCH_DOCS into logical structure
- ✅ Archived 20+ historical documents
- ✅ Consolidated duplicate reviews
- ✅ Added comprehensive index (this file)
- ✅ Updated folder structure for clarity

---

## 📞 **Support**

**Questions about:**
- Architecture → See `01-CORE/MASTER_ARCHITECTURE.txt`
- Features → See `02-FEATURES/`
- Deployment → See `04-DESIGN/DEPLOYMENT_NOTES.md`
- Historical issues → See `archive/`

---

**Maintained by:** Development Team  
**Last Review:** January 12, 2026  
**Next Review:** Quarterly or on major releases

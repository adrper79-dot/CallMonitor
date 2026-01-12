# Quick Reference - CallMonitor

**Version:** 1.0.0 | **Date:** January 12, 2026 | **Status:** ✅ Production

---

## 🚀 **Essential URLs**

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/` | Quick call form + bulk upload |
| Voice Operations | `/voice` | Call management |
| Settings | `/settings` | Voice config + toggles |
| Tests | `/test` | System health dashboard |

---

## 📞 **How to Make a Call**

### **Single Call:**
1. Go to `/`
2. Enter phone number (+E.164 format)
3. Click "Start Call"

### **Bulk Calls:**
1. Go to `/`
2. Click "📋 Bulk Upload"
3. Download template
4. Fill CSV with phone numbers
5. Upload & click "Start Bulk Calls"

---

## 🌐 **Live Translation Setup**

### **Requirements:**
- ✅ Business or Enterprise plan
- ✅ Feature flag: `TRANSLATION_LIVE_ASSIST_PREVIEW=true`
- ✅ Translation enabled in settings
- ✅ Languages configured (From/To)

### **Where to Configure:**
1. Go to `/settings`
2. Toggle "Live Translation (Preview)"
3. Select From language (e.g., English)
4. Select To language (e.g., Spanish)
5. Done!

---

## 🧪 **Run Tests**

### **Via UI:**
1. Go to `/test`
2. Click "▶️ Run All Tests"
3. Review results (🔴🟡🟢)

### **Via CLI:**
```bash
npm test -- --run         # Unit tests
npx tsc --noEmit           # TypeScript check
```

---

## 📁 **Key Files**

### **Most Important:**
- `ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt` - System design
- `ARCH_DOCS/01-CORE/Schema.txt` - Database schema
- `ARCH_DOCS/02-FEATURES/Translation_Agent` - Live translation guide

### **Feature Docs:**
- `ARCH_DOCS/02-FEATURES/BULK_UPLOAD_FEATURE.md` - Bulk upload
- `ARCH_DOCS/02-FEATURES/TEST_DASHBOARD.md` - Test system
- `ARCH_DOCS/02-FEATURES/SECRET_SHOPPER_INFRASTRUCTURE.md` - Scoring

---

## 🔐 **Plans & Permissions**

| Plan | Recording | Transcription | Translation | Live Translation | Survey | Scoring |
|------|-----------|---------------|-------------|------------------|--------|---------|
| Free/Base | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pro/Standard | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Global | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Business | ✅ | ✅ | ✅ | ✅ (Preview) | ✅ | ✅ |
| Enterprise | ✅ | ✅ | ✅ | ✅ (Preview) | ✅ | ✅ |

---

## 🛠️ **Common Tasks**

### **Add New User:**
```bash
# Via UI: /auth/signup
# Via API: POST /api/auth/signup
```

### **Update Organization Plan:**
```sql
UPDATE organizations SET plan = 'business' WHERE id = 'org-id';
```

### **Enable Live Translation:**
```bash
# 1. Set env var
TRANSLATION_LIVE_ASSIST_PREVIEW=true

# 2. Update org plan to business/enterprise
# 3. Go to /settings and toggle on
```

### **View Call Details:**
1. Go to `/voice`
2. Click call in sidebar
3. View modulations, artifacts, timeline

---

## 🐛 **Troubleshooting**

### **Translation toggle not visible:**
- Check plan is Business or Enterprise
- Verify feature flag enabled
- Check `/settings` page (not `/voice`)

### **401 Auth errors:**
- Verify Supabase keys configured correctly
- Check both `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
- Ensure `apikey` header included (not just Authorization)

### **Tests failing:**
- Run `npm test -- --run` to see details
- Check `/test` dashboard for visual status
- Review `archive/reviews/` for similar issues

---

## 📚 **Documentation Index**

### **Start Here:**
1. `00-README.md` - Full navigation guide
2. `CURRENT_STATUS.md` - This file
3. `QUICK_REFERENCE.md` - Cheat sheet

### **Core Docs:**
- `01-CORE/` - Architecture, schema, error handling
- `02-FEATURES/` - Feature-specific guides
- `03-INFRASTRUCTURE/` - Deployment & infrastructure
- `04-DESIGN/` - UX principles & deployment
- `05-REFERENCE/` - Sample data & references

### **Historical:**
- `archive/reviews/` - Past code reviews
- `archive/fixes/` - Resolved issues
- `archive/implementations/` - Completed work

---

## 🎯 **Next Steps**

### **For Development:**
1. Review `01-CORE/MASTER_ARCHITECTURE.txt`
2. Check `01-CORE/Schema.txt` for database structure
3. Follow patterns in existing features

### **For Testing:**
1. Go to `/test` and run full suite
2. Verify all lights are green
3. Test live translation with Business plan org

### **For Deployment:**
1. Review `04-DESIGN/DEPLOYMENT_NOTES.md`
2. Configure environment variables
3. Run database migrations
4. Verify webhooks configured

---

## 💡 **Tips**

- **Finding features?** Check navigation bar (🏠📞⚙️🧪)
- **Need help?** Read `00-README.md` for full index
- **Historical context?** Browse `archive/` folders
- **API details?** Check `01-CORE/MASTER_ARCHITECTURE.txt`

---

## 📊 **System Stats**

- **Files Modified:** 32
- **Features Deployed:** 20
- **Tests Passing:** 57/59 (96.6%)
- **Documentation Pages:** 30+
- **Lines of Code:** ~15,000+
- **API Endpoints:** 15+

---

**🚀 Everything you need in one place!**

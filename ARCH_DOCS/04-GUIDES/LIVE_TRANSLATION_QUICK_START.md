# Live Translation - Quick Start Guide

**Feature:** SignalWire AI Agent Live Translation  
**Audience:** Power Users, Quick Reference  
**Time to Setup:** 2 minutes

---

## 🚀 **Quick Start (5 Steps)**

### **1. Prerequisites** ✅

- [ ] Organization has Business plan or higher
- [ ] You have Owner or Admin role
- [ ] Database migration has been run
- [ ] You're on `/voice` page

---

### **2. Enable Live Translation** 🔄

1. Go to **Call Features** section
2. Toggle **"Live Translation"** to ON
3. See language selectors appear

---

### **3. Select Languages** 🌍

**From Language:** Language the caller speaks (e.g., Spanish)  
**To Language:** Language you want to hear (e.g., English)

**Tip:** Leave "From" blank for auto-detection (adds ~500ms latency).

---

### **4. Make a Call** 📞

1. Enter target phone number in E.164 format: `+12392027345`
2. Click **"Start Call"**
3. Wait for connection

---

### **5. Translation Happens Automatically** ✨

- Caller speaks → 1-3 seconds → Translated audio plays
- Real-time, automatic, seamless
- Call continues until hangup

---

## 🎯 **Supported Languages (12)**

```
English (en)     Spanish (es)     French (fr)      German (de)
Italian (it)     Portuguese (pt)  Chinese (zh)     Japanese (ja)
Korean (ko)      Arabic (ar)      Hindi (hi)       Russian (ru)
```

---

## 💡 **Common Scenarios**

### **Scenario 1: US Support for Spanish Speakers**

```
From Language: Spanish (es)
To Language: English (en)
Use Case: Spanish-speaking customer calls English support line
```

### **Scenario 2: International Sales Call**

```
From Language: French (fr)
To Language: English (en)
Use Case: French client calls US sales team
```

### **Scenario 3: Emergency Hotline**

```
From Language: (leave blank for auto-detect)
To Language: English (en)
Use Case: Multilingual emergency line
```

---

## ⚙️ **Optional: Voice Cloning**

**What it does:** Preserves caller's voice characteristics in translation  
**Default:** OFF  
**Recommendation:** Try without first, enable if generic voices unsatisfactory

**To enable:**

1. Enable Live Translation
2. Select languages
3. Toggle **"Voice Cloning"** to ON

---

## 🔍 **Verification Checklist**

After enabling, verify:

- [ ] Toggle shows "Live Translation" (not just "Translate")
- [ ] Blue "Preview" badge visible
- [ ] Two language dropdowns appear
- [ ] Selected languages persist after page refresh
- [ ] No console errors (F12 → Console)

---

## 📊 **What to Expect**

| Metric        | Value                                          |
| ------------- | ---------------------------------------------- |
| **Latency**   | 1-3 seconds (typical)                          |
| **Accuracy**  | 85-95% (general conversation)                  |
| **Cost**      | Included in Business plan                      |
| **Recording** | Original audio only (translation not recorded) |

---

## 🐛 **Quick Troubleshooting**

| Problem                | Quick Fix                              |
| ---------------------- | -------------------------------------- |
| **Toggle not visible** | Check plan is Business+, run migration |
| **Toggle grayed out**  | Check you have Owner/Admin role        |
| **Call fails**         | Verify E.164 format: `+1234567890`     |
| **No translation**     | Check Vercel logs for SWML endpoint    |
| **Transcript missing** | Wait 2-10 min, then refresh            |

---

## 📞 **Test Call Template**

```
Target Number:  +1-239-202-7345 (your test number)
From Language:  Spanish
To Language:    English
Voice Cloning:  OFF

Expected Flow:
1. Click "Start Call"
2. Your phone rings
3. Answer phone
4. Speak in Spanish: "Hola, ¿cómo estás?"
5. Hear English translation: "Hello, how are you?"
6. Hang up
7. Check call details for transcript (wait 5 min)
```

---

## 🎓 **Pro Tips**

1. **Specify Languages:** Auto-detect works but adds latency
2. **Structured Turn-Taking:** One speaker at a time for best results
3. **Test First:** Use your own number to test before customer calls
4. **Check Logs:** Monitor Vercel logs during first few calls
5. **Voice Cloning:** Experimental - test quality before relying on it

---

## 📚 **Full Documentation**

For detailed user flow, troubleshooting, and FAQs:

**See:** `ARCH_DOCS/04-GUIDES/LIVE_TRANSLATION_USER_FLOW.md`

---

## 🔗 **Quick Links**

- **Voice Operations:** `https://wordis-bond.com/voice`
- **Settings/Plan:** `https://wordis-bond.com/settings`
- **API Capabilities:** `GET /api/call-capabilities?orgId={uuid}`
- **Vercel Logs:** `npx vercel logs --follow`

---

## 📝 **Need More Help?**

**Full User Flow:** `ARCH_DOCS/04-GUIDES/LIVE_TRANSLATION_USER_FLOW.md`  
**Status Report:** `SIGNALWIRE_LIVE_TRANSLATION_STATUS.md`  
**Support:** support@wordis-bond.com

---

**Version:** 1.0 | **Date:** 2026-01-15

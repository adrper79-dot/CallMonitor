# Bulk Call Upload Feature

## 📋 **Overview**

Added bulk phone number upload feature to the main page for making test calls in batch.

---

## ✨ **Features**

1. ✅ **CSV Template Download** - Pre-formatted template with all required columns
2. ✅ **Drag & Drop Upload** - Easy file selection with visual feedback
3. ✅ **Real-time Processing** - Calls initiated sequentially with progress tracking
4. ✅ **Results Dashboard** - Visual summary with success/failure counts
5. ✅ **Results Export** - Download CSV with call IDs and errors
6. ✅ **Error Handling** - Validates phone numbers and reports issues

---

## 📁 **Files Created**

1. ✅ `app/api/voice/bulk-upload/route.ts` - API endpoint for CSV processing
2. ✅ `components/BulkCallUpload.tsx` - UI component
3. ✅ `ARCH_DOCS/BULK_UPLOAD_FEATURE.md` - This documentation

---

## 📝 **CSV Template Format**

```csv
phone_number,description,notes,results
+15551234567,Test Call 1,Optional notes here,
+15559876543,Test Call 2,Another note,
+15555555555,Test Call 3,,
```

**Columns:**
- `phone_number` (required) - E.164 format (e.g., +15551234567)
- `description` (optional) - Human-readable description
- `notes` (optional) - Additional notes/metadata
- `results` (optional) - Reserved for results export

---

## 🚀 **Usage**

### **Step 1: Download Template**
1. Go to main page (`/`)
2. Click "📋 Bulk Upload" button
3. Click "📥 Download Template"
4. Template downloads as `bulk_call_template.csv`

### **Step 2: Fill Template**
Open CSV and add phone numbers:
```csv
phone_number,description,notes,results
+15551234001,Customer Support Test,Test greeting message,
+15551234002,Sales Team Test,Test transfer logic,
+15551234003,After Hours Test,Test voicemail,
```

### **Step 3: Upload & Process**
1. Click the file upload area
2. Select your CSV file
3. Click "🚀 Start Bulk Calls"
4. Watch progress in real-time

### **Step 4: Download Results**
1. Review summary (Total, Successful, Failed)
2. Check detailed results table
3. Click "💾 Download Results" for CSV with call IDs

---

## 📊 **Results Format**

Downloaded results include:
```csv
phone_number,description,notes,status,call_id,error
+15551234001,Customer Support Test,Test greeting,success,abc123-...,
+15551234002,Sales Team Test,Test transfer,success,def456-...,
+15551234003,Invalid Number,Bad format,error,,Invalid phone format (must be E.164)
```

---

## 🔧 **API Endpoints**

### **GET /api/voice/bulk-upload**
Downloads CSV template

**Response:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="bulk_call_template.csv"
```

### **POST /api/voice/bulk-upload**
Processes bulk upload

**Request:**
- `multipart/form-data`
- `file`: CSV file
- `organization_id`: Organization UUID

**Response:**
```json
{
  "success": true,
  "total": 10,
  "successful": 8,
  "failed": 2,
  "results": [
    {
      "phone_number": "+15551234567",
      "description": "Test Call",
      "notes": "Notes here",
      "status": "success",
      "call_id": "abc-123-..."
    }
  ]
}
```

---

## ⚙️ **Technical Details**

### **Validation:**
- Phone numbers must be E.164 format: `^\+[1-9]\d{1,14}$`
- Missing phone numbers are skipped with error
- Invalid formats are caught before call initiation

### **Processing:**
- Calls are initiated sequentially (100ms delay between calls)
- Each call uses `startCallHandler` with default modulations:
  - `record: true`
  - `transcribe: true`
  - `translate: false`

### **Rate Limiting:**
- Built-in 100ms delay between calls
- Prevents overwhelming the system
- Can be adjusted in API route if needed

---

## 🎨 **UI Features**

### **Toggle View:**
- Switch between single call form and bulk upload
- Button: "📋 Bulk Upload" / "📞 Single Call"

### **File Upload Area:**
- Drag & drop support
- Visual feedback when file selected
- Shows filename with checkmark

### **Results Table:**
- Color-coded status (✓ green / ✗ red)
- Scrollable for large datasets
- Sticky header
- Hover effects

### **Summary Cards:**
- Total processed
- Successful (green)
- Failed (red)
- Center-aligned grid layout

---

## 📈 **Use Cases**

1. **QA Testing**
   - Upload list of test numbers
   - Verify system behavior at scale
   - Document results for test reports

2. **Customer Outreach**
   - Bulk notification calls
   - Survey campaigns
   - Appointment reminders

3. **System Load Testing**
   - Test concurrent call handling
   - Validate rate limiting
   - Monitor system performance

4. **Integration Testing**
   - Test SignalWire integration
   - Verify recording/transcription
   - Check webhook flows

---

## 🔒 **Security**

- Organization ID required
- Uses existing RBAC/authentication
- Input validation on phone format
- Error messages don't leak sensitive data
- CSV parsing with safe defaults

---

## 🐛 **Error Handling**

**Common Errors:**
1. "Missing phone number" - Row has no phone_number column
2. "Invalid phone format" - Not E.164 format
3. "Call failed" - `startCallHandler` returned error
4. "Unknown error" - Unexpected exception

**All errors are:**
- Captured per-row
- Included in results
- Downloadable in results CSV
- Logged for debugging

---

## 📝 **Example Workflow**

```
1. User downloads template
   ↓
2. User fills with 100 phone numbers
   ↓
3. User uploads CSV
   ↓
4. System validates all rows
   ↓
5. System initiates calls sequentially
   ↓
6. User sees real-time results
   ↓
7. User downloads results CSV
   ↓
8. User reviews call IDs and errors
```

---

## 🎯 **Future Enhancements**

**Possible additions:**
- [ ] Real-time progress bar
- [ ] Pause/resume functionality
- [ ] Custom modulation settings per row
- [ ] Schedule bulk calls for later
- [ ] Email notification when complete
- [ ] Webhook for results
- [ ] Retry failed calls
- [ ] Batch size limits

---

## 📊 **Dependencies**

**Added:**
- `csv-parse` - CSV parsing library

**Used:**
- `startCallHandler` - Core call initiation
- `FormData` API - File upload handling
- Next.js App Router - API routes

---

## 🎉 **Summary**

**Added complete bulk upload system:**
- ✅ CSV template download
- ✅ File upload UI
- ✅ Batch call processing
- ✅ Results tracking
- ✅ Error handling
- ✅ Results export

**Location:** Main page (`/`) with toggle button

**Ready to use!** 🚀

---

**Date:** January 12, 2026  
**Feature:** Bulk Call Upload  
**Status:** ✅ COMPLETE

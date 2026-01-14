# CallMonitor Chrome Extension

**Last Updated:** January 14, 2026  
**Version:** 1.0.0  
**Status:** Implemented

---

## Overview

The CallMonitor Chrome Extension provides:

- **Quick Call** - Make calls directly from the browser
- **Click-to-Call** - Auto-detect phone numbers on any webpage
- **Schedule Calls** - Book future calls from context menu
- **Notifications** - Real-time call status updates

---

## Architecture

```
chrome-extension/
├── manifest.json           # Extension manifest (Manifest V3)
├── icons/                  # Extension icons (16, 32, 48, 128px)
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.js            # Popup logic
│   └── options.html        # Settings page
├── background/
│   └── service-worker.js   # Background tasks
├── content/
│   ├── content.js          # Phone number detection
│   └── content.css         # Styling for highlights
└── README.md               # Installation guide
```

---

## Features

### 1. Quick Call (Popup)

Click the extension icon to:
- Enter a phone number
- Start a call with one click
- View recent calls
- Access dashboard

### 2. Click-to-Call (Content Script)

Automatically on every webpage:
- Detects phone numbers
- Highlights them in blue
- Shows Call/Schedule tooltip on hover
- Supports international formats

**Supported Formats:**
- `+1234567890` (E.164)
- `(123) 456-7890` (US format)
- `123-456-7890` (Dashes)
- `123.456.7890` (Dots)

### 3. Context Menu

Right-click selected text to:
- "📞 Call with CallMonitor"
- "📅 Schedule Call with CallMonitor"

### 4. Notifications

Chrome notifications for:
- Call started
- Call completed
- Booking reminders

---

## Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "CallMonitor - Click to Call",
  "version": "1.0.0",
  
  "permissions": [
    "activeTab",
    "storage",
    "contextMenus",
    "notifications"
  ],
  
  "host_permissions": [
    "https://voxsouth.online/*"
  ],
  
  "action": {
    "default_popup": "popup/popup.html"
  },
  
  "background": {
    "service_worker": "background/service-worker.js"
  },
  
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content.js"],
    "css": ["content/content.css"]
  }]
}
```

---

## API Integration

The extension communicates with CallMonitor API:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health/user` | GET | Check authentication |
| `/api/voice/call` | POST | Initiate calls |
| `/api/calls` | GET | List recent calls |
| `/api/bookings` | POST | Create bookings |

**Authentication:**
- Uses browser session cookies (`credentials: 'include'`)
- Requires user to be signed in via web app

---

## Installation

### Developer Mode (Local)

1. Clone the repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `chrome-extension/` folder

### Chrome Web Store (Future)

1. Package extension as `.zip`
2. Submit to Chrome Web Store
3. Users install via store link

---

## Settings (Options Page)

User-configurable settings:

| Setting | Default | Description |
|---------|---------|-------------|
| API URL | voxsouth.online | CallMonitor server URL |
| Click-to-call enabled | true | Auto-detect phone numbers |
| Show tooltip | true | Show Call/Schedule on hover |
| Call notifications | true | Show call status notifications |
| Booking reminders | true | Remind before scheduled calls |
| Default record | true | Record calls by default |
| Default transcribe | true | Transcribe calls by default |

---

## Content Script Security

- **DOM Isolation** - Uses unique class names (`callmonitor-*`)
- **No External Scripts** - All code bundled in extension
- **Limited Permissions** - Only `activeTab` for current page
- **No Data Collection** - Phone numbers processed locally

---

## Build & Distribution

### Creating Icons

Required icon sizes:
- `icons/icon16.png` - Toolbar
- `icons/icon32.png` - Toolbar (2x)
- `icons/icon48.png` - Extensions page
- `icons/icon128.png` - Chrome Web Store

### Packaging for Distribution

```bash
cd chrome-extension
zip -r callmonitor-extension.zip . -x ".*"
```

---

## Troubleshooting

### Extension not loading?
- Enable Developer mode in `chrome://extensions/`
- Check for manifest errors

### Can't make calls?
- Sign in to CallMonitor web app first
- Check API URL in settings

### Phone numbers not detected?
- Ensure "Click-to-call enabled" is on
- Refresh page after enabling

### CORS errors?
- Extension must be in `host_permissions`
- API must allow cross-origin with credentials

---

## Future Enhancements

- [ ] Chrome Web Store publication
- [ ] Firefox extension port
- [ ] Edge extension port
- [ ] Safari extension port
- [ ] Keyboard shortcuts
- [ ] Badge with call count
- [ ] Sync settings across devices

---

## References

- Chrome Extensions Manifest V3: https://developer.chrome.com/docs/extensions/mv3/
- Content Scripts: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- Service Workers: https://developer.chrome.com/docs/extensions/mv3/service_workers/

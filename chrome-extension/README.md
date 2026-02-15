# Word Is Bond — Chrome Extension

Click-to-call from any CRM. Record, transcribe, and analyze every call directly from HubSpot, Salesforce, Pipedrive, and Zoho.

## Features

- **Click-to-Call** — Detects phone numbers on CRM pages and adds call buttons inline
- **Floating Dial Widget** — Quick-dial from any CRM page via a bottom-right FAB
- **Popup Controls** — Login, quick dial, and recent calls list in the extension popup
- **Multi-CRM Support** — HubSpot, Salesforce, Pipedrive, Zoho (extensible)
- **SPA-Aware** — MutationObserver re-scans on CRM navigation changes

## Install (Developer Mode)

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder from this repo
5. The extension icon appears in the toolbar — click it to sign in

## Project Structure

```
chrome-extension/
├── manifest.json    # Extension manifest (MV3)
├── background.js    # Service worker — auth & API calls
├── content.js       # Content script — phone detection & UI injection
├── content.css      # Styles for injected UI elements
├── popup.html       # Extension popup markup
├── popup.js         # Popup logic — auth, dial, recent calls
├── icons/           # Extension icons (16, 48, 128 px)
└── README.md
```

## Icons

Place PNG icons in the `icons/` directory:

- `icon16.png` — 16×16 px (toolbar)
- `icon48.png` — 48×48 px (extensions page)
- `icon128.png` — 128×128 px (Chrome Web Store)

## Configuration

The extension connects to:

| Endpoint | URL |
|----------|-----|
| API | `https://wordisbond-api.adrper79.workers.dev/api/` |
| Dashboard | `https://wordis-bond.com` |

To change the API URL, update `API_BASE` in `background.js`.

## Build for Chrome Web Store

1. Ensure icons are present in `icons/`
2. Zip the `chrome-extension/` folder contents (not the folder itself)
3. Upload at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Fill in listing details, screenshots, and privacy policy
5. Submit for review

## Supported CRMs

| CRM | URL Pattern | Status |
|-----|-------------|--------|
| HubSpot | `app.hubspot.com/*` | ✅ |
| Salesforce | `*.my.salesforce.com/*`, `*.lightning.force.com/*` | ✅ |
| Pipedrive | `*.pipedrive.com/*` | ✅ |
| Zoho CRM | `*.zoho.com/*` | ✅ |

## Security Notes

- Auth tokens stored in `chrome.storage.local` (extension-scoped)
- All API calls use `Bearer` token auth over HTTPS
- No data leaves the extension except to the WIB API
- Content scripts only run on matched CRM domains

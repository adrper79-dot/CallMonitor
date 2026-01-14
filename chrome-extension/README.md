# CallMonitor Chrome Extension

A powerful Chrome extension for managing voice calls, scheduling bookings, and click-to-call functionality directly from any webpage.

## Features

### 📞 Quick Call
- Make calls directly from the extension popup
- One-click calling with automatic recording and transcription

### 📅 Schedule Calls
- Book future calls with Cal.com-style scheduling
- Set duration, add notes, and manage attendee details

### 🔗 Click-to-Call
- Automatically detects phone numbers on any webpage
- Hover to see Call/Schedule options
- Right-click context menu for selected phone numbers

### 🔔 Notifications
- Real-time call status notifications
- Booking reminders before scheduled calls

## Installation

### From Source (Development)

1. Clone this repository or download the `chrome-extension` folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `chrome-extension` folder

### Building Icons

The extension requires icon files in the `icons/` folder:
- `icon16.png` (16x16)
- `icon32.png` (32x32)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

You can create these from any square image or use the CallMonitor logo.

## Configuration

1. Click the extension icon
2. Sign in to your CallMonitor account
3. Go to Settings (⚙️) to customize:
   - API URL (default: https://voxsouth.online)
   - Click-to-call enabled/disabled
   - Default call settings

## Usage

### Making a Call
1. Click the extension icon
2. Enter a phone number in E.164 format (+1234567890)
3. Click "Start Call"

### Scheduling a Call
1. Click the extension icon
2. Click "📅 Schedule"
3. Fill in the booking details
4. The call will be automatically placed at the scheduled time

### Click-to-Call on Webpages
1. Visit any webpage with phone numbers
2. Phone numbers are automatically highlighted in blue
3. Hover over a number to see Call/Schedule buttons
4. Or right-click selected text containing a phone number

## Permissions

This extension requires the following permissions:

- **activeTab**: To detect phone numbers on the current page
- **storage**: To save your settings
- **contextMenus**: For right-click call functionality
- **notifications**: For call and booking notifications

## API Integration

The extension communicates with the CallMonitor API:

- `GET /api/health/user` - Check authentication
- `POST /api/voice/call` - Initiate calls
- `GET /api/calls` - List recent calls
- `POST /api/bookings` - Create bookings

## Troubleshooting

### Extension not loading?
- Ensure Developer mode is enabled
- Check for errors in `chrome://extensions/`

### Can't make calls?
- Make sure you're signed in to CallMonitor
- Check the API URL in settings

### Phone numbers not detected?
- Enable "Click-to-call" in settings
- Refresh the page after installation

## Privacy

- No data is collected or stored by the extension
- All data is transmitted securely to your CallMonitor server
- Phone numbers are only processed locally for click-to-call

## Support

For issues or feature requests, contact your CallMonitor administrator.

---

Made with ❤️ for CallMonitor

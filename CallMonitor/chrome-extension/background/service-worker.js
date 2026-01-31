/**
 * Word Is Bond Chrome Extension - Background Service Worker
 * 
 * Handles context menus, notifications, and background tasks.
 */

// Configuration
const API_BASE_URL = 'https://voxsouth.online'

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for phone numbers
  chrome.contextMenus.create({
    id: 'callmonitor-call',
    title: '📞 Call with Word Is Bond',
    contexts: ['selection']
  })
  
  chrome.contextMenus.create({
    id: 'callmonitor-schedule',
    title: '📅 Schedule Call with Word Is Bond',
    contexts: ['selection']
  })
  
  console.log('Word Is Bond extension installed')
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText?.trim()
  
  if (!selectedText) {
    return
  }
  
  // Try to extract phone number from selection
  const phoneMatch = selectedText.match(/\+?[\d\s\-\(\)]{7,}/)
  const phoneNumber = phoneMatch ? phoneMatch[0].replace(/[\s\-\(\)]/g, '') : selectedText
  
  if (info.menuItemId === 'callmonitor-call') {
    // Open popup or make call directly
    await handleQuickCall(phoneNumber)
  } else if (info.menuItemId === 'callmonitor-schedule') {
    // Open scheduling page with phone number
    const url = `${API_BASE_URL}/voice?action=schedule&phone=${encodeURIComponent(phoneNumber)}`
    chrome.tabs.create({ url })
  }
})

// Handle quick call from context menu
async function handleQuickCall(phoneNumber) {
  // Validate phone format
  if (!phoneNumber.match(/^\+?[1-9]\d{6,14}$/)) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Invalid Phone Number',
      message: 'The selected text does not appear to be a valid phone number.'
    })
    return
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/voice/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        phone_number: phoneNumber,
        modulations: {
          record: true,
          transcribe: true
        }
      })
    })
    
    const data = await response.json()
    
    if (response.ok && data.success) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Call Started',
        message: `Calling ${phoneNumber}...`
      })
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Call Failed',
        message: data.error?.message || 'Unable to start call. Please sign in first.'
      })
    }
  } catch (error) {
    console.error('Call error:', error)
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Connection Error',
      message: 'Unable to connect to Word Is Bond. Please check your connection.'
    })
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'call') {
    handleQuickCall(request.phoneNumber)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true // Keep channel open for async response
  }
  
  if (request.action === 'schedule') {
    const url = `${API_BASE_URL}/voice?action=schedule&phone=${encodeURIComponent(request.phoneNumber)}`
    chrome.tabs.create({ url })
    sendResponse({ success: true })
  }
  
  if (request.action === 'openDashboard') {
    chrome.tabs.create({ url: `${API_BASE_URL}/voice` })
    sendResponse({ success: true })
  }
})

// Handle alarm for scheduled reminders (future enhancement)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('booking-reminder-')) {
    const bookingId = alarm.name.replace('booking-reminder-', '')
    // Fetch booking details and show notification
    showBookingReminder(bookingId)
  }
})

async function showBookingReminder(bookingId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}`, {
      credentials: 'include'
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success && data.booking) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Upcoming Call',
          message: `Call with ${data.booking.attendee_name || data.booking.attendee_phone} in 5 minutes`
        })
      }
    }
  } catch (error) {
    console.error('Failed to fetch booking for reminder:', error)
  }
}

console.log('Word Is Bond service worker started')

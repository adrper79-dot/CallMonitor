/**
 * CallMonitor Chrome Extension - Popup Script
 * 
 * Handles popup UI interactions, authentication, and API calls.
 */

// Configuration
const API_BASE_URL = 'https://voxsouth.online' // Update for production
const DEV_API_URL = 'http://localhost:3000'

// State
let isAuthenticated = false
let currentUser = null
let apiUrl = API_BASE_URL

// Elements
const connectionStatus = document.getElementById('connectionStatus')
const authSection = document.getElementById('authSection')
const mainContent = document.getElementById('mainContent')
const signInBtn = document.getElementById('signInBtn')
const quickCallBtn = document.getElementById('quickCallBtn')
const scheduleBtn = document.getElementById('scheduleBtn')
const dashboardBtn = document.getElementById('dashboardBtn')
const settingsBtn = document.getElementById('settingsBtn')
const phoneNumber = document.getElementById('phoneNumber')
const callBtn = document.getElementById('callBtn')
const callError = document.getElementById('callError')
const callSuccess = document.getElementById('callSuccess')
const recentCalls = document.getElementById('recentCalls')
const openDashboard = document.getElementById('openDashboard')

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings()
  await checkAuth()
  setupEventListeners()
})

// Load settings from storage
async function loadSettings() {
  const result = await chrome.storage.sync.get(['apiUrl', 'authToken', 'user'])
  if (result.apiUrl) {
    apiUrl = result.apiUrl
  }
  if (result.authToken && result.user) {
    isAuthenticated = true
    currentUser = result.user
  }
}

// Check authentication status
async function checkAuth() {
  connectionStatus.textContent = 'Checking connection...'
  
  try {
    const response = await fetch(`${apiUrl}/api/health/user`, {
      credentials: 'include'
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success && data.user) {
        isAuthenticated = true
        currentUser = data.user
        await chrome.storage.sync.set({ user: data.user })
        showMainContent()
        loadRecentCalls()
        connectionStatus.textContent = `Connected as ${data.user.email || 'User'}`
      } else {
        showAuthSection()
        connectionStatus.textContent = 'Not signed in'
      }
    } else {
      showAuthSection()
      connectionStatus.textContent = 'Not signed in'
    }
  } catch (error) {
    console.error('Auth check failed:', error)
    connectionStatus.textContent = 'Connection error'
    showAuthSection()
  }
}

// Show/hide sections
function showAuthSection() {
  authSection.classList.remove('hidden')
  mainContent.classList.add('hidden')
}

function showMainContent() {
  authSection.classList.add('hidden')
  mainContent.classList.remove('hidden')
}

// Setup event listeners
function setupEventListeners() {
  // Sign in button
  signInBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: `${apiUrl}/admin/auth` })
  })
  
  // Quick call button
  quickCallBtn.addEventListener('click', () => {
    document.getElementById('callForm').scrollIntoView({ behavior: 'smooth' })
    phoneNumber.focus()
  })
  
  // Schedule button
  scheduleBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: `${apiUrl}/voice?action=schedule` })
  })
  
  // Dashboard button
  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: `${apiUrl}/voice` })
  })
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: `${apiUrl}/settings` })
  })
  
  // Call button
  callBtn.addEventListener('click', handleCall)
  
  // Phone number enter key
  phoneNumber.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleCall()
    }
  })
  
  // Open dashboard link
  openDashboard.addEventListener('click', (e) => {
    e.preventDefault()
    chrome.tabs.create({ url: `${apiUrl}/voice` })
  })
}

// Handle call
async function handleCall() {
  const phone = phoneNumber.value.trim()
  
  if (!phone) {
    showError('Please enter a phone number')
    return
  }
  
  // Validate phone format
  if (!phone.match(/^\+?[1-9]\d{1,14}$/)) {
    showError('Invalid phone format. Use E.164 (e.g., +1234567890)')
    return
  }
  
  setLoading(true)
  hideMessages()
  
  try {
    const response = await fetch(`${apiUrl}/api/voice/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        phone_number: phone,
        modulations: {
          record: true,
          transcribe: true
        }
      })
    })
    
    const data = await response.json()
    
    if (response.ok && data.success) {
      showSuccess('Call initiated! Check dashboard for status.')
      phoneNumber.value = ''
      
      // Send notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Call Started',
        message: `Calling ${phone}...`
      })
      
      // Reload recent calls
      setTimeout(loadRecentCalls, 2000)
    } else {
      showError(data.error?.message || data.error || 'Failed to start call')
    }
  } catch (error) {
    console.error('Call error:', error)
    showError('Failed to connect to server')
  } finally {
    setLoading(false)
  }
}

// Load recent calls
async function loadRecentCalls() {
  try {
    const response = await fetch(`${apiUrl}/api/calls?limit=5`, {
      credentials: 'include'
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success && data.calls && data.calls.length > 0) {
        renderRecentCalls(data.calls)
      } else {
        recentCalls.innerHTML = '<div class="call-item"><div class="details"><div class="phone">No recent calls</div></div></div>'
      }
    }
  } catch (error) {
    console.error('Failed to load recent calls:', error)
    recentCalls.innerHTML = '<div class="call-item"><div class="details"><div class="phone">Unable to load</div></div></div>'
  }
}

// Render recent calls
function renderRecentCalls(calls) {
  recentCalls.innerHTML = calls.map(call => {
    const statusClass = call.status === 'completed' ? 'completed' : 
                       call.status === 'failed' ? 'failed' : ''
    const icon = call.status === 'completed' ? '✓' : 
                call.status === 'failed' ? '✕' : '📞'
    const time = call.started_at ? formatTime(call.started_at) : 'Pending'
    
    return `
      <div class="call-item" data-call-id="${call.id}">
        <div class="icon">${icon}</div>
        <div class="details">
          <div class="phone">${call.call_sid ? call.call_sid.slice(0, 12) + '...' : 'Call #' + call.id.slice(0, 8)}</div>
          <div class="time">${time}</div>
        </div>
        <div class="status ${statusClass}">${call.status || 'unknown'}</div>
      </div>
    `
  }).join('')
  
  // Add click handlers
  document.querySelectorAll('.call-item[data-call-id]').forEach(item => {
    item.addEventListener('click', () => {
      const callId = item.dataset.callId
      chrome.tabs.create({ url: `${apiUrl}/voice?call=${callId}` })
    })
  })
}

// Format time
function formatTime(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

// UI Helpers
function setLoading(loading) {
  const btnText = callBtn.querySelector('.btn-text')
  const loadingEl = callBtn.querySelector('.loading')
  
  if (loading) {
    btnText.classList.add('hidden')
    loadingEl.classList.remove('hidden')
    callBtn.disabled = true
  } else {
    btnText.classList.remove('hidden')
    loadingEl.classList.add('hidden')
    callBtn.disabled = false
  }
}

function showError(message) {
  callError.textContent = message
  callError.classList.remove('hidden')
}

function showSuccess(message) {
  callSuccess.textContent = message
  callSuccess.classList.remove('hidden')
}

function hideMessages() {
  callError.classList.add('hidden')
  callSuccess.classList.add('hidden')
}

/**
 * CallMonitor Chrome Extension - Content Script
 * 
 * Detects phone numbers on web pages and adds click-to-call functionality.
 */

// Configuration
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g
const INTL_PHONE_REGEX = /\+[1-9]\d{6,14}/g

// State
let isEnabled = true
let tooltipElement = null

// Initialize
function init() {
  // Check if extension is enabled
  chrome.storage.sync.get(['clickToCallEnabled'], (result) => {
    isEnabled = result.clickToCallEnabled !== false // Default to true
    if (isEnabled) {
      scanPageForPhoneNumbers()
      observeDOM()
    }
  })
  
  // Create tooltip element
  createTooltip()
}

// Create tooltip for hover actions
function createTooltip() {
  tooltipElement = document.createElement('div')
  tooltipElement.className = 'callmonitor-tooltip'
  tooltipElement.innerHTML = `
    <button class="callmonitor-tooltip-btn callmonitor-call" title="Call Now">
      📞 Call
    </button>
    <button class="callmonitor-tooltip-btn callmonitor-schedule" title="Schedule Call">
      📅 Schedule
    </button>
  `
  tooltipElement.style.display = 'none'
  document.body.appendChild(tooltipElement)
  
  // Add event listeners
  tooltipElement.querySelector('.callmonitor-call').addEventListener('click', (e) => {
    e.stopPropagation()
    const phone = tooltipElement.dataset.phone
    if (phone) {
      chrome.runtime.sendMessage({ action: 'call', phoneNumber: phone })
      hideTooltip()
    }
  })
  
  tooltipElement.querySelector('.callmonitor-schedule').addEventListener('click', (e) => {
    e.stopPropagation()
    const phone = tooltipElement.dataset.phone
    if (phone) {
      chrome.runtime.sendMessage({ action: 'schedule', phoneNumber: phone })
      hideTooltip()
    }
  })
}

// Scan page for phone numbers
function scanPageForPhoneNumbers() {
  // Find all text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script, style, and already processed nodes
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        
        const tagName = parent.tagName.toLowerCase()
        if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT
        }
        
        if (parent.classList.contains('callmonitor-phone')) {
          return NodeFilter.FILTER_REJECT
        }
        
        // Check if contains phone number
        const text = node.textContent || ''
        if (PHONE_REGEX.test(text) || INTL_PHONE_REGEX.test(text)) {
          return NodeFilter.FILTER_ACCEPT
        }
        
        return NodeFilter.FILTER_REJECT
      }
    }
  )
  
  const nodesToProcess = []
  let node
  while ((node = walker.nextNode())) {
    nodesToProcess.push(node)
  }
  
  // Process nodes (in reverse to avoid DOM mutation issues)
  nodesToProcess.forEach(processTextNode)
}

// Process a text node containing phone numbers
function processTextNode(textNode) {
  const text = textNode.textContent || ''
  const parent = textNode.parentElement
  
  if (!parent || parent.classList.contains('callmonitor-phone')) {
    return
  }
  
  // Find all phone numbers
  const combined = new RegExp(`(${PHONE_REGEX.source})|(${INTL_PHONE_REGEX.source})`, 'g')
  const matches = [...text.matchAll(combined)]
  
  if (matches.length === 0) return
  
  // Create a document fragment to replace the text node
  const fragment = document.createDocumentFragment()
  let lastIndex = 0
  
  matches.forEach((match) => {
    // Add text before the match
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
    }
    
    // Create phone link
    const phoneText = match[0]
    const normalizedPhone = normalizePhone(phoneText)
    
    const phoneSpan = document.createElement('span')
    phoneSpan.className = 'callmonitor-phone'
    phoneSpan.textContent = phoneText
    phoneSpan.dataset.phone = normalizedPhone
    phoneSpan.title = 'Click to call with CallMonitor'
    
    // Add event listeners
    phoneSpan.addEventListener('mouseenter', (e) => showTooltip(e, normalizedPhone))
    phoneSpan.addEventListener('mouseleave', () => hideTooltipDelayed())
    phoneSpan.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      chrome.runtime.sendMessage({ action: 'call', phoneNumber: normalizedPhone })
    })
    
    fragment.appendChild(phoneSpan)
    lastIndex = match.index + match[0].length
  })
  
  // Add remaining text
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
  }
  
  // Replace the text node
  parent.replaceChild(fragment, textNode)
}

// Normalize phone number to E.164
function normalizePhone(phone) {
  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/[^\d+]/g, '')
  
  // If no + and 10 digits, assume US number
  if (!normalized.startsWith('+') && normalized.length === 10) {
    normalized = '+1' + normalized
  }
  
  // If 11 digits starting with 1, assume US number
  if (!normalized.startsWith('+') && normalized.length === 11 && normalized.startsWith('1')) {
    normalized = '+' + normalized
  }
  
  // Ensure + prefix
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized
  }
  
  return normalized
}

// Show tooltip
function showTooltip(event, phone) {
  if (!tooltipElement) return
  
  tooltipElement.dataset.phone = phone
  tooltipElement.style.display = 'flex'
  
  const rect = event.target.getBoundingClientRect()
  const tooltipRect = tooltipElement.getBoundingClientRect()
  
  let top = rect.bottom + window.scrollY + 4
  let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2)
  
  // Ensure tooltip stays within viewport
  if (left < 8) left = 8
  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = window.innerWidth - tooltipRect.width - 8
  }
  
  tooltipElement.style.top = `${top}px`
  tooltipElement.style.left = `${left}px`
}

let hideTimeout
function hideTooltipDelayed() {
  hideTimeout = setTimeout(() => {
    hideTooltip()
  }, 300)
}

function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.style.display = 'none'
  }
}

// Keep tooltip visible when hovering over it
if (tooltipElement) {
  tooltipElement.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout)
  })
  
  tooltipElement.addEventListener('mouseleave', () => {
    hideTooltip()
  })
}

// Observe DOM for dynamically added content
function observeDOM() {
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldScan = true
      }
    })
    
    if (shouldScan) {
      // Debounce scanning
      clearTimeout(window.callmonitorScanTimeout)
      window.callmonitorScanTimeout = setTimeout(() => {
        scanPageForPhoneNumbers()
      }, 500)
    }
  })
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

console.log('CallMonitor content script loaded')

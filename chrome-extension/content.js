/**
 * Word Is Bond — Content Script
 * Detects phone numbers on CRM pages and injects click-to-call UI.
 */

(() => {
  'use strict';

  // ─── Config ──────────────────────────────────────────────────────────────────

  const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

  const CRM_SELECTORS = {
    hubspot: {
      phoneFields: [
        '[data-selenium-test="property-input-phone"]',
        '[data-test-id="phone-number"]',
        '.private-form__control[type="tel"]',
        'a[href^="tel:"]',
      ],
      container: '.contacts-profile-wrapper, .deal-detail-panel',
    },
    salesforce: {
      phoneFields: [
        'a[href^="tel:"]',
        '.phoneField',
        'lightning-formatted-phone',
        '.slds-form-element [data-type="phone"]',
      ],
      container: '.forceDetailPanel, .forceRecordLayout',
    },
    pipedrive: {
      phoneFields: ['a[href^="tel:"]', '.phoneField', '[data-field-key="phone"]'],
      container: '.detailView',
    },
    zoho: {
      phoneFields: ['a[href^="tel:"]', '.phone-field', '[data-field="Phone"]'],
      container: '.detail-view',
    },
  };

  // ─── Detect CRM ─────────────────────────────────────────────────────────────

  function detectCRM() {
    const host = location.hostname;
    if (host.includes('hubspot.com')) return 'hubspot';
    if (host.includes('salesforce.com') || host.includes('force.com')) return 'salesforce';
    if (host.includes('pipedrive.com')) return 'pipedrive';
    if (host.includes('zoho.com')) return 'zoho';
    return 'generic';
  }

  // ─── Phone detection ────────────────────────────────────────────────────────

  function extractPhoneNumbers() {
    const crm = detectCRM();
    const phones = new Set();

    // CRM-specific selectors
    const selectors = CRM_SELECTORS[crm];
    if (selectors) {
      selectors.phoneFields.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
          const text = el.textContent || el.href || '';
          const matches = text.match(PHONE_REGEX);
          if (matches) matches.forEach((m) => phones.add(normalizePhone(m)));
        });
      });
    }

    // Fallback: scan tel: links everywhere
    document.querySelectorAll('a[href^="tel:"]').forEach((el) => {
      const num = el.href.replace('tel:', '').trim();
      if (num) phones.add(normalizePhone(num));
    });

    return [...phones];
  }

  function normalizePhone(raw) {
    return raw.replace(/[^\d+]/g, '');
  }

  // ─── Inject click-to-call buttons ──────────────────────────────────────────

  function injectCallButtons() {
    const crm = detectCRM();
    const selectors = CRM_SELECTORS[crm];
    if (!selectors) return;

    selectors.phoneFields.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el.dataset.wibInjected) return;
        el.dataset.wibInjected = 'true';

        const text = el.textContent || el.href || '';
        const matches = text.match(PHONE_REGEX);
        if (!matches) return;

        const phone = normalizePhone(matches[0]);
        const btn = createCallButton(phone);
        el.parentNode.insertBefore(btn, el.nextSibling);
      });
    });
  }

  function createCallButton(phoneNumber) {
    const btn = document.createElement('button');
    btn.className = 'wib-call-btn';
    btn.title = `Call ${phoneNumber} via Word Is Bond`;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
      </svg>
    `;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      initiateCall(phoneNumber);
    });
    return btn;
  }

  // ─── Floating widget ───────────────────────────────────────────────────────

  function injectFloatingWidget() {
    if (document.getElementById('wib-floating-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'wib-floating-widget';
    widget.innerHTML = `
      <button id="wib-fab" class="wib-fab" title="Word Is Bond — Click to Call">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
        </svg>
      </button>
      <div id="wib-fab-panel" class="wib-fab-panel wib-hidden">
        <div class="wib-fab-header">
          <span>Word Is Bond</span>
          <button id="wib-fab-close" class="wib-fab-close">&times;</button>
        </div>
        <div class="wib-fab-body">
          <input id="wib-fab-phone" type="tel" placeholder="Enter phone number" class="wib-fab-input" />
          <button id="wib-fab-dial" class="wib-fab-dial">Call</button>
        </div>
        <div id="wib-fab-status" class="wib-fab-status"></div>
      </div>
    `;
    document.body.appendChild(widget);

    // Toggle panel
    document.getElementById('wib-fab').addEventListener('click', () => {
      document.getElementById('wib-fab-panel').classList.toggle('wib-hidden');
    });

    document.getElementById('wib-fab-close').addEventListener('click', () => {
      document.getElementById('wib-fab-panel').classList.add('wib-hidden');
    });

    // Dial
    document.getElementById('wib-fab-dial').addEventListener('click', () => {
      const phone = document.getElementById('wib-fab-phone').value.trim();
      if (phone) initiateCall(phone);
    });

    document.getElementById('wib-fab-phone').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const phone = e.target.value.trim();
        if (phone) initiateCall(phone);
      }
    });
  }

  // ─── Call initiation ───────────────────────────────────────────────────────

  function initiateCall(phoneNumber) {
    setStatus(`Calling ${phoneNumber}…`);

    chrome.runtime.sendMessage(
      { action: 'makeCall', payload: { phoneNumber } },
      (response) => {
        if (response?.error) {
          setStatus(`Error: ${response.error}`);
          if (response.error === 'Not authenticated') {
            setStatus('Please log in via the extension popup first.');
          }
        } else {
          setStatus(`Call initiated! ID: ${response.data?.callId || '—'}`);
        }
      }
    );
  }

  function setStatus(text) {
    const el = document.getElementById('wib-fab-status');
    if (el) el.textContent = text;
  }

  // ─── Observer for SPA navigation ───────────────────────────────────────────

  function observe() {
    const observer = new MutationObserver(() => {
      injectCallButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    injectFloatingWidget();
    injectCallButtons();
    observe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

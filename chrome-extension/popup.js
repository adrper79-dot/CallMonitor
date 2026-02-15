/**
 * Word Is Bond — Popup Script
 * Handles auth UI, quick dial, and recent calls display.
 */

// ─── DOM refs ────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const loginView   = $('login-view');
const mainView    = $('main-view');
const statusDot   = $('status-dot');
const statusText  = $('status-text');
const loginBtn    = $('login-btn');
const logoutBtn   = $('logout-btn');
const loginError  = $('login-error');
const emailInput  = $('email');
const passInput   = $('password');
const userEmail   = $('user-email');
const dialInput   = $('dial-input');
const dialBtn     = $('dial-btn');
const dialStatus  = $('dial-status');
const callsList   = $('calls-list');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendMessage(action, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, payload }, resolve);
  });
}

function showView(view) {
  loginView.classList.toggle('active', view === 'login');
  mainView.classList.toggle('active', view === 'main');
}

function setOnline(online) {
  statusDot.classList.toggle('offline', !online);
  statusText.textContent = online ? 'Online' : 'Offline';
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function checkAuth() {
  const res = await sendMessage('checkAuth');
  if (res?.data?.authenticated) {
    setOnline(true);
    userEmail.textContent = res.data.user?.email || 'Logged in';
    showView('main');
    loadRecentCalls();
  } else {
    setOnline(false);
    showView('login');
  }
}

loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passInput.value;
  if (!email || !password) {
    loginError.textContent = 'Please enter email and password.';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';
  loginError.textContent = '';

  const res = await sendMessage('login', { email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = 'Sign In';

  if (res?.error) {
    loginError.textContent = res.error;
  } else {
    setOnline(true);
    userEmail.textContent = email;
    showView('main');
    loadRecentCalls();
  }
});

logoutBtn.addEventListener('click', async () => {
  await sendMessage('logout');
  setOnline(false);
  showView('login');
  emailInput.value = '';
  passInput.value = '';
  loginError.textContent = '';
});

// ─── Quick dial ──────────────────────────────────────────────────────────────

dialBtn.addEventListener('click', () => dial());
dialInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dial();
});

async function dial() {
  const phoneNumber = dialInput.value.trim();
  if (!phoneNumber) return;

  dialBtn.disabled = true;
  dialStatus.textContent = `Calling ${phoneNumber}…`;

  const res = await sendMessage('makeCall', { phoneNumber });

  dialBtn.disabled = false;

  if (res?.error) {
    dialStatus.textContent = `Error: ${res.error}`;
  } else {
    dialStatus.textContent = `Call initiated! ID: ${res.data?.callId || '—'}`;
    dialInput.value = '';
    // refresh calls list after a short delay
    setTimeout(loadRecentCalls, 2000);
  }
}

// ─── Recent calls ────────────────────────────────────────────────────────────

async function loadRecentCalls() {
  const res = await sendMessage('getRecentCalls');

  if (res?.error) {
    callsList.innerHTML = `<div class="empty-state">Could not load calls.</div>`;
    return;
  }

  const calls = res.data?.data || res.data?.calls || res.data || [];

  if (!Array.isArray(calls) || calls.length === 0) {
    callsList.innerHTML = `<div class="empty-state">No recent calls</div>`;
    return;
  }

  callsList.innerHTML = calls
    .slice(0, 10)
    .map(
      (c) => `
      <div class="call-item" data-phone="${c.to || c.phone_number || ''}" title="Click to redial">
        <div>
          <div class="phone">${c.to || c.phone_number || 'Unknown'}</div>
          <div class="meta">${timeAgo(c.created_at || c.started_at)}</div>
        </div>
        <div class="duration">${formatDuration(c.duration)}</div>
      </div>
    `
    )
    .join('');

  // Click to redial
  callsList.querySelectorAll('.call-item').forEach((item) => {
    item.addEventListener('click', () => {
      const phone = item.dataset.phone;
      if (phone) {
        dialInput.value = phone;
        dial();
      }
    });
  });
}

// ─── Init ────────────────────────────────────────────────────────────────────

checkAuth();

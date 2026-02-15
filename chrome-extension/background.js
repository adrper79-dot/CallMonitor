/**
 * Word Is Bond — Chrome Extension Background Service Worker
 * Handles auth, API communication, and message routing.
 */

const API_BASE = 'https://wordisbond-api.adrper79.workers.dev/api';

// ─── Auth helpers ────────────────────────────────────────────────────────────

async function getToken() {
  const { wib_token } = await chrome.storage.local.get('wib_token');
  return wib_token || null;
}

async function setToken(token) {
  await chrome.storage.local.set({ wib_token: token });
}

async function clearToken() {
  await chrome.storage.local.remove(['wib_token', 'wib_user']);
}

async function setUser(user) {
  await chrome.storage.local.set({ wib_user: user });
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = await getToken();
  if (!token && !options.skipAuth) {
    throw new Error('Not authenticated');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }

  return res.json();
}

// ─── Core functions ──────────────────────────────────────────────────────────

async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });

  if (data.token) {
    await setToken(data.token);
    await setUser(data.user || { email });
    return { success: true, user: data.user };
  }
  throw new Error(data.error || 'Login failed');
}

async function logout() {
  await clearToken();
  return { success: true };
}

async function makeCall(phoneNumber) {
  const data = await apiFetch('/calls/outbound', {
    method: 'POST',
    body: JSON.stringify({ to: phoneNumber }),
  });
  return data;
}

async function getCallStatus(callId) {
  const data = await apiFetch(`/calls/${callId}/status`);
  return data;
}

async function getRecentCalls() {
  const data = await apiFetch('/calls?limit=10&sort=desc');
  return data;
}

async function checkAuth() {
  try {
    const token = await getToken();
    if (!token) return { authenticated: false };
    const data = await apiFetch('/auth/me');
    return { authenticated: true, user: data.user || data };
  } catch {
    await clearToken();
    return { authenticated: false };
  }
}

// ─── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { action, payload } = message;

  const handlers = {
    login: () => login(payload.email, payload.password),
    logout: () => logout(),
    checkAuth: () => checkAuth(),
    makeCall: () => makeCall(payload.phoneNumber),
    getCallStatus: () => getCallStatus(payload.callId),
    getRecentCalls: () => getRecentCalls(),
  };

  const handler = handlers[action];
  if (!handler) {
    sendResponse({ error: `Unknown action: ${action}` });
    return false;
  }

  handler()
    .then((data) => sendResponse({ data }))
    .catch((err) => sendResponse({ error: err.message }));

  return true; // keep channel open for async response
});

// ─── Notifications ───────────────────────────────────────────────────────────

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  });
}

// Notify on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    notify('Word Is Bond', 'Extension installed! Click the icon to log in.');
  }
});

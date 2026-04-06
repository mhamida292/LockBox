// Content script — fills login forms and injects inline fill buttons

// ── Skip injection on the LockBox app itself ─────────────────────────

chrome.storage.local.get(['serverUrl'], (data) => {
  // Always skip the LockBox app itself, regardless of whether serverUrl is configured
  if (document.querySelector('meta[name="lockbox-vault"]')) return;
  if (data.serverUrl) {
    try {
      const serverOrigin = new URL(data.serverUrl).origin;
      if (window.location.origin === serverOrigin) return;
    } catch {}
  }
  init();
});

// ── Fill on command from popup/background ────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'fill') {
    fillForm(msg.username, msg.password);
  }
});

// ── Inline fill button ──────────────────────────────────────────────

const LOCKBOX_ATTR = 'data-lockbox-btn';
const ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

// ── Multi-step login state ───────────────────────────────────────────

let capturedUsername = null;
let capturedUsernameExpiry = 0;

function getCapturedUsername() {
  if (capturedUsername && Date.now() < capturedUsernameExpiry) return capturedUsername;
  capturedUsername = null;
  return null;
}

function setCapturedUsername(val) {
  capturedUsername = val;
  capturedUsernameExpiry = Date.now() + 120000;
  chrome.storage.local.set({ capturedUsername: { value: val, expiry: capturedUsernameExpiry, origin: location.origin } });
}

// Restore captured username from storage (survives full page navigations)
chrome.storage.local.get(['capturedUsername'], (data) => {
  const c = data && data.capturedUsername;
  if (c && c.origin === location.origin && Date.now() < c.expiry) {
    capturedUsername = c.value;
    capturedUsernameExpiry = c.expiry;
  }
});

const USER_FIELD_SELECTOR = [
  'input[type="email"]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
  'input[name*="user" i]',
  'input[name*="email" i]',
  'input[name*="login" i]',
  'input[id*="user" i]',
  'input[id*="email" i]',
  'input[id*="login" i]',
].join(',');

function looksLikeLoginField(field) {
  const ac = (field.getAttribute('autocomplete') || '').toLowerCase();
  // Skip new-password fields (registration / change-password forms)
  if (ac === 'new-password') return false;
  // Explicit current-password — always a login field
  if (ac === 'current-password') return true;
  // Multi-step: we captured an email from step 1 on this domain
  if (getCapturedUsername()) return true;
  // Look for a username/email field in the same form or nearest container
  const container = field.closest('form') || field.closest('[role="dialog"]') || field.parentElement;
  return !!(container && container.querySelector(USER_FIELD_SELECTOR));
}

function injectButtons() {
  // Standard: inject on password fields in login forms
  const passFields = document.querySelectorAll('input[type="password"]');
  passFields.forEach(field => {
    if (field.hasAttribute(LOCKBOX_ATTR) || !isVisible(field)) return;
    if (!looksLikeLoginField(field)) return;
    field.setAttribute(LOCKBOX_ATTR, 'true');
    createFillButton(field);
  });

  // Multi-step step 1: inject on email/username field when no password field is visible
  const anyVisiblePass = [...passFields].some(f => isVisible(f));
  if (!anyVisiblePass) {
    const emailField = document.querySelector(USER_FIELD_SELECTOR);
    if (emailField && isVisible(emailField) && !emailField.hasAttribute(LOCKBOX_ATTR)) {
      emailField.setAttribute(LOCKBOX_ATTR, 'true');
      createFillButton(emailField, true);
    }
  }
}

function createFillButton(field, isEmailStep = false) {
  // Create host element
  const host = document.createElement('div');
  host.className = 'lockbox-fill-host';
  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      :host {
        position: absolute;
        z-index: 2147483647;
        pointer-events: none;
      }
      .lb-btn {
        pointer-events: auto;
        width: 24px; height: 24px;
        border-radius: 6px;
        border: none;
        background: rgba(108, 140, 255, 0.12);
        color: rgba(108, 140, 255, 0.8);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.15s ease;
        padding: 0;
      }
      .lb-btn:hover {
        background: rgba(108, 140, 255, 0.25);
        color: rgb(108, 140, 255);
        transform: scale(1.05);
      }
      .lb-btn:active { transform: scale(0.95); }
      .lb-btn.filled {
        background: rgba(61, 214, 140, 0.2);
        color: rgb(61, 214, 140);
      }
      .lb-picker {
        position: absolute; bottom: calc(100% + 6px); right: 0;
        background: #0e1015; border: 1px solid #232733;
        border-radius: 10px; padding: 4px;
        min-width: 200px; max-width: 280px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: none;
        pointer-events: auto;
      }
      .lb-picker.open { display: block; }
      .lb-picker-title {
        font-size: 9px; font-weight: 700; letter-spacing: 2px;
        text-transform: uppercase; color: #6c8cff;
        padding: 8px 10px 6px;
      }
      .lb-item {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 10px; border-radius: 7px;
        cursor: pointer; transition: background 0.1s;
        border: none; background: none; width: 100%; text-align: left;
        font-family: inherit;
      }
      .lb-item:hover { background: rgba(108, 140, 255, 0.08); }
      .lb-item-title {
        font-size: 12px; font-weight: 500; color: #d4d7e0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .lb-item-user {
        font-size: 10px; color: #4e5370;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .lb-empty {
        padding: 12px 10px; font-size: 11px; color: #4e5370; text-align: center;
      }
    </style>
    <div style="position:relative">
      <button class="lb-btn" title="Lockbox — fill credentials">${ICON_SVG}</button>
      <div class="lb-picker"></div>
    </div>
  `;

  const btn = shadow.querySelector('.lb-btn');
  const picker = shadow.querySelector('.lb-picker');

  // Position the button inside the field
  const useFixed = hasFixedAncestor(field);
  function positionBtn() {
    const rect = field.getBoundingClientRect();
    host.style.position = useFixed ? 'fixed' : 'absolute';
    host.style.top = ((useFixed ? 0 : window.scrollY) + rect.top + (rect.height - 24) / 2) + 'px';
    host.style.left = ((useFixed ? 0 : window.scrollX) + rect.right - 30) + 'px';
  }
  // Reposition on scroll/resize
  let rafId = null;
  const reposition = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!document.body.contains(field)) { host.remove(); return; }
      if (!isVisible(field)) { host.style.display = 'none'; return; }
      host.style.display = '';
      positionBtn();
    });
  };
  window.addEventListener('scroll', reposition, { passive: true, capture: true });
  window.addEventListener('resize', reposition, { passive: true });

  // Delay initial position until after any expand/reveal animations settle
  positionBtn();
  setTimeout(positionBtn, 350);

  // Re-position whenever the field's size changes (handles animated containers)
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(reposition);
    ro.observe(field);
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    chrome.runtime.sendMessage({ type: 'getMatches', url: window.location.href }, (res) => {
      const matches = (res && res.matches) || [];

      function applyEntry(entry) {
        const username = entry.data.username || '';
        const password = entry.data.password || '';
        if (isEmailStep) {
          // Step 1: fill only the email field and capture for step 2
          setNativeValue(field, username);
          flashField(field);
          setCapturedUsername(username);
        } else {
          fillForm(username, password);
        }
        picker.classList.remove('open');
        btn.classList.add('filled');
        setTimeout(() => btn.classList.remove('filled'), 1200);
      }

      if (matches.length === 0) {
        picker.innerHTML = `<div class="lb-picker-title">Lockbox</div><div class="lb-empty">No saved logins for this site</div>`;
        picker.classList.add('open');
        setTimeout(() => picker.classList.remove('open'), 2000);
      } else if (matches.length === 1) {
        applyEntry(matches[0]);
      } else {
        // Multiple matches — show picker
        picker.innerHTML = `<div class="lb-picker-title">Lockbox</div>` +
          matches.map((m, i) => `
            <button class="lb-item" data-idx="${i}">
              <div>
                <div class="lb-item-title">${escHtml(m.title)}</div>
                <div class="lb-item-user">${escHtml(m.data.username || m.data.url || 'No username')}</div>
              </div>
            </button>
          `).join('');
        picker.classList.add('open');

        picker.querySelectorAll('.lb-item').forEach(item => {
          item.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            applyEntry(matches[parseInt(item.dataset.idx)]);
          });
        });
      }
    });
  });

  // Close picker on outside click
  document.addEventListener('click', () => picker.classList.remove('open'));

  host._lbField = field;
  document.body.appendChild(host);
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Multi-step login: capture email from step 1 ──────────────────────

function captureEmailStep() {
  // Continuously track any visible email/username field value.
  // This is more reliable than catching button clicks.
  function snapshotEmailField() {
    const passField = document.querySelector('input[type="password"]');
    if (passField && isVisible(passField)) return; // step 2 — don't overwrite
    const candidates = document.querySelectorAll(USER_FIELD_SELECTOR + ', input[type="text"]');
    for (const f of candidates) {
      if (isVisible(f) && f.value.trim()) {
        setCapturedUsername(f.value.trim());
        return;
      }
    }
  }

  // Snapshot on input changes
  document.addEventListener('input', snapshotEmailField, true);
  // Snapshot on blur (catches autofill)
  document.addEventListener('blur', snapshotEmailField, true);
  // Snapshot on button/Next clicks
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="submit"], [role="button"]');
    if (btn) snapshotEmailField();
  }, true);
  // Snapshot on Enter key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') snapshotEmailField();
  }, true);
}

// ── Detect login submissions & offer to save ────────────────────────

function watchFormSubmissions() {
  document.addEventListener('submit', (e) => handleFormSubmit(e.target), true);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="submit"], [role="button"]');
    if (!btn) return;
    // Try form first, fall back to whole document (for JS-driven multi-step like Google)
    const container = btn.closest('form') || document;
    handleFormSubmit(container);
  }, true);
}

function handleFormSubmit(container) {
  if (!container || !container.querySelector) return;

  // Find a visible, filled password field
  let passField = null;
  container.querySelectorAll('input[type="password"]').forEach(f => {
    if (!passField && isVisible(f) && f.value) passField = f;
  });
  if (!passField) return;

  // Find username in container first, then whole document
  const userSelectors = [
    'input[type="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[name="username"]', 'input[name="email"]', 'input[name="login"]',
    'input[id="username"]',  'input[id="email"]',   'input[id="login"]',
    'input[name*="user"]',   'input[name*="email"]', 'input[name*="login"]',
    'input[id*="user"]',     'input[id*="email"]',   'input[id*="login"]',
    'input[type="text"]',
  ];

  let username = '';
  for (const sel of userSelectors) {
    const f = container.querySelector(sel);
    if (f && f !== passField && f.value) { username = f.value; break; }
  }
  // Multi-step fallback: use email captured from the previous step
  if (!username) username = getCapturedUsername() || '';

  const password = passField.value;
  const url = window.location.hostname;
  const siteTitle = document.title.split(/[|\-–—]/)[0].trim() || url;

  chrome.storage.local.set({
    pendingSave: {
      username,
      password,
      url,
      origin: window.location.origin,
      title: siteTitle,
      timestamp: Date.now(),
    }
  });
}

function checkPendingSave() {
  chrome.storage.local.get(['pendingSave'], (data) => {
    const pending = data && data.pendingSave;
    if (!pending) return;

    // Expire after 2 minutes
    if (Date.now() - pending.timestamp > 120000) {
      chrome.storage.local.remove('pendingSave');
      return;
    }

    // Clear it immediately so it doesn't show again on refresh
    chrome.storage.local.remove('pendingSave');

    // Only show if logged in
    chrome.runtime.sendMessage({ type: 'isLoggedIn' }, (res) => {
      if (!res || !res.loggedIn) return;

      // Check if already saved
      chrome.runtime.sendMessage({ type: 'getMatches', url: pending.origin }, (matchRes) => {
        const matches = (matchRes && matchRes.matches) || [];
        const alreadyExists = matches.some(m =>
          m.data.username === pending.username
        );
        if (alreadyExists) return;

          chrome.runtime.sendMessage({ type: 'getFolders' }, (folderRes) => {
            const folders = (folderRes && folderRes.folders) || [];
            showSavePrompt(pending.username, pending.password, pending.url, pending.origin, pending.title, folders);
          });
      });
    });
  });
}

function showSavePrompt(username, password, url, origin, siteTitle, folders) {
  // Remove any existing prompt
  const existing = document.querySelector('.lockbox-save-host');
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.className = 'lockbox-save-host';
  const shadow = host.attachShadow({ mode: 'closed' });

  if (!siteTitle) siteTitle = document.title.split(/[|\-–—]/)[0].trim() || url;

  shadow.innerHTML = `
    <style>
      :host {
        position: fixed; top: 12px; right: 12px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .lb-save {
        background: #0e1015; border: 1px solid #232733;
        border-radius: 10px; padding: 16px 16px;
        width: 420px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        animation: slideIn 0.2s ease-out;
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .lb-save-header {
        display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
      }
      .lb-save-icon {
        width: 22px; height: 22px; border-radius: 5px;
        background: rgba(108, 140, 255, 0.12);
        display: flex; align-items: center; justify-content: center;
        color: #6c8cff; flex-shrink: 0;
      }
      .lb-save-title {
        font-size: 11px; font-weight: 600; color: #d4d7e0;
      }
      .lb-save-sub {
        font-size: 9px; color: #4e5370;
      }
      .lb-save-input {
        width: 100%; padding: 8px 10px; margin-bottom: 8px;
        background: #07080a; border: 1px solid #232733; border-radius: 5px;
        color: #d4d7e0; font-size: 12px; font-family: inherit;
        outline: none; transition: border-color 0.15s;
        box-sizing: border-box;
      }
      .lb-save-input:focus { border-color: #6c8cff; }
      .lb-row { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
      .lb-row-label { font-size: 11px; color: #4e5370; width: 36px; flex-shrink: 0; }
      .lb-row-val { font-size: 12px; color: #7b819a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .lb-save-actions {
        display: flex; gap: 6px;
      }
      .lb-save-btn {
        flex: 1; padding: 9px; border-radius: 5px;
        font-size: 12px; font-weight: 600; cursor: pointer;
        border: none; transition: all 0.15s; font-family: inherit;
      }
      .lb-save-btn.primary { background: #6c8cff; color: #fff; }
      .lb-save-btn.primary:hover { background: #8da6ff; }
      .lb-save-btn.secondary { background: none; color: #7b819a; border: 1px solid #232733; }
      .lb-save-btn.secondary:hover { border-color: #333846; color: #d4d7e0; }
      .lb-save-btn.success { background: rgba(61,214,140,0.15); color: #3dd68c; border: 1px solid #3dd68c; }
      .lb-save-btn.error { background: rgba(255,92,106,0.15); color: #ff5c6a; border: 1px solid #ff5c6a; }
      .lb-save-select {
        width: 100%; padding: 8px 10px; margin-bottom: 8px;
        background: #07080a; border: 1px solid #232733; border-radius: 5px;
        color: #d4d7e0; font-size: 12px; font-family: inherit;
        outline: none; cursor: pointer; box-sizing: border-box;
      }
      .lb-save-select:focus { border-color: #6c8cff; }
    </style>
    <div class="lb-save">
      <div class="lb-save-header">
        <div class="lb-save-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div>
          <div class="lb-save-title">Save to Lockbox?</div>
          <div class="lb-save-sub">${escHtml(url)}</div>
        </div>
      </div>
      <input class="lb-save-input" id="lbTitle" value="${escAttr(siteTitle)}" placeholder="Title">
      <div class="lb-row">
        <span class="lb-row-label">User</span>
        <span class="lb-row-val">${escHtml(username || 'none')}</span>
      </div>
      ${folders.length ? `
      <select class="lb-save-select" id="lbFolder">
        <option value="">No category</option>
        ${folders.map(f => `<option value="${f.id}">${escHtml(f.name)}</option>`).join('')}
      </select>` : ''}
      <div class="lb-save-actions">
        <button class="lb-save-btn secondary" id="lbDismiss">Dismiss</button>
        <button class="lb-save-btn primary" id="lbSave">Save</button>
      </div>
    </div>
  `;

  const saveBtn = shadow.querySelector('#lbSave');
  const dismissBtn = shadow.querySelector('#lbDismiss');
  const titleInput = shadow.querySelector('#lbTitle');

  saveBtn.addEventListener('click', () => {
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    const folderSelect = shadow.querySelector('#lbFolder');
    const folderId = folderSelect ? (folderSelect.value ? parseInt(folderSelect.value) : null) : null;
    chrome.runtime.sendMessage({
      type: 'saveEntry',
      title: titleInput.value || siteTitle,
      username,
      password,
      url: origin || window.location.origin,
      folder_id: folderId,
    }, (res) => {
      if (res && res.ok) {
        saveBtn.textContent = 'Saved!';
        saveBtn.className = 'lb-save-btn success';
        setTimeout(() => host.remove(), 1200);
      } else {
        saveBtn.textContent = res?.error || 'Failed';
        saveBtn.className = 'lb-save-btn error';
        saveBtn.disabled = false;
        setTimeout(() => {
          saveBtn.textContent = 'Save';
          saveBtn.className = 'lb-save-btn primary';
        }, 2000);
      }
    });
  });

  dismissBtn.addEventListener('click', () => {
    host.remove();
  });

  // Auto-dismiss after 15 seconds
  setTimeout(() => { if (document.body.contains(host)) host.remove(); }, 15000);

  document.body.appendChild(host);
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Observe for dynamically added fields ────────────────────────────

function cleanupOrphans() {
  document.querySelectorAll('.lockbox-fill-host').forEach(h => {
    if (h._lbField && !document.body.contains(h._lbField)) h.remove();
  });
}

function init() {
  const observer = new MutationObserver(() => { cleanupOrphans(); injectButtons(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  injectButtons();
  watchFormSubmissions();
  captureEmailStep();
  checkPendingSave();

  // Safety net: on page unload, save credentials if a filled password field exists
  window.addEventListener('beforeunload', () => {
    const passField = [...document.querySelectorAll('input[type="password"]')].find(f => isVisible(f) && f.value);
    if (!passField) return;
    const username = getCapturedUsername() || '';
    const url = location.hostname;
    const siteTitle = document.title.split(/[|\-–—]/)[0].trim() || url;
    chrome.storage.local.set({
      pendingSave: { username, password: passField.value, url, origin: location.origin, title: siteTitle, timestamp: Date.now() }
    });
  });

  let lastUrl = location.href;
  let lastHost = location.hostname;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Clear captured username if we've left the domain
      if (location.hostname !== lastHost) {
        capturedUsername = null;
        chrome.storage.local.remove('capturedUsername');
        lastHost = location.hostname;
      }
      // Full cleanup on navigation — remove all injected buttons and markers
      document.querySelectorAll('.lockbox-fill-host').forEach(h => h.remove());
      document.querySelectorAll(`[${LOCKBOX_ATTR}]`).forEach(f => f.removeAttribute(LOCKBOX_ATTR));
      injectButtons();
      checkPendingSave();
    }
  }, 1500);
}

// ── Form filling ────────────────────────────────────────────────────

function fillForm(username, password) {
  const userSelectors = [
    'input[type="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[name="username"]',
    'input[name="email"]',
    'input[name="login"]',
    'input[id="username"]',
    'input[id="email"]',
    'input[id="login"]',
    'input[type="text"][name*="user"]',
    'input[type="text"][name*="email"]',
    'input[type="text"][name*="login"]',
    'input[name*="user"]',
    'input[name*="email"]',
    'input[name*="login"]',
    'input[id*="user"]',
    'input[id*="email"]',
    'input[id*="login"]',
    'input[type="text"]',
    'input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="image"]):not([type="reset"]):not([type="search"]):not([type="number"]):not([type="tel"]):not([type="date"])',
  ];

  const passSelectors = [
    'input[type="password"]',
    'input[type="password"][name*="pass"]',
  ];

  let userField = null;
  let passField = null;

  for (const sel of passSelectors) {
    const fields = document.querySelectorAll(sel);
    for (const f of fields) {
      if (isVisible(f)) { passField = f; break; }
    }
    if (passField) break;
  }

  for (const sel of userSelectors) {
    const fields = document.querySelectorAll(sel);
    for (const f of fields) {
      if (isVisible(f) && f !== passField) { userField = f; break; }
    }
    if (userField) break;
  }

  if (userField && username) {
    setNativeValue(userField, username);
    flashField(userField);
  }
  if (passField && password) {
    setNativeValue(passField, password);
    flashField(passField);
  }

  if (!userField && !passField) {
    console.log('[Lockbox] No login fields found on this page');
  }
}

function setNativeValue(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  nativeInputValueSetter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return el.offsetWidth > 0 && el.offsetHeight > 0;
}

function hasFixedAncestor(el) {
  let parent = el.parentElement;
  while (parent && parent !== document.documentElement) {
    if (window.getComputedStyle(parent).position === 'fixed') return true;
    parent = parent.parentElement;
  }
  return false;
}

function flashField(el) {
  const orig = el.style.boxShadow;
  el.style.boxShadow = '0 0 0 3px rgba(108, 140, 255, 0.5)';
  el.style.transition = 'box-shadow 0.3s';
  setTimeout(() => { el.style.boxShadow = orig; }, 800);
}

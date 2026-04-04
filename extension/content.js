// Content script — fills login forms when told to by background/popup

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'fill') {
    fillForm(msg.username, msg.password);
  }
});

function fillForm(username, password) {
  // Find username/email field
  const userSelectors = [
    'input[type="email"]',
    'input[type="text"][name*="user"]',
    'input[type="text"][name*="email"]',
    'input[type="text"][name*="login"]',
    'input[type="text"][autocomplete="username"]',
    'input[type="text"][autocomplete="email"]',
    'input[type="text"]',
  ];

  const passSelectors = [
    'input[type="password"]',
    'input[type="password"][name*="pass"]',
  ];

  let userField = null;
  let passField = null;

  // Find password field first (most reliable)
  for (const sel of passSelectors) {
    const fields = document.querySelectorAll(sel);
    for (const f of fields) {
      if (isVisible(f)) { passField = f; break; }
    }
    if (passField) break;
  }

  // Find username field
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
    // No fields found — could be a SPA that hasn't loaded yet
    console.log('[Lockbox] No login fields found on this page');
  }
}

function setNativeValue(el, value) {
  // Trigger React/Vue/Angular change detection
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
  return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
}

function flashField(el) {
  const orig = el.style.boxShadow;
  el.style.boxShadow = '0 0 0 3px rgba(108, 140, 255, 0.5)';
  el.style.transition = 'box-shadow 0.3s';
  setTimeout(() => {
    el.style.boxShadow = orig;
  }, 800);
}

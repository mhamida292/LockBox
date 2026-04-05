// Background service worker — manages server communication and entry cache

let cachedEntries = [];
let cachedFolders = [];
let serverUrl = '';
let isLoggedIn = false;

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getState') {
    chrome.storage.local.get(['serverUrl'], (data) => {
      sendResponse({ serverUrl: data.serverUrl || '', isLoggedIn, entries: cachedEntries, folders: cachedFolders });
    });
    return true;
  }

  if (msg.type === 'saveServer') {
    serverUrl = msg.url.replace(/\/+$/, '');
    chrome.storage.local.set({ serverUrl });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'login') {
    chrome.storage.local.get(['serverUrl'], async (data) => {
      serverUrl = data.serverUrl || '';
      try {
        const res = await fetch(`${serverUrl}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ master_password: msg.password }),
          credentials: 'include',
        });
        const d = await res.json();
        if (d.ok) {
          isLoggedIn = true;
          await fetchEntries();
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: d.error });
        }
      } catch (e) {
        sendResponse({ ok: false, error: 'Cannot reach server' });
      }
    });
    return true;
  }

  if (msg.type === 'getEntries') {
    sendResponse({ entries: cachedEntries });
    return true;
  }

  if (msg.type === 'getMatches') {
    const url = msg.url || '';
    const matches = findMatches(url);
    sendResponse({ matches });
    return true;
  }

  if (msg.type === 'fill') {
    const entry = cachedEntries.find(e => e.id === msg.id);
    if (entry && sender.tab) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'fill',
        username: entry.data.username || '',
        password: entry.data.password || '',
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'fillFromPopup') {
    const entry = cachedEntries.find(e => e.id === msg.id);
    if (entry) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'fill',
            username: entry.data.username || '',
            password: entry.data.password || '',
          });
        }
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'logout') {
    isLoggedIn = false;
    cachedEntries = [];
    cachedFolders = [];
    if (serverUrl) {
      fetch(`${serverUrl}/api/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'refresh') {
    fetchEntries().then(() => sendResponse({ ok: true, entries: cachedEntries, folders: cachedFolders }));
    return true;
  }

  if (msg.type === 'saveEntry') {
    if (!serverUrl || !isLoggedIn) {
      sendResponse({ ok: false, error: 'Not logged in' });
      return true;
    }
    (async () => {
      try {
        const res = await fetch(`${serverUrl}/api/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: 'login',
            title: msg.title,
            data: {
              username: msg.username || '',
              password: msg.password || '',
              url: msg.url || '',
            },
          }),
        });
        const d = await res.json();
        if (d.ok) {
          await fetchEntries(); // refresh cache
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: d.error || 'Save failed' });
        }
      } catch (e) {
        sendResponse({ ok: false, error: 'Cannot reach server' });
      }
    })();
    return true;
  }

  if (msg.type === 'isLoggedIn') {
    sendResponse({ loggedIn: isLoggedIn });
    return true;
  }
});

async function fetchEntries() {
  if (!serverUrl) return;
  try {
    const [eRes, fRes] = await Promise.all([
      fetch(`${serverUrl}/api/entries`, { credentials: 'include' }),
      fetch(`${serverUrl}/api/folders`, { credentials: 'include' }),
    ]);
    if (eRes.ok) {
      cachedEntries = await eRes.json();
    } else {
      isLoggedIn = false;
      cachedEntries = [];
    }
    if (fRes.ok) {
      cachedFolders = await fRes.json();
    }
  } catch (e) {
    cachedEntries = [];
    cachedFolders = [];
  }
}

function findMatches(tabUrl) {
  if (!tabUrl || !cachedEntries.length) return [];
  try {
    const parsed = new URL(tabUrl);
    const hostname = parsed.hostname.replace(/^www\./, '');
    return cachedEntries.filter(e => {
      if (e.type !== 'login') return false;
      const entryUrl = e.data.url || '';
      if (!entryUrl) return false;
      try {
        const full = entryUrl.startsWith('http') ? entryUrl : 'https://' + entryUrl;
        const entryHost = new URL(full).hostname.replace(/^www\./, '');
        return hostname === entryHost || hostname.endsWith('.' + entryHost);
      } catch {
        return entryUrl.toLowerCase().includes(hostname);
      }
    });
  } catch {
    return [];
  }
}

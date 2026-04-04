const $ = id => document.getElementById(id);

let allEntries = [];

// ── Init ──────────────────────────────────────────────────────────────

async function init() {
  chrome.runtime.sendMessage({ type: 'getState' }, (state) => {
    if (state.serverUrl) $('serverUrl').value = state.serverUrl;
    if (state.isLoggedIn && state.entries.length >= 0) {
      allEntries = state.entries;
      showMain();
    } else if (state.serverUrl) {
      // Has server but not logged in
      showSetup();
    } else {
      showSetup();
    }
  });
}

// ── Screens ───────────────────────────────────────────────────────────

function showSetup() {
  $('setupScreen').classList.remove('hidden');
  $('mainScreen').classList.add('hidden');
  $('headerActions').innerHTML = '';
}

function showMain() {
  $('setupScreen').classList.add('hidden');
  $('mainScreen').classList.remove('hidden');
  $('headerActions').innerHTML = `
    <button class="hbtn" id="refreshBtn" title="Refresh">↻</button>
    <button class="hbtn dng" id="lockBtn" title="Lock">🔒</button>
  `;
  $('refreshBtn').addEventListener('click', doRefresh);
  $('lockBtn').addEventListener('click', doLock);
  $('statusBar').textContent = `${allEntries.length} entries`;
  loadMatches();
  renderEntries(allEntries);
}

// ── Connect / Login ───────────────────────────────────────────────────

$('connectBtn').addEventListener('click', doConnect);
$('masterPw').addEventListener('keydown', e => { if (e.key === 'Enter') doConnect(); });
$('serverUrl').addEventListener('keydown', e => { if (e.key === 'Enter') $('masterPw').focus(); });

async function doConnect() {
  const url = $('serverUrl').value.trim();
  const pw = $('masterPw').value;
  const err = $('setupErr');
  err.textContent = '';

  if (!url) { err.textContent = 'Enter your server URL'; return; }
  if (!pw) { err.textContent = 'Enter your master password'; return; }

  $('connectBtn').textContent = 'Connecting...';

  chrome.runtime.sendMessage({ type: 'saveServer', url }, () => {
    chrome.runtime.sendMessage({ type: 'login', password: pw }, (res) => {
      $('connectBtn').textContent = 'Connect';
      if (res.ok) {
        chrome.runtime.sendMessage({ type: 'getState' }, (state) => {
          allEntries = state.entries;
          showMain();
        });
      } else {
        err.textContent = res.error || 'Connection failed';
      }
    });
  });
}

// ── Actions ───────────────────────────────────────────────────────────

function doRefresh() {
  chrome.runtime.sendMessage({ type: 'refresh' }, (res) => {
    if (res.ok) {
      allEntries = res.entries;
      $('statusBar').textContent = `${allEntries.length} entries — refreshed`;
      loadMatches();
      renderEntries(filterEntries($('searchInput').value));
    }
  });
}

function doLock() {
  chrome.runtime.sendMessage({ type: 'logout' }, () => {
    allEntries = [];
    $('masterPw').value = '';
    showSetup();
  });
}

// ── URL matching ──────────────────────────────────────────────────────

function loadMatches() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tabUrl = tabs[0].url;
    chrome.runtime.sendMessage({ type: 'getMatches', url: tabUrl }, (res) => {
      const section = $('matchSection');
      if (res.matches && res.matches.length) {
        let html = '<div class="match-label">Matches for this site</div>';
        html += res.matches.map(e => entryHtml(e, true)).join('');
        section.innerHTML = html;
        attachFillHandlers(section);
      } else {
        section.innerHTML = '';
      }
    });
  });
}

// ── Search ────────────────────────────────────────────────────────────

$('searchInput').addEventListener('input', () => {
  const q = $('searchInput').value;
  renderEntries(filterEntries(q));
});

function filterEntries(q) {
  if (!q) return allEntries;
  q = q.toLowerCase();
  return allEntries.filter(e =>
    e.title.toLowerCase().includes(q) ||
    (e.data.username || '').toLowerCase().includes(q) ||
    (e.data.url || '').toLowerCase().includes(q)
  );
}

// ── Render ────────────────────────────────────────────────────────────

function renderEntries(list) {
  const el = $('entryList');
  if (!list.length) {
    el.innerHTML = '<div class="empty">No entries found</div>';
    return;
  }
  el.innerHTML = list.map(e => entryHtml(e, false)).join('');
  attachFillHandlers(el);
}

function entryHtml(e, isMatch) {
  const meta = e.type === 'login' ? (e.data.username || e.data.url || 'No username') : 'Secure note';
  const fillBtn = e.type === 'login'
    ? `<button class="e-fill" data-id="${e.id}">Fill</button>`
    : '';
  return `
    <div class="entry" data-id="${e.id}">
      <div class="e-icon">🔑</div>
      <div class="e-info">
        <div class="e-title">${esc(e.title)}</div>
        <div class="e-meta">${esc(meta)}</div>
      </div>
      ${fillBtn}
    </div>
  `;
}

function attachFillHandlers(container) {
  container.querySelectorAll('.e-fill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      chrome.runtime.sendMessage({ type: 'fillFromPopup', id });
      btn.textContent = 'Filled!';
      btn.style.background = 'var(--success)';
      btn.style.color = '#000';
      btn.style.borderColor = 'var(--success)';
      setTimeout(() => window.close(), 600);
    });
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Start ─────────────────────────────────────────────────────────────

init();

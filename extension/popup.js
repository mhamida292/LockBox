const $ = id => document.getElementById(id);

let allEntries = [];
let allFolders = [];
let matchedIds = new Set();
let activeFolder = null; // null = all
let themeOpen = false;

// ── Themes ───────────────────────────────────────────────────────────

const THEMES = [
  { id: 'midnight',  name: 'Midnight',  dots: ['#0e1015','#6c8cff','#d4d7e0'] },
  { id: 'ember',     name: 'Ember',     dots: ['#14100c','#e8853a','#e0d5c8'] },
  { id: 'arctic',    name: 'Arctic',    dots: ['#ffffff','#2563eb','#1a1f2e'] },
  { id: 'moss',      name: 'Moss',      dots: ['#0d120f','#5cb87a','#c8d8ce'] },
  { id: 'sakura',    name: 'Sakura',    dots: ['#ffffff','#e06088','#2e1a22'] },
  { id: 'slate',     name: 'Slate',     dots: ['#16181c','#8b929e','#c8cbcf'] },
  { id: 'amethyst',  name: 'Amethyst',  dots: ['#110e18','#a07ce8','#d4cee0'] },
  { id: 'lavender',  name: 'Lavender',  dots: ['#ffffff','#7c5cbf','#1e1a2e'] },
];

function setTheme(id) {
  document.documentElement.setAttribute('data-theme', id);
  chrome.storage.local.set({ theme: id });
  renderThemeGrid();
}

function loadTheme() {
  chrome.storage.local.get(['theme'], (data) => {
    if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);
  });
}

function renderThemeGrid() {
  const current = document.documentElement.getAttribute('data-theme') || 'midnight';
  $('themeGrid').innerHTML = THEMES.map(t => `
    <div class="theme-swatch${t.id === current ? ' active' : ''}" data-theme="${t.id}">
      <div class="swatch-dots">
        ${t.dots.map(c => `<div class="swatch-dot" style="background:${c}"></div>`).join('')}
      </div>
      <div class="swatch-name">${t.name}</div>
    </div>
  `).join('');
  $('themeGrid').querySelectorAll('.theme-swatch').forEach(el => {
    el.addEventListener('click', () => setTheme(el.dataset.theme));
  });
}

// ── Icons (same as main app) ─────────────────────────────────────────

const ICONS = {
  key:       '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  mail:      '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  lock:      '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  globe:     '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  card:      '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  user:      '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:     '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  phone:     '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  cart:      '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  gamepad:   '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><rect width="20" height="12" x="2" y="6" rx="2"/>',
  mappin:    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  music:     '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  play:      '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
  heart:     '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  code:      '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
  cloud:     '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  shield:    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  star:      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  filetext:  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  palette:   '<circle cx="13.5" cy="6.5" r="0.01"/><circle cx="17.5" cy="10.5" r="0.01"/><circle cx="8.5" cy="7.5" r="0.01"/><circle cx="6.5" cy="12.5" r="0.01"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
};

function iconSvg(id, size, color) {
  const path = ICONS[id] || ICONS.key;
  const stroke = color || 'currentColor';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

// ── Init ──────────────────────────────────────────────────────────────

loadTheme();

async function init() {
  chrome.runtime.sendMessage({ type: 'getState' }, (state) => {
    if (state.serverUrl) $('serverUrl').value = state.serverUrl;
    if (state.isLoggedIn && state.entries.length >= 0) {
      allEntries = state.entries;
      allFolders = state.folders || [];
      showMain();
      // Refresh in background to get latest data
      chrome.runtime.sendMessage({ type: 'refresh' }, (res) => {
        if (res && res.ok) {
          allEntries = res.entries;
          allFolders = res.folders || [];
          $('statusBar').textContent = `${allEntries.length} entries`;
          renderFolderTabs();
          loadMatches();
          renderEntries(getVisibleEntries());
        }
      });
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
  // Remove search + tabs from top bar in setup mode
  const oldSearch = $('topBar').querySelector('.search-wrap');
  const oldTabs = $('topBar').querySelector('.folder-tabs');
  if (oldSearch) oldSearch.remove();
  if (oldTabs) oldTabs.remove();
}

function showMain() {
  $('setupScreen').classList.add('hidden');
  $('mainScreen').classList.remove('hidden');
  $('headerActions').innerHTML = `
    <button class="hbtn" id="openVaultBtn" title="Open Vault">${iconSvg('globe', 16)}</button>
    <button class="hbtn" id="themeBtn" title="Theme">${iconSvg('palette', 16)}</button>
    <button class="hbtn" id="refreshBtn" title="Refresh">↻</button>
    <button class="hbtn dng" id="lockBtn" title="Lock">${iconSvg('lock', 16)}</button>
  `;
  $('openVaultBtn').addEventListener('click', () => {
    chrome.storage.local.get(['serverUrl'], (data) => {
      if (data.serverUrl) chrome.tabs.create({ url: data.serverUrl });
    });
  });
  $('themeBtn').addEventListener('click', () => {
    themeOpen = !themeOpen;
    $('themePanel').classList.toggle('open', themeOpen);
    if (themeOpen) renderThemeGrid();
  });
  $('refreshBtn').addEventListener('click', doRefresh);
  $('lockBtn').addEventListener('click', doLock);
  $('statusBar').textContent = `${allEntries.length} entries`;

  // Inject search + folder tabs into top-bar
  buildTopBar();
  loadMatches();
  renderEntries(getVisibleEntries());
}

function buildTopBar() {
  // Remove old dynamic elements
  const oldSearch = $('topBar').querySelector('.search-wrap');
  const oldTabs = $('topBar').querySelector('.folder-tabs');
  if (oldSearch) oldSearch.remove();
  if (oldTabs) oldTabs.remove();

  // Search
  const searchDiv = document.createElement('div');
  searchDiv.className = 'search-wrap';
  searchDiv.innerHTML = '<input type="text" id="searchInput" placeholder="Search vault...">';
  $('topBar').appendChild(searchDiv);
  $('searchInput').addEventListener('input', () => renderEntries(getVisibleEntries()));

  // Folder tabs
  const tabDiv = document.createElement('div');
  tabDiv.className = 'folder-tabs';
  tabDiv.id = 'folderTabs';
  $('topBar').appendChild(tabDiv);
  renderFolderTabs();
}

// ── Folder tabs ──────────────────────────────────────────────────────

function renderFolderTabs() {
  const el = $('folderTabs');
  if (!el) return;
  if (!allFolders.length) { el.innerHTML = ''; return; }
  let html = `<button class="ftab${activeFolder === null ? ' on' : ''}" data-fid="all">All</button>`;
  allFolders.forEach(f => {
    const ic = iconSvg(f.icon || 'key', 12, f.color || null);
    html += `<button class="ftab${activeFolder === f.id ? ' on' : ''}" data-fid="${f.id}">${ic} ${esc(f.name)}</button>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.ftab').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.fid;
      activeFolder = fid === 'all' ? null : parseInt(fid);
      renderFolderTabs();
      renderEntries(getVisibleEntries());
    });
  });
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
          allFolders = state.folders || [];
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
      allFolders = res.folders || [];
      $('statusBar').textContent = `${allEntries.length} entries — refreshed`;
      renderFolderTabs();
      loadMatches();
      renderEntries(getVisibleEntries());
    }
  });
}

function doLock() {
  chrome.runtime.sendMessage({ type: 'logout' }, () => {
    allEntries = [];
    allFolders = [];
    activeFolder = null;
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
        matchedIds = new Set(res.matches.map(e => e.id));
        let html = '<div class="match-label">Matches for this site</div>';
        html += res.matches.map(e => entryHtml(e)).join('');
        section.innerHTML = html;
        attachFillHandlers(section);
        // Re-render entry list to exclude matches
        renderEntries(getVisibleEntries());
      } else {
        matchedIds = new Set();
        section.innerHTML = '';
      }
    });
  });
}

// ── Search & filter ──────────────────────────────────────────────────

function getVisibleEntries() {
  let list = allEntries.filter(e => !matchedIds.has(e.id));
  if (activeFolder !== null) list = list.filter(e => e.folder_id === activeFolder);
  const input = $('searchInput');
  const q = input ? input.value.toLowerCase() : '';
  if (q) {
    list = list.filter(e =>
      e.title.toLowerCase().includes(q) ||
      (e.data.username || '').toLowerCase().includes(q) ||
      (e.data.url || '').toLowerCase().includes(q)
    );
  }
  return list;
}

// ── Render ────────────────────────────────────────────────────────────

function renderEntries(list) {
  const el = $('entryList');
  if (!list.length) {
    el.innerHTML = '<div class="empty">No entries found</div>';
    return;
  }
  el.innerHTML = list.map(e => entryHtml(e)).join('');
  attachFillHandlers(el);
}

function entryHtml(e) {
  const folder = allFolders.find(f => f.id === e.folder_id);
  const ic = iconSvg(folder?.icon || (e.type === 'login' ? 'key' : 'filetext'), 16, folder?.color || null);
  const meta = e.type === 'login' ? (e.data.username || e.data.url || 'No username') : 'Secure note';

  let acts = '';
  if (e.type === 'login') {
    acts = `
      <div class="e-acts">
        <button class="e-act" data-id="${e.id}" data-action="copy-user" title="Copy username">${iconSvg('user', 12)}</button>
        <button class="e-act" data-id="${e.id}" data-action="copy-pass" title="Copy password">${iconSvg('lock', 12)}</button>
        <button class="e-act e-act-fill" data-id="${e.id}" data-action="fill" title="Fill">${iconSvg('key', 12)}</button>
      </div>
    `;
  } else {
    acts = `
      <div class="e-acts">
        <button class="e-act" data-id="${e.id}" data-action="copy-note" title="Copy note">${iconSvg('filetext', 12)}</button>
      </div>
    `;
  }

  return `
    <div class="entry" data-id="${e.id}">
      <div class="e-icon">${ic}</div>
      <div class="e-info">
        <div class="e-title">${esc(e.title)}</div>
        <div class="e-meta">${esc(meta)}</div>
      </div>
      ${acts}
    </div>
  `;
}

function attachFillHandlers(container) {
  container.querySelectorAll('.e-act').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const action = btn.dataset.action;
      const entry = allEntries.find(en => en.id === id);
      if (!entry) return;

      if (action === 'fill') {
        chrome.runtime.sendMessage({ type: 'fillFromPopup', id });
        flashBtn(btn);
        setTimeout(() => window.close(), 600);
      } else if (action === 'copy-user') {
        copyText(entry.data.username || '');
        flashBtn(btn);
      } else if (action === 'copy-pass') {
        copyText(entry.data.password || '');
        flashBtn(btn);
      } else if (action === 'copy-note') {
        copyText(entry.data.notes || entry.data.content || '');
        flashBtn(btn);
      }
    });
  });
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
}

function flashBtn(btn) {
  btn.style.color = 'var(--success)';
  btn.style.borderColor = 'var(--success)';
  btn.style.background = 'rgba(61, 214, 140, 0.15)';
  setTimeout(() => {
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.style.background = '';
  }, 1200);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Start ─────────────────────────────────────────────────────────────

init();

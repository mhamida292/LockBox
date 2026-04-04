let entries=[],folders=[],aFolder=null,aType='all',editId=null;
let selFolderIcon='key',editFolderId=null;
let P={theme:'midnight',pwLen:'20',symbols:'true',lockMin:'30'};
try{const s=JSON.parse(localStorage.getItem('lb_p'));if(s)P={...P,...s}}catch(e){}

// ── Icons ─────────────────────────────────────────────────────────────

const ICONS={
  key:       {n:'Key',        p:'<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>'},
  mail:      {n:'Mail',       p:'<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'},
  lock:      {n:'Lock',       p:'<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'},
  globe:     {n:'Website',    p:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'},
  card:      {n:'Finance',    p:'<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>'},
  user:      {n:'Person',     p:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'},
  users:     {n:'Social',     p:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'},
  phone:     {n:'Mobile',     p:'<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>'},
  briefcase: {n:'Work',       p:'<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'},
  cart:      {n:'Shopping',   p:'<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'},
  gamepad:   {n:'Gaming',     p:'<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><rect width="20" height="12" x="2" y="6" rx="2"/>'},
  mappin:    {n:'Travel',     p:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'},
  music:     {n:'Music',      p:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'},
  play:      {n:'Streaming',  p:'<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>'},
  heart:     {n:'Health',     p:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'},
  code:      {n:'Developer',  p:'<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>'},
  cloud:     {n:'Cloud',      p:'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'},
  shield:    {n:'Security',   p:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'},
  star:      {n:'Favourite',  p:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'},
  filetext:  {n:'Document',   p:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'},
};

function iconSvg(id,size=20){
  const path=(ICONS[id]||ICONS.key).p;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

// ── Folder icon picker ────────────────────────────────────────────────

function renderFolderIconPicker(){
  return Object.entries(ICONS).map(([id,{n}])=>
    `<button type="button" class="icon-opt${selFolderIcon===id?' on':''}" onclick="pickFolderIcon('${id}')" title="${n}">${iconSvg(id,16)}</button>`
  ).join('');
}
function pickFolderIcon(id){selFolderIcon=id;document.getElementById('folderIconPicker').innerHTML=renderFolderIconPicker()}

// ── Prefs ─────────────────────────────────────────────────────────────

function applyP(){
  document.body.dataset.theme=P.theme;
  document.querySelectorAll('.tcard').forEach(c=>c.classList.toggle('on',c.dataset.t===P.theme));
  const l=document.getElementById('sPwLen');if(l)l.value=P.pwLen;
  const s=document.getElementById('sSym');if(s)s.value=P.symbols;
  const k=document.getElementById('sLock');if(k)k.value=P.lockMin;
}
function savePref(k,v){P[k]=v;localStorage.setItem('lb_p',JSON.stringify(P));applyP()}
function setTheme(t){savePref('theme',t)}
applyP();

// ── Init / Auth ───────────────────────────────────────────────────────

async function init(){
  const r=await fetch('/api/status');const d=await r.json();
  if(d.authenticated){showApp()}
  else if(d.setup_done){document.getElementById('authSub').textContent='Unlock your vault';document.getElementById('authBtn').textContent='Unlock'}
  else{document.getElementById('confirmWrap').style.display='block'}
}

async function doAuth(){
  const pw=document.getElementById('masterIn').value,cf=document.getElementById('confirmIn').value,err=document.getElementById('authErr');
  const st=await(await fetch('/api/status')).json();
  if(!st.setup_done){
    if(pw.length<8){err.textContent='Must be at least 8 characters';return}
    if(pw!==cf){err.textContent="Passwords don't match";return}
    const r=await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({master_password:pw})});
    const d=await r.json();if(d.ok)showApp();else err.textContent=d.error;
  }else{
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({master_password:pw})});
    const d=await r.json();if(d.ok)showApp();else err.textContent=d.error;
  }
}
['masterIn','confirmIn'].forEach(id=>document.getElementById(id).addEventListener('keydown',e=>{if(e.key==='Enter')doAuth()}));

async function showApp(){document.getElementById('authScreen').style.display='none';document.getElementById('app').classList.add('active');await loadData()}
async function doLogout(){await fetch('/api/logout',{method:'POST'});location.reload()}
async function loadData(){const[f,e]=await Promise.all([fetch('/api/folders'),fetch('/api/entries')]);folders=await f.json();entries=await e.json();renderF();render()}

// ── Sidebar ───────────────────────────────────────────────────────────

function openSB(){document.getElementById('sidebar').classList.add('open');document.getElementById('shade').classList.add('open')}
function closeSB(){document.getElementById('sidebar').classList.remove('open');document.getElementById('shade').classList.remove('open')}

function renderF(){
  const el=document.getElementById('flist'),ct={};
  entries.forEach(e=>{const k=e.folder_id||'x';ct[k]=(ct[k]||0)+1});
  let h=`<li class="fi-item ${aFolder===null?'on':''}" onclick="pickF(null)"><span class="fn">📁 All</span><span class="fc">${entries.length}</span></li>`;
  folders.forEach(f=>{
    const fic=iconSvg(f.icon||'key',14);
    h+=`<li class="fi-item ${aFolder===f.id?'on':''}" onclick="pickF(${f.id})">
      <span class="fn">${fic} ${esc(f.name)}</span>
      <span style="display:flex;align-items:center;gap:4px">
        <span class="fc">${ct[f.id]||0}</span>
        <button class="fedit" onclick="event.stopPropagation();openFolderModal(${f.id})" title="Edit">✎</button>
        <button class="fdel" onclick="event.stopPropagation();delF(${f.id})">×</button>
      </span>
    </li>`;
  });
  el.innerHTML=h;
}

function pickF(id){aFolder=id;renderF();render();closeSB()}

// ── Folder modal ──────────────────────────────────────────────────────

function openFolderModal(fid=null){
  editFolderId=fid;
  if(fid){
    const f=folders.find(x=>x.id===fid);if(!f)return;
    document.getElementById('fMt').textContent='Edit Folder';
    document.getElementById('fName').value=f.name;
    selFolderIcon=f.icon||'key';
  }else{
    document.getElementById('fMt').textContent='New Folder';
    document.getElementById('fName').value='';
    selFolderIcon='key';
  }
  document.getElementById('folderIconPicker').innerHTML=renderFolderIconPicker();
  document.getElementById('fOv').classList.add('on');
}
function closeFolderModal(){document.getElementById('fOv').classList.remove('on')}
async function saveFolderModal(){
  const name=document.getElementById('fName').value.trim();
  if(!name){toast('Name required');return}
  if(editFolderId){
    await fetch(`/api/folders/${editFolderId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,icon:selFolderIcon})});
  }else{
    await fetch('/api/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,icon:selFolderIcon})});
  }
  closeFolderModal();await loadData();toast(editFolderId?'Folder updated':'Folder created');
}

async function delF(id){if(!confirm('Delete folder? Entries move to uncategorized.'))return;await fetch(`/api/folders/${id}`,{method:'DELETE'});if(aFolder===id)aFolder=null;await loadData()}
function setType(t,btn){aType=t;document.querySelectorAll('.tbtn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');render();closeSB()}

// ── Render entries ────────────────────────────────────────────────────

function render(){
  const q=document.getElementById('searchIn').value.toLowerCase();
  let list=entries;
  if(aFolder!==null)list=list.filter(e=>e.folder_id===aFolder);
  if(aType!=='all')list=list.filter(e=>e.type===aType);
  if(q)list=list.filter(e=>e.title.toLowerCase().includes(q)||(e.data.username||'').toLowerCase().includes(q)||(e.data.url||'').toLowerCase().includes(q)||(e.data.notes||'').toLowerCase().includes(q));
  const el=document.getElementById('elist');
  if(!list.length){el.innerHTML=`<div class="empty"><div class="empty-hex">⬡</div><p>No entries${q?' found':' yet'}</p><div class="hint">${q?'Try a different search':'Tap + to add your first entry'}</div></div>`;return}
  el.innerHTML=list.map((e,i)=>{
    const folder=folders.find(f=>f.id===e.folder_id);
    const ic=iconSvg(folder?.icon||(e.type==='login'?'key':'filetext'));
    const meta=e.type==='login'?(e.data.username||e.data.url||'No username'):'Secure note';
    const btns=e.type==='login'
      ?`<button class="ecopy" onclick="event.stopPropagation();cpField(${e.id},'username')" title="Copy username">👤</button><button class="ecopy" onclick="event.stopPropagation();cpField(${e.id},'password')" title="Copy password">🔑</button>`
      :`<button class="ecopy" onclick="event.stopPropagation();cpField(${e.id},'notes')" title="Copy note">📋</button>`;
    return`<div class="ecard" data-type="${e.type}" style="animation-delay:${i*.03}s" onclick="openEdit(${e.id})"><div class="eicon">${ic}</div><div class="einfo"><div class="etitle">${esc(e.title)}</div><div class="emeta">${esc(meta)}</div></div><div class="ecopy-group">${btns}</div></div>`
  }).join('');
}

// ── Copy ──────────────────────────────────────────────────────────────

async function cpField(id,field){const e=entries.find(x=>x.id===id);if(!e)return;const t=e.data[field]||'';if(!t){toast('Nothing to copy');return}try{await navigator.clipboard.writeText(t)}catch(err){const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;left:-9999px;top:-9999px';document.body.appendChild(ta);ta.focus();ta.select();document.execCommand('copy');document.body.removeChild(ta)}const labels={username:'Username',password:'Password',notes:'Note'};toast(labels[field]+' copied')}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200)}

// ── Entry modal ───────────────────────────────────────────────────────

function openEntry(type='login'){
  editId=null;
  document.getElementById('eMt').textContent='New Entry';
  document.getElementById('eType').value=type;
  ['eTitle','eUser','ePass','eUrl','eNotes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ePass').type='password';
  document.getElementById('bDel').style.display='none';
  fillFS();togLogin();document.getElementById('eOv').classList.add('on');
}
function openEdit(id){
  const e=entries.find(x=>x.id===id);if(!e)return;editId=id;
  document.getElementById('eMt').textContent='Edit Entry';
  document.getElementById('eType').value=e.type;
  document.getElementById('eTitle').value=e.title;
  document.getElementById('eUser').value=e.data.username||'';
  document.getElementById('ePass').value=e.data.password||'';
  document.getElementById('ePass').type='password';
  document.getElementById('eUrl').value=e.data.url||'';
  document.getElementById('eNotes').value=e.data.notes||'';
  document.getElementById('bDel').style.display='inline-block';
  fillFS(e.folder_id);togLogin();document.getElementById('eOv').classList.add('on');
}
function closeEntry(){document.getElementById('eOv').classList.remove('on')}
function togLogin(){const l=document.getElementById('eType').value==='login';document.getElementById('loginF').style.display=l?'block':'none';document.getElementById('nLbl').textContent=l?'Notes':'Content'}
function fillFS(sel=null){const s=document.getElementById('eFolder');s.innerHTML='<option value="">No folder</option>'+folders.map(f=>`<option value="${f.id}" ${f.id===sel?'selected':''}>${esc(f.name)}</option>`).join('')}
function togPw(){const i=document.getElementById('ePass');i.type=i.type==='password'?'text':'password'}
async function genFill(){const r=await fetch(`/api/generate-password?length=${P.pwLen}&symbols=${P.symbols}`);const d=await r.json();document.getElementById('ePass').value=d.password;document.getElementById('ePass').type='text'}

async function saveEntry(){
  const type=document.getElementById('eType').value,title=document.getElementById('eTitle').value.trim();
  if(!title){toast('Title is required');return}
  const fid=document.getElementById('eFolder').value||null;
  const body={type,title,folder_id:fid?parseInt(fid):null,data:{}};
  if(type==='login'){body.data.username=document.getElementById('eUser').value;body.data.password=document.getElementById('ePass').value;body.data.url=document.getElementById('eUrl').value}
  body.data.notes=document.getElementById('eNotes').value;
  if(editId){await fetch(`/api/entries/${editId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
  else{await fetch('/api/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
  closeEntry();await loadData();toast(editId?'Entry updated':'Entry saved');
}
async function delEntry(){if(!editId||!confirm('Delete this entry permanently?'))return;await fetch(`/api/entries/${editId}`,{method:'DELETE'});closeEntry();await loadData();toast('Entry deleted')}

// ── Settings modal ────────────────────────────────────────────────────

function openSet(){applyP();document.getElementById('sOv').classList.add('on');closeSB()}
function closeSet(){document.getElementById('sOv').classList.remove('on')}

async function clearAll(){
  if(!confirm('This will delete EVERYTHING — all entries, folders, and your master password.'))return;
  const typed=prompt('Type DELETE to confirm:');if(typed!=='DELETE'){toast('Cancelled');return}
  await fetch('/api/clear-all',{method:'POST'});
  closeSet();toast('All data cleared');setTimeout(()=>location.reload(),1000);
}

// ── Utils ─────────────────────────────────────────────────────────────

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
document.getElementById('eOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeEntry()});
document.getElementById('sOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeSet()});
document.getElementById('fOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeFolderModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeEntry();closeSet();closeFolderModal()}if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();document.getElementById('searchIn').focus()}});

if(!sessionStorage.getItem('lb_alive')){
  fetch('/api/logout',{method:'POST'}).finally(()=>{
    sessionStorage.setItem('lb_alive','1');
    init();
  });
}else{
  init();
}

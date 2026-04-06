let entries=[],folders=[],trashEntries=[],aFolder=null,aType='all',aSort='updated';
let expandedId=null; // null, 'new', or entry id
let selFolderIcon='key',selFolderColor='',editFolderId=null;
let lockTimer=null,trackingStarted=false;
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

const COLORS=[
  {hex:'',        label:'Default'},
  {hex:'#6c8cff', label:'Blue'},
  {hex:'#e8853a', label:'Orange'},
  {hex:'#3dd68c', label:'Green'},
  {hex:'#ff5c6a', label:'Red'},
  {hex:'#a78bfa', label:'Purple'},
  {hex:'#f59e0b', label:'Yellow'},
  {hex:'#06b6d4', label:'Cyan'},
  {hex:'#ec4899', label:'Pink'},
];

function iconSvg(id,size=20,color=null){
  const path=(ICONS[id]||ICONS.key).p;
  const stroke=color||'currentColor';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

// ── Folder icon + color pickers ───────────────────────────────────────

function renderFolderIconPicker(){
  return Object.entries(ICONS).map(([id,{n}])=>
    `<button type="button" class="icon-opt${selFolderIcon===id?' on':''}" onclick="pickFolderIcon('${id}')" title="${n}">${iconSvg(id,16)}</button>`
  ).join('');
}
function pickFolderIcon(id){selFolderIcon=id;document.getElementById('folderIconPicker').innerHTML=renderFolderIconPicker()}

function renderColorPicker(){
  return COLORS.map(({hex,label})=>{
    const cls=`color-opt${!hex?' color-default':''}${selFolderColor===hex?' on':''}`;
    const style=hex?`background:${hex}`:'';
    return `<button type="button" class="${cls}" onclick="pickFolderColor('${hex}')" title="${label}" style="${style}"></button>`;
  }).join('');
}
function pickFolderColor(hex){selFolderColor=hex;document.getElementById('colorPicker').innerHTML=renderColorPicker()}

// ── Prefs ─────────────────────────────────────────────────────────────

function applyP(){
  document.body.dataset.theme=P.theme;
  document.querySelectorAll('.tcard').forEach(c=>c.classList.toggle('on',c.dataset.t===P.theme));
  const l=document.getElementById('sPwLen');if(l)l.value=P.pwLen;
  const s=document.getElementById('sSym');if(s)s.value=P.symbols;
  const k=document.getElementById('sLock');if(k)k.value=P.lockMin;
}
function savePref(k,v){P[k]=v;localStorage.setItem('lb_p',JSON.stringify(P));applyP();if(k==='lockMin')resetLockTimer()}
function setTheme(t){savePref('theme',t)}
applyP();

// ── Auto-lock ─────────────────────────────────────────────────────────

function resetLockTimer(){
  if(lockTimer)clearTimeout(lockTimer);
  const mins=parseInt(P.lockMin);
  if(!mins)return;
  lockTimer=setTimeout(doLogout,mins*60*1000);
}
function startActivityTracking(){
  if(trackingStarted)return;
  trackingStarted=true;
  ['mousemove','keydown','click','touchstart'].forEach(ev=>
    document.addEventListener(ev,resetLockTimer,{passive:true})
  );
  resetLockTimer();
}

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

async function showApp(){
  document.getElementById('authScreen').style.display='none';
  document.getElementById('app').classList.add('active');
  await loadData();
  startActivityTracking();
}
async function doLogout(){await fetch('/api/logout',{method:'POST'});location.reload()}
async function loadData(){const[f,e,t]=await Promise.all([fetch('/api/folders'),fetch('/api/entries'),fetch('/api/trash')]);folders=await f.json();entries=await e.json();trashEntries=await t.json();renderF();render()}

// ── Sidebar ───────────────────────────────────────────────────────────

function openSB(){document.getElementById('sidebar').classList.add('open');document.getElementById('shade').classList.add('open')}
function closeSB(){document.getElementById('sidebar').classList.remove('open');document.getElementById('shade').classList.remove('open')}

const TRASH_SVG='<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 0-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
function trashSvg(size=14){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${TRASH_SVG}</svg>`}

function renderF(){
  const el=document.getElementById('flist'),ct={};
  entries.forEach(e=>{const k=e.folder_id||'x';ct[k]=(ct[k]||0)+1});
  let h=`<li class="fi-item ${aFolder===null?'on':''}" onclick="pickF(null)"><span class="fn">📁 All</span><span class="fc">${entries.length}</span></li>`;
  folders.forEach(f=>{
    const fic=iconSvg(f.icon||'key',14,f.color||null);
    h+=`<li class="fi-item ${aFolder===f.id?'on':''}" onclick="pickF(${f.id})">
      <span class="fn">${fic} ${esc(f.name)}</span>
      <span style="display:flex;align-items:center;gap:4px">
        <span class="fc">${ct[f.id]||0}</span>
        <button class="fedit" onclick="event.stopPropagation();openFolderModal(${f.id})" title="Edit">✎</button>
        <button class="fdel" onclick="event.stopPropagation();delF(${f.id})">×</button>
      </span>
    </li>`;
  });
  h+=`<li class="fi-item fi-trash ${aFolder==='trash'?'on':''}" onclick="pickF('trash')"><span class="fn">${trashSvg(14)} Trash</span><span class="fc">${trashEntries.length||''}</span></li>`;
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
    selFolderColor=f.color||'';
  }else{
    document.getElementById('fMt').textContent='New Folder';
    document.getElementById('fName').value='';
    selFolderIcon='key';
    selFolderColor='';
  }
  document.getElementById('folderIconPicker').innerHTML=renderFolderIconPicker();
  document.getElementById('colorPicker').innerHTML=renderColorPicker();
  document.getElementById('fOv').classList.add('on');
  setTimeout(()=>document.getElementById('fName').focus(),50);
}
function closeFolderModal(){document.getElementById('fOv').classList.remove('on')}
async function saveFolderModal(){
  const name=document.getElementById('fName').value.trim();
  if(!name){toast('Name required');return}
  if(editFolderId){
    await fetch(`/api/folders/${editFolderId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,icon:selFolderIcon,color:selFolderColor})});
  }else{
    await fetch('/api/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,icon:selFolderIcon,color:selFolderColor})});
  }
  closeFolderModal();await loadData();toast(editFolderId?'Folder updated':'Folder created');
}
async function delF(id){if(!confirm('Delete folder? Entries move to uncategorized.'))return;await fetch(`/api/folders/${id}`,{method:'DELETE'});if(aFolder===id)aFolder=null;await loadData()}
function setType(t,btn){aType=t;document.querySelectorAll('.tbtn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');render();closeSB()}
function setSort(v){aSort=v;render()}

// ── Password strength ─────────────────────────────────────────────────

function passwordScore(pw){
  if(!pw)return -1;
  let s=0;
  if(pw.length>=8)s++;
  if(pw.length>=14)s++;
  if(/[A-Z]/.test(pw))s++;
  if(/[0-9]/.test(pw))s++;
  if(/[^A-Za-z0-9]/.test(pw))s++;
  return Math.min(s,4);
}
function updateStrength(){
  const pw=document.getElementById('ePass');
  if(!pw)return;
  const val=pw.value;
  const wrap=document.getElementById('pwStrength');
  if(!wrap)return;
  if(!val){wrap.style.display='none';return}
  wrap.style.display='flex';
  const score=passwordScore(val);
  const levels=[
    {t:'Very weak',c:'#ff5c6a',w:'20%'},
    {t:'Weak',     c:'#ff8c42',w:'40%'},
    {t:'Fair',     c:'#f59e0b',w:'60%'},
    {t:'Good',     c:'#84cc16',w:'80%'},
    {t:'Strong',   c:'#3dd68c',w:'100%'},
  ];
  const l=levels[score<0?0:score];
  const bar=document.getElementById('pwBar');
  const lbl=document.getElementById('pwLabel');
  if(bar)bar.style.cssText=`width:${l.w};background:${l.c}`;
  if(lbl){lbl.textContent=l.t;lbl.style.color=l.c}
}

// ── Inline entry form builder ─────────────────────────────────────────

function buildEntryForm(e){
  // e is null for new entry, or the entry object for edit
  const isEdit=!!e;
  const type=e?e.type:'login';
  const title=e?esc(e.title):'';
  const user=e?esc(e.data.username||''):'';
  const pass=e?esc(e.data.password||''):'';
  const url=e?esc(e.data.url||''):'';
  const notes=e?esc(e.data.notes||''):'';
  const fid=e?e.folder_id:aFolder;
  const loginDisplay=type==='login'?'block':'none';
  const notesLabel=type==='login'?'Notes':'Content';

  const folderOpts='<option value="">No folder</option>'+folders.map(f=>
    `<option value="${f.id}" ${f.id===fid?'selected':''}>${esc(f.name)}</option>`
  ).join('');

  return `
    <div class="ef-form">
      <div class="ef-row ef-row-type">
        <div class="ef-field ef-half">
          <label class="fl">Type</label>
          <select class="fsel" id="eType" onchange="togLoginInline()">
            <option value="login" ${type==='login'?'selected':''}>Login</option>
            <option value="note" ${type==='note'?'selected':''}>Secure Note</option>
          </select>
        </div>
        <div class="ef-field ef-half">
          <label class="fl">Folder</label>
          <select class="fsel" id="eFolder">${folderOpts}</select>
        </div>
      </div>
      <div class="ef-field">
        <label class="fl">Title</label>
        <input class="finp" id="eTitle" placeholder="e.g. GitHub, Netflix..." value="${title}">
      </div>
      <div id="loginF" style="display:${loginDisplay}">
        <div class="ef-field">
          <label class="fl">Username / Email</label>
          <input class="finp" id="eUser" placeholder="user@example.com" autocomplete="off" value="${user}">
        </div>
        <div class="ef-field">
          <label class="fl">Password</label>
          <div class="frow">
            <div class="fg"><input class="finp" type="password" id="ePass" placeholder="••••••••" autocomplete="off" value="${pass}" oninput="updateStrength()"></div>
            <button class="bsm" onclick="togPw()" title="Show/hide" type="button">👁</button>
            <button class="bgen" onclick="genFill()" type="button">GEN</button>
          </div>
          <div class="pw-strength" id="pwStrength" style="display:none">
            <div class="pw-strength-track"><div class="pw-strength-bar" id="pwBar"></div></div>
            <div class="pw-strength-label" id="pwLabel"></div>
          </div>
        </div>
        <div class="ef-field">
          <label class="fl">URL</label>
          <input class="finp" id="eUrl" placeholder="https://..." value="${url}">
        </div>
      </div>
      <div class="ef-field">
        <label class="fl" id="nLbl">${notesLabel}</label>
        <textarea class="fta" id="eNotes" placeholder="Optional notes...">${notes}</textarea>
      </div>
      <div class="ef-actions">
        ${isEdit?`<button class="bdng" onclick="delEntry(${e.id})" type="button">Delete</button>`:'<div></div>'}
        <div class="ef-actions-right">
          <button class="bgho" onclick="closeInline()" type="button">Cancel</button>
          <button class="bpri" onclick="saveEntry()" type="button">Save</button>
        </div>
      </div>
    </div>
  `;
}

// ── Render entries ────────────────────────────────────────────────────

function renderTrash(q){
  const el=document.getElementById('elist');
  let list=trashEntries;
  if(aType!=='all')list=list.filter(e=>e.type===aType);
  if(q)list=list.filter(e=>e.title.toLowerCase().includes(q));
  if(aSort==='az')list=[...list].sort((a,b)=>a.title.localeCompare(b.title));
  else if(aSort==='za')list=[...list].sort((a,b)=>b.title.localeCompare(a.title));
  else if(aSort==='created')list=[...list].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(!list.length&&!trashEntries.length){
    el.innerHTML='<div class="empty"><div class="empty-hex">⬡</div><p>Trash is empty</p><div class="hint">Deleted entries appear here for 30 days</div></div>';
    return;
  }
  const emptyBtn=trashEntries.length?`<button class="bdng" onclick="emptyTrash()">Empty Trash</button>`:'';
  let html=`<div class="trash-bar"><span>${trashEntries.length} item${trashEntries.length!==1?'s':''} in trash</span>${emptyBtn}</div>`;
  if(!list.length){el.innerHTML=html+'<div class="empty"><div class="empty-hex">⬡</div><p>No results</p></div>';return}
  html+=list.map((e,i)=>{
    const folder=folders.find(f=>f.id===e.folder_id);
    const ic=iconSvg(folder?.icon||(e.type==='login'?'key':'filetext'),20,folder?.color||null);
    const meta=e.type==='login'?(e.data.username||e.data.url||'No username'):'Secure note';
    return `<div class="ecard" data-type="${e.type}" style="animation-delay:${i*.03}s">
      <div class="eicon">${ic}</div>
      <div class="einfo"><div class="etitle">${esc(e.title)}</div><div class="emeta">${esc(meta)}</div></div>
      <div class="ecopy-group">
        <button class="ecopy ecopy-restore" onclick="restoreEntry(${e.id})" title="Restore">↩</button>
        <button class="ecopy ecopy-danger" onclick="permDeleteEntry(${e.id})" title="Delete permanently">✕</button>
      </div>
    </div>`;
  }).join('');
  el.innerHTML=html;
}

function render(){
  const q=document.getElementById('searchIn').value.toLowerCase();
  const addBtn=document.querySelector('.btn-new');
  if(addBtn)addBtn.style.display=aFolder==='trash'?'none':'';
  if(aFolder==='trash'){renderTrash(q);return}
  let list=entries;
  if(aFolder!==null)list=list.filter(e=>e.folder_id===aFolder);
  if(aType!=='all')list=list.filter(e=>e.type===aType);
  if(q)list=list.filter(e=>e.title.toLowerCase().includes(q)||(e.data.username||'').toLowerCase().includes(q)||(e.data.url||'').toLowerCase().includes(q)||(e.data.notes||'').toLowerCase().includes(q));
  if(aSort==='az')list=[...list].sort((a,b)=>a.title.localeCompare(b.title));
  else if(aSort==='za')list=[...list].sort((a,b)=>b.title.localeCompare(a.title));
  else if(aSort==='created')list=[...list].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const el=document.getElementById('elist');

  let html='';

  // New entry form at top
  if(expandedId==='new'){
    html+=`<div class="ecard expanded">${buildEntryForm(null)}</div>`;
  }

  if(!list.length && expandedId!=='new'){
    el.innerHTML=`<div class="empty"><div class="empty-hex">⬡</div><p>No entries${q?' found':' yet'}</p><div class="hint">${q?'Try a different search':'Tap + to add your first entry'}</div></div>`;
    return;
  }

  html+=list.map((e,i)=>{
    if(expandedId===e.id){
      return `<div class="ecard expanded" data-type="${e.type}">${buildEntryForm(e)}</div>`;
    }
    const folder=folders.find(f=>f.id===e.folder_id);
    const ic=iconSvg(folder?.icon||(e.type==='login'?'key':'filetext'),20,folder?.color||null);
    const meta=e.type==='login'?(e.data.username||e.data.url||'No username'):'Secure note';
    const urlBtn=e.type==='login'&&e.data.url?`<button class="ecopy" onclick="event.stopPropagation();goToUrl(${e.id})" title="Open URL">🔗</button>`:'';
    const btns=e.type==='login'
      ?`<button class="ecopy" onclick="event.stopPropagation();cpField(${e.id},'username')" title="Copy username">👤</button><button class="ecopy" onclick="event.stopPropagation();cpField(${e.id},'password')" title="Copy password">🔑</button>${urlBtn}`
      :`<button class="ecopy" onclick="event.stopPropagation();cpField(${e.id},'notes')" title="Copy note">📋</button>`;
    return`<div class="ecard" data-type="${e.type}" style="animation-delay:${i*.03}s" onclick="openEdit(${e.id})"><div class="eicon">${ic}</div><div class="einfo"><div class="etitle">${esc(e.title)}</div><div class="emeta">${esc(meta)}</div></div><div class="ecopy-group">${btns}</div></div>`;
  }).join('');

  el.innerHTML=html;

  // After render, scroll expanded card into view and trigger strength check
  if(expandedId!==null){
    const exp=el.querySelector('.ecard.expanded');
    if(exp){
      exp.scrollIntoView({behavior:'smooth',block:'nearest'});
      setTimeout(()=>{
        const titleIn=document.getElementById('eTitle');
        if(titleIn && expandedId==='new')titleIn.focus();
        updateStrength();
      },60);
    }
  }
}

// ── Inline entry actions ──────────────────────────────────────────────

function openEntry(){
  expandedId='new';
  render();
}
function openEdit(id){
  expandedId=id;
  render();
}
function closeInline(){
  expandedId=null;
  render();
}
function togLoginInline(){
  const l=document.getElementById('eType').value==='login';
  document.getElementById('loginF').style.display=l?'block':'none';
  document.getElementById('nLbl').textContent=l?'Notes':'Content';
}
function togPw(){const i=document.getElementById('ePass');if(i)i.type=i.type==='password'?'text':'password'}
async function genFill(){const r=await fetch(`/api/generate-password?length=${P.pwLen}&symbols=${P.symbols}`);const d=await r.json();const p=document.getElementById('ePass');if(p){p.value=d.password;p.type='text';updateStrength()}}

async function saveEntry(){
  const type=document.getElementById('eType').value,title=document.getElementById('eTitle').value.trim();
  if(!title){toast('Title is required');return}
  const fid=document.getElementById('eFolder').value||null;
  const body={type,title,folder_id:fid?parseInt(fid):null,data:{}};
  if(type==='login'){body.data.username=document.getElementById('eUser').value;body.data.password=document.getElementById('ePass').value;body.data.url=document.getElementById('eUrl').value}
  body.data.notes=document.getElementById('eNotes').value;
  const eid=expandedId;
  let res;
  if(eid!=='new'){
    res=await fetch(`/api/entries/${eid}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }else{
    res=await fetch('/api/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }
  const d=await res.json();
  if(d.entry){
    if(eid!=='new'){
      const idx=entries.findIndex(x=>x.id===eid);
      if(idx>=0)entries[idx]=d.entry;
    }else{
      entries.unshift(d.entry);
    }
    renderF();
  }
  expandedId=null;
  render();
  toast(eid!=='new'?'Entry updated':'Entry saved');
}
async function delEntry(id){
  if(!confirm('Move this entry to trash?'))return;
  await fetch(`/api/entries/${id}`,{method:'DELETE'});
  const entry=entries.find(x=>x.id===id);
  if(entry)trashEntries.unshift(entry);
  entries=entries.filter(x=>x.id!==id);
  expandedId=null;
  renderF();render();
  toast('Moved to trash');
}
async function restoreEntry(id){
  await fetch(`/api/entries/${id}/restore`,{method:'POST'});
  const entry=trashEntries.find(x=>x.id===id);
  if(entry)entries.unshift(entry);
  trashEntries=trashEntries.filter(x=>x.id!==id);
  renderF();render();
  toast('Entry restored');
}
async function permDeleteEntry(id){
  if(!confirm('Permanently delete this entry? This cannot be undone.'))return;
  await fetch(`/api/entries/${id}/permanent`,{method:'DELETE'});
  trashEntries=trashEntries.filter(x=>x.id!==id);
  renderF();render();
  toast('Entry permanently deleted');
}
async function emptyTrash(){
  if(!confirm(`Permanently delete all ${trashEntries.length} item${trashEntries.length!==1?'s':''} in trash? This cannot be undone.`))return;
  await fetch('/api/trash/empty',{method:'POST'});
  trashEntries=[];
  renderF();render();
  toast('Trash emptied');
}

// ── Copy ──────────────────────────────────────────────────────────────

function goToUrl(id){const e=entries.find(x=>x.id===id);if(!e||!e.data.url)return;let url=e.data.url;if(!/^https?:\/\//i.test(url))url='https://'+url;window.open(url,'_blank')}

async function cpField(id,field){const e=entries.find(x=>x.id===id);if(!e)return;const t=e.data[field]||'';if(!t){toast('Nothing to copy');return}try{await navigator.clipboard.writeText(t)}catch(err){const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;left:-9999px;top:-9999px';document.body.appendChild(ta);ta.focus();ta.select();document.execCommand('copy');document.body.removeChild(ta)}const labels={username:'Username',password:'Password',notes:'Note'};toast(labels[field]+' copied')}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200)}

// ── Settings modal ────────────────────────────────────────────────────

function openSet(){applyP();document.getElementById('sOv').classList.add('on');closeSB()}
function closeSet(){document.getElementById('sOv').classList.remove('on')}

async function clearAll(){
  if(!confirm('This will delete EVERYTHING — all entries, folders, and your master password.'))return;
  const typed=prompt('Type DELETE to confirm:');if(typed!=='DELETE'){toast('Cancelled');return}
  await fetch('/api/clear-all',{method:'POST'});
  closeSet();toast('All data cleared');setTimeout(()=>location.reload(),1000);
}

// ── Export / Import ───────────────────────────────────────────────────

let exportFormat='encrypted',exportStep=1;
let importStep=1,importFile=null;

function openExportModal(fmt){
  exportFormat=fmt;
  exportStep=1;
  document.getElementById('exMt').textContent=fmt==='encrypted'?'Export Backup':'Export CSV';
  document.getElementById('exMaster').value='';
  document.getElementById('exBackup').value='';
  document.getElementById('exBackupConfirm').value='';
  document.getElementById('exConfirm').value='';
  document.getElementById('exErr').textContent='';
  document.getElementById('exStep1').style.display='block';
  document.getElementById('exStep2').style.display='none';
  document.getElementById('exBtn').textContent='Next';
  document.getElementById('exOv').classList.add('on');
  closeSet();
  setTimeout(()=>document.getElementById('exMaster').focus(),50);
}
function closeExportModal(){document.getElementById('exOv').classList.remove('on')}

async function doExport(){
  const err=document.getElementById('exErr');
  err.textContent='';
  if(exportStep===1){
    const master=document.getElementById('exMaster').value;
    if(!master){err.textContent='Enter your master password';return}
    exportStep=2;
    document.getElementById('exStep1').style.display='none';
    document.getElementById('exStep2').style.display='block';
    if(exportFormat==='encrypted'){
      document.getElementById('exBackupWrap').style.display='block';
      document.getElementById('exConfirmWrap').style.display='none';
      document.getElementById('exBtn').textContent='Export';
      setTimeout(()=>document.getElementById('exBackup').focus(),50);
    }else{
      document.getElementById('exBackupWrap').style.display='none';
      document.getElementById('exConfirmWrap').style.display='block';
      document.getElementById('exBtn').textContent='Export';
      setTimeout(()=>document.getElementById('exConfirm').focus(),50);
    }
    return;
  }
  // Step 2: execute
  const master=document.getElementById('exMaster').value;
  if(exportFormat==='csv'){
    if(document.getElementById('exConfirm').value!=='EXPORT'){err.textContent='Type EXPORT to confirm';return}
  }else{
    const bp=document.getElementById('exBackup').value;
    const bpc=document.getElementById('exBackupConfirm').value;
    if(!bp||bp.length<8){err.textContent='Backup password must be at least 8 characters';return}
    if(bp!==bpc){err.textContent='Passwords don\'t match';return}
  }
  const body={master_password:master,format:exportFormat};
  if(exportFormat==='encrypted')body.backup_password=document.getElementById('exBackup').value;
  const res=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok){const d=await res.json();err.textContent=d.error;return}
  const blob=await res.blob();
  const cd=res.headers.get('Content-Disposition')||'';
  const fnMatch=cd.match(/filename=(.+)/);
  const fn=fnMatch?fnMatch[1]:(exportFormat==='csv'?'lockbox-export.csv':'lockbox-backup.enc');
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeExportModal();
  toast('Export complete');
}

function openImportFlow(){
  importStep=1;importFile=null;
  document.getElementById('imStep1').style.display='block';
  document.getElementById('imStep2').style.display='none';
  document.getElementById('imStep3').style.display='none';
  document.getElementById('imErr').textContent='';
  document.getElementById('imFile').value='';
  document.getElementById('imBtn').textContent='Next';
  document.getElementById('imOv').classList.add('on');
  closeSet();
}
function closeImportModal(){document.getElementById('imOv').classList.remove('on')}

async function doImportStep(){
  const err=document.getElementById('imErr');
  err.textContent='';
  if(importStep===1){
    const fileInput=document.getElementById('imFile');
    if(!fileInput.files.length){err.textContent='Select a file';return}
    importFile=fileInput.files[0];
    if(importFile.name.endsWith('.enc')){
      importStep=2;
      document.getElementById('imStep1').style.display='none';
      document.getElementById('imStep2').style.display='block';
      document.getElementById('imBtn').textContent='Import';
      setTimeout(()=>document.getElementById('imPass').focus(),50);
    }else{
      importStep=3;
      document.getElementById('imStep1').style.display='none';
      document.getElementById('imStep3').style.display='block';
      document.getElementById('imPreview').innerHTML=`Ready to import <strong>${esc(importFile.name)}</strong>?`;
      document.getElementById('imBtn').textContent='Import';
    }
    return;
  }
  if(importStep===2){
    const pw=document.getElementById('imPass').value;
    if(!pw){err.textContent='Enter the backup password';return}
    importStep=3;
    document.getElementById('imStep2').style.display='none';
    document.getElementById('imStep3').style.display='block';
    document.getElementById('imPreview').innerHTML=`Ready to import <strong>${esc(importFile.name)}</strong>?`;
    document.getElementById('imBtn').textContent='Import';
    return;
  }
  // Step 3: do import
  const fd=new FormData();
  fd.append('file',importFile);
  if(importFile.name.endsWith('.enc')){
    fd.append('backup_password',document.getElementById('imPass').value);
  }
  document.getElementById('imBtn').textContent='Importing...';
  const res=await fetch('/api/import',{method:'POST',body:fd});
  const d=await res.json();
  if(d.ok){
    closeImportModal();
    await loadData();
    let msg=`Imported ${d.imported_entries} entries`;
    if(d.imported_folders)msg+=` and ${d.imported_folders} folders`;
    toast(msg);
  }else{
    err.textContent=d.error;
    document.getElementById('imBtn').textContent='Import';
  }
}

// ── Utils ─────────────────────────────────────────────────────────────

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
document.getElementById('sOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeSet()});
document.getElementById('fOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeFolderModal()});
document.getElementById('exOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeExportModal()});
document.getElementById('imOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeImportModal()});
document.getElementById('fName').addEventListener('keydown',e=>{if(e.key==='Enter')saveFolderModal()});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(expandedId!==null){closeInline();return}
    closeSet();closeFolderModal();closeExportModal();closeImportModal();
  }
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();document.getElementById('searchIn').focus()}
});

if(!sessionStorage.getItem('lb_alive')){
  fetch('/api/logout',{method:'POST'}).finally(()=>{
    sessionStorage.setItem('lb_alive','1');
    init();
  });
}else{
  init();
}

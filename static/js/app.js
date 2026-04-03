let entries=[],folders=[],aFolder=null,aType='all',editId=null;
let P={theme:'midnight',pwLen:'20',symbols:'true',lockMin:'30'};
try{const s=JSON.parse(localStorage.getItem('lb_p'));if(s)P={...P,...s}}catch(e){}

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

function openSB(){document.getElementById('sidebar').classList.add('open');document.getElementById('shade').classList.add('open')}
function closeSB(){document.getElementById('sidebar').classList.remove('open');document.getElementById('shade').classList.remove('open')}

function renderF(){
    const el=document.getElementById('flist'),ct={};
    entries.forEach(e=>{const k=e.folder_id||'x';ct[k]=(ct[k]||0)+1});
    let h=`<li class="fi-item ${aFolder===null?'on':''}" onclick="pickF(null)"><span class="fn">📁 All</span><span class="fc">${entries.length}</span></li>`;
    folders.forEach(f=>{h+=`<li class="fi-item ${aFolder===f.id?'on':''}" onclick="pickF(${f.id})"><span class="fn">📂 ${esc(f.name)}</span><span style="display:flex;align-items:center;gap:6px"><span class="fc">${ct[f.id]||0}</span><button class="fdel" onclick="event.stopPropagation();delF(${f.id})">×</button></span></li>`});
    el.innerHTML=h;
}
function pickF(id){aFolder=id;renderF();render();closeSB()}
async function newFolder(){const n=prompt('Folder name:');if(!n||!n.trim())return;await fetch('/api/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n.trim()})});await loadData()}
async function delF(id){if(!confirm('Delete folder? Entries move to uncategorized.'))return;await fetch(`/api/folders/${id}`,{method:'DELETE'});if(aFolder===id)aFolder=null;await loadData()}

function setType(t,btn){aType=t;document.querySelectorAll('.tbtn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');render();closeSB()}

function render(){
    const q=document.getElementById('searchIn').value.toLowerCase();
    let list=entries;
    if(aFolder!==null)list=list.filter(e=>e.folder_id===aFolder);
    if(aType!=='all')list=list.filter(e=>e.type===aType);
    if(q)list=list.filter(e=>e.title.toLowerCase().includes(q)||(e.data.username||'').toLowerCase().includes(q)||(e.data.url||'').toLowerCase().includes(q)||(e.data.notes||'').toLowerCase().includes(q));
    const el=document.getElementById('elist');
    if(!list.length){el.innerHTML=`<div class="empty"><div class="empty-hex">⬡</div><p>No entries${q?' found':' yet'}</p><div class="hint">${q?'Try a different search':'Tap + to add your first entry'}</div></div>`;return}
    el.innerHTML=list.map((e,i)=>{
        const ic=e.type==='login'?'🔑':'📝',meta=e.type==='login'?(e.data.username||e.data.url||'No username'):'Secure note';
        const btns = e.type==='login'
            ? `<button class="ecopy" onclick="event.stopPropagation();cpField(${e.id},'username')" title="Copy username">👤</button><button class="ecopy" onclick="event.stopPropagation();cpField(${e.id},'password')" title="Copy password">🔑</button>`
            : `<button class="ecopy" onclick="event.stopPropagation();cpField(${e.id},'notes')" title="Copy note">📋</button>`;
        return`<div class="ecard" data-type="${e.type}" style="animation-delay:${i*.03}s" onclick="openEdit(${e.id})"><div class="eicon">${ic}</div><div class="einfo"><div class="etitle">${esc(e.title)}</div><div class="emeta">${esc(meta)}</div></div><div class="ecopy-group">${btns}</div></div>`
    }).join('');
}

async function cpField(id,field){const e=entries.find(x=>x.id===id);if(!e)return;const t=e.data[field]||'';if(!t){toast('Nothing to copy');return}try{await navigator.clipboard.writeText(t)}catch(err){const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;left:-9999px;top:-9999px';document.body.appendChild(ta);ta.focus();ta.select();document.execCommand('copy');document.body.removeChild(ta)}const labels={username:'Username',password:'Password',notes:'Note'};toast(labels[field]+' copied')}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200)}

function openEntry(type='login'){
    editId=null;document.getElementById('eMt').textContent='New Entry';
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

function openSet(){applyP();document.getElementById('sOv').classList.add('on');closeSB()}
function closeSet(){document.getElementById('sOv').classList.remove('on')}

async function clearAll(){
    if(!confirm('This will delete EVERYTHING — all entries, folders, and your master password.'))return;
    const typed=prompt('Type DELETE to confirm:');if(typed!=='DELETE'){toast('Cancelled');return}
    await fetch('/api/clear-all',{method:'POST'});
    closeSet();toast('All data cleared');setTimeout(()=>location.reload(),1000);
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
document.getElementById('eOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeEntry()});
document.getElementById('sOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeSet()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeEntry();closeSet()}if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();document.getElementById('searchIn').focus()}});

if(!sessionStorage.getItem('lb_alive')){
    fetch('/api/logout',{method:'POST'}).finally(()=>{
        sessionStorage.setItem('lb_alive','1');
        init();
    });
} else {
    init();
}

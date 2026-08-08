/* nine2two (922) — mobile web app, Supabase backend. Spec: nine2two-PRD-v1.md */
/* supabase-js is vendored (vendor/supabase/supabase.js, UMD) and exposes window.supabase. */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/* ================= Config / clients ================= */
const CONFIGURED = /^https:\/\//.test(SUPABASE_URL) && !SUPABASE_URL.includes('YOUR-PROJECT');
const supabase = CONFIGURED ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const DEFAULT_CENTER = [34.1016, -118.3267]; // Hollywood, LA (PRD §4.1)
const FRESH_LIMIT_DAYS = 30;                 // "Needs a fresh check" (PRD §4.4)
const FEATURES = ['Free','Accessible ♿','Changing table','Gender neutral','Needs key/code','24 hours'];
const REPORT_REASONS = ["Doesn't exist",'Closed permanently','Inappropriate content'];
const ADMIN_MODE = new URLSearchParams(location.search).get('admin') === '1';

let map, userPos = null, userMarker = null;
let restrooms = [];   // rows from restrooms_with_stats
let markers = {};
let dropMode = false, pendingLatLng = null, pendingName = '';
let adjustMarker = null;
let addStarsVal = 0, detailStars = 0;
let session = null, isAdmin = false;

/* ================= Helpers ================= */
const $ = id => document.getElementById(id);
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); }
function scoreColor(a){ return a>=4 ? 'var(--ok)' : a>=2.5 ? 'var(--signal)' : a>0 ? 'var(--danger)' : 'var(--muted)'; }
function scoreTextColor(a){ return (a>=2.5 && a<4) ? 'var(--ink)' : '#fff'; }
function scoreWord(a){ return a>=4.5?'Sparkling':a>=4?'Clean':a>=3?'Decent':a>=2?'Rough':a>0?'Avoid':'Unrated'; }
function starsStr(n){ return '★'.repeat(Math.round(n)) + '☆'.repeat(5-Math.round(n)); }
function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function distMi(a,b){
  // Haversine great-circle distance in miles (R = Earth's mean radius in miles).
  // Not a flat lat/lng approximation — accurate over any real-world distance.
  const R=3958.8, dLat=(b[0]-a[0])*Math.PI/180, dLng=(b[1]-a[1])*Math.PI/180;
  const h=Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function distLabel(r){
  if(!userPos) return '';
  const mi = distMi(userPos,[r.lat,r.lng]);
  return mi<0.1 ? Math.round(mi*5280)+' ft' : mi.toFixed(1)+' mi';
}
function radiusFilter(){ return parseFloat($('radiusSelect').value); } // may be Infinity
function filteredRestrooms(){
  if(!userPos) return restrooms;
  const r = radiusFilter();
  return isFinite(r) ? restrooms.filter(x=> distMi(userPos,[x.lat,x.lng]) <= r) : restrooms;
}
function timeAgo(ts){
  const m=Math.floor((Date.now()-ts)/60000);
  if(m<1) return 'just now'; if(m<60) return m+'m ago';
  const h=Math.floor(m/60); if(h<24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}
function lastRatedTs(r){ return r.last_rated_at ? Date.parse(r.last_rated_at) : 0; }
function freshnessLabel(r){
  const ts=lastRatedTs(r); if(!ts) return 'never rated';
  const days=(Date.now()-ts)/86400000;
  return (days>=1 ? 'last rated ' : 'rated ')+timeAgo(ts);
}
function needsFreshCheck(r){
  const ts=lastRatedTs(r);
  return !ts || (Date.now()-ts) > FRESH_LIMIT_DAYS*86400000;
}

/* ================= Data (Supabase) ================= */
async function loadRestrooms(){
  if(!supabase){ restrooms=[]; renderAll(); return; }
  const { data, error } = await supabase.from('restrooms_with_stats').select('*');
  if(error){ console.error(error); toast('Could not load restrooms — check your connection'); return; }
  restrooms = data;
  renderAll();
}
async function insertRestroom(row){
  const { data, error } = await supabase.from('restrooms').insert(row).select().single();
  if(error) throw error;
  return data;
}
async function insertReview(restroomId, stars, note){
  const { error } = await supabase.from('reviews').insert({ restroom_id: restroomId, stars, note });
  if(error) throw error;
}
async function fetchReviews(restroomId){
  const { data, error } = await supabase.from('reviews').select('stars,note,created_at')
    .eq('restroom_id', restroomId).order('created_at', { ascending:false }).limit(30);
  if(error) throw error;
  return data;
}
function requireBackend(){
  if(supabase) return true;
  toast('Supabase isn’t configured yet — see SETUP.md');
  return false;
}

/* ================= Map ================= */
function initMap(){
  map = L.map('map', {zoomControl:false}).setView(DEFAULT_CENTER, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  map.on('click', e=>{
    if(!dropMode) return;
    dropMode = false;
    $('dropBanner').classList.remove('show');
    startPinAdjust(e.latlng, '');
  });
}
function pinIcon(a, verified){
  const bg = !verified ? '#8AA0A3' : a>=4 ? '#2E9E5B' : a>=2.5 ? '#FFC531' : a>0 ? '#C94F3D' : '#8AA0A3';
  const fg = (verified && a>=2.5 && a<4) ? '#1C2B2D' : '#fff';
  return L.divIcon({
    className:'',
    html:`<div style="width:36px;height:36px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);
      background:${bg};border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.3);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);font-size:12px;font-weight:800;color:${fg};font-family:sans-serif;">
      ${a?a.toFixed(1):'?'}</span></div>`,
    iconSize:[36,36], iconAnchor:[18,34]
  });
}
function renderMarkers(){
  Object.values(markers).forEach(m=>map.removeLayer(m));
  markers = {};
  filteredRestrooms().forEach(r=>{
    const m = L.marker([r.lat,r.lng], {icon: pinIcon(r.avg_stars, r.verified)}).addTo(map);
    m.on('click', ()=>openDetail(r.id));
    markers[r.id] = m;
  });
}

/* ================= List ================= */
function renderList(){
  const list = $('list');
  if(!restrooms.length){
    list.innerHTML = supabase
      ? `<div class="empty">No restrooms posted yet in this community.<br><b>Tap ＋ to add the first one!</b></div>`
      : `<div class="empty">Connect Supabase to load the shared map.<br><b>See SETUP.md for the walkthrough.</b></div>`;
    return;
  }
  const visible = filteredRestrooms();
  const sorted = [...visible].sort((a,b)=>{
    if(userPos) return distMi(userPos,[a.lat,a.lng]) - distMi(userPos,[b.lat,b.lng]);
    return b.avg_stars - a.avg_stars;
  });
  $('listTitle').textContent = userPos ? 'Nearby restrooms' : 'All restrooms';
  if(userPos && !sorted.length){
    const radiusText = $('radiusSelect').selectedOptions[0].textContent.toLowerCase();
    list.innerHTML = `<div class="empty">No restrooms ${radiusText}.<br>
      <button class="btn ghost" id="expandRadiusBtn" style="margin-top:10px;width:auto;padding:9px 18px">Show all restrooms</button></div>`;
    $('expandRadiusBtn').onclick=()=>{ $('radiusSelect').value='Infinity'; renderAll(); };
    return;
  }
  list.innerHTML = sorted.map(r=>{
    const a = r.avg_stars;
    const extraTags =
      (!r.verified?'<span class="tag unverified">Unverified</span>':'') +
      (needsFreshCheck(r)&&r.rating_count?'<span class="tag warn">Needs a fresh check</span>':'');
    return `<div class="card" data-id="${r.id}">
      <div class="card-top"><h3>${esc(r.name)}</h3><span class="dist">${distLabel(r)}</span></div>
      <div class="score-row">
        <span class="sparkle-badge" style="background:${r.verified?scoreColor(a):'var(--muted)'};color:${r.verified?scoreTextColor(a):'#fff'}">✦ ${a?a.toFixed(1):'—'}</span>
        <span class="score-label">${r.verified?scoreWord(a):'Unverified'} · ${r.rating_count} rating${r.rating_count===1?'':'s'} · ${freshnessLabel(r)}</span>
      </div>
      ${(r.tags.length||extraTags)?`<div class="tags">${extraTags}${r.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`:''}
    </div>`;
  }).join('');
  [...list.querySelectorAll('.card')].forEach(c=>c.onclick=()=>openDetail(c.dataset.id));
}
function renderAll(){ renderMarkers(); renderList(); }

/* ================= Geolocation (PRD §4.1, always user-initiated — never on load) ================= */
function youAreHereIcon(){
  // Deliberately distinct from the teardrop restroom pins: a plain dot with a soft halo.
  return L.divIcon({
    className:'',
    html:`<div style="width:20px;height:20px;border-radius:50%;background:var(--deep-aqua);
      border:3px solid #fff;box-shadow:0 0 0 5px rgba(14,110,115,.28),0 2px 6px rgba(0,0,0,.3);"></div>`,
    iconSize:[20,20], iconAnchor:[10,10]
  });
}
function updateLocationUI(){
  const has = !!userPos;
  $('locatePrompt').style.display = has ? 'none' : 'flex';
  $('radiusSelect').style.display = has ? 'inline-block' : 'none';
  $('listTitle').textContent = has ? 'Nearby restrooms' : 'All restrooms';
}
function locateUser(){
  if(!navigator.geolocation){ toast('Location not available on this device'); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    userPos = [pos.coords.latitude, pos.coords.longitude];
    if(userMarker) map.removeLayer(userMarker);
    userMarker = L.marker(userPos, {icon: youAreHereIcon(), zIndexOffset: 1000, keyboard:false})
      .bindTooltip('You are here', {direction:'top', offset:[0,-8]})
      .addTo(map);
    map.setView(userPos, 15);
    updateLocationUI();
    renderAll();
  }, err=>{
    // Graceful fallback: stay on the Hollywood default view, just tell the user why.
    const denied = err.code === err.PERMISSION_DENIED;
    toast(denied ? 'Location permission denied' : 'Could not get your location — check permissions');
    updateLocationUI();
  }, {enableHighAccuracy:true, timeout:8000});
}

/* ================= Add flow (PRD §4.3) ================= */
function buildStarRow(container, onSet){
  container.innerHTML='';
  for(let i=1;i<=5;i++){
    const s=document.createElement('span');
    s.className='star'; s.textContent='★'; s.setAttribute('role','radio'); s.tabIndex=0;
    s.setAttribute('aria-label', i+' star'+(i>1?'s':''));
    const set=()=>{ onSet(i); [...container.children].forEach((c,j)=>c.classList.toggle('on', j<i)); };
    s.onclick=set;
    s.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();set();} };
    container.appendChild(s);
  }
}
function openAddModal(){
  addStarsVal=0;
  $('rName').value=pendingName; $('rNote').value='';
  buildStarRow($('addStars'), v=>addStarsVal=v);
  $('addChips').innerHTML = FEATURES.map(f=>`<span class="chip" data-f="${f}">${f}</span>`).join('');
  [...$('addChips').children].forEach(c=>c.onclick=()=>c.classList.toggle('on'));
  $('addOverlay').classList.add('open');
  setTimeout(()=>$('rName').focus(),100);
}

/* ---- Locate step: geocode search (OSM Nominatim) or manual pin ---- */
/* Nominatim usage policy notes: browsers forbid scripts from setting the
   User-Agent header, so the app is identified by the Referer the browser
   sends automatically; requests are debounced AND throttled to stay under
   the 1 request/second limit. */
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
let searchTimer = null, searchAbort = null, lastSearchAt = 0;

function openLocateModal(){
  pendingName='';
  $('searchInput').value='';
  $('searchStatus').textContent='';
  $('searchResults').innerHTML='';
  $('locateOverlay').classList.add('open');
  setTimeout(()=>$('searchInput').focus(),100);
}
function scheduleSearch(){
  clearTimeout(searchTimer);
  const q=$('searchInput').value.trim();
  if(q.length<3){ $('searchResults').innerHTML=''; $('searchStatus').textContent=''; return; }
  // debounce typing, then respect the 1 req/s policy
  const wait = Math.max(600, 1100 - (Date.now() - lastSearchAt));
  searchTimer=setTimeout(()=>runSearch(q), wait);
}
async function runSearch(q){
  if(searchAbort) searchAbort.abort();
  searchAbort = new AbortController();
  lastSearchAt = Date.now();
  $('searchStatus').textContent='Searching…';
  try{
    // viewbox biases results toward the current map view (Hollywood by default)
    const bb = map.getBounds().toBBoxString();
    const url = `${NOMINATIM}?format=jsonv2&limit=5&q=${encodeURIComponent(q)}&viewbox=${bb}&bounded=0`;
    const resp = await fetch(url, { signal: searchAbort.signal, headers: { 'Accept': 'application/json' } });
    if(!resp.ok) throw new Error('Nominatim '+resp.status);
    const data = await resp.json();
    renderSearchResults(data);
  }catch(e){
    if(e.name==='AbortError') return;
    console.error(e);
    $('searchStatus').textContent='Search failed — check your connection, or drop a pin manually.';
  }
}
function renderSearchResults(data){
  const box=$('searchResults');
  if(!data.length){
    $('searchStatus').textContent='No matches. Try a different spelling — or drop a pin manually below.';
    box.innerHTML='';
    return;
  }
  $('searchStatus').textContent='Pick the right one:';
  box.innerHTML = data.map((d,i)=>{
    const name = d.name || String(d.display_name).split(',')[0];
    return `<div class="review search-result" data-i="${i}">
      <div class="r-name">${esc(name)}</div>
      <div class="r-addr">${esc(d.display_name)}</div>
    </div>`;
  }).join('');
  [...box.children].forEach(el=>el.onclick=()=>{
    const d = data[+el.dataset.i];
    $('locateOverlay').classList.remove('open');
    startPinAdjust({lat:+d.lat, lng:+d.lon}, d.name || String(d.display_name).split(',')[0]);
  });
}

/* Both paths (search pick + manual map tap) converge here: a draggable
   pin the user can nudge to the actual entrance before confirming. */
function startPinAdjust(latlng, name){
  pendingName = (name||'').slice(0,60);
  if(adjustMarker) map.removeLayer(adjustMarker);
  adjustMarker = L.marker(latlng, {draggable:true, autoPan:true}).addTo(map);
  map.setView(latlng, Math.max(map.getZoom(), 17));
  $('nudgeBanner').classList.add('show');
}
function endPinAdjust(){
  if(adjustMarker){ map.removeLayer(adjustMarker); adjustMarker=null; }
  $('nudgeBanner').classList.remove('show');
}
$('confirmPin').onclick=()=>{
  if(!adjustMarker) return;
  pendingLatLng = adjustMarker.getLatLng();
  endPinAdjust();
  openAddModal();
};
$('cancelPin').onclick=()=>{ endPinAdjust(); pendingName=''; };

$('searchInput').addEventListener('input', scheduleSearch);
$('searchInput').addEventListener('keydown', e=>{
  if(e.key==='Enter'){ e.preventDefault(); clearTimeout(searchTimer); runSearch($('searchInput').value.trim()); }
});
$('manualDrop').onclick=()=>{
  $('locateOverlay').classList.remove('open');
  dropMode=true;
  $('dropBanner').classList.add('show');
};
$('closeLocate').onclick=()=>$('locateOverlay').classList.remove('open');

$('addBtn').onclick=()=>{
  if(!requireBackend()) return;
  openLocateModal();
};
$('cancelDrop').onclick=()=>{ dropMode=false; $('dropBanner').classList.remove('show'); };
$('closeAdd').onclick=()=>$('addOverlay').classList.remove('open');
$('saveRestroom').onclick=async ()=>{
  const name=$('rName').value.trim();
  if(!name){ toast('Give it a name so people can find it'); return; }
  if(!addStarsVal){ toast('Tap the stars to rate cleanliness'); return; }
  if(!pendingLatLng){ toast('No location set — tap ＋ then tap the map'); return; }
  const tags=[...$('addChips').querySelectorAll('.chip.on')].map(c=>c.dataset.f);
  const note=$('rNote').value.trim();
  $('saveRestroom').disabled=true;
  try{
    const row = await insertRestroom({
      name, lat:pendingLatLng.lat, lng:pendingLatLng.lng, tags,
      verified:true, source:'user'
    });
    await insertReview(row.id, addStarsVal, note);
    pendingLatLng=null;
    $('addOverlay').classList.remove('open');
    await loadRestrooms();
    toast('Posted — thanks for helping the community! ✦');
  }catch(e){
    console.error(e);
    toast('Could not save — check your connection');
  }finally{
    $('saveRestroom').disabled=false;
  }
};

/* ================= Detail + rating (PRD §4.2) ================= */
async function openDetail(id){
  const r=restrooms.find(x=>x.id===id); if(!r) return;
  const a=r.avg_stars;
  let reviewRows=[];
  try{ reviewRows = await fetchReviews(id); }
  catch(e){ console.error(e); }
  const reviews=reviewRows.map(v=>`
    <div class="review">
      <div class="r-top"><span class="stars-inline">${starsStr(v.stars)}</span><span>${timeAgo(Date.parse(v.created_at))}</span></div>
      ${v.note?`<p>${esc(v.note)}</p>`:''}
    </div>`).join('');
  const subBits=[
    r.verified?scoreWord(a):'Unverified',
    `${r.rating_count} rating${r.rating_count===1?'':'s'}`,
    freshnessLabel(r),
    distLabel(r)?distLabel(r)+' away':''
  ].filter(Boolean).join(' · ');
  const extraTags =
    (!r.verified?'<span class="tag unverified">Be the first to confirm ✔</span>':'') +
    (needsFreshCheck(r)&&r.rating_count?'<span class="tag warn">Needs a fresh check</span>':'');
  $('detailModal').innerHTML=`
    <div class="detail-head">
      <div>
        <h2>${esc(r.name)}</h2>
        <p class="sub">${subBits}</p>
        ${(r.tags.length||extraTags)?`<div class="tags">${extraTags}${r.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`:''}
      </div>
      <div class="big-score" style="background:${r.verified?scoreColor(a):'var(--muted)'};color:${r.verified?scoreTextColor(a):'#fff'}">
        <span class="n">✦ ${a?a.toFixed(1):'—'}</span><span class="s">/ 5.0</span>
      </div>
    </div>
    <button class="btn nav" id="navBtn">🧭 Navigate there</button>
    <label>Rate the condition now${r.verified?'':' — your rating verifies this listing'}</label>
    <div class="star-row" id="detailStars"></div>
    <textarea id="detailNote" placeholder="How is it right now? (optional)" maxlength="200" style="margin-top:8px"></textarea>
    <button class="btn primary" id="submitRating">Submit rating</button>
    <label style="margin-top:16px">Recent reports</label>
    <div class="reviews">${reviews || '<p class="sub">No reports yet.</p>'}</div>
    <button class="btn ghost" id="reportBtn">⚑ Report listing</button>
    <div class="chip-row" id="reportReasons" style="display:none;margin-top:10px"></div>
    ${isAdmin?`<button class="btn ghost" id="adminRename" style="color:var(--deep-aqua)">✎ Edit name (admin)</button>
    <button class="btn ghost" id="adminDelete" style="color:var(--danger);border-color:var(--danger)">🗑 Delete listing (admin)</button>`:''}
    <button class="btn ghost" id="closeDetailBtn">Close</button>`;
  $('navBtn').onclick=()=>navigateTo(r.lat,r.lng);
  $('closeDetailBtn').onclick=closeDetail;
  detailStars=0;
  buildStarRow($('detailStars'), v=>detailStars=v);
  $('submitRating').onclick=async ()=>{
    if(!requireBackend()) return;
    if(!detailStars){ toast('Tap the stars first'); return; }
    $('submitRating').disabled=true;
    try{
      await insertReview(id, detailStars, $('detailNote').value.trim());
      const flipped = !r.verified;
      await loadRestrooms();
      openDetail(id);
      toast(flipped ? 'Rating posted — listing verified ✔' : 'Rating posted ✦');
    }catch(e){
      console.error(e);
      toast('Could not save — check your connection');
      $('submitRating').disabled=false;
    }
  };
  $('reportBtn').onclick=()=>{
    if(!requireBackend()) return;
    const row=$('reportReasons');
    if(row.style.display!=='none'){ row.style.display='none'; return; }
    row.innerHTML=REPORT_REASONS.map((x,i)=>`<span class="chip" data-i="${i}">${x}</span>`).join('');
    [...row.children].forEach(c=>c.onclick=async ()=>{
      try{
        const { error } = await supabase.from('reports').insert({ restroom_id:id, reason:REPORT_REASONS[+c.dataset.i] });
        if(error) throw error;
        row.style.display='none';
        toast('Reported — thanks, we’ll take a look');
      }catch(e){ console.error(e); toast('Could not send report'); }
    });
    row.style.display='flex';
  };
  if(isAdmin){
    $('adminRename').onclick=async ()=>{
      const name=prompt('New name:', r.name);
      if(!name || !name.trim()) return;
      const { error } = await supabase.from('restrooms').update({name:name.trim().slice(0,60)}).eq('id',id);
      if(error){ toast('Rename failed'); return; }
      await loadRestrooms(); openDetail(id);
    };
    $('adminDelete').onclick=async ()=>{
      if(!confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
      const { error } = await supabase.from('restrooms').delete().eq('id',id);
      if(error){ toast('Delete failed'); return; }
      await loadRestrooms(); closeDetail(); toast('Listing deleted');
    };
  }
  $('detailOverlay').classList.add('open');
}
function closeDetail(){ $('detailOverlay').classList.remove('open'); }

/* ================= Navigation deep link ================= */
function navigateTo(lat,lng){
  const isApple=/iPhone|iPad|Macintosh/i.test(navigator.userAgent);
  const url = isApple
    ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
  window.open(url,'_blank');
}

/* ================= Admin (PRD §4.7) ================= */
async function refreshAdminState(){
  if(!supabase) return;
  const { data:{ session:s } } = await supabase.auth.getSession();
  session = s;
  isAdmin = false;
  if(session){
    const { data } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    isAdmin = !!data;
  }
}
async function openAdmin(){
  if(!requireBackend()) return;
  await refreshAdminState();
  const modal=$('adminModal');
  if(!session){
    modal.innerHTML=`
      <h2>Admin sign-in</h2>
      <p class="sub">Enter the owner email. We’ll send a one-time sign-in link — no password needed.</p>
      <label for="adminEmail">Email</label>
      <input type="email" id="adminEmail" placeholder="you@example.com" autocomplete="email">
      <button class="btn primary" id="sendLink">Send sign-in link</button>
      <button class="btn ghost" id="closeAdminA">Close</button>`;
    $('sendLink').onclick=async ()=>{
      const email=$('adminEmail').value.trim();
      if(!email){ toast('Enter your email'); return; }
      $('sendLink').disabled=true;
      const { error } = await supabase.auth.signInWithOtp({ email,
        options:{ emailRedirectTo: location.origin + location.pathname + '?admin=1' } });
      if(error){ console.error(error); toast('Could not send link — try again'); $('sendLink').disabled=false; return; }
      modal.querySelector('.sub').textContent='Link sent! Open the email on this device and tap the link to finish signing in.';
      toast('Check your inbox 📬');
    };
    $('closeAdminA').onclick=()=>$('adminOverlay').classList.remove('open');
  }else if(!isAdmin){
    modal.innerHTML=`
      <h2>Almost there</h2>
      <p class="sub">You’re signed in as <b>${esc(session.user.email)}</b>, but this account isn’t on the admin list yet.
      Run the SQL in SETUP.md step 6 to grant it admin access, then reopen this panel.</p>
      <button class="btn ghost" id="signOut">Sign out</button>
      <button class="btn ghost" id="closeAdminB">Close</button>`;
    $('signOut').onclick=async ()=>{ await supabase.auth.signOut(); openAdmin(); };
    $('closeAdminB').onclick=()=>$('adminOverlay').classList.remove('open');
  }else{
    let reports=[];
    const { data, error } = await supabase.from('reports')
      .select('id,reason,created_at,restroom_id,restrooms(name)')
      .eq('resolved', false).order('created_at');
    if(error) console.error(error); else reports=data;
    const byRestroom={};
    reports.forEach(x=>{ (byRestroom[x.restroom_id]??={name:x.restrooms?.name||'(deleted)',items:[]}).items.push(x); });
    const groups=Object.entries(byRestroom);
    modal.innerHTML=`
      <h2>Reported listings</h2>
      <p class="sub">Signed in as ${esc(session.user.email)} ·
        ${groups.length?groups.length+' listing'+(groups.length===1?'':'s')+' with open reports.':'No open reports. 🎉'}</p>
      <div class="reviews">${groups.map(([rid,g])=>`
        <div class="review">
          <div class="r-top"><span><b>${esc(g.name)}</b></span><span>${g.items.length} report${g.items.length===1?'':'s'}</span></div>
          <p>${g.items.map(x=>esc(x.reason)+' · '+timeAgo(Date.parse(x.created_at))).join('<br>')}</p>
          <div class="chip-row" style="margin-top:8px">
            <span class="chip" data-act="resolve" data-rid="${rid}">✔ Resolve reports</span>
            <span class="chip danger" data-act="delete" data-rid="${rid}" data-name="${esc(g.name)}">🗑 Delete listing</span>
          </div>
        </div>`).join('')}
      </div>
      <button class="btn primary" id="seedBtn">⬇ Import Hollywood seed data (Refuge Restrooms)</button>
      <button class="btn ghost" id="signOut">Sign out</button>
      <button class="btn ghost" id="closeAdminC">Close</button>`;
    [...modal.querySelectorAll('.chip[data-act]')].forEach(c=>c.onclick=async ()=>{
      if(c.dataset.act==='resolve'){
        const { error } = await supabase.from('reports').update({resolved:true}).eq('restroom_id', c.dataset.rid);
        if(error){ toast('Failed'); return; }
      }else{
        if(!confirm(`Delete "${c.dataset.name}"? This cannot be undone.`)) return;
        const { error } = await supabase.from('restrooms').delete().eq('id', c.dataset.rid);
        if(error){ toast('Failed'); return; }
      }
      await loadRestrooms(); openAdmin();
    });
    $('seedBtn').onclick=seedFromRefuge;
    $('signOut').onclick=async ()=>{ await supabase.auth.signOut(); openAdmin(); };
    $('closeAdminC').onclick=()=>$('adminOverlay').classList.remove('open');
  }
  $('adminOverlay').classList.add('open');
}

/* Seed unverified listings near Hollywood from Refuge Restrooms (PRD §4.5).
   Admin-only: the RLS insert policy rejects source='refuge' from anon users. */
async function seedFromRefuge(){
  $('seedBtn').disabled=true;
  try{
    const url = `https://www.refugerestrooms.org/api/v1/restrooms/by_location?per_page=50&lat=${DEFAULT_CENTER[0]}&lng=${DEFAULT_CENTER[1]}`;
    const resp = await fetch(url);
    if(!resp.ok) throw new Error('Refuge API '+resp.status);
    const data = await resp.json();
    const existing = new Set(restrooms.map(r=>r.name.toLowerCase()));
    const rows = data
      .filter(d=>d.latitude && d.longitude && d.name && !existing.has(String(d.name).slice(0,60).toLowerCase()))
      .map(d=>({
        name:String(d.name).slice(0,60),
        lat:+d.latitude, lng:+d.longitude,
        tags:[d.accessible&&'Accessible ♿', d.unisex&&'Gender neutral', d.changing_table&&'Changing table'].filter(Boolean),
        verified:false, source:'refuge'
      }));
    if(!rows.length){ toast('Nothing new to import'); return; }
    const { error } = await supabase.from('restrooms').insert(rows);
    if(error) throw error;
    await loadRestrooms();
    toast(`Imported ${rows.length} unverified listings ✔`);
  }catch(e){
    console.error(e);
    toast('Import failed — see console');
  }finally{
    const b=$('seedBtn'); if(b) b.disabled=false;
  }
}

/* ================= Misc wiring ================= */
$('locateBtn').onclick=()=>locateUser();
$('useLocationBtn').onclick=()=>locateUser();
$('radiusSelect').onchange=renderAll;
$('refreshBtn').onclick=async ()=>{ await loadRestrooms(); toast('Refreshed'); };
[$('addOverlay'),$('detailOverlay'),$('adminOverlay'),$('locateOverlay')].forEach(o=>o.addEventListener('click',e=>{ if(e.target===o) o.classList.remove('open'); }));

/* ================= Boot ================= */
initMap();
updateLocationUI(); // shows the "enable location" prompt by default — no silent auto-request
if(!CONFIGURED) $('setupBanner').classList.add('show');
if(ADMIN_MODE){
  $('adminBtn').style.display='block';
  $('adminBtn').onclick=openAdmin;
  // Returning from a magic link: pick up the session and refresh admin state.
  if(supabase) supabase.auth.onAuthStateChange(()=>refreshAdminState());
  refreshAdminState();
}
loadRestrooms();

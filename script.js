// ============================================================
// LAZI AKADEMIE — LANDING PAGE
// Shared behavior: Infotag-Auto-Rollover, Countdown, Mobile Sticky,
// Video embed, Form prefill (Fachbereich + Termin)
// ============================================================

// -----------------------------------------------------------
// INFOTAG-TERMINE
// Geladen aus Sanity via /api/infotag-termine — bearbeitbar im Studio
// als "Veranstaltung" mit Kategorie "Infotag".
// CRM-locked: valueString muss exakt mit Zoho-Form-Option übereinstimmen.
// -----------------------------------------------------------
let TERMINE = [];

async function loadTermine(){
  try {
    // Trailing-Slash, weil next.config.ts trailingSlash:true setzt — sonst
    // antwortet die Route mit 308-Redirect auf /api/infotag-termine/. Direkt
    // die kanonische URL anfragen vermeidet den Redirect-Roundtrip.
    const r = await fetch('/api/infotag-termine/');
    if (!r.ok) return [];
    const data = await r.json();
    TERMINE = Array.isArray(data) ? data : [];
    return TERMINE;
  } catch {
    return [];
  }
}

function getNextInfotag(){
  if (!TERMINE.length) return null;
  const now = Date.now();
  // NUR den nächsten kommenden Termin — KEIN Vergangenheits-Fallback.
  // Liegt kein zukünftiger Termin (mehr) vor, gibt es bewusst KEINEN Treffer
  // (null), damit der Countdown nicht auf einen toten Vergangenheits-Termin
  // zurückfällt ("13. Mai" + "-- Tage"). Der saubere Leerzustand übernimmt dann.
  return TERMINE.find(t => new Date(t.iso).getTime() > now) || null;
}

// Sauberer Leerzustand für die Infotag-Countdown-Karte(n), wenn KEIN
// zukünftiger Termin vorliegt (oder die Daten nicht geladen werden konnten).
// Statt eines toten Countdowns ("-- Tage") + Vergangenheits-Datum ("13. Mai")
// zeigen wir einen klaren CTA "Infotag-Termine anfragen".
function applyNoInfotag(){
  // Countdown-Karten als "kein Termin" markieren → CSS blendet Grid/Countdown
  // aus und zeigt den Anfrage-Hinweis (siehe globals.css .countdown-card.is-empty).
  document.querySelectorAll('.countdown-card').forEach(card => {
    // Nur Infotag-Karten betreffen (Werkschau/Semester haben eigene, immer
    // gültige Zieldaten und sollen NICHT umgeschaltet werden).
    if (!card.querySelector('[data-next="headline"]')) return;
    card.classList.add('is-empty');
  });
  // Datumszeile auf neutralen Hinweis setzen (kein Vergangenheits-Datum stehen lassen).
  document.querySelectorAll('[data-next="headline"]').forEach(el => {
    el.textContent = 'Nächster Termin in Planung';
  });
  // CTA-Label/Link der Infotag-Karte auf "Termine anfragen" umstellen.
  document.querySelectorAll('.countdown-card.is-empty a.cta-small').forEach(a => {
    a.textContent = 'Infotag-Termine anfragen ';
    const arrow = document.createElement('span');
    arrow.className = 'btn-arrow';
    arrow.textContent = '›';
    a.appendChild(arrow);
  });
}

// Update all elements with data-next="<key>" to the value of that key in the next Termin
function applyNextInfotag(){
  const next = getNextInfotag();
  if (!next) { applyNoInfotag(); return null; }
  document.querySelectorAll('[data-next]').forEach(el => {
    const key = el.getAttribute('data-next');
    if (next[key] !== undefined) el.textContent = next[key];
  });
  // Pre-select the matching Termin in den Dropdowns (LP-Form: if-termin, Global-Form: gif-termin)
  for (const selId of ['if-termin', 'gif-termin']) {
    const select = document.getElementById(selId);
    if (select && next.valueString){
      const opt = Array.from(select.options).find(o => o.value === next.valueString);
      if (opt) opt.selected = true;
    }
  }
  return next;
}

// -----------------------------------------------------------
// COUNTDOWN
// -----------------------------------------------------------
let countdownInterval = null;
function startCountdown(targetIso){
  const target = new Date(targetIso).getTime();
  const els    = ['cd-d','cd-h','cd-m','cd-s'].map(i => document.getElementById(i));
  const hels   = ['hcd-d','hcd-h','hcd-m','hcd-s'].map(i => document.getElementById(i));
  const iels   = ['it-d','it-h','it-m','it-s'].map(i => document.getElementById(i));
  const home   = ['home-cd-d','home-cd-h','home-cd-m','home-cd-s'].map(i => document.getElementById(i));
  const sticky = ['ibcd-d','ibcd-h','ibcd-m','ibcd-s'].map(i => document.getElementById(i));
  if (!els[0] && !hels[0] && !iels[0] && !home[0] && !sticky[0]) return;
  function tick(){
    const diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff / 3600000) % 24);
    const m = Math.floor((diff / 60000) % 60);
    const s = Math.floor((diff / 1000) % 60);
    const pad = n => String(n).padStart(2,'0');
    const vals = [pad(d), pad(h), pad(m), pad(s)];
    els.forEach((el, i)    => { if (el) el.textContent = vals[i]; });
    hels.forEach((el, i)   => { if (el) el.textContent = vals[i]; });
    iels.forEach((el, i)   => { if (el) el.textContent = vals[i]; });
    home.forEach((el, i)   => { if (el) el.textContent = vals[i]; });
    sticky.forEach((el, i) => { if (el) el.textContent = vals[i]; });
  }
  tick();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(tick, 1000);
}

let semesterInterval = null;
function initSemesterCountdown(){
  const el = document.getElementById('bcd-d');
  if (!el) return;
  // Termine kommen aus Sanity (Globale Einstellungen -> Semesterstarts), vom
  // Server als data-starts="2027-03-01,2027-09-07,..." mitgegeben, Logik in
  // lib/semester.ts. Fehlt das Attribut (alte Seite im Cache), gilt die alte
  // Regel 1. Maerz / 7. September. Am Starttag springt der Countdown von
  // selbst auf den naechsten Termin, samt Beschriftung.
  const MONATE = ['Januar','Februar','März','April','Mai','Juni',
                  'Juli','August','September','Oktober','November','Dezember'];
  function nachRegel(){
    const j = new Date().getFullYear();
    return [new Date(j,2,1), new Date(j,8,7), new Date(j+1,2,1), new Date(j+1,8,7)];
  }
  const eingetragen = (el.dataset.starts || '').split(',').map(function(s){
    const t = s.split('-').map(Number);
    return t.length === 3 ? new Date(t[0], t[1] - 1, t[2]) : null;
  }).filter(function(d){ return d && !isNaN(d.getTime()); });
  const starts = (eingetragen.length ? eingetragen : nachRegel()).sort(function(a,b){ return a - b; });
  const labelEl = document.getElementById('bcd-label');
  let target = null;
  function waehlen(){
    const jetzt = Date.now();
    target = starts.find(function(d){ return d.getTime() > jetzt; })
          || nachRegel().find(function(d){ return d.getTime() > jetzt; });
    // Steht in Sanity ein eigener Text (semesterCountdownDate), hat das
    // Element keine id und bleibt unangetastet.
    if (labelEl) {
      const m = target.getMonth();
      const art = (m >= 1 && m <= 6) ? 'Sommer-Semester' : 'Winter-Semester';
      labelEl.textContent = art + ' · ' + MONATE[m] + ' ' + target.getFullYear();
    }
  }
  waehlen();
  const ids = ['bcd-d','bcd-h','bcd-m','bcd-s'];
  function tick(){
    if (target.getTime() <= Date.now()) waehlen();
    const diff = Math.max(0, target.getTime() - Date.now());
    const vals = [
      Math.floor(diff / 86400000),
      Math.floor((diff / 3600000) % 24),
      Math.floor((diff / 60000) % 60),
      Math.floor((diff / 1000) % 60),
    ].map(n => String(n).padStart(2,'0'));
    ids.forEach((id, i) => { const e = document.getElementById(id); if (e) e.textContent = vals[i]; });
  }
  tick();
  if (semesterInterval) clearInterval(semesterInterval);
  semesterInterval = setInterval(tick, 1000);
}

let werkschauInterval = null;
function initWerkschauCountdown(){
  const wsEl = document.getElementById('ws-d');
  if (!wsEl) return;
  const rawDate = wsEl.dataset.target || '2027-01-30T17:00:00';
  const target = new Date(rawDate).getTime();
  const ids = ['ws-d','ws-h','ws-m','ws-s'];
  function tick(){
    const diff = Math.max(0, target - Date.now());
    const vals = [
      Math.floor(diff / 86400000),
      Math.floor((diff / 3600000) % 24),
      Math.floor((diff / 60000) % 60),
      Math.floor((diff / 1000) % 60),
    ].map(n => String(n).padStart(2,'0'));
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.textContent = vals[i];
    });
  }
  tick();
  if (werkschauInterval) clearInterval(werkschauInterval);
  werkschauInterval = setInterval(tick, 1000);
}

// -----------------------------------------------------------
// MOBILE STICKY
// -----------------------------------------------------------
function initMobileSticky(){
  const sticky = document.getElementById('mobileSticky');
  const banner = document.querySelector('.banner');
  if (!sticky || !banner) return;
  function onScroll(){
    const bottom = banner.getBoundingClientRect().bottom;
    if (bottom < 0) sticky.classList.add('visible');
    else sticky.classList.remove('visible');
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
}

// -----------------------------------------------------------
// VIDEO EMBED — click-to-play YouTube
// -----------------------------------------------------------
function initVideoPlaceholders(){
  document.querySelectorAll('[data-youtube-id]').forEach(wrap => {
    const id = wrap.getAttribute('data-youtube-id');
    if (!id || id === 'REPLACE_ME') return;
    const placeholder = wrap.querySelector('.video-placeholder, .play');
    if (placeholder) placeholder.addEventListener('click', (e) => {
      e.preventDefault();
      loadVideo(wrap, id);
    });
  });
}
function loadVideo(wrap, id){
  const iframe = document.createElement('iframe');
  const sep = id.includes('?') ? '&' : '?';
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}${sep}autoplay=1&rel=0`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
  wrap.innerHTML = '';
  wrap.appendChild(iframe);
  const card = wrap.closest('.film-card');
  if (card) card.classList.add('is-playing');
}

// -----------------------------------------------------------
// BTS IMAGE CYCLING — global pool, one tile per second
// Add image URLs here to grow the pool; video tiles are skipped.
// -----------------------------------------------------------
const BTS_IMAGES = [
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1h2Ja4p-kfsynlNCOlQhp2Ughvxe7uRHn.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1HPOhPTsaGIxRitaX_Md74i_Mw7GSXiP5.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/17i1SQNb4figqx5NhXf-ibv29_LvDa9nm.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1qOKLnbXbx25cyhNkosIs-aM_FWPfAW0m.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/14MN-Sy88KuA8jG_ToLZC-kQByUhAC1kE.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/18w7alO5pWZG1K9RWXlu8jB3zXoFhECuC.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1YCLzI-XDLCZjk9tEarIfd9dOQSjOx19m.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/16tQ_0SVd8i_F9ljCBenE64BPjttwYIu0.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1hvszUcE25o997Ue0hksjFem9QLJloDq1.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1Som7RXIsSfSAPVftbEYLtKjb2XphQ_Gc.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1ggrDLEM77iHzcXgLnBYU6DkqYJr1Qfao.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1rmaXY_qcjPpgBFQ2XNGau83n8FsjCuv5.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1r-z9HLYdUf8Kjr49hyRv-x7vJXeUKm3z.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1PBUfglb9FGwcD9-bihgOtj12l3DpgHlC.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1nGeLg5zhQCQsp3JTKQyYYPXGHps7mlzF.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1HD45V7kgwhWMMSDodDoOn0SAB5Hp-1qv.jpg',
  'https://res.cloudinary.com/lazi/image/upload/f_auto,q_auto,w_800,c_limit/laziwebsite/landingpages/film-mediendesign/1cf6kvzwda6h0iMlRPbreY2X1NGiOr6nE.jpg',
];

function initBtsCycling(){
  const scroller = document.querySelector('.bts-scroller');
  if (!scroller || scroller.dataset.noCycle === 'true') return;
  const set1 = document.querySelector('.bts-set:not([aria-hidden])');
  const set2 = document.querySelector('.bts-set[aria-hidden]');
  if (!set1) return;
  const tiles1 = Array.from(set1.querySelectorAll('.bts-tile img'));
  const tiles2 = set2 ? Array.from(set2.querySelectorAll('.bts-tile img')) : [];
  if (!tiles1.length || !BTS_IMAGES.length) return;
  let poolIdx = 0, tileIdx = 0;
  setInterval(function() {
    tiles1[tileIdx].src = BTS_IMAGES[poolIdx];
    if (tiles2[tileIdx]) tiles2[tileIdx].src = BTS_IMAGES[poolIdx];
    poolIdx = (poolIdx + 1) % BTS_IMAGES.length;
    tileIdx = (tileIdx + 1) % tiles1.length;
  }, 2500);
}

// -----------------------------------------------------------
// IMAGE CYCLING — data-img-cycle='["url1","url2",...]' on any container
// -----------------------------------------------------------
function initImgCycle(){
  document.querySelectorAll('[data-img-cycle]').forEach(wrap => {
    let urls;
    try { urls = JSON.parse(wrap.getAttribute('data-img-cycle')); } catch(e){ return; }
    if (!urls || urls.length < 2) return;
    const img = wrap.querySelector('img');
    if (!img) return;
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % urls.length;
      img.style.opacity = '0';
      setTimeout(() => { img.src = urls[idx]; img.style.opacity = ''; }, 400);
    }, 5000);
  });
}

// -----------------------------------------------------------
// FORM PREFILL — Fachbereich aus body data-Attribut in alle Hidden-Felder
// -----------------------------------------------------------
function prefillFachbereich(){
  const fb = document.body.dataset.fachbereich;
  if (!fb) return;
  document.querySelectorAll('[data-prefill="fachbereich"]').forEach(el => {
    el.value = fb;
  });
}

// -----------------------------------------------------------
// VIDEO CAROUSEL — flat list of all videos, dots + arrows
// -----------------------------------------------------------
function initCategorySlider() {
  var wrapper = document.getElementById('vs-wrapper');
  if (!wrapper) return;
  var videos;
  try { videos = JSON.parse(wrapper.dataset.vs || '[]'); } catch(e) { return; }
  if (!videos.length) return;

  var trackEl = document.getElementById('vs-track');
  var dotsEl  = document.getElementById('vs-dots');
  var prevBtn = document.getElementById('vs-prev');
  var nextBtn = document.getElementById('vs-next');
  var fachEl  = document.getElementById('vs-fach');
  if (!trackEl) return;

  var idx = 0;
  var scrollLock = false;
  var drag = { down: false, moved: false, startX: 0, startScroll: 0 };

  // Vorschaubilder über unsere Domain, nie direkt von Google (Recht, 17.10.2026)
  function thumbHi(yt) { return '/api/yt-thumb/' + yt + '/maxresdefault/'; }
  function thumbLo(yt) { return '/api/yt-thumb/' + yt + '/hqdefault/'; }

  // event delegation — survives innerHTML replacements on individual cards
  trackEl.addEventListener('click', function(e) {
    // War es ein Drag (Maus-Wischen)? Dann nicht abspielen.
    if (drag.moved) { drag.moved = false; return; }
    var card = e.target.closest('.vs-card');
    if (!card) return;
    var i = parseInt(card.dataset.idx || '0');
    // Ist die getippte Karte (nahezu) mittig? Dann direkt abspielen — auch wenn
    // idx nach einem Swipe noch nicht nachgezogen ist. Sonst braucht man auf
    // Mobil zwei Taps (erst zentrieren, dann abspielen).
    var center = trackEl.scrollLeft + trackEl.offsetWidth / 2;
    var cardCenter = card.offsetLeft + card.offsetWidth / 2;
    var centered = Math.abs(cardCenter - center) < card.offsetWidth * 0.5;
    if (centered || i === idx) {
      if (i !== idx) { idx = i; syncDots(); syncTabs(); syncFach(); updateArrows(); }
      // Clean & einfach: Video öffnet in einer Lightbox (natives YouTube mit
      // Pause/Vollbild + ein ✕). Im Slider liegen nur Thumbnails →
      // Swipen bleibt immer frei, keine Buttons auf den Karten.
      openVideoLightbox(videos[i].yt);
    } else {
      goTo(i);
    }
  });

  function openVideoLightbox(yt) {
    var lb = document.createElement('div');
    lb.className = 'vs-lightbox';
    lb.innerHTML =
      '<button class="vs-lightbox-close" aria-label="Video schließen">✕</button>' +
      '<div class="vs-lightbox-player"><iframe src="https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&rel=0&playsinline=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>';
    document.body.appendChild(lb);
    document.body.style.overflow = 'hidden';
    lb.addEventListener('click', function (ev) {
      // Klick auf ✕ oder den dunklen Hintergrund schließt
      if (ev.target === lb || ev.target.closest('.vs-lightbox-close')) {
        lb.remove();
        document.body.style.overflow = '';
      }
    });
  }

  function scrollToCard(i, smooth) {
    var cards = Array.from(trackEl.querySelectorAll('.vs-card'));
    if (!cards[i]) return;
    var card = cards[i];
    var target = card.offsetLeft - (trackEl.offsetWidth - card.offsetWidth) / 2;
    scrollLock = true;
    trackEl.scrollTo({ left: Math.max(0, target), behavior: smooth ? 'smooth' : 'instant' });
    setTimeout(function() { scrollLock = false; }, 600);
  }

  // tab buttons
  var tabBtns = Array.from(document.querySelectorAll('#vs-tabs [data-tab-id]'));

  function goTo(i) {
    idx = i;
    Array.from(trackEl.querySelectorAll('.vs-card')).forEach(function(c, j) {
      c.classList.toggle('active', j === i);
    });
    scrollToCard(i, true);
    syncDots();
    syncTabs();
    syncFach();
    updateArrows();
  }

  function updateArrows() {
    if (prevBtn) prevBtn.classList.toggle('hidden', idx === 0);
    if (nextBtn) nextBtn.classList.toggle('hidden', idx >= videos.length - 1);
  }

  function syncDots() {
    if (!dotsEl) return;
    Array.from(dotsEl.querySelectorAll('.slider-dot')).forEach(function(d, j) {
      d.classList.toggle('active', j === idx);
    });
  }

  function syncTabs() {
    if (!tabBtns.length) return;
    var currentTab = videos[idx] && videos[idx].tab;
    tabBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tabId === currentTab);
    });
    // Aktiven Tab im scrollbaren Streifen zentriert in Sicht bringen (scrollt
    // NUR den Tab-Container, nicht die Seite). Timer-Animation statt
    // scrollTo({behavior:'smooth'})/rAF — beides läuft in eingebetteten
    // Webviews (z.B. App-Vorschau) nicht zuverlässig, setInterval schon.
    var tabsEl = document.getElementById('vs-tabs');
    var active = tabsEl && tabsEl.querySelector('.active');
    if (active) {
      var target = Math.max(0, Math.min(
        active.offsetLeft - (tabsEl.offsetWidth - active.offsetWidth) / 2,
        tabsEl.scrollWidth - tabsEl.clientWidth
      ));
      clearInterval(tabAnim);
      var from = tabsEl.scrollLeft, i = 0, steps = 10;
      tabAnim = setInterval(function () {
        i++;
        var p = i / steps;
        tabsEl.scrollLeft = from + (target - from) * (1 - Math.pow(1 - p, 3));
        if (i >= steps) clearInterval(tabAnim);
      }, 28);
    }
  }
  var tabAnim = 0;

  function syncFach() {
    if (!fachEl) return;
    var fach = (videos[idx] && videos[idx].fach) || '';
    fachEl.textContent = fach;
    fachEl.hidden = !fach;
  }

  function renderDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    videos.forEach(function(_, i) {
      (function(i) {
        var d = document.createElement('button');
        d.className = 'slider-dot' + (i === 0 ? ' active' : '');
        d.setAttribute('aria-label', 'Video ' + (i + 1));
        d.addEventListener('click', function() { goTo(i); });
        dotsEl.appendChild(d);
      })(i);
    });
  }

  // wire tab buttons → jump to first video of that tab
  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var start = parseInt(btn.dataset.tabStart || '0');
      goTo(start);
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', function() { if (idx > 0) goTo(idx - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function() { if (idx < videos.length - 1) goTo(idx + 1); });

  // Maus-Drag zum Wischen (Touch scrollt nativ). Ohne das lässt sich das
  // Video-Karussell in der Desktop-Vorschau nicht mit der Maus ziehen —
  // analog zum Rezensions-Slider.
  var dragVel = 0, dragLastX = 0, dragRaf = 0;
  trackEl.addEventListener('mousedown', function(e) {
    // Verhindert das native Bild-/Text-Drag (Geisterbild), das sonst das
    // Wischen blockiert und "hängen" lässt.
    e.preventDefault();
    cancelAnimationFrame(dragRaf);
    drag.down = true; drag.moved = false;
    drag.startX = e.pageX; drag.startScroll = trackEl.scrollLeft;
    dragLastX = e.pageX; dragVel = 0;
    trackEl.style.scrollSnapType = 'none';
    trackEl.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', function(e) {
    if (!drag.down) return;
    var dx = e.pageX - drag.startX;
    if (Math.abs(dx) > 3) drag.moved = true;
    dragVel = dragLastX - e.pageX;
    dragLastX = e.pageX;
    trackEl.scrollLeft = drag.startScroll - dx;
  });
  window.addEventListener('mouseup', function() {
    if (!drag.down) return;
    drag.down = false;
    trackEl.style.cursor = '';
    document.body.style.userSelect = '';
    // Kurzer Nachlauf (Momentum), dann Snap wieder an → smootheres Loslassen.
    (function glide() {
      if (Math.abs(dragVel) < 0.6) { trackEl.style.scrollSnapType = ''; return; }
      trackEl.scrollLeft += dragVel;
      dragVel *= 0.92;
      dragRaf = requestAnimationFrame(glide);
    })();
  });

  // sync active card on manual swipe
  var scrollTimer;
  trackEl.addEventListener('scroll', function() {
    if (scrollLock) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      var cards = Array.from(trackEl.querySelectorAll('.vs-card'));
      var center = trackEl.scrollLeft + trackEl.offsetWidth / 2;
      var closest = 0, minDist = Infinity;
      cards.forEach(function(c, i) {
        var d = Math.abs((c.offsetLeft + c.offsetWidth / 2) - center);
        if (d < minDist) { minDist = d; closest = i; }
      });
      if (closest !== idx) {
        idx = closest;
        cards.forEach(function(c, j) {
          c.classList.toggle('active', j === closest);
        });
        syncDots();
        syncTabs();
        syncFach();
        updateArrows();
      }
    }, 80);
  }, { passive: true });

  renderDots();
  updateArrows();
  syncTabs();
  syncFach();
}

// -----------------------------------------------------------
// FILM CARD TEXT — overflow hint arrow + right scrollbar on hover
// -----------------------------------------------------------
function initFilmCardScroll() {
  document.querySelectorAll('.film-scroll-wrap').forEach(function(wrap) {
    // Wrap in outer container so hint can be positioned absolutely
    var outer = document.createElement('div');
    outer.className = 'film-scroll-outer';
    wrap.parentNode.insertBefore(outer, wrap);
    outer.appendChild(wrap);

    // Append down-arrow hint
    var hint = document.createElement('div');
    hint.className = 'film-scroll-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = '▾';
    outer.appendChild(hint);

    function updateHint() {
      var hasOverflow = wrap.scrollHeight > wrap.clientHeight + 4;
      var atBottom = wrap.scrollTop >= wrap.scrollHeight - wrap.clientHeight - 4;
      hint.classList.toggle('hidden', !hasOverflow || atBottom);
    }

    wrap.addEventListener('scroll', updateHint);
    requestAnimationFrame(updateHint);
  });
}

function initCampusSlider() {
  const mosaic = document.querySelector('.campus-mosaic');
  if (!mosaic) return;
  const tiles = Array.from(mosaic.children).filter(el => el.classList.contains('campus-tile'));
  if (tiles.length < 2) return;

  // Dots sind optional — nicht jede Seite hat #campus-dots. Der Maus-Drag
  // unten muss trotzdem greifen, deshalb hier kein früher return mehr.
  const dotsEl = document.getElementById('campus-dots');
  if (dotsEl) {
    dotsEl.innerHTML = '';
    const dots = tiles.map((tile, i) => {
      const d = document.createElement('span');
      d.className = 'slider-dot' + (i === 0 ? ' active' : '');
      d.addEventListener('click', () => {
        mosaic.scrollTo({ left: tile.offsetLeft - mosaic.offsetLeft, behavior: 'smooth' });
      });
      dotsEl.appendChild(d);
      return d;
    });
    mosaic.addEventListener('scroll', () => {
      const idx = Math.round(mosaic.scrollLeft / (tiles[0] ? tiles[0].offsetWidth + 8 : mosaic.offsetWidth));
      dots.forEach((d, i) => d.classList.toggle('active', i === Math.min(idx, dots.length - 1)));
    }, { passive: true });
  }

  // Maus-Drag zum Wischen (Touch scrollt nativ). preventDefault verhindert das
  // native Bild-Drag, das sonst das Ziehen blockiert.
  var md = { down: false, startX: 0, startScroll: 0, vel: 0, lastX: 0 };
  var campusAnim = 0;
  mosaic.addEventListener('mousedown', function (e) {
    e.preventDefault();
    clearInterval(campusAnim);
    md.down = true; md.startX = e.pageX; md.startScroll = mosaic.scrollLeft;
    md.lastX = e.pageX; md.vel = 0;
    mosaic.style.scrollSnapType = 'none';
    mosaic.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', function (e) {
    if (!md.down) return;
    md.vel = md.lastX - e.pageX; md.lastX = e.pageX;
    mosaic.scrollLeft = md.startScroll - (e.pageX - md.startX);
  });
  window.addEventListener('mouseup', function () {
    if (!md.down) return;
    md.down = false;
    mosaic.style.cursor = '';
    document.body.style.userSelect = '';
    // Weich zur nächstgelegenen Karte animieren (Schwung eingerechnet) —
    // Snap erst danach wieder aktivieren, sonst springt es hart.
    var maxScroll = mosaic.scrollWidth - mosaic.clientWidth;
    var proj = Math.max(0, Math.min(mosaic.scrollLeft + md.vel * 10, maxScroll));
    // scroll-padding-left abziehen → exakt der native Snap-Punkt,
    // sonst korrigiert der Browser am Ende mit einem Mini-Sprung.
    var snapPad = parseFloat(getComputedStyle(mosaic).scrollPaddingLeft) || 0;
    var positions = tiles.map(function (t) {
      return Math.max(0, Math.min(t.offsetLeft - mosaic.offsetLeft - snapPad, maxScroll));
    });
    var target = positions.reduce(function (best, pos) {
      return Math.abs(pos - proj) < Math.abs(best - proj) ? pos : best;
    }, positions[0]);
    var from = mosaic.scrollLeft, i = 0, steps = 16;
    clearInterval(campusAnim);
    campusAnim = setInterval(function () {
      i++;
      var p = i / steps;
      mosaic.scrollLeft = from + (target - from) * (1 - Math.pow(1 - p, 3));
      if (i >= steps) { clearInterval(campusAnim); mosaic.style.scrollSnapType = ''; }
    }, 18);
  });
}

// BTS-Mosaik mobil: kurzer Anschubser beim ersten Sichtbarwerden — zeigt,
// dass die Kacheln horizontal weiterwischbar sind (analog Trust-Leiste).
function initBtsNudge() {
  if (window.innerWidth > 699) return;
  document.querySelectorAll('.bts').forEach(function (el) {
    if (el.scrollWidth <= el.clientWidth + 10) return;
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || done) return;
        done = true;
        io.disconnect();
        setTimeout(function () {
          el.scrollTo({ left: 90, behavior: 'smooth' });
          setTimeout(function () { el.scrollTo({ left: 0, behavior: 'smooth' }); }, 650);
        }, 350);
      });
    }, { threshold: 0.4 });
    io.observe(el);
  });
}

function initTrustNudge() {
  var el = document.querySelector('.banner-trust');
  if (!el) return;
  // only nudge when content actually overflows
  if (el.scrollWidth <= el.clientWidth) return;
  setTimeout(function() {
    el.scrollTo({ left: 80, behavior: 'smooth' });
    setTimeout(function() {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    }, 600);
  }, 1200);
}

async function laziInit() {
  await loadTermine();
  const next = applyNextInfotag();
  if (next) startCountdown(next.iso);
  initSemesterCountdown();
  initWerkschauCountdown();
  initMobileSticky();
  initVideoPlaceholders();
  prefillFachbereich();
  initBtsCycling();
  initImgCycle();
  initCategorySlider();
  initCampusSlider();
  initTrustNudge();
  initBtsNudge();
  initFilmCardScroll();
}

// Bei Client-seitiger Navigation (Next.js Router) läuft laziInit NICHT erneut.
// Countdowns müssen aber auf jeder neuen Seite neu verkabelt werden, sonst
// bleiben die Ziffern auf "--" stehen. Diese Funktion re-initialisiert nur die
// idempotenten Countdown-Teile (jede cleart ihr eigenes Interval).
async function laziReinit() {
  if (!TERMINE.length) { await loadTermine(); }
  const next = applyNextInfotag();
  if (next) startCountdown(next.iso);
  initSemesterCountdown();
  initWerkschauCountdown();
}
window.laziReinit = laziReinit;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', laziInit);
} else {
  laziInit();
}

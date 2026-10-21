(function () {
  if (window.__laziPartyInit) return;
  window.__laziPartyInit = true;

  // Photosensitive: prefers-reduced-motion → Party-Mode überspringen
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  /* ── Trigger: tippe "berghain" irgendwo auf der Seite ──────────────────── */
  var TRIGGER = 'berghain';
  var buf = '';
  var bufTimer = null;

  document.addEventListener('keydown', function (e) {
    // Nicht beim Tippen in Inputs/Textareas
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-TRIGGER.length);
    clearTimeout(bufTimer);
    bufTimer = setTimeout(function () { buf = ''; }, 1500);
    if (buf === TRIGGER) {
      buf = '';
      if (!partyActive) showWarning();
    }
  });

  /* ── State ────────────────────────────────────────────────────────────── */
  var partyActive = false;
  var strobeTimer = null;
  var flashTimer  = null;
  var filterTimer = null;
  var beatTimer   = null;
  var teamTimer   = null;
  var audioCtx    = null;
  var darkEl      = null;
  var flashEl     = null;
  var teamLayer   = null;
  var modalEl     = null;
  var hueDeg      = 0;
  var teamPhotos  = [];

  /* ── Warning-Modal ────────────────────────────────────────────────────── */
  function showWarning() {
    if (modalEl) return;
    modalEl = document.createElement('div');
    modalEl.id = 'lazi-party-warn';
    modalEl.style.cssText =
      'position:fixed;inset:0;z-index:99999999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.85);backdrop-filter:blur(4px);font-family:system-ui,-apple-system,sans-serif;';
    modalEl.innerHTML =
      '<div style="background:#0a0a0a;color:#fff;border:1px solid #333;border-radius:14px;' +
      'padding:34px 30px;width:min(440px,90vw);text-align:center;">' +
      '<div style="font-size:46px;line-height:1;margin-bottom:14px;">⚠️</div>' +
      '<h2 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;">Achtung: Stroboskop-Effekt</h2>' +
      '<p style="margin:0 0 22px;font-size:14px;line-height:1.5;color:#bbb;">' +
      'Berghain-Modus aktiviert helle Lichtblitze, Farbverschiebungen und einen ' +
      'Kickbass. <strong style="color:#fff;">Photosensitive Epilepsie:</strong> bitte ' +
      'überspringen — schnelle Lichtwechsel können Anfälle auslösen.' +
      '</p>' +
      '<button id="lp-go" style="display:block;width:100%;padding:13px;border:none;border-radius:9px;' +
      'background:#c9002b;color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px;">' +
      'Los geht\'s 🖤</button>' +
      '<button id="lp-no" style="display:block;width:100%;padding:13px;border:1px solid #333;border-radius:9px;' +
      'background:transparent;color:#888;font-size:14px;font-weight:600;cursor:pointer;">' +
      'Nein, lieber nicht</button>' +
      '</div>';
    document.body.appendChild(modalEl);
    document.getElementById('lp-go').onclick = function () { closeModal(); startParty(); };
    document.getElementById('lp-no').onclick = closeModal;
  }
  function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  /* ── Party ────────────────────────────────────────────────────────────── */
  function startParty() {
    if (partyActive) return;
    partyActive = true;

    // Dark Overlay — permanent, lässt die Seite dunkel durchschimmern
    darkEl = document.createElement('div');
    darkEl.id = 'lazi-party-dark';
    darkEl.style.cssText =
      'position:fixed;inset:0;z-index:99999990;pointer-events:none;background:#000;opacity:0.88;';
    document.body.appendChild(darkEl);

    // Team-Layer (dahinter — Portraits springen drüber, aber unter Stop-Button)
    teamLayer = document.createElement('div');
    teamLayer.id = 'lazi-party-team';
    teamLayer.style.cssText =
      'position:fixed;inset:0;z-index:99999991;pointer-events:none;overflow:hidden;';
    document.body.appendChild(teamLayer);

    // Flash-Overlay — kurze, harte Blitze (volles Weiß)
    flashEl = document.createElement('div');
    flashEl.id = 'lazi-party-flash';
    flashEl.style.cssText =
      'position:fixed;inset:0;z-index:99999992;pointer-events:none;background:#fff;opacity:0;' +
      'transition:opacity 40ms linear;';
    document.body.appendChild(flashEl);

    // Stop-Button
    var stopBtn = document.createElement('button');
    stopBtn.id = 'lazi-party-stop';
    stopBtn.textContent = '⏏ Party beenden';
    stopBtn.style.cssText =
      'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999995;' +
      'padding:12px 24px;border:1px solid #fff;border-radius:30px;background:rgba(0,0,0,0.7);' +
      'color:#fff;font-family:system-ui,sans-serif;font-size:14px;font-weight:700;cursor:pointer;' +
      'backdrop-filter:blur(8px);letter-spacing:0.05em;text-transform:uppercase;';
    stopBtn.onclick = stopParty;
    document.body.appendChild(stopBtn);

    // ESC zum Beenden
    document.addEventListener('keydown', onEsc);

    // Starker Stroboskop: schnelle Bursts (alle 180–360 ms) je 50 ms voll hell
    function scheduleFlash() {
      if (!partyActive) return;
      flashEl.style.opacity = '1';
      setTimeout(function () { if (flashEl) flashEl.style.opacity = '0'; }, 50);
      strobeTimer = setTimeout(scheduleFlash, 180 + Math.random() * 180);
    }
    scheduleFlash();

    // Body-Filter-Cycle — dezenter, damit nicht zu bunt im Dunkel wird
    filterTimer = setInterval(function () {
      hueDeg = (hueDeg + 45) % 360;
      document.documentElement.style.filter =
        'hue-rotate(' + hueDeg + 'deg) contrast(1.1) saturate(1.2)';
    }, 920);

    // Team-Portraits: zufällig auf den Screen "blitzen lassen"
    loadTeamPhotos();
    function showTeamPhoto() {
      if (!partyActive || teamPhotos.length === 0) {
        teamTimer = setTimeout(showTeamPhoto, 400);
        return;
      }
      var photo = teamPhotos[Math.floor(Math.random() * teamPhotos.length)];
      var img = document.createElement('img');
      img.src = photo;
      img.alt = '';
      // Vollbild — keine Ränder, immer komplette Screen-Coverage
      var posX = Math.round(20 + Math.random() * 60); // 20–80% Crop
      var posY = Math.round(20 + Math.random() * 60);
      img.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;' +
        'object-fit:cover;object-position:' + posX + '% ' + posY + '%;' +
        'opacity:0;transition:opacity 30ms linear;border:none;border-radius:0;box-shadow:none;' +
        'filter:contrast(1.05) saturate(0.95) brightness(0.95);';
      teamLayer.appendChild(img);
      requestAnimationFrame(function () { img.style.opacity = '1'; });
      var visible = 90 + Math.random() * 130; // 90–220 ms sichtbar
      setTimeout(function () {
        img.style.opacity = '0';
        setTimeout(function () { img.remove(); }, 60);
      }, visible);
      teamTimer = setTimeout(showTeamPhoto, 1800 + Math.random() * 2200); // alle 1.8–4.0 s
    }
    showTeamPhoto();

    // Audio-Kontext + Kickbass (130 BPM = 461ms/beat)
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      var beatMs = 461;
      var nextTime = audioCtx.currentTime + 0.05;
      var beatCount = 0;
      function scheduler() {
        while (nextTime < audioCtx.currentTime + 0.2) {
          kick(nextTime, beatCount);
          if (beatCount % 4 === 0) hihat(nextTime + (beatMs / 2000));
          beatCount++;
          nextTime += beatMs / 1000;
        }
      }
      beatTimer = setInterval(scheduler, 30);
    } catch (e) { /* Audio optional */ }
  }

  function kick(when, n) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.12);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.7, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(when);
    osc.stop(when + 0.3);
  }

  function hihat(when) {
    var buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.15, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    var hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    src.connect(hp).connect(g).connect(audioCtx.destination);
    src.start(when);
  }

  function onEsc(e) {
    if (e.key === 'Escape' && partyActive) stopParty();
  }

  function stopParty() {
    partyActive = false;
    clearTimeout(strobeTimer); strobeTimer = null;
    clearTimeout(teamTimer);   teamTimer   = null;
    clearInterval(filterTimer); filterTimer = null;
    clearInterval(beatTimer);   beatTimer   = null;
    document.removeEventListener('keydown', onEsc);
    if (darkEl)    { darkEl.remove();    darkEl    = null; }
    if (flashEl)   { flashEl.remove();   flashEl   = null; }
    if (teamLayer) { teamLayer.remove(); teamLayer = null; }
    var btn = document.getElementById('lazi-party-stop');
    if (btn) btn.remove();
    document.documentElement.style.filter = '';
    if (audioCtx) { audioCtx.close().catch(function(){}); audioCtx = null; }
  }

  function loadTeamPhotos() {
    if (teamPhotos.length > 0) return;
    fetch('/api/team-photos')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        teamPhotos = (Array.isArray(data) ? data : [])
          .map(function (t) {
            // Original-URL hat „/f_auto,q_auto,w_800,c_limit/" → die preservt weiße Ränder.
            // Wir trimmen weiße Borders + cropen aus der Mitte heraus.
            return (t.bildUrl || '').replace(
              /\/upload\/[^/]+\//,
              '/upload/e_trim:10:white/c_thumb,g_face,z_1.4,w_1100,h_1400,f_auto,q_auto/'
            );
          })
          .filter(Boolean);
      })
      .catch(function () { teamPhotos = []; });
  }

  // Öffentliche API: direkt aufrufbar (z.B. von /club/ nach korrektem Passwort)
  window.laziParty = {
    open: function () { if (!partyActive) showWarning(); },
    stop: stopParty,
    isActive: function () { return partyActive; },
  };
}());

(function () {
  if (window.__laziSchlangeInit) return;
  window.__laziSchlangeInit = true;
  if (window.matchMedia('(hover: none)').matches) return;

  /* ── Hall of Fame (Sanity API) ─────────────────────────────────────────── */
  function loadHoF(cb) {
    fetch('/api/snake-score')
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(Array.isArray(data) ? data : []); })
      .catch(function () { cb([]); });
  }

  var gameToken = null;

  function fetchToken(cb) {
    fetch('/api/snake-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { gameToken = d && d.token ? d.token : null; cb && cb(); })
      .catch(function () { gameToken = null; cb && cb(); });
  }

  function saveToHoF(name, pts, cb) {
    fetch('/api/snake-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, score: pts, token: gameToken }),
    })
      .then(function (r) { return r.json(); })
      .then(function (top20) {
        var hof = Array.isArray(top20) ? top20 : [];
        var pos = hof.findIndex(function (e) {
          return e.playerName === ((name || '').trim().slice(0, 20) || 'Anonym') && e.score === pts;
        });
        cb({ hof: hof, pos: pos });
      })
      .catch(function () { cb({ hof: [], pos: -1 }); });
  }

  /* ── canvas ───────────────────────────────────────────────────────────── */
  var canvas = document.createElement('canvas');
  canvas.id = 'schlange-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;z-index:9999997;display:none;pointer-events:none;';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  /* ── overlay (HTML panels) ────────────────────────────────────────────── */
  var ov = document.createElement('div');
  ov.id = 'schlange-ov';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:9999998;display:none;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.38);backdrop-filter:blur(2px);';
  document.body.appendChild(ov);

  /* ── styles ───────────────────────────────────────────────────────────── */
  var st = document.createElement('style');
  st.textContent =
    '#schlange-panel{background:#fff;border-radius:18px;box-shadow:0 12px 48px rgba(0,0,0,0.28);' +
    'padding:28px 30px;width:min(420px,90vw);font-family:system-ui,-apple-system,sans-serif;max-height:85vh;overflow-y:auto;}' +
    '#schlange-panel h2{margin:0 0 2px;font-size:22px;letter-spacing:-0.02em;color:#141414;}' +
    '#schlange-panel .s-sub{font-size:13px;color:#999;margin:0 0 18px;}' +
    '.s-score-big{font-size:64px;font-weight:800;color:#c9002b;letter-spacing:-0.04em;line-height:1;margin:6px 0 2px;}' +
    '.s-score-lbl{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#aaa;margin-bottom:20px;}' +
    '.s-hof-head{font-size:11px;text-transform:uppercase;letter-spacing:0.09em;color:#bbb;font-weight:700;margin:0 0 8px;}' +
    '#schlange-hof{margin:0;padding:0;list-style:none;max-height:360px;overflow-y:auto;}' +
    '#schlange-hof li{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:8px;font-size:14px;}' +
    '#schlange-hof li+li{border-top:1px solid #f4f4f2;}' +
    '#schlange-hof .rank{font-size:18px;width:28px;text-align:center;flex-shrink:0;}' +
    '#schlange-hof .s-nm{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#schlange-hof .s-pt{font-weight:800;color:#141414;font-size:15px;}' +
    '#schlange-hof .s-dt{font-size:11px;color:#ccc;}' +
    '#schlange-hof li.s-hl{background:#fff8e6;}' +
    '#schlange-hof li.s-hl .s-pt{color:#c9002b;}' +
    '.s-empty{color:#ccc;font-size:13px;text-align:center;padding:16px 0;}' +
    '.s-inp{display:block;width:100%;box-sizing:border-box;border:2px solid #e8e8e8;border-radius:9px;' +
    'padding:11px 14px;font-size:16px;margin:10px 0 14px;outline:none;transition:border 0.15s;}' +
    '.s-inp:focus{border-color:#141414;}' +
    '.s-btn{display:block;width:100%;padding:13px;border:none;border-radius:9px;font-size:15px;' +
    'font-weight:700;cursor:pointer;margin-top:8px;transition:opacity 0.15s;}' +
    '.s-btn:hover{opacity:0.82;}' +
    '.s-primary{background:#141414;color:#fff;}' +
    '.s-ghost{background:transparent;border:2px solid #e8e8e8;color:#aaa;font-weight:600;}' +
    '.s-red{background:#c9002b;color:#fff;}' +
    '.s-hr{border:none;border-top:1px solid #f2f2f0;margin:18px 0;}';
  document.head.appendChild(st);

  /* ── game constants ───────────────────────────────────────────────────── */
  var CELL     = 30;   // px per grid cell
  var INIT_MS  = 135;  // ms per move at start
  var MIN_MS   = 63;   // fastest speed (reached at ~400 pts)

  /* ── state ────────────────────────────────────────────────────────────── */
  var W, H, cols, rows;
  var enabled = false;
  var snake, dir, nextDir, food, score, dead;
  var moveTimer = null;
  var moveMs = INIT_MS;
  var animId = null;
  var lastScore = 0;

  /* ── helpers ──────────────────────────────────────────────────────────── */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cols = Math.floor(W / CELL);
    rows = Math.floor(H / CELL);
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── game logic ───────────────────────────────────────────────────────── */
  function initGame() {
    var sx = Math.floor(cols / 2), sy = Math.floor(rows / 2);
    snake = [{ x: sx, y: sy }, { x: sx - 1, y: sy }, { x: sx - 2, y: sy }];
    dir      = { x: 1, y: 0 };
    nextDir  = { x: 1, y: 0 };
    score    = 0;
    dead     = false;
    moveMs   = INIT_MS;
    placeFood();
  }

  function placeFood() {
    var occupied = {};
    for (var i = 0; i < snake.length; i++) occupied[snake[i].x + ',' + snake[i].y] = 1;
    var free = [];
    for (var cx = 0; cx < cols; cx++) {
      for (var cy = 0; cy < rows; cy++) {
        if (!occupied[cx + ',' + cy]) free.push({ x: cx, y: cy });
      }
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function startMoving() {
    clearInterval(moveTimer);
    moveTimer = setInterval(step, moveMs);
  }

  function step() {
    if (dead || !enabled) return;
    dir = nextDir;
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // wall
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) { return doGameOver(); }
    // self
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) return doGameOver();
    }

    snake.unshift(head);

    if (food && head.x === food.x && head.y === food.y) {
      score += 10;
      if (score % 60 === 0) {          // speed up every 60 pts
        moveMs = Math.max(MIN_MS, moveMs - 12);
        startMoving();
      }
      placeFood();
    } else {
      snake.pop();
    }
  }

  function doGameOver() {
    dead = true;
    clearInterval(moveTimer); moveTimer = null;
    lastScore = score;
    // one more draw (dead flash), then show panel
    cancelAnimationFrame(animId);
    drawFrame();
    setTimeout(showGameOver, 600);
  }

  /* ── draw ─────────────────────────────────────────────────────────────── */
  function drawFrame() {
    ctx.clearRect(0, 0, W, H);
    if (!snake) return;

    var g = 2, s = CELL - g * 2; // segment draw size

    // food
    if (food) {
      var fx = food.x * CELL + CELL / 2, fy = food.y * CELL + CELL / 2;
      ctx.shadowColor = 'rgba(220,40,40,0.85)'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#e84040';
      ctx.beginPath(); ctx.arc(fx, fy, CELL / 2 - 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // leaf
      ctx.fillStyle = '#2e8a1e';
      ctx.save(); ctx.translate(fx + 1, fy - CELL / 2 + 2); ctx.rotate(-0.4);
      ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(fx - 3, fy - 4, 3, 0, Math.PI * 2); ctx.fill();
    }

    // snake segments
    for (var i = snake.length - 1; i >= 0; i--) {
      var seg = snake[i];
      var bx = seg.x * CELL + g, by = seg.y * CELL + g;
      var t = i === 0 ? 0 : i / snake.length;
      // bright at head, darkens toward tail
      var red = Math.round(210 - t * 80);
      ctx.fillStyle = 'rgb(' + red + ',0,0)';

      if (i < 4) { ctx.shadowColor = 'rgba(220,0,0,0.55)'; ctx.shadowBlur = 12; }
      else { ctx.shadowBlur = 0; }

      rrect(bx, by, s, s, Math.min(7, s / 2)); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // head eyes
    if (snake.length > 0) {
      var hd = snake[0];
      var hx = hd.x * CELL + CELL / 2, hy = hd.y * CELL + CELL / 2;
      var e1x = hx + dir.x * 4 - dir.y * 5, e1y = hy + dir.y * 4 + dir.x * 5;
      var e2x = hx + dir.x * 4 + dir.y * 5, e2y = hy + dir.y * 4 - dir.x * 5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(e1x, e1y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x, e2y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath(); ctx.arc(e1x + dir.x * 1.5, e1y + dir.y * 1.5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x + dir.x * 1.5, e2y + dir.y * 1.5, 2, 0, Math.PI * 2); ctx.fill();
    }

    // score HUD
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rrect(W / 2 - 72, 10, 144, 42, 10); ctx.fill();
    ctx.font = 'bold 26px system-ui,sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(score + ' P', W / 2, 40);

    // keyboard hint (bottom)
    ctx.font = '12px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText('↑ ↓ ← →  ·  ESC = beenden', W / 2, H - 12);
  }

  function loop() {
    if (!enabled || dead) return;
    drawFrame();
    animId = requestAnimationFrame(loop);
  }

  /* ── panels ───────────────────────────────────────────────────────────── */
  function hofList(hof, highlightPos) {
    if (!hof.length) {
      return '<p class="s-empty">Noch keine Einträge — du kannst der Erste sein!</p>';
    }
    var medals = ['🥇', '🥈', '🥉'];
    var out = '<ul id="schlange-hof">';
    for (var i = 0; i < hof.length; i++) {
      var e = hof[i];
      var rank = i < 3 ? medals[i] : (i + 1) + '.';
      var hl = i === highlightPos ? ' class="s-hl"' : '';
      var date = e._createdAt ? new Date(e._createdAt).toLocaleDateString('de-DE') : '';
      out += '<li' + hl + '>' +
        '<span class="rank">' + rank + '</span>' +
        '<span class="s-nm">' + esc(e.playerName || e.name || 'Anonym') + '</span>' +
        '<span class="s-pt">' + e.score + ' P</span>' +
        '<span class="s-dt">' + esc(date) + '</span>' +
        '</li>';
    }
    return out + '</ul>';
  }

  function showStart() {
    ov.style.display = 'flex';
    ov.innerHTML =
      '<div id="schlange-panel">' +
      '<h2>🐍 Lazi Snake</h2>' +
      '<p class="s-sub">Pfeil- oder WASD-Tasten · mit jedem Apfel schneller</p>' +
      '<p class="s-hof-head">🏆 Hall of Fame</p>' +
      '<p class="s-empty" id="s-hof-loading">Laden …</p>' +
      '<hr class="s-hr">' +
      '<button class="s-btn s-red" id="s-play">Spielen 🐍</button>' +
      '<button class="s-btn s-ghost" id="s-close">Schließen</button>' +
      '</div>';
    document.getElementById('s-play').onclick = function () { hidePanel(); startGame(); };
    document.getElementById('s-close').onclick = function () { window.laziSchlange.disable(); };
    loadHoF(function (hof) {
      var el = document.getElementById('s-hof-loading');
      if (el) el.outerHTML = hofList(hof, -1);
    });
  }

  function showGameOver() {
    ov.style.display = 'flex';
    ov.innerHTML =
      '<div id="schlange-panel">' +
      '<h2>💀 Game Over</h2>' +
      '<div class="s-score-big">' + lastScore + '</div>' +
      '<div class="s-score-lbl">Punkte erreicht</div>' +
      '<label style="font-size:13px;font-weight:600;color:#555;">Dein Name für den Hall of Fame:</label>' +
      '<input class="s-inp" id="s-name" type="text" maxlength="20" placeholder="Name eingeben …" autocomplete="off" autofocus>' +
      '<button class="s-btn s-primary" id="s-enter">Eintragen &amp; Hall of Fame anzeigen 🏆</button>' +
      '<button class="s-btn s-ghost" id="s-skip">Ohne Namen weiter</button>' +
      '</div>';

    var inp = document.getElementById('s-name');
    setTimeout(function () { inp && inp.focus(); }, 80);

    function submit() {
      var btn = document.getElementById('s-enter');
      if (btn) { btn.disabled = true; btn.textContent = 'Speichern …'; }
      saveToHoF(inp.value, lastScore, function (r) { showHoF(r.hof, r.pos); });
    }
    document.getElementById('s-enter').onclick = submit;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    document.getElementById('s-skip').onclick = function () {
      loadHoF(function (hof) { showHoF(hof, -1); });
    };
  }

  function showHoF(hof, highlightPos) {
    ov.style.display = 'flex';
    ov.innerHTML =
      '<div id="schlange-panel">' +
      '<h2>🏆 Hall of Fame</h2>' +
      '<p class="s-sub">Top ' + Math.min(hof.length, 20) + ' aller Zeiten</p>' +
      hofList(hof, highlightPos) +
      '<hr class="s-hr">' +
      '<button class="s-btn s-red" id="s-again">Neue Runde 🐍</button>' +
      '<button class="s-btn s-ghost" id="s-end">Beenden</button>' +
      '</div>';
    document.getElementById('s-again').onclick = function () { hidePanel(); startGame(); };
    document.getElementById('s-end').onclick = function () { window.laziSchlange.disable(); };
  }

  function hidePanel() {
    ov.style.display = 'none';
    ov.innerHTML = '';
  }

  function startGame() {
    gameToken = null;
    fetchToken(function () {
      initGame();
      animId = requestAnimationFrame(loop);
      startMoving();
    });
  }

  /* ── keyboard ─────────────────────────────────────────────────────────── */
  var DIRS = {
    ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
    ArrowUp:   { x: 0, y: -1 }, ArrowDown:  { x: 0, y: 1 },
    a: { x: -1, y: 0 }, d: { x: 1, y: 0 }, w: { x: 0, y: -1 }, s: { x: 0, y: 1 },
    A: { x: -1, y: 0 }, D: { x: 1, y: 0 }, W: { x: 0, y: -1 }, S: { x: 0, y: 1 },
  };

  document.addEventListener('keydown', function (e) {
    if (!enabled) return;
    if (e.key === 'Escape') { window.laziSchlange.disable(); return; }
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (!dir || dead) return;
    var d = DIRS[e.key];
    if (d && (d.x + dir.x !== 0 || d.y + dir.y !== 0)) {
      nextDir = d;
      e.preventDefault();
    }
  });

  /* ── API ──────────────────────────────────────────────────────────────── */
  window.laziSchlange = {
    enable: function () {
      enabled = true;
      resize();
      canvas.style.display = '';
      showStart();
      window.dispatchEvent(new CustomEvent('laziSchlangeState', { detail: { enabled: true } }));
    },
    disable: function () {
      enabled = false;
      canvas.style.display = 'none';
      hidePanel();
      clearInterval(moveTimer); moveTimer = null;
      cancelAnimationFrame(animId); animId = null;
      window.dispatchEvent(new CustomEvent('laziSchlangeState', { detail: { enabled: false } }));
    },
    isEnabled: function () { return enabled; },
  };

  window.addEventListener('resize', function () { if (enabled) resize(); });
}());

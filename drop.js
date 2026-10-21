(function () {
  if (window.__laziDropInit) return;
  window.__laziDropInit = true;

  /* ── Hall of Fame (Sanity API) ─────────────────────────────────────────── */
  function loadHoF(cb) {
    fetch('/api/drop-score')
      .then(function (r) { return r.json(); })
      .then(function (data) { cb(Array.isArray(data) ? data : []); })
      .catch(function () { cb([]); });
  }

  var gameToken = null;

  function fetchToken(cb) {
    fetch('/api/drop-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { gameToken = d && d.token ? d.token : null; cb && cb(); })
      .catch(function () { gameToken = null; cb && cb(); });
  }

  function saveToHoF(name, pts, lns, lvl, cb) {
    // Wenn beim Spielstart der Token-Fetch fehlgeschlagen war, hier nachholen —
    // so geht kein 15k-Score wegen Network-Hiccup verloren.
    function doSave() {
      fetch('/api/drop-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, score: pts, lines: lns, level: lvl, token: gameToken }),
      })
        .then(function (r) {
          return r.json().then(function (body) { return { ok: r.ok, body: body }; });
        })
        .then(function (res) {
          if (!res.ok || !Array.isArray(res.body)) {
            cb({ hof: [], pos: -1, error: (res.body && res.body.error) || 'Speichern fehlgeschlagen' });
            return;
          }
          var pos = res.body.findIndex(function (e) {
            return e.playerName === ((name || '').trim().slice(0, 20) || 'Anonym') && e.score === pts;
          });
          cb({ hof: res.body, pos: pos });
        })
        .catch(function () { cb({ hof: [], pos: -1, error: 'Netzwerk-Fehler' }); });
    }
    if (!gameToken) {
      fetchToken(doSave);
    } else {
      doSave();
    }
  }

  /* ── canvas ───────────────────────────────────────────────────────────── */
  var canvas = document.createElement('canvas');
  canvas.id = 'drop-canvas';
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999997;display:none;' +
    'touch-action:none;background:transparent;';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  /* ── overlay ──────────────────────────────────────────────────────────── */
  var ov = document.createElement('div');
  ov.id = 'drop-ov';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:9999998;display:none;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);padding:20px;';
  document.body.appendChild(ov);

  /* ── styles ───────────────────────────────────────────────────────────── */
  var st = document.createElement('style');
  st.textContent =
    '#drop-panel{background:#fff;border-radius:18px;box-shadow:0 12px 48px rgba(0,0,0,0.4);' +
    'padding:24px 22px;width:min(420px,92vw);font-family:system-ui,-apple-system,sans-serif;max-height:88vh;overflow-y:auto;}' +
    '#drop-panel h2{margin:0 0 2px;font-size:22px;letter-spacing:-0.02em;color:#141414;}' +
    '#drop-panel .t-sub{font-size:13px;color:#999;margin:0 0 18px;}' +
    '.t-score-big{font-size:64px;font-weight:800;color:#c9002b;letter-spacing:-0.04em;line-height:1;margin:6px 0 2px;}' +
    '.t-score-lbl{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#aaa;margin-bottom:12px;}' +
    '.t-stats{display:flex;justify-content:center;gap:18px;margin-bottom:18px;font-size:13px;color:#555;}' +
    '.t-stats b{display:block;color:#141414;font-size:18px;}' +
    '.t-hof-head{font-size:11px;text-transform:uppercase;letter-spacing:0.09em;color:#bbb;font-weight:700;margin:0 0 8px;}' +
    '#drop-hof{margin:0;padding:0;list-style:none;max-height:340px;overflow-y:auto;}' +
    '#drop-hof li{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:8px;font-size:14px;}' +
    '#drop-hof li+li{border-top:1px solid #f4f4f2;}' +
    '#drop-hof .rank{font-size:18px;width:28px;text-align:center;flex-shrink:0;}' +
    '#drop-hof .t-nm{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#drop-hof .t-pt{font-weight:800;color:#141414;font-size:15px;}' +
    '#drop-hof .t-lv{font-size:10px;color:#bbb;letter-spacing:0.05em;}' +
    '#drop-hof li.t-hl{background:#fff8e6;}' +
    '#drop-hof li.t-hl .t-pt{color:#c9002b;}' +
    '.t-empty{color:#ccc;font-size:13px;text-align:center;padding:16px 0;}' +
    '.t-inp{display:block;width:100%;box-sizing:border-box;border:2px solid #e8e8e8;border-radius:9px;' +
    'padding:11px 14px;font-size:16px;margin:10px 0 14px;outline:none;transition:border 0.15s;}' +
    '.t-inp:focus{border-color:#141414;}' +
    '.t-btn{display:block;width:100%;padding:13px;border:none;border-radius:9px;font-size:15px;' +
    'font-weight:700;cursor:pointer;margin-top:8px;transition:opacity 0.15s;-webkit-appearance:none;}' +
    '.t-btn:active{opacity:0.7;}' +
    '.t-primary{background:#141414;color:#fff;}' +
    '.t-ghost{background:transparent;border:2px solid #e8e8e8;color:#888;font-weight:600;}' +
    '.t-red{background:#c9002b;color:#fff;}' +
    '.t-hr{border:none;border-top:1px solid #f2f2f0;margin:18px 0;}' +
    '.t-hint{font-size:12px;color:#aaa;text-align:center;line-height:1.5;margin:8px 0 4px;}';
  document.head.appendChild(st);

  /* ── game constants ───────────────────────────────────────────────────── */
  var COLS = 10, ROWS = 20;

  // Block-Formen — die 7 klassischen Vierer-Kombinationen
  var SHAPES = {
    I: { color: '#00d4d4', cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
    O: { color: '#f0d000', cells: [[1,1],[1,1]] },
    T: { color: '#b040c8', cells: [[0,1,0],[1,1,1],[0,0,0]] },
    L: { color: '#f08020', cells: [[0,0,1],[1,1,1],[0,0,0]] },
    J: { color: '#2050d8', cells: [[1,0,0],[1,1,1],[0,0,0]] },
    S: { color: '#00c060', cells: [[0,1,1],[1,1,0],[0,0,0]] },
    Z: { color: '#d83838', cells: [[1,1,0],[0,1,1],[0,0,0]] },
  };
  var BAG_KEYS = ['I','O','T','L','J','S','Z'];

  // Speed (ms per gravity tick) per level — approximation of NES Drop
  var SPEEDS = [800, 720, 630, 550, 470, 380, 300, 220, 170, 130, 100, 90, 80, 70, 60];

  /* ── state ────────────────────────────────────────────────────────────── */
  var enabled = false;
  var board, current, nextPiece, bag, score, lines, level, dead;
  var moveTimer = null;
  var animId = null;
  var lastScore = 0, lastLines = 0, lastLevel = 1;

  // canvas geometry (recalc on resize)
  var W, H, CELL, OX, OY, NEXT_OX, NEXT_OY, NEXT_CELL;

  /* ── helpers ──────────────────────────────────────────────────────────── */
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Cell size: max that fits 10×20 with margin for HUD
    var hudTop = 88;     // score/level area at top
    var hudBot = 60;     // hint area at bottom
    var available_h = H - hudTop - hudBot;
    var available_w = W - 24;
    CELL = Math.floor(Math.min(available_w / COLS, available_h / ROWS));
    if (CELL < 14) CELL = 14;

    OX = Math.floor((W - COLS * CELL) / 2);
    OY = hudTop;

    NEXT_CELL = Math.floor(CELL * 0.55);
    NEXT_OX = OX + COLS * CELL + 12;
    NEXT_OY = OY;
    if (NEXT_OX + 4 * NEXT_CELL > W - 4) {
      // No room on the side → place top-right
      NEXT_OX = W - 4 * NEXT_CELL - 12;
      NEXT_OY = 14;
    }
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
  function makeBag() {
    var b = BAG_KEYS.slice();
    for (var i = b.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }

  function nextFromBag() {
    if (!bag || !bag.length) bag = makeBag();
    return bag.shift();
  }

  function spawnPiece(key) {
    var s = SHAPES[key];
    // Deep-clone cells
    var cells = s.cells.map(function (row) { return row.slice(); });
    var width = cells[0].length;
    return {
      key: key,
      color: s.color,
      cells: cells,
      x: Math.floor((COLS - width) / 2),
      y: key === 'I' ? -1 : 0,
    };
  }

  function rotateCW(cells) {
    var n = cells.length;
    var r = [];
    for (var y = 0; y < n; y++) {
      r.push([]);
      for (var x = 0; x < n; x++) {
        r[y].push(cells[n - 1 - x][y]);
      }
    }
    return r;
  }

  function collide(piece, dx, dy, cells) {
    var c = cells || piece.cells;
    for (var y = 0; y < c.length; y++) {
      for (var x = 0; x < c[y].length; x++) {
        if (!c[y][x]) continue;
        var bx = piece.x + x + dx;
        var by = piece.y + y + dy;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  function merge(piece) {
    for (var y = 0; y < piece.cells.length; y++) {
      for (var x = 0; x < piece.cells[y].length; x++) {
        if (piece.cells[y][x]) {
          var by = piece.y + y;
          var bx = piece.x + x;
          if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
            board[by][bx] = piece.color;
          }
        }
      }
    }
  }

  function clearLines() {
    var cleared = 0;
    for (var y = ROWS - 1; y >= 0; y--) {
      var full = true;
      for (var x = 0; x < COLS; x++) {
        if (!board[y][x]) { full = false; break; }
      }
      if (full) {
        board.splice(y, 1);
        board.unshift(new Array(COLS).fill(null));
        cleared++;
        y++; // re-check this row
      }
    }
    return cleared;
  }

  function awardLines(n) {
    if (n <= 0) return;
    var base = [0, 100, 300, 500, 800][n] || 800;
    score += base * level;
    lines += n;
    var newLevel = Math.floor(lines / 10) + 1;
    if (newLevel > level) {
      level = newLevel;
      startMoving();
    }
  }

  function speedMs() {
    var idx = Math.min(level - 1, SPEEDS.length - 1);
    return SPEEDS[idx];
  }

  function startMoving() {
    clearInterval(moveTimer);
    moveTimer = setInterval(tick, speedMs());
  }

  function tick() {
    if (dead || !enabled) return;
    if (!current) return;
    if (!collide(current, 0, 1)) {
      current.y++;
    } else {
      lockAndSpawn();
    }
  }

  function lockAndSpawn() {
    merge(current);
    var n = clearLines();
    awardLines(n);
    current = nextPiece;
    nextPiece = spawnPiece(nextFromBag());
    if (collide(current, 0, 0)) doGameOver();
  }

  function move(dx) {
    if (dead || !current) return;
    if (!collide(current, dx, 0)) current.x += dx;
  }

  function softDrop() {
    if (dead || !current) return;
    if (!collide(current, 0, 1)) {
      current.y++;
      score += 1;
    } else {
      lockAndSpawn();
    }
  }

  function hardDrop() {
    if (dead || !current) return;
    var d = 0;
    while (!collide(current, 0, d + 1)) d++;
    current.y += d;
    score += d * 2;
    lockAndSpawn();
  }

  function rotate() {
    if (dead || !current) return;
    if (current.key === 'O') return;
    var rotated = rotateCW(current.cells);
    // Try basic + 1-step wall kicks
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collide(current, kicks[i], 0, rotated)) {
        current.cells = rotated;
        current.x += kicks[i];
        return;
      }
    }
  }

  function doGameOver() {
    dead = true;
    clearInterval(moveTimer); moveTimer = null;
    lastScore = score;
    lastLines = lines;
    lastLevel = level;
    cancelAnimationFrame(animId);
    drawFrame();
    setTimeout(showGameOver, 600);
  }

  /* ── draw ─────────────────────────────────────────────────────────────── */
  function drawCell(x, y, color, alpha) {
    var px = OX + x * CELL;
    var py = OY + y * CELL;
    if (py + CELL <= OY) return; // off-screen above (e.g. I piece spawn)
    var g = 1;
    ctx.globalAlpha = alpha != null ? alpha : 1;
    ctx.fillStyle = color;
    rrect(px + g, py + g, CELL - g * 2, CELL - g * 2, 3);
    ctx.fill();
    // shine
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#fff';
    rrect(px + 3, py + 3, CELL - 8, Math.max(2, CELL * 0.18), 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawFrame() {
    // Transparent canvas — Seite scheint durch (wie Snake)
    ctx.clearRect(0, 0, W, H);

    // Field background — halbtransparent damit die Seite leicht durchschimmert
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(OX - 2, OY - 2, COLS * CELL + 4, ROWS * CELL + 4);
    ctx.fillStyle = 'rgba(20,20,20,0.55)';
    ctx.fillRect(OX, OY, COLS * CELL, ROWS * CELL);

    // Grid (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (var gx = 1; gx < COLS; gx++) {
      ctx.beginPath();
      ctx.moveTo(OX + gx * CELL + 0.5, OY);
      ctx.lineTo(OX + gx * CELL + 0.5, OY + ROWS * CELL);
      ctx.stroke();
    }
    for (var gy = 1; gy < ROWS; gy++) {
      ctx.beginPath();
      ctx.moveTo(OX, OY + gy * CELL + 0.5);
      ctx.lineTo(OX + COLS * CELL, OY + gy * CELL + 0.5);
      ctx.stroke();
    }

    // Placed blocks
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (board[y][x]) drawCell(x, y, board[y][x], 1);
      }
    }

    // Current piece (kein Ghost — Spieler soll selbst antizipieren)
    if (current && !dead) {
      for (var py = 0; py < current.cells.length; py++) {
        for (var px = 0; px < current.cells[py].length; px++) {
          if (current.cells[py][px]) {
            drawCell(current.x + px, current.y + py, current.color, 1);
          }
        }
      }
    }

    // HUD top — Score-Pille (links)
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    rrect(OX - 6, 10, 130, 56, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(score + ' P', OX + 4, 36);
    ctx.font = '11px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Level ' + level + '  ·  ' + lines + ' Lines', OX + 4, 56);

    // Close-X (rechts oben) — runder Knopf
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.arc(W - 28, 28, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕', W - 28, 35);

    // Next-Piece-Preview mit Backing
    if (nextPiece) {
      var nbW = 4 * NEXT_CELL + 12;
      var nbH = 4 * NEXT_CELL + 22;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      rrect(NEXT_OX - 6, NEXT_OY - 18, nbW, nbH, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 10px system-ui,sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('NEXT', NEXT_OX, NEXT_OY - 4);
      for (var ny = 0; ny < nextPiece.cells.length; ny++) {
        for (var nx = 0; nx < nextPiece.cells[ny].length; nx++) {
          if (nextPiece.cells[ny][nx]) {
            var cx = NEXT_OX + nx * NEXT_CELL;
            var cy = NEXT_OY + ny * NEXT_CELL;
            ctx.fillStyle = nextPiece.color;
            rrect(cx + 1, cy + 1, NEXT_CELL - 2, NEXT_CELL - 2, 2);
            ctx.fill();
          }
        }
      }
    }

    // Bottom hint mit Backing
    ctx.textAlign = 'center';
    ctx.font = '11px system-ui,sans-serif';
    var hint = 'Wischen ← → ↓ · Tippen = drehen · ↑ = Hard Drop';
    var hintW = ctx.measureText(hint).width;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    rrect(W / 2 - hintW / 2 - 12, H - 42, hintW + 24, 32, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(hint, W / 2, H - 26);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('X oben rechts = beenden', W / 2, H - 14);

    ctx.textAlign = 'left';
  }

  function loop() {
    if (!enabled || dead) return;
    drawFrame();
    animId = requestAnimationFrame(loop);
  }

  /* ── panels ───────────────────────────────────────────────────────────── */
  function hofList(hof, highlightPos) {
    if (!hof.length) {
      return '<p class="t-empty">Noch keine Einträge — du kannst der Erste sein!</p>';
    }
    var medals = ['🥇', '🥈', '🥉'];
    var out = '<ul id="drop-hof">';
    for (var i = 0; i < hof.length; i++) {
      var e = hof[i];
      var rank = i < 3 ? medals[i] : (i + 1) + '.';
      var hl = i === highlightPos ? ' class="t-hl"' : '';
      var lvl = e.level ? ' · L' + e.level : '';
      var lns = (e.lines != null) ? ' · ' + e.lines + ' Lines' : '';
      out += '<li' + hl + '>' +
        '<span class="rank">' + rank + '</span>' +
        '<span class="t-nm">' + esc(e.playerName || e.name || 'Anonym') + '</span>' +
        '<span><span class="t-pt">' + e.score + ' P</span>' +
        '<span class="t-lv">' + esc(lvl + lns) + '</span></span>' +
        '</li>';
    }
    return out + '</ul>';
  }

  function showStart() {
    ov.style.display = 'flex';
    ov.innerHTML =
      '<div id="drop-panel">' +
      '<h2>🧱 Lazi Drop</h2>' +
      '<p class="t-sub">Wischen ← → ↓ · Tippen = drehen · ↑-Wisch = Hard Drop</p>' +
      '<p class="t-hof-head">🏆 Hall of Fame</p>' +
      '<p class="t-empty" id="t-hof-loading">Laden …</p>' +
      '<hr class="t-hr">' +
      '<button class="t-btn t-red" id="t-play">Spielen 🧱</button>' +
      '<button class="t-btn t-ghost" id="t-close">Schließen</button>' +
      '</div>';
    document.getElementById('t-play').onclick = function () { hidePanel(); startGame(); };
    document.getElementById('t-close').onclick = function () { window.laziDrop.disable(); };
    loadHoF(function (hof) {
      var el = document.getElementById('t-hof-loading');
      if (el) el.outerHTML = hofList(hof, -1);
    });
  }

  function showGameOver() {
    ov.style.display = 'flex';
    ov.innerHTML =
      '<div id="drop-panel">' +
      '<h2>💀 Game Over</h2>' +
      '<div class="t-score-big">' + lastScore + '</div>' +
      '<div class="t-score-lbl">Punkte erreicht</div>' +
      '<div class="t-stats"><span>Level<b>' + lastLevel + '</b></span><span>Lines<b>' + lastLines + '</b></span></div>' +
      '<label style="font-size:13px;font-weight:600;color:#555;">Dein Name für den Hall of Fame:</label>' +
      '<input class="t-inp" id="t-name" type="text" maxlength="20" placeholder="Name eingeben …" autocomplete="off">' +
      '<button class="t-btn t-primary" id="t-enter">Eintragen &amp; Hall of Fame 🏆</button>' +
      '<button class="t-btn t-ghost" id="t-skip">Ohne Namen weiter</button>' +
      '</div>';

    var inp = document.getElementById('t-name');
    setTimeout(function () { inp && inp.focus(); }, 80);

    // Guard verhindert Doppel-Submit (Enter + Klick fast gleichzeitig → 2 Sanity-Einträge)
    var submitted = false;
    function submit() {
      if (submitted) return;
      submitted = true;
      var btn = document.getElementById('t-enter');
      if (btn) { btn.disabled = true; btn.textContent = 'Speichern …'; }
      saveToHoF(inp.value, lastScore, lastLines, lastLevel, function (r) {
        if (r.error) {
          // Save fehlgeschlagen: User soll erneut versuchen statt verlorenem Score
          submitted = false;
          if (btn) { btn.disabled = false; btn.textContent = 'Nochmal versuchen — ' + r.error; }
          return;
        }
        showHoF(r.hof, r.pos);
      });
    }
    document.getElementById('t-enter').onclick = submit;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    document.getElementById('t-skip').onclick = function () {
      loadHoF(function (hof) { showHoF(hof, -1); });
    };
  }

  function showHoF(hof, highlightPos) {
    ov.style.display = 'flex';
    ov.innerHTML =
      '<div id="drop-panel">' +
      '<h2>🏆 Hall of Fame</h2>' +
      '<p class="t-sub">Top ' + Math.min(hof.length, 20) + ' aller Zeiten</p>' +
      hofList(hof, highlightPos) +
      '<hr class="t-hr">' +
      '<button class="t-btn t-red" id="t-again">Neue Runde 🧱</button>' +
      '<button class="t-btn t-ghost" id="t-end">Beenden</button>' +
      '</div>';
    document.getElementById('t-again').onclick = function () { hidePanel(); startGame(); };
    document.getElementById('t-end').onclick = function () { window.laziDrop.disable(); };
  }

  function hidePanel() {
    ov.style.display = 'none';
    ov.innerHTML = '';
  }

  function startGame() {
    gameToken = null;
    fetchToken(function () {
      board = [];
      for (var y = 0; y < ROWS; y++) board.push(new Array(COLS).fill(null));
      score = 0; lines = 0; level = 1; dead = false;
      bag = null;
      current   = spawnPiece(nextFromBag());
      nextPiece = spawnPiece(nextFromBag());
      animId = requestAnimationFrame(loop);
      startMoving();
    });
  }

  /* ── touch controls ───────────────────────────────────────────────────── */
  var touch = null;

  function isCloseHit(x, y) {
    // Top-right ~ 60×60 hit area
    return x > W - 60 && y < 60;
  }

  canvas.addEventListener('touchstart', function (e) {
    if (!enabled || dead) return;
    if (!e.touches || !e.touches.length) return;
    var t = e.touches[0];
    if (isCloseHit(t.clientX, t.clientY)) {
      e.preventDefault();
      window.laziDrop.disable();
      return;
    }
    touch = {
      sx: t.clientX, sy: t.clientY,
      lx: t.clientX, ly: t.clientY,
      startMs: Date.now(),
      moved: 0,
      lastMoveMs: 0,
      hardDropped: false,
    };
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    if (!enabled || dead || !touch) return;
    if (!e.touches || !e.touches.length) return;
    var t = e.touches[0];
    var dx = t.clientX - touch.lx;
    var dy = t.clientY - touch.ly;
    touch.moved += Math.abs(dx) + Math.abs(dy);

    // Horizontal move per CELL/2 of drag
    var hStep = Math.max(20, CELL * 0.6);
    if (Math.abs(dx) >= hStep && Math.abs(dx) > Math.abs(dy)) {
      var steps = Math.trunc(dx / hStep);
      for (var i = 0; i < Math.abs(steps); i++) move(steps > 0 ? 1 : -1);
      touch.lx += steps * hStep;
      touch.ly = t.clientY;
    }

    // Soft drop while finger drags down (max every 50ms)
    var vStep = Math.max(20, CELL * 0.6);
    if (dy >= vStep && Math.abs(dy) > Math.abs(dx)) {
      var now = Date.now();
      if (now - touch.lastMoveMs > 50) {
        softDrop();
        touch.lastMoveMs = now;
        touch.ly += vStep;
        touch.lx = t.clientX;
      }
    }

    // Hard drop via fast up-swipe
    var totalDy = t.clientY - touch.sy;
    if (!touch.hardDropped && totalDy < -50 && (Date.now() - touch.startMs) < 300) {
      touch.hardDropped = true;
      hardDrop();
    }

    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    if (!enabled || dead || !touch) return;
    var elapsed = Date.now() - touch.startMs;
    var totalDx = touch.lx - touch.sx;
    var totalDy = touch.ly - touch.sy;
    var totalMove = Math.abs(totalDx) + Math.abs(totalDy);

    // Quick tap (no significant move) → rotate
    if (elapsed < 250 && totalMove < 14 && touch.moved < 20) {
      rotate();
    }

    touch = null;
    e.preventDefault();
  }, { passive: false });

  /* ── keyboard fallback (for testing on desktop) ───────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (!enabled || dead) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (e.key === 'Escape') { window.laziDrop.disable(); return; }
    if (e.key === 'ArrowLeft')  { move(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { move( 1); e.preventDefault(); }
    if (e.key === 'ArrowDown')  { softDrop(); e.preventDefault(); }
    if (e.key === 'ArrowUp')    { rotate(); e.preventDefault(); }
    if (e.key === ' ')          { hardDrop(); e.preventDefault(); }
  });

  /* ── API ──────────────────────────────────────────────────────────────── */
  window.laziDrop = {
    enable: function () {
      enabled = true;
      resize();
      canvas.style.display = '';
      showStart();
      window.dispatchEvent(new CustomEvent('laziDropState', { detail: { enabled: true } }));
    },
    disable: function () {
      enabled = false;
      canvas.style.display = 'none';
      hidePanel();
      clearInterval(moveTimer); moveTimer = null;
      cancelAnimationFrame(animId); animId = null;
      window.dispatchEvent(new CustomEvent('laziDropState', { detail: { enabled: false } }));
    },
    isEnabled: function () { return enabled; },
  };

  window.addEventListener('resize', function () { if (enabled) resize(); });
  window.addEventListener('orientationchange', function () { if (enabled) setTimeout(resize, 200); });
}());

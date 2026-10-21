(function () {
  if (window.__laziFlyInit) return;
  window.__laziFlyInit = true;
  if (window.matchMedia('(hover: none)').matches) return;

  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;z-index:999999;pointer-events:auto;cursor:default;width:32px;height:32px;will-change:transform;top:0;left:0;';
  el.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
    '<ellipse cx="5.5" cy="7" rx="5" ry="2.8" fill="rgba(190,210,230,0.5)" stroke="rgba(120,150,180,0.35)" stroke-width="0.6" transform="rotate(-20 5.5 7)"/>' +
    '<ellipse cx="14.5" cy="7" rx="5" ry="2.8" fill="rgba(190,210,230,0.5)" stroke="rgba(120,150,180,0.35)" stroke-width="0.6" transform="rotate(20 14.5 7)"/>' +
    '<ellipse cx="10" cy="12" rx="2.8" ry="4.2" fill="#1a1a1a"/>' +
    '<ellipse cx="10" cy="7" rx="2.2" ry="2.2" fill="#111"/>' +
    '<circle cx="8.8" cy="6.5" r="0.9" fill="#b00000"/>' +
    '<circle cx="11.2" cy="6.5" r="0.9" fill="#b00000"/>' +
    '</svg>';
  document.body.appendChild(el);

  var W = window.innerWidth, H = window.innerHeight;
  var x = W * 0.5, y = H * 0.5;
  var vx = 0, vy = 0;
  var cx = W * 0.5, cy = H * 0.5;
  var cvx = 0, cvy = 0, lastCx = cx, lastCy = cy;
  var rx = x, ry = y;
  var angle = 90;
  var orbitAngle = 0;
  var walkTx = null, walkTy = null;
  var roamIsCta = false;
  var ctaRect = null;
  var state = 'tracking';
  var stateMs = 0;
  var t = 0;
  var burstSpd = 0.9, burstMs = 0;
  var freezeMs = 0;
  var alive = true;
  // Fliege standardmäßig AUS, automatisch nach 5 Sek aktivieren (siehe unten).
  // Wenn sie zerquetscht wird, geht enabled=false und sie bleibt aus
  // bis User per Button wieder aktiviert.
  var enabled = false;
  var respawnTimer = null;

  var CTA_SEL = '.btn-primary, .seat-cta, .header-sticky-btn, .cta-small, .ms-btn, .infotag-cta';

  function show() { el.style.display = ''; }
  function hide() { el.style.display = 'none'; }

  function squish() {
    if (!alive) return;
    alive = false;
    hide();
    var sa = Math.round(Math.random() * 360);
    var splat = document.createElement('div');
    splat.style.cssText = 'position:fixed;z-index:999998;pointer-events:none;transition:opacity 0.8s;' +
      'left:' + (x - 20) + 'px;top:' + (y - 20) + 'px;width:40px;height:40px;';
    splat.innerHTML = '<svg width="40" height="40" viewBox="0 0 40 40"><g opacity="0.85">' +
      '<ellipse cx="20" cy="20" rx="11" ry="7"   fill="#7a0000" transform="rotate(' + sa          + ' 20 20)"/>' +
      '<ellipse cx="13" cy="14" rx="5"  ry="3"   fill="#5c0000" transform="rotate(' + (sa + 55)   + ' 13 14)"/>' +
      '<ellipse cx="28" cy="15" rx="4"  ry="2.5" fill="#5c0000" transform="rotate(' + (sa - 40)   + ' 28 15)"/>' +
      '<ellipse cx="14" cy="28" rx="4"  ry="2"   fill="#5c0000"/>' +
      '<ellipse cx="27" cy="27" rx="3"  ry="2"   fill="#5c0000" transform="rotate(30 27 27)"/>' +
      '</g></svg>';
    document.body.appendChild(splat);
    setTimeout(function () { splat.style.opacity = '0'; }, 1200);
    setTimeout(function () { splat.remove(); }, 2200);

    // Beim Zerquetschen Fliege endgültig deaktivieren — User muss bewusst
    // den Toggle-Button drücken um sie zurückzuholen. Persistent über
    // Seiten-Reloads via localStorage.
    enabled = false;
    try { localStorage.setItem('laziFlySquished', '1'); } catch (e) {}
    if (respawnTimer) clearTimeout(respawnTimer);
    window.dispatchEvent(new CustomEvent('laziFlyState', { detail: { enabled: false } }));
  }

  function visibleCtaBtns() {
    var vh = window.innerHeight;
    return Array.from(document.querySelectorAll(CTA_SEL)).filter(function (b) {
      var r = b.getBoundingClientRect();
      return r.width > 0 && r.top >= 0 && r.bottom <= vh;
    });
  }

  function pickCta(btns) {
    var pool = [];
    btns.forEach(function (b) {
      pool.push(b);
      if (b.classList.contains('infotag-cta') || b.classList.contains('header-sticky-btn')) pool.push(b);
    });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function newRoamTarget() {
    roamIsCta = false; ctaRect = null;
    var visible = visibleCtaBtns();
    if (visible.length && Math.random() < 0.72) {
      var btn = pickCta(visible);
      var r = btn.getBoundingClientRect();
      rx = r.left + r.width * 0.5;
      ry = r.top  + r.height * 0.5;
      roamIsCta = true; ctaRect = r;
      return;
    }
    rx = 80 + Math.random() * (window.innerWidth  - 160);
    ry = 80 + Math.random() * (window.innerHeight - 160);
  }

  el.addEventListener('click', squish);

  document.addEventListener('mousemove', function (e) {
    cvx = e.clientX - lastCx; cvy = e.clientY - lastCy;
    lastCx = e.clientX; lastCy = e.clientY;
    cx = e.clientX; cy = e.clientY;
  });

  // Global control API for React toggle button
  window.laziFly = {
    enable: function () {
      enabled = true;
      // Squished-Persistenz aufheben — User will Fliege wieder
      try { localStorage.removeItem('laziFlySquished'); } catch (e) {}
      if (!alive) {
        if (respawnTimer) clearTimeout(respawnTimer);
        alive = true;
        x = 80 + Math.random() * (window.innerWidth - 160);
        y = 100 + Math.random() * (window.innerHeight - 200);
        vx = 0; vy = 0;
        state = 'roaming'; stateMs = 5000;
        newRoamTarget();
      }
      show();
      // notify React
      window.dispatchEvent(new CustomEvent('laziFlyState', { detail: { enabled: true } }));
    },
    disable: function () {
      enabled = false;
      if (respawnTimer) clearTimeout(respawnTimer);
      hide();
      window.dispatchEvent(new CustomEvent('laziFlyState', { detail: { enabled: false } }));
    },
    isEnabled: function () { return enabled; },
  };

  // Auto-Start: nach 5 Sek Fliege aktivieren — aber NUR wenn sie nicht
  // schon zuvor zerquetscht wurde (Persistenz via localStorage).
  // Wenn User sie killt → bleibt sie auch nach Page-Reload aus, bis er
  // bewusst den Toggle-Button drückt.
  // Außerdem: auf Seiten mit eigenen Animationen (Luftballons o.ä.) startet
  // die Fliege NICHT automatisch — sonst wird's visuell zu viel.
  var ANIMATED_PAGES = ['/freundeskreis/', '/sponsoring/', '/bewerbung/'];
  var skipAutoStart = ANIMATED_PAGES.some(function (p) {
    return location.pathname.indexOf(p) === 0;
  });
  setTimeout(function () {
    if (enabled || !window.laziFly || skipAutoStart) return;
    var squished = false;
    try { squished = localStorage.getItem('laziFlySquished') === '1'; } catch (e) {}
    if (!squished) window.laziFly.enable();
  }, 5000);

  var last = performance.now();

  function tick(now) {
    var dt = Math.min(now - last, 50);
    last = now;
    if (!alive || !enabled) { requestAnimationFrame(tick); return; }
    t += dt;
    stateMs -= dt;

    var ddx = cx - x, ddy = cy - y;
    var distToCursor = Math.sqrt(ddx * ddx + ddy * ddy);
    var cursorSpd    = Math.sqrt(cvx * cvx + cvy * cvy);
    if (distToCursor < 90 && cursorSpd > 12) {
      var dodgeAng = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5);
      vx = Math.cos(dodgeAng) * (5 + Math.random() * 4);
      vy = Math.sin(dodgeAng) * (5 + Math.random() * 4);
      x += vx * 2; y += vy * 2;
      if (state === 'resting' || state === 'onbutton') { state = 'tracking'; freezeMs = 0; }
      burstSpd = 5 + Math.random() * 2; burstMs = 200 + Math.random() * 300;
    }

    burstMs -= dt;
    if (burstMs <= 0) {
      var roll = Math.random();
      if      (roll < 0.15) { burstSpd = 6.5 + Math.random() * 2.0; burstMs =  50 + Math.random() * 150; }
      else if (roll < 0.38) { burstSpd = 4.0 + Math.random() * 1.2; burstMs = 100 + Math.random() * 200; }
      else if (roll < 0.65) { burstSpd = 2.5 + Math.random() * 1.0; burstMs = 150 + Math.random() * 250; }
      else                  { burstSpd = 1.2 + Math.random() * 0.6; burstMs =  80 + Math.random() * 160; }
    }

    if (state === 'roaming' && freezeMs <= 0 && Math.random() < 0.022) {
      freezeMs = 400 + Math.random() * 1600;
    }
    if (freezeMs > 0) {
      freezeMs -= dt;
      var jx = (Math.random() - 0.5) * 0.8;
      var jy = (Math.random() - 0.5) * 0.8 + Math.sin(t * 0.003) * 0.5;
      el.style.transform = 'translate(' + (x - 10 + jx) + 'px,' + (y - 10 + jy) + 'px) rotate(' + angle + 'deg)';
      if (freezeMs <= 0) {
        var joltAng = Math.random() * Math.PI * 2;
        vx = Math.cos(joltAng) * (2.5 + Math.random() * 2.5);
        vy = Math.sin(joltAng) * (2.5 + Math.random() * 2.5);
        burstSpd = 4 + Math.random() * 2; burstMs = 80 + Math.random() * 150;
      }
      requestAnimationFrame(tick);
      return;
    }

    if (state === 'roaming' && !roamIsCta && Math.random() < 0.0022) { newRoamTarget(); }
    if (state === 'tracking' && Math.random() < 0.0025) {
      var urgent = visibleCtaBtns();
      if (urgent.length) {
        var ub = pickCta(urgent), ur = ub.getBoundingClientRect();
        rx = ur.left + ur.width * 0.5; ry = ur.top + ur.height * 0.5;
        roamIsCta = true; ctaRect = ur;
        state = 'roaming'; stateMs = 8000;
      }
    }

    if (state === 'resting') {
      var bob = Math.sin(t * 0.004) * 0.7;
      var jx = (Math.random() - 0.5) * 0.4, jy = (Math.random() - 0.5) * 0.4;
      el.style.transform = 'translate(' + (x - 10 + jx) + 'px,' + (y - 10 + bob + jy) + 'px) rotate(' + angle + 'deg)';
      if (stateMs <= 0) {
        if (Math.random() < 0.25) {
          state = 'annoying'; stateMs = 4000 + Math.random() * 5000;
          orbitAngle = Math.random() * Math.PI * 2;
        } else {
          state = 'roaming'; stateMs = 6000 + Math.random() * 9000;
          newRoamTarget();
        }
      }

    } else if (state === 'annoying') {
      orbitAngle += dt * (0.005 + Math.sin(t * 0.003) * 0.0015 + Math.random() * 0.003);
      var pulseR = 30 + Math.sin(t * 0.007) * 14;
      if (Math.sin(t * 0.014) > 0.82) pulseR = 4 + Math.random() * 8;
      var goalX = cx + Math.cos(orbitAngle) * pulseR + (Math.random() - 0.5) * 5;
      var goalY = cy + Math.sin(orbitAngle) * pulseR + (Math.random() - 0.5) * 5;
      var adx = goalX - x, ady = goalY - y, adist = Math.sqrt(adx * adx + ady * ady) || 1;
      var aspd = 2.6 + Math.random() * 1.4;
      vx = vx * 0.68 + (adx / adist) * aspd * 0.32 + (Math.random() - 0.5) * 1.1;
      vy = vy * 0.68 + (ady / adist) * aspd * 0.32 + (Math.random() - 0.5) * 1.1;
      x += vx; y += vy;
      angle = Math.atan2(vy, vx) * 180 / Math.PI + 90;
      var vmag = Math.sqrt(vx * vx + vy * vy);
      var flutter = 1 + Math.sin(t * (0.06 + Math.min(vmag * 0.008, 0.06))) * (0.10 + Math.min(vmag * 0.015, 0.18));
      el.style.transform = 'translate(' + (x - 10) + 'px,' + (y - 10) + 'px) rotate(' + angle + 'deg) scaleX(' + flutter + ')';
      if (stateMs <= 0) { state = 'roaming'; stateMs = 5000 + Math.random() * 7000; newRoamTarget(); }

    } else if (state === 'onbutton') {
      var r = ctaRect;
      var bcx = r ? r.left + r.width  * 0.5 : rx;
      var bcy = r ? r.top  + r.height * 0.5 : ry;
      var bHalf = r ? Math.min(r.width, r.height) * 0.45 : 12;
      if (Math.random() < 0.007) { freezeMs = 500 + Math.random() * 1400; }
      if (!walkTx || Math.sqrt((walkTx - x) * (walkTx - x) + (walkTy - y) * (walkTy - y)) < 3) {
        walkTx = bcx + (Math.random() - 0.5) * bHalf * 2;
        walkTy = bcy + (Math.random() - 0.5) * bHalf * 2;
      }
      var wdx = walkTx - x, wdy = walkTy - y, wdist = Math.sqrt(wdx * wdx + wdy * wdy) || 1;
      var wspd = 0.25 + Math.random() * 0.45;
      vx = vx * 0.75 + (wdx / wdist) * wspd * 0.25 + (Math.random() - 0.5) * 0.12;
      vy = vy * 0.75 + (wdy / wdist) * wspd * 0.25 + (Math.random() - 0.5) * 0.12;
      x += vx; y += vy;
      angle = Math.atan2(vy, vx) * 180 / Math.PI + 90;
      var jx = (Math.random() - 0.5) * 0.35, jy = (Math.random() - 0.5) * 0.35;
      el.style.transform = 'translate(' + (x - 10 + jx) + 'px,' + (y - 10 + jy) + 'px) rotate(' + angle + 'deg)';
      if (stateMs <= 0) { state = 'tracking'; roamIsCta = false; walkTx = null; walkTy = null; }

    } else {
      var goalX = (state === 'roaming') ? rx : cx;
      var goalY = (state === 'roaming') ? ry : cy;
      var dx = goalX - x, dy = goalY - y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 14) {
        if (state === 'tracking') {
          state = 'resting'; stateMs = 400 + Math.random() * 1000;
        } else if (roamIsCta) {
          state = 'onbutton'; stateMs = 2500 + Math.random() * 3000;
          walkTx = null; walkTy = null;
          var freshBtn = document.elementFromPoint(rx, ry);
          if (freshBtn) { var closest = freshBtn.closest(CTA_SEL); if (closest) ctaRect = closest.getBoundingClientRect(); }
        } else {
          if (stateMs <= 0) { state = 'tracking'; } else { newRoamTarget(); }
        }
      } else {
        var spd  = burstSpd * (0.6 + Math.random() * 0.9) + Math.random() * 0.3;
        var damp = burstSpd > 2 ? 0.70 : 0.76;
        var perpX = 0, perpY = 0;
        if (roamIsCta && dist < 60) {
          var spiral = (1 - dist / 60) * 0.55;
          perpX = (-dy / dist) * spiral * spd;
          perpY = ( dx / dist) * spiral * spd;
        }
        vx = vx * damp + (dx / dist) * spd * (1 - damp) + perpX * (1 - damp) + (Math.random() - 0.5) * 0.55 * burstSpd;
        vy = vy * damp + (dy / dist) * spd * (1 - damp) + perpY * (1 - damp) + (Math.random() - 0.5) * 0.50 * burstSpd;
        x += vx; y += vy;
        angle = Math.atan2(vy, vx) * 180 / Math.PI + 90;
      }
      var vmag = Math.sqrt(vx * vx + vy * vy);
      var flutter = 1 + Math.sin(t * (0.04 + Math.min(vmag * 0.007, 0.06))) * (0.06 + Math.min(vmag * 0.012, 0.16));
      el.style.transform = 'translate(' + (x - 10) + 'px,' + (y - 10) + 'px) rotate(' + angle + 'deg) scaleX(' + flutter + ')';
    }

    requestAnimationFrame(tick);
  }

  // Start hidden — button in UI controls visibility
  hide();
  enabled = false;
  setTimeout(function () { requestAnimationFrame(tick); }, 500);
}());

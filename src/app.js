/* Race-weekend portfolio. Depends on window.Motion (motion.js) and window.Sim (sim.js).
   One requestAnimationFrame loop drives everything scroll-linked; labs use CSS transitions
   and the Web Animations API on transform/opacity only. */
(function () {
  'use strict';
  const M = window.Motion, S = window.Sim;
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const store = {
    get(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  /* ================= flag in the header ================= */
  const flagEl = document.querySelector('.flag'), flagText = $('flag-text');
  let flagTimer = 0;
  function setFlag(kind, text, ms) {
    clearTimeout(flagTimer);
    flagEl.classList.remove('red', 'yellow');
    if (kind) flagEl.classList.add(kind);
    flagText.textContent = text;
    if (ms) flagTimer = setTimeout(() => setFlag(null, 'GREEN FLAG'), ms);
  }

  /* ================= start lights intro ================= */
  function startHero() {
    document.querySelector('.title').classList.add('in');
    document.querySelector('.hero-text').classList.add('in');
    document.querySelector('.cockpit').classList.add('in');
  }
  (function intro() {
    const box = $('lights');
    if (reduce || store.get('lights-seen')) { startHero(); return; }
    store.set('lights-seen', '1');
    const pods = box.querySelectorAll('.pod'), msg = $('lights-msg');
    box.hidden = false; document.body.classList.add('locked');
    const sched = M.lightsSchedule({ lights: 5, stepMs: 380, minHoldMs: 250, maxHoldMs: 750, rand: Math.random });
    const t0 = performance.now();
    const timers = [];
    let outAt = Infinity, done = false, reacted = false;
    sched.onAt.forEach((t, i) => timers.push(setTimeout(() => pods[i].classList.add('on'), t)));
    timers.push(setTimeout(() => {
      pods.forEach((p) => p.classList.remove('on'));
      outAt = performance.now() - t0;
      if (!reacted) { msg.textContent = 'Lights out'; msg.classList.add('big'); }
      timers.push(setTimeout(finish, 750));
    }, sched.outAt));
    function finish() {
      if (done) return; done = true;
      timers.forEach(clearTimeout);
      box.classList.add('go');
      document.body.classList.remove('locked');
      startHero();
      setTimeout(() => { box.hidden = true; }, 900);
    }
    box.addEventListener('pointerdown', (e) => {
      if (e.target.id === 'lights-skip' || reacted) return;
      reacted = true;
      const r = M.judgeReaction(performance.now() - t0, outAt);
      msg.classList.add('big');
      msg.textContent = r.jumpStart ? 'Jump start' : M.formatReaction(r.ms);
      if (r.jumpStart) { timers.forEach(clearTimeout); pods.forEach((p) => p.classList.remove('on')); setTimeout(finish, 650); }
    });
    $('lights-skip').addEventListener('click', finish);
    timers.push(setTimeout(finish, 6000)); // never trap anyone behind the intro
  })();

  /* ================= header + nav ================= */
  const banner = $('banner');
  const navLinks = [...document.querySelectorAll('.nav a')];
  const sections = ['top', 'grid', 'control', 'pace', 'pitwall'].map((id) => $(id));
  const SECTION_NAMES = ['Start', 'The grid', 'Race control', 'Race pace', 'Pit wall'];
  const navIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => navIO.observe(s));

  /* ================= reveal on scroll + count-ups ================= */
  function countUp(b) {
    const target = parseFloat(b.dataset.count), dec = +(b.dataset.dec || 0), suffix = b.dataset.suffix || '';
    const fmt = (v) => v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
    if (reduce || target === 0) { b.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 1500;
    (function step(now) {
      const k = M.ease.outExpo(M.clamp((now - t0) / dur, 0, 1));
      b.textContent = fmt(dec ? target * k : Math.round(target * k));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  const revealIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      const b = e.target.querySelector('[data-count]');
      if (b) countUp(b);
      revealIO.unobserve(e.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((n) => revealIO.observe(n));

  /* ================= timing tower ================= */
  const REPOS = [
    { name: 'core-banking-ledger', url: 'core-banking-ledger', tag: 'Core banking on a double-entry, append-only ledger', stack: 'Java 21 · Spring Boot 4 · PostgreSQL · Kafka', lang: 'Java', tyre: ['soft', 'J'], stat: '711 tests', cov: '98.5%',
      points: ['Postgres triggers reject UPDATE, DELETE and TRUNCATE on the ledger; mistakes are corrected by a linked reversal.', 'Transfers lock both balance rows in ascending id order under READ COMMITTED, so opposite transfers queue instead of deadlocking.', 'Maker-checker with holds, idempotency by unique constraint, and a transactional outbox to Kafka.'] },
    { name: 'ecommerce-backend', url: 'ecommerce-backend', tag: 'A shop API that cannot oversell, double-charge or replay a refresh token', stack: 'Java 21 · Spring Boot 4 · MySQL · Redis', lang: 'Java', tyre: ['soft', 'J'], stat: '600 tests', cov: '99.3%', best: true,
      points: ['One conditional UPDATE per order line; a test fires 20 concurrent buyers at the last 5 units and expects exactly 5 orders.', 'Idempotent order placement: key, user, body hash and response stored in the order transaction.', 'Rotating refresh-token families; emails sent only after the transaction commits.'] },
    { name: 'transaction-reconciliation-batch', url: 'transaction-reconciliation-batch', tag: 'Nightly bank reconciliation that explains every break', stack: 'Java 21 · Spring Batch · PostgreSQL', lang: 'Java', tyre: ['soft', 'J'], stat: '309 tests', cov: '97.0%',
      points: ['Million-line statement files loaded exactly once, with checksums and control totals.', 'Set-wise matching against the ledger; every difference classified as a break.', 'Maker/approver resolution, and restarts after a mid-run failure that never re-post.'] },
    { name: 'CheckoutKit', url: 'CheckoutKit', tag: 'Drop-in Android payment SDK with an un-breakable state machine', stack: 'Kotlin Multiplatform · Compose · JitPack', lang: 'KMP', tyre: ['med', 'K'], stat: '49/49 pairs', cov: '97.5%',
      points: ['Pure transition function with all 49 state × event pairs tested, applied with compare-and-set.', 'A timeout is never reported as "failed" while money may be captured: the SDK reconciles by key first.', '10,000-session retry storm never exceeds maxAttempts per key.'] },
    { name: 'PayFlow', url: 'PayFlow', tag: 'UPI payments built the way a payments team would', stack: 'Kotlin · Compose · Room · ML Kit', lang: 'Kotlin', tyre: ['med', 'K'], stat: '1,000 conc.', cov: '89.0%',
      points: ['Idempotency keys stored in Room before the PSP call; status polling with backoff and jitter.', 'Keystore AES-GCM, biometric/PIN lock with lockout, root/tamper detection, FLAG_SECURE.', '1,000 concurrent payments against a flaky PSP: zero duplicate or orphan payments.'] },
    { name: 'GeoGuard', url: 'GeoGuard', tag: 'Group geofence alerts that arrive with the app closed', stack: 'Kotlin · Compose · WorkManager · Firebase', lang: 'Kotlin', tyre: ['med', 'K'], stat: '0 dup alerts', cov: '—',
      points: ['OS geofencing instead of GPS polling: battery-safe, background-capable.', 'WorkManager uploads with deterministic event ids, so a retry can never duplicate an alert.', 'Server-side FCM fan-out, so no secrets ship in the APK.'] },
    { name: 'SplitSmart', url: 'SplitSmart', tag: 'Receipt photo to paise-exact split to one-tap UPI settle-up', stack: 'Kotlin · Compose · Hilt · Gemini', lang: 'Kotlin', tyre: ['med', 'K'], stat: 'OCR + LLM', cov: '95.2%',
      points: ['On-device ML Kit OCR, then Gemini over a pinned client with strict JSON and a regex fallback.', 'Equal, by-item and by-share splits with proportional tax and tip, paise-exact remainders.', '1,000 concurrent model calls with 60% 429s: zero failures, retries spread by full jitter.'] },
    { name: 'FinPay', url: 'Fin_Pay', tag: 'A fintech UI built test-first', stack: 'Flutter · sqflite', lang: 'Flutter', tyre: ['inter', 'F'], stat: '1,500+ tests', cov: '—',
      points: ['Exact-paise ledger in sqflite, salted credential hashing, idempotent payment flow.', '144 golden baselines and physics-based motion.', 'Stress suite pushes 100,000 ledger rows and 1,000-tap storms through the real screens.'] },
    { name: 'ai-customer-support-agent', url: 'ai-customer-support-agent', tag: 'Classifies, drafts grounded replies, escalates and explains', stack: 'Python · evaluation pipeline', lang: 'Python', tyre: ['wet', 'P'], stat: '50 tests', cov: '—',
      points: ['Built on 2.8M support tweets with 99.8% conversation-link integrity.', 'Intent classification, replies grounded in a brand\'s own history, explicit escalation.', 'Reproducibility and honest evaluation over system size.'] }
  ];
  const LANG_COLOR = { Java: '#FF7A1A', KMP: '#8F7BFF', Kotlin: '#B26BFF', Flutter: '#3DA5FF', Python: '#FFD23F' };
  (function tower() {
    const root = $('tower');
    REPOS.forEach((r, i) => {
      const row = el('div', 'row'); row.setAttribute('role', 'listitem'); row.style.setProperty('--i', i);
      const btn = el('button', 'row-btn'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
      const did = 'd-' + i; btn.setAttribute('aria-controls', did);
      btn.appendChild(el('span', 'pos', String(i + 1)));
      const stripe = el('span', 'stripe'); stripe.style.background = LANG_COLOR[r.lang]; btn.appendChild(stripe);
      const nm = el('span', 'rname'); nm.appendChild(el('b', null, r.name)); nm.appendChild(el('span', null, r.tag)); btn.appendChild(nm);
      const tc = el('span', 'tyre-cell'); tc.appendChild(el('span', 'tyre ' + r.tyre[0], r.tyre[1])); tc.appendChild(document.createTextNode(r.lang)); btn.appendChild(tc);
      btn.appendChild(el('span', 'stat', r.stat));
      btn.appendChild(el('span', 'gap' + (r.best ? ' best' : ''), r.cov));
      btn.appendChild(el('span', 'chev'));
      const detail = el('div', 'detail'); detail.id = did;
      const wrap = el('div'); const inner = el('div', 'detail-in');
      const ul = el('ul'); r.points.forEach((p) => ul.appendChild(el('li', null, p)));
      const left = el('div'); left.appendChild(el('p', 'fine', r.stack + ' · ' + r.stat + (r.cov !== '—' ? ' · ' + r.cov + ' line coverage' : ''))); left.appendChild(ul);
      const a = el('a', 'btn btn-ghost sm repo'); a.href = 'https://github.com/Darshan-05032003/' + r.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.appendChild(el('span', null, 'Open repo ↗'));
      inner.appendChild(left); inner.appendChild(a); wrap.appendChild(inner); detail.appendChild(wrap);
      btn.addEventListener('click', () => {
        const open = row.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
      });
      row.appendChild(btn); row.appendChild(detail); root.appendChild(row);
    });
    new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { root.classList.add('in'); io.disconnect(); } }, { threshold: 0.08 }).observe(root);
  })();

  /* ================= pace charts ================= */
  (function pace() {
    const cov = [['ecommerce-backend', 99.3], ['core-banking-ledger', 98.5], ['CheckoutKit', 97.5], ['reconciliation-batch', 97.0], ['SplitSmart', 95.2], ['PayFlow', 89.0]];
    const tests = [['FinPay', 1500], ['core-banking-ledger', 711], ['ecommerce-backend', 600], ['reconciliation-batch', 309], ['ai-support-agent', 50], ['this site', 36]];
    function bars(id, data, max, fmt, deltaFmt) {
      const root = $(id), best = data[0][1];
      data.forEach(([n, v], i) => {
        const li = el('li'); li.style.setProperty('--i', i);
        li.appendChild(el('span', 'bn', n));
        const t = el('span', 'bt'); const f = el('span', 'bf' + (i === 0 ? ' best' : '')); f.style.setProperty('--w', (v / max).toFixed(4)); t.appendChild(f); li.appendChild(t);
        const bv = el('span', 'bv', fmt(v)); bv.appendChild(el('small', null, i === 0 ? 'fastest' : deltaFmt(v - best))); li.appendChild(bv);
        root.appendChild(li);
      });
    }
    bars('bars-cov', cov, 100, (v) => v.toFixed(1) + '%', (d) => d.toFixed(1));
    bars('bars-tests', tests, 1500, (v) => v.toLocaleString('en-IN') + (v === 1500 ? '+' : ''), (d) => '−' + Math.abs(d).toLocaleString('en-IN'));
  })();

  /* ================= cockpit, streaks, track map: one rAF loop ================= */
  const kmhEl = $('kmh'), gearEl = $('gear'), fillEl = $('gauge-fill'), shiftEl = $('shift'), hintEl = $('cockpit-hint');
  const leds = [];
  for (let i = 0; i < 15; i++) { const d = el('i', i < 5 ? 'g' : i < 10 ? 'r' : 'p'); shiftEl.appendChild(d); leds.push(d); }
  (function ticks() {
    const g = $('ticks'), NS = 'http://www.w3.org/2000/svg';
    for (let s = 0; s <= 350; s += 50) {
      const a = Math.PI * (1 - s / M.TOP_SPEED);
      if (s > M.TOP_SPEED) break;
      const cx = 120, cy = 130, r1 = 84, r2 = 76, rl = 64;
      const ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', cx + r1 * Math.cos(a)); ln.setAttribute('y1', cy - r1 * Math.sin(a));
      ln.setAttribute('x2', cx + r2 * Math.cos(a)); ln.setAttribute('y2', cy - r2 * Math.sin(a));
      g.appendChild(ln);
      const tx = document.createElementNS(NS, 'text');
      tx.setAttribute('x', cx + rl * Math.cos(a)); tx.setAttribute('y', cy - rl * Math.sin(a) + 3); tx.setAttribute('text-anchor', 'middle');
      tx.textContent = s; g.appendChild(tx);
    }
  })();

  // speed streaks in the hero
  const canvas = $('streaks'), ctx = canvas.getContext('2d');
  let cw = 0, ch = 0, heroVisible = true;
  const parts = [];
  function sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function seedParts() {
    parts.length = 0;
    const n = Math.round(M.clamp(cw / 16, 40, 90));
    for (let i = 0; i < n; i++) parts.push({ x: Math.random() * cw, y: Math.random() * ch, len: 20 + Math.random() * 90, spd: 0.4 + Math.random() * 1.4, a: 0.04 + Math.random() * 0.16, red: Math.random() < 0.12 });
  }
  sizeCanvas(); seedParts();
  new ResizeObserver(() => { sizeCanvas(); seedParts(); }).observe(canvas);
  new IntersectionObserver((es) => { heroVisible = es[0].isIntersecting; }).observe($('top'));

  function drawStreaks(speed01, dt) {
    ctx.clearRect(0, 0, cw, ch);
    const boost = 0.35 + speed01 * 7;
    const stretch = 0.7 + speed01 * 3.2;
    ctx.lineCap = 'round';
    for (const p of parts) {
      p.x -= p.spd * boost * dt * 120;
      const L = p.len * stretch;
      if (p.x + L < 0) { p.x = cw + Math.random() * 60; p.y = Math.random() * ch; }
      ctx.globalAlpha = Math.min(0.9, p.a * (0.6 + speed01 * 2.2));
      ctx.strokeStyle = p.red ? '#FF2B1F' : '#F2F3F5';
      ctx.lineWidth = p.red ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + L, p.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // track map
  const trackmap = $('trackmap'), track = $('track'), trackDone = $('track-done'), car = $('car');
  const tmSector = $('tm-sector'), tmName = $('tm-name'), tmLap = $('tm-lap');
  const trackLen = track.getTotalLength();
  let bounds = [0, 0.2, 0.5, 0.75, 0.9];
  function measure() {
    const max = document.documentElement.scrollHeight - innerHeight;
    bounds = sections.map((s) => (max > 0 ? M.clamp((s.getBoundingClientRect().top + scrollY - innerHeight * 0.4) / max, 0, 1) : 0));
    bounds[0] = 0;
  }
  measure();
  let measureQueued = false;
  new ResizeObserver(() => { if (measureQueued) return; measureQueued = true; requestAnimationFrame(() => { measureQueued = false; measure(); }); }).observe(document.body);
  addEventListener('load', measure);

  let lastY = scrollY, lastT = performance.now(), vel = 0, prog = M.scrollProgress(scrollY, document.documentElement.scrollHeight, innerHeight);
  let shownKmh = -1, shownGear = -1, shownLit = -1, shownSector = -1, solid = null, mapShown = null;
  const lapStart = performance.now();

  function frame(now) {
    const dt = M.clamp((now - lastT) / 1000, 0, 0.1); lastT = now;
    const y = scrollY;
    const raw = dt > 0 ? (y - lastY) / dt : 0; lastY = y;
    const target = Math.abs(raw);
    vel = M.damp(vel, target, target > vel ? 9 : 2.4, dt);
    const kmh = reduce ? 0 : M.speedKmh(vel);

    // header
    const s = y > 24;
    if (s !== solid) { banner.classList.toggle('solid', s); solid = s; }

    // cockpit (only touch the DOM when a value changes)
    const k = Math.round(kmh);
    if (k !== shownKmh) {
      kmhEl.textContent = k; shownKmh = k;
      fillEl.style.strokeDasharray = ((kmh / M.TOP_SPEED) * 100).toFixed(2) + ' 100';
      fillEl.style.opacity = k < 1 ? '0' : '1';
      if (k > 30) hintEl.textContent = k > 250 ? 'DRS open' : 'Push, push';
      else hintEl.textContent = 'Scroll to accelerate';
    }
    const g = M.gearFor(kmh);
    if (g !== shownGear) { gearEl.textContent = g; shownGear = g; }
    const rpm = k < 2 ? 0 : M.rpmFor(kmh);
    const lit = M.shiftLights(rpm, 15);
    if (lit !== shownLit) {
      for (let i = 0; i < 15; i++) leds[i].classList.toggle('on', i < lit);
      shiftEl.classList.toggle('limiter', g === 8 && lit >= 15);
      shownLit = lit;
    }

    // streaks
    if (heroVisible && !reduce) drawStreaks(kmh / M.TOP_SPEED, dt);

    // track map
    const p = M.scrollProgress(y, document.documentElement.scrollHeight, innerHeight);
    prog = reduce ? p : M.damp(prog, p, 7, dt);
    const show = y > innerHeight * 0.55;
    if (show !== mapShown) { trackmap.classList.toggle('show', show); mapShown = show; }
    if (show) {
      const pt = track.getPointAtLength(prog * trackLen);
      car.setAttribute('cx', pt.x.toFixed(2)); car.setAttribute('cy', pt.y.toFixed(2));
      trackDone.style.strokeDashoffset = String(1000 * (1 - prog));
      const sec = M.sectorAt(p, bounds);
      if (sec !== shownSector) { tmSector.textContent = 'S' + (sec + 1); tmName.textContent = SECTION_NAMES[sec]; shownSector = sec; }
      tmLap.textContent = M.formatLap(now - lapStart);
    }
    if (!document.hidden) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastT = performance.now(); lastY = scrollY; requestAnimationFrame(frame); } });

  /* ================= Lab 1: 20 buyers, 5 units ================= */
  (function raceLab() {
    const stage = $('race-stage'), log = $('race-log'), verdict = $('race-verdict'), status = $('race-status');
    const ordersEl = $('race-orders'), stockEl = $('race-stock'), runBtn = $('race-run');
    const N = 20, STOCK = 5;
    const SEEDS = [6, 15, 29, 63, 47, 19, 62, 71, 70, 25];
    let L = null, running = false, runIdx = 0, timers = [];
    const cars = [], where = []; // where[i] = ['grid'|'box'|'over', index]
    const slots = [];

    for (let i = 0; i < N; i++) {
      const c = el('div', 'car', String(i + 1)); c.setAttribute('aria-label', 'Buyer ' + (i + 1)); stage.appendChild(c); cars.push(c); where.push(['grid', i]);
    }
    for (let i = 0; i < 5; i++) { const sl = el('div', 'slot'); stage.insertBefore(sl, stage.firstChild); slots.push(sl); }

    function pos(i) { const [z, k] = where[i]; return z === 'grid' ? L.grid[k] : z === 'box' ? L.boxes[k] : L.overflow[k]; }
    function layout() {
      L = M.raceLayout(stage.clientWidth);
      stage.style.height = L.height + 'px';
      slots.forEach((s, k) => { const b = L.boxes[k]; s.style.cssText = 'left:' + (b.x - 3) + 'px;top:' + (b.y - 3) + 'px;width:' + (L.chipW + 6) + 'px;height:' + (L.chipH + 6) + 'px'; });
      $('z-box').style.left = L.boxesX + 'px';
      $('z-over').style.left = (L.boxesX + L.chipW + 4) + 'px';
      cars.forEach((c, i) => { const p = pos(i); c.style.width = L.chipW + 'px'; c.style.height = L.chipH + 'px'; c.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)'; });
    }
    layout();
    new ResizeObserver(() => layout()).observe(stage);

    function move(i, zone, k) { where[i] = [zone, k]; const p = pos(i); cars[i].style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)'; }
    function say(html, cls) {
      const li = el('li', cls || ''); li.innerHTML = html; log.appendChild(li);
      while (log.children.length > 7) log.removeChild(log.firstChild);
    }
    function bump(node, val, cls) { node.textContent = String(val); node.className = cls || ''; void node.offsetWidth; node.classList.add('pop'); }

    function reset() {
      timers.forEach(clearTimeout); timers = [];
      cars.forEach((c, i) => { c.className = 'car'; move(i, 'grid', i); });
      stage.classList.remove('over');
      bump(ordersEl, 0); bump(stockEl, STOCK);
      log.textContent = ''; verdict.textContent = ''; verdict.className = 'verdict';
    }

    function run() {
      if (running) return; running = true; runBtn.disabled = true;
      reset();
      const mode = document.querySelector('input[name="race-mode"]:checked').value;
      const res = S.race({ mode, buyers: N, stock: STOCK, seed: SEEDS[runIdx++ % SEEDS.length] });
      status.textContent = 'Session live'; status.className = 'lab-status live';
      setFlag('yellow', 'INCIDENT 01', 0);
      const scale = reduce ? 0 : 3600;
      let placed = 0, last = 0;
      say('<b>RACE CONTROL</b> ' + (mode === 'naive' ? 'Each buyer reads stock, then writes stock − 1' : 'Each buyer runs UPDATE … WHERE stock >= 1'));
      for (const e of res.events) {
        const at = 250 + e.t * scale; last = Math.max(last, at);
        timers.push(setTimeout(() => {
          const c = cars[e.buyer], n = e.buyer + 1;
          if (e.type === 'read') { c.classList.add('req'); say('<b>CAR ' + n + '</b> SELECT stock → ' + e.stockSeen); }
          else if (e.type === 'request') { c.classList.add('req'); say('<b>CAR ' + n + '</b> UPDATE … WHERE stock >= 1'); }
          else if (e.type === 'order') {
            c.classList.remove('req'); placed++;
            if (placed <= STOCK) { c.classList.add('won'); move(e.buyer, 'box', placed - 1); }
            else { c.classList.add('phantom'); move(e.buyer, 'over', placed - STOCK - 1); stage.classList.add('over'); }
            bump(ordersEl, placed, placed > STOCK ? 'bad' : '');
            bump(stockEl, e.stockAfter);
            if (mode === 'naive') say('<b>CAR ' + n + '</b> UPDATE stock = ' + e.stockAfter + ' (saw ' + e.stockSeen + ')' + (placed > STOCK ? ' · phantom unit' : ''), placed > STOCK ? 'bad' : 'ok');
            else say('<b>CAR ' + n + '</b> 1 row updated → order ' + placed, 'ok');
          } else {
            c.classList.remove('req'); c.classList.add('rej');
            say('<b>CAR ' + n + '</b> ' + (mode === 'naive' ? 'saw 0 → out of stock → 409' : '0 rows → 409 Conflict'));
          }
        }, at));
      }
      timers.push(setTimeout(() => {
        const over = res.orders - STOCK;
        if (over > 0) {
          verdict.className = 'verdict bad';
          verdict.innerHTML = '<strong>' + res.orders + ' orders for ' + STOCK + ' units.</strong> ' + over + ' customers paid for stock that does not exist, because each request trusted a number it read a moment earlier. Switch to Conditional UPDATE and run it again.';
          status.textContent = 'Oversold'; status.className = 'lab-status bad';
          setFlag('red', 'RED FLAG · OVERSOLD', 3500);
        } else {
          verdict.className = 'verdict good';
          verdict.innerHTML = '<strong>Exactly ' + STOCK + ' orders, ' + res.rejected + ' clean rejections.</strong> The database decides in one atomic statement; zero affected rows rolls the whole order back. This is <code>OrderPlacementService</code> in ecommerce-backend.';
          ordersEl.className = 'good'; stockEl.className = 'good';
          status.textContent = 'Clean session'; status.className = 'lab-status';
          setFlag(null, 'GREEN FLAG');
        }
        running = false; runBtn.disabled = false; runBtn.firstElementChild.textContent = 'Run again';
      }, last + 700));
    }
    runBtn.addEventListener('click', run);
    document.querySelectorAll('input[name="race-mode"]').forEach((r) => r.addEventListener('change', () => { if (!running) reset(); }));
  })();

  /* ================= Lab 2: idempotent payments ================= */
  (function payLab() {
    const road = $('pay-road'), wire = $('pay-wire'), stmt = $('pay-stmt'), verdict = $('pay-verdict');
    const btn = $('pay-run'), keyBox = $('pay-key'), chargesEl = $('pay-charges'), status = $('pay-status');
    let busy = false;
    function drive(node, from, to, ms, easing) {
      if (reduce) { node.style.transform = 'translate3d(' + to + 'px,0,0)'; return Promise.resolve(); }
      const a = node.animate([{ transform: 'translate3d(' + from + 'px,0,0)' }, { transform: 'translate3d(' + to + 'px,0,0)' }], { duration: ms, easing: easing || 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      return a.finished;
    }
    function line(attempt, html, cls) {
      const li = el('li'); li.appendChild(el('b', cls || null, attempt)); const sp = el('span', cls || null); sp.innerHTML = html; li.appendChild(sp); wire.appendChild(li);
    }
    async function run() {
      if (busy) return; busy = true; btn.disabled = true;
      wire.textContent = ''; stmt.textContent = ''; verdict.textContent = ''; verdict.className = 'verdict'; road.textContent = '';
      chargesEl.textContent = '0 charges';
      status.textContent = 'Session live'; status.className = 'lab-status live';
      const useKey = keyBox.checked;
      const server = S.paymentServer();
      const r = S.payWithRetries(server, { useKey, amount: 49900, lostResponses: 2, key: 'idem-7f3a9c' });
      const w = road.clientWidth;
      for (const a of r.attempts) {
        const req = el('div', 'pkt', useKey ? 'POST · key 7f3a' : 'POST /pay'); road.appendChild(req);
        const reqW = req.offsetWidth;
        line('Attempt ' + a.attempt, 'POST /payments ₹499' + (useKey ? ' <code>Idempotency-Key: idem-7f3a9c</code>' : ''));
        await drive(req, 0, w - reqW - 12, 650);
        const soFar = useKey ? 1 : a.attempt; // the server has charged this many times by now
        chargesEl.textContent = soFar + (soFar === 1 ? ' charge' : ' charges');
        req.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce ? 1 : 200, fill: 'forwards' });
        const back = el('div', 'pkt back', a.replayed ? '201 replayed' : '201 Paid'); road.appendChild(back);
        const bw = back.offsetWidth;
        if (a.lost) {
          await drive(back, 0, -(w - bw - 12) * 0.5, 420, 'cubic-bezier(.4,0,1,1)');
          back.classList.add('lost'); back.textContent = '✕ radio lost';
          if (!reduce) back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 250, fill: 'forwards' });
          line('timeout', 'server answered <code>' + a.status + '</code>' + (a.replayed ? ' (replayed)' : ' (charged ' + esc(a.chargeId) + ')') + ', but the phone never heard it. Retrying…', 'lost');
          await wait(380);
        } else {
          await drive(back, 0, -(w - bw - 12), 650);
          line(String(a.status), a.replayed ? '<code>Idempotent-Replayed: true</code>: same stored response, no new charge' : 'Paid. Charge ' + esc(a.chargeId), a.replayed ? 'replay' : '');
        }
        await wait(200);
      }
      const n = server.charges.length;
      chargesEl.textContent = n + (n === 1 ? ' charge' : ' charges');
      server.charges.forEach((c) => { const row = el('div', 'stmt-row'); row.appendChild(el('span', null, c.id + ' · card ending 4417')); row.appendChild(el('span', null, S.inr(c.amount))); stmt.appendChild(row); });
      const tot = el('div', 'stmt-row total ' + (n > 1 ? 'bad' : 'good')); tot.appendChild(el('span', null, 'Charged to customer')); tot.appendChild(el('span', null, S.inr(n * 49900))); stmt.appendChild(tot);
      if (n > 1) {
        verdict.className = 'verdict bad';
        verdict.innerHTML = '<strong>Charged ' + n + ' times for one order.</strong> Every retry looked like a new payment. Flip the switch and pay again.';
        status.textContent = 'Double charge'; status.className = 'lab-status bad';
        setFlag('red', 'RED FLAG · DOUBLE CHARGE', 3500);
      } else {
        verdict.className = 'verdict good';
        verdict.innerHTML = '<strong>Charged once.</strong> The key, the user and a SHA-256 of the body are stored with the first response in the same transaction. Retries get that response back; the same key with a different amount gets 422.';
        status.textContent = 'Clean session'; status.className = 'lab-status';
      }
      busy = false; btn.disabled = false;
    }
    btn.addEventListener('click', run);
  })();

  /* ================= Lab 3: ledger ================= */
  (function ledgerLab() {
    const acctsEl = $('accts'), tbody = $('journal'), notice = $('ledger-notice'), pendingEl = $('pending'), status = $('ledger-status');
    const NAMES = { asha: 'Asha', ravi: 'Ravi', CASH_VAULT: 'Cash vault (GL)' };
    let L;
    function fresh() { L = S.ledger({ accounts: { asha: 1000000, ravi: 200000 }, approvalThreshold: 500000 }); }
    function say(kind, html) { notice.innerHTML = '<p class="notice' + (kind === 'bad' ? ' bad' : '') + '">' + html + '</p>'; }
    function lb(text, cls, fn, label) { const b = el('button', 'linkbtn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; if (label) b.setAttribute('aria-label', label); b.addEventListener('click', fn); return b; }

    function render() {
      acctsEl.textContent = '';
      for (const a of L.accounts()) {
        const d = el('div', 'acct'); const held = L.held(a);
        d.appendChild(el('span', null, NAMES[a])); d.appendChild(el('b', null, S.inr(L.balance(a))));
        const av = el('span', null, 'available ' + S.inr(L.available(a)));
        if (held) { av.appendChild(document.createTextNode(' · ')); av.appendChild(el('span', 'held', 'on hold ' + S.inr(held))); }
        d.appendChild(av); acctsEl.appendChild(d);
      }
      pendingEl.textContent = '';
      for (const t of L.transfers()) {
        if (t.status !== 'PENDING_APPROVAL') continue;
        const row = el('div'); row.appendChild(el('span', null, t.id + ' ' + NAMES[t.from] + ' → ' + NAMES[t.to] + ' ' + S.inr(t.amount) + ' awaits a checker.'));
        row.appendChild(lb('Approve as ' + NAMES[t.by], null, () => { try { L.approve(t.id, t.by); } catch (e) { say('bad', '<code>403</code> ' + esc(e.message) + '. The server checks the raiser\'s id against the approver\'s token, not a UI flag.'); setFlag('yellow', 'STEWARDS · FOUR EYES', 3000); } render(); }));
        row.appendChild(lb('Approve as Checker', null, () => { const r = L.approve(t.id, 'checker'); say('ok', 'Posted as ' + esc(r.journal) + '. The hold is released and the ledger balance moves only now.'); render(); }));
        pendingEl.appendChild(row);
      }
      tbody.textContent = '';
      const journals = L.journals(), entries = L.entries();
      for (const e of entries) {
        const j = journals.find((x) => x.id === e.journal);
        const tr = el('tr'); if (j.type === 'REVERSAL') tr.className = 'rev';
        const firstLeg = entries.find((x) => x.journal === e.journal).id === e.id;
        const td1 = el('td');
        if (firstLeg) { td1.appendChild(document.createTextNode(e.journal + ' ')); td1.appendChild(el('span', 'jt', j.type.toLowerCase() + (j.reversalOf ? ' of ' + j.reversalOf : ''))); }
        tr.appendChild(td1); tr.appendChild(el('td', null, NAMES[e.account]));
        tr.appendChild(el('td', 'num', e.side === 'D' ? S.inr(e.amount) : '')); tr.appendChild(el('td', 'num', e.side === 'C' ? S.inr(e.amount) : ''));
        const act = el('td', 'act');
        act.appendChild(lb('Edit', 'danger', () => {
          try { L.update(e.id, { amount: 1 }); } catch (err) {
            say('bad', '<code>ERROR: ' + esc(err.message) + '</code><br>In core-banking-ledger this is a PostgreSQL trigger on <code>ledger_entry</code>, so even someone with a psql shell cannot quietly change history.');
            setFlag('yellow', 'STEWARDS · EDIT REFUSED', 3000);
          }
        }, 'Try to edit entry ' + e.id));
        if (firstLeg && j.type === 'TRANSFER' && !journals.some((x) => x.reversalOf === j.id)) {
          act.appendChild(lb('Reverse', null, () => { const r = L.reverse(j.id, 'teller'); say('ok', 'Posted ' + esc(r.journal) + ', a mirror-image journal linked by <code>reversal_of</code>. The original stays, the books still balance, and a unique constraint means it can only be reversed once.'); render(); }));
        }
        tr.appendChild(act); tbody.appendChild(tr);
      }
      const tb = L.trialBalance();
      $('tb-d').textContent = S.inr(tb.debits); $('tb-c').textContent = S.inr(tb.credits);
      const st = $('tb-stamp'); st.textContent = ''; st.appendChild(el('span', 'stamp' + (tb.balanced ? '' : ' bad'), tb.balanced ? 'Balanced' : 'Off'));
      status.textContent = tb.balanced ? 'Books balanced' : 'Books off'; status.className = 'lab-status' + (tb.balanced ? '' : ' bad');
      const sc = tbody.parentElement.parentElement; sc.scrollTop = sc.scrollHeight;
    }

    document.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
      const op = b.dataset.op;
      try {
        if (op === 'reset') { fresh(); say('ok', 'Fresh books. Opening balances are themselves journals against the cash vault, so the trial balance starts balanced.'); }
        if (op === 't1') { const r = L.transfer({ from: 'asha', to: 'ravi', amount: 150000, by: 'asha' }); r.status === 'POSTED' ? say('ok', 'Posted ' + r.journal + ': debit Asha, credit Ravi, one transaction. Both balance rows were locked in ascending id order first.') : say('bad', '<code>422</code> ' + esc(r.reason) + '.'); }
        if (op === 't2') { const r = L.transfer({ from: 'ravi', to: 'asha', amount: 300000, by: 'ravi' }); r.status === 'POSTED' ? say('ok', 'Posted ' + r.journal + '.') : say('bad', '<code>422 INSUFFICIENT_FUNDS</code> Nothing was written. The FAILED transfer row is kept for audit; the ledger is untouched.'); }
        if (op === 'big') { const r = L.transfer({ from: 'asha', to: 'ravi', amount: 600000, by: 'asha' }); r.status === 'PENDING_APPROVAL' ? say('ok', '<code>202 Accepted</code> Above ₹5,000 a transfer needs a second pair of eyes. ₹6,000 is now on hold: Asha\'s available balance dropped, her ledger balance did not.') : say('bad', '<code>422</code> ' + esc(r.reason || r.status) + '.'); }
        if (op === 'bad') { L.post('MANUAL', [{ account: 'asha', side: 'D', amount: 100000 }, { account: 'ravi', side: 'C', amount: 99900 }]); }
      } catch (e) {
        say('bad', '<code>' + esc(e.message) + '</code><br><code>PostingService</code> sums the legs before anything touches the database. Debits ₹1,000, credits ₹999: refused.');
        setFlag('yellow', 'STEWARDS · REFUSED', 3000);
      }
      render();
    }));
    fresh(); render();
  })();

  /* ================= Lab 4: geofence ================= */
  (function geoLab() {
    const svg = $('geo-map'), dot = $('geo-dot'), halo = $('geo-halo'), carEl = $('geo-car'), name = $('geo-name');
    const screen = $('geo-screen'), pipe = $('geo-pipe'), help = $('geo-help'), status = $('geo-status');
    const CX = 200, CY = 150, R = 95, GREEN = '#30E07A', RED = '#FF2B1F';
    const g = S.geofence({ cx: CX, cy: CY, r: R, cooldownMs: 300000 });
    let x = 180, y = 140, simNow = 0, lastReal = performance.now(), dragging = false, animating = false;
    g.move(x, y, 0);
    const base = 10 * 60 + 42;
    setInterval(() => {
      const now = performance.now(); simNow += (now - lastReal) * 60; lastReal = now; // demo time runs 60x
      const mins = base + Math.floor(simNow / 60000);
      $('geo-clock').textContent = String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    }, 1000);
    function paint(c) { halo.setAttribute('fill', c); carEl.setAttribute('fill', c); }
    function place(nx, ny) {
      x = M.clamp(nx, 12, 408); y = M.clamp(ny, 26, 288);
      [halo, carEl].forEach((c) => { c.setAttribute('cx', x); c.setAttribute('cy', y); });
      name.setAttribute('x', x); name.setAttribute('y', y - 20);
      const dist = Math.hypot(x - CX, y - CY);
      dot.setAttribute('aria-valuenow', Math.min(100, Math.round(dist / R * 50)));
      dot.setAttribute('aria-valuetext', (dist <= R ? 'inside' : 'outside') + ' the zone, ' + Math.round(dist / R * 300) + ' metres from centre');
      const res = g.move(x, y, simNow);
      if (res.transition === 'EXIT') fire(res.notify);
      if (res.transition === 'ENTER') { paint(GREEN); clearPipe(); status.textContent = 'Inside track limits'; status.className = 'lab-status'; help.textContent = 'Back inside. Re-entry is a transition too, but the app only alerts on EXIT.'; }
    }
    function clearPipe() { pipe.querySelectorAll('li').forEach((li) => { li.classList.remove('on', 'muted'); }); }
    async function fire(notify) {
      paint(RED); status.textContent = 'Track limits exceeded'; status.className = 'lab-status bad';
      if (animating) return; animating = true; clearPipe();
      setFlag('yellow', 'TRACK LIMITS', 2500);
      for (const s of ['os', 'worker', 'fs', 'fn', 'fcm']) {
        const li = pipe.querySelector('[data-step="' + s + '"]');
        if (!notify && s === 'fn') {
          li.classList.add('muted');
          help.textContent = 'Recorded, not pushed: this exit is inside the 5-minute cooldown, so GPS jitter at the edge cannot spam the group. Wait a minute of demo time and try again.';
          animating = false; return;
        }
        li.classList.add('on');
        await wait(330);
      }
      const n = el('div', 'notif'); n.appendChild(el('b', null, 'GeoGuard · now')); n.appendChild(document.createTextNode('Asha has left the safe zone.'));
      screen.appendChild(n);
      while (screen.children.length > 4) screen.removeChild(screen.children[1]);
      help.textContent = 'Delivered with the app closed. Drag her back in, then out again to see the cooldown.';
      animating = false;
    }
    function pt(ev) { const r = svg.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * 420, y: (ev.clientY - r.top) / r.height * 300 }; }
    let pending = null;
    function schedule(p) { // coalesce pointer moves to one update per frame
      const first = !pending; pending = p;
      if (first) requestAnimationFrame(() => { const q = pending; pending = null; place(q.x, q.y); });
    }
    dot.addEventListener('pointerdown', (e) => { dragging = true; dot.setPointerCapture(e.pointerId); e.preventDefault(); });
    dot.addEventListener('pointermove', (e) => { if (dragging) schedule(pt(e)); });
    dot.addEventListener('pointerup', () => { dragging = false; });
    dot.addEventListener('pointercancel', () => { dragging = false; });
    svg.addEventListener('pointerdown', (e) => { if (dot.contains(e.target)) return; const p = pt(e); place(p.x, p.y); });
    dot.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
      if (!k) return; e.preventDefault(); place(x + k[0], y + k[1]);
    });
  })();

  /* ================= copy email ================= */
  (function copy() {
    const b = $('copy-mail'), out = $('copied');
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('sonawanedarshan35@gmail.com'); out.textContent = 'Copied. Box, box.'; }
      catch (e) { out.textContent = 'Select and copy the address above'; }
      setTimeout(() => { out.textContent = ''; }, 2600);
    });
  })();

  /* ================= reaction test ================= */
  (function reaction() {
    const pad = $('react-pad'), pods = $('react-gantry').querySelectorAll('.pod'), out = $('react-out'), bestEl = $('react-best'), start = $('react-start'), help = $('react-help');
    let state = 'idle', timers = [], outAt = 0, best = parseInt(store.get('react-best') || '0', 10) || 0;
    if (best) bestEl.textContent = 'Session best ' + M.formatReaction(best);
    function clear() { timers.forEach(clearTimeout); timers = []; pods.forEach((p) => p.classList.remove('on')); }
    function go() {
      if (state === 'arming' || state === 'go') return;
      clear(); state = 'arming'; out.className = 'react-out'; out.textContent = 'Wait…'; start.disabled = true;
      const s = M.lightsSchedule({ lights: 5, stepMs: 650, minHoldMs: 300, maxHoldMs: 2600, rand: Math.random });
      s.onAt.forEach((t, i) => timers.push(setTimeout(() => pods[i].classList.add('on'), t)));
      timers.push(setTimeout(() => { pods.forEach((p) => p.classList.remove('on')); outAt = performance.now(); state = 'go'; out.textContent = 'GO'; }, s.outAt));
      pad.focus({ preventScroll: true });
    }
    function hit() {
      if (state === 'arming') {
        clear(); state = 'idle'; start.disabled = false;
        out.className = 'react-out jump'; out.textContent = 'Jump start';
        help.textContent = 'Drive-through penalty. Press start and wait for all five lights to go out.';
        return;
      }
      if (state !== 'go') return;
      const r = M.judgeReaction(performance.now(), outAt);
      state = 'idle'; start.disabled = false;
      out.textContent = M.formatReaction(r.ms);
      out.className = 'react-out' + (r.ms < 250 ? ' good' : '');
      help.textContent = r.ms < 200 ? 'Pole-position reflexes. Hire the driver.' : r.ms < 300 ? 'Clean launch. Try again for purple.' : 'Bogged down off the line. Again?';
      if (!best || r.ms < best) { best = r.ms; store.set('react-best', String(best)); bestEl.textContent = 'Session best ' + M.formatReaction(best); }
    }
    start.addEventListener('click', go);
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); if (state === 'idle') go(); else hit(); });
    pad.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (state === 'idle') go(); else hit(); } });
  })();
})();

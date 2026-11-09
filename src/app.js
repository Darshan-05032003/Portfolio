/* Portfolio v4 controller. One rAF loop; a single 0..1 scroll progress drives camera, car and text.
   Rules: transform/opacity only, one ease, render the 3D scene only when something changed. */
import './motion.js';
import './cinema.js';
import './sim.js';
import './drive.js';
import './road.js';
import { createScene, deviceTier } from './scene.js';
import { initLabs } from './labs.js';

const M = window.Motion, C = window.Cinema, D = window.Drive, RD = window.Road;
const road = RD.create();
const $ = (id) => document.getElementById(id);
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const store = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

/* ---------------- loader ---------------- */
const loader = $('loader'), bar = $('loader-bar'), pct = $('loader-pct');
let shown = 0;
function progress(p) { shown = Math.max(shown, p); bar.style.transform = 'scaleX(' + shown + ')'; pct.textContent = String(Math.round(shown * 100)).padStart(2, '0'); }
function loaderDone() { progress(1); loader.classList.add('done'); document.body.classList.remove('locked'); startHero(); }
if (!store.get('seen') && !reduce) document.body.classList.add('locked');
store.set('seen', '1');
progress(0.15);

/* ---------------- hero reveal ---------------- */
function startHero() {
  document.querySelector('.name').classList.add('in');
  document.querySelectorAll('.hero .reveal').forEach((n, i) => { n.style.setProperty('--d', (0.25 + i * 0.06) + 's'); n.classList.add('in'); });
  const t = document.querySelectorAll('.telemetry [data-count]'); t.forEach(countUp);
}

/* ---------------- reveals + count-ups ---------------- */
document.querySelectorAll('.reveal-lines').forEach((h) => {
  // split into lines by words measured at render time: cheap approximation, one wrapper per line
  const words = h.textContent.trim().split(/\s+/); h.textContent = '';
  const probe = document.createElement('span'); h.appendChild(probe);
  let line = [], lines = [], lastTop = null;
  for (const w of words) {
    probe.textContent = (line.concat(w)).join(' ');
    const top = probe.getBoundingClientRect().height;
    if (lastTop !== null && top > lastTop && line.length) { lines.push(line); line = [w]; probe.textContent = w; lastTop = probe.getBoundingClientRect().height; }
    else { line.push(w); lastTop = top; }
  }
  if (line.length) lines.push(line);
  h.textContent = '';
  lines.forEach((ln, i) => { const o = document.createElement('span'); o.className = 'ln'; const r = document.createElement('span'); r.className = 'rv'; r.style.setProperty('--i', i); r.textContent = ln.join(' '); o.appendChild(r); h.appendChild(o); });
});
function countUp(b) {
  const target = parseFloat(b.dataset.count), dec = +(b.dataset.dec || 0), suffix = b.dataset.suffix || '';
  const fmt = (v) => v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
  if (reduce) { b.textContent = fmt(target); return; }
  const t0 = performance.now(), dur = 1400;
  (function step(now) { const k = M.ease.outExpo(M.clamp((now - t0) / dur, 0, 1)); b.textContent = fmt(dec ? target * k : Math.round(target * k)); if (k < 1) requestAnimationFrame(step); })(t0);
}
const io = new IntersectionObserver((es) => { for (const e of es) { if (!e.isIntersecting) continue; e.target.classList.add('in'); io.unobserve(e.target); } }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal:not(.hero .reveal), .reveal-lines, .tower').forEach((n) => io.observe(n));

/* ---------------- nav state ---------------- */
const links = [...document.querySelectorAll('.links a')];
const navIO = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)); }, { rootMargin: '-40% 0px -55% 0px' });
['work', 'labs', 'contact'].forEach((id) => navIO.observe($(id)));

/* ---------------- timing tower ---------------- */
const REPOS = [
  ['ecommerce-backend', 'ECO', 'Java', 'A shop API that cannot oversell, double-charge or replay a refresh token', 'Java 21 · Spring Boot 4 · MySQL · Redis · 600 tests', '99.3%', ['One conditional UPDATE per order line; a test fires 20 concurrent buyers at the last 5 units and expects exactly 5 orders.', 'Idempotent order placement: key, user, body hash and response stored in the order transaction.', 'Rotating refresh-token families; emails sent only after the transaction commits.']],
  ['core-banking-ledger', 'LDG', 'Java', 'Core banking on a double-entry, append-only ledger', 'Java 21 · Spring Boot 4 · PostgreSQL · Kafka · 711 tests', '98.5%', ['Postgres triggers reject UPDATE, DELETE and TRUNCATE on the ledger; mistakes are corrected by a linked reversal.', 'Transfers lock both balance rows in ascending id order, so opposite transfers queue instead of deadlocking.', 'Maker-checker with holds, idempotency by unique constraint, transactional outbox to Kafka.']],
  ['CheckoutKit', 'CKT', 'KMP', 'Drop-in Android payment SDK with a state machine that cannot reach an illegal state', 'Kotlin Multiplatform · Compose · JitPack', '97.5%', ['Pure transition function with all 49 state × event pairs tested, applied with compare-and-set.', 'A timeout is never reported as "failed" while money may be captured: the SDK reconciles by key first.', '10,000-session retry storm never exceeds maxAttempts per key.']],
  ['transaction-reconciliation-batch', 'REC', 'Java', 'Nightly bank reconciliation that explains every break', 'Java 21 · Spring Batch · PostgreSQL · 309 tests', '97.0%', ['Million-line statement files loaded exactly once, with checksums and control totals.', 'Set-wise matching against the ledger; every difference classified as a break.', 'Maker/approver resolution; restarts after a mid-run failure never re-post.']],
  ['SplitSmart', 'SPL', 'Kotlin', 'Receipt photo to paise-exact split to one-tap UPI settle-up', 'Kotlin · Compose · Hilt · Gemini', '95.2%', ['On-device ML Kit OCR, then Gemini over a pinned client with strict JSON and a regex fallback.', 'Equal, by-item and by-share splits with proportional tax and tip, paise-exact remainders.', '1,000 concurrent model calls with 60% 429s: zero failures, retries spread by full jitter.']],
  ['PayFlow', 'PAY', 'Kotlin', 'UPI payments built the way a payments team would', 'Kotlin · Compose · Room · ML Kit', '89.0%', ['Idempotency keys stored in Room before the PSP call; status polling with backoff and jitter.', 'Keystore AES-GCM, biometric/PIN lock with lockout, root/tamper detection, FLAG_SECURE.', '1,000 concurrent payments against a flaky PSP: zero duplicate or orphan payments.']],
  ['FinPay', 'FIN', 'Flutter', 'A fintech UI built test-first: 1,500+ tests, 144 golden baselines', 'Flutter · sqflite', '—', ['Exact-paise ledger in sqflite, salted credential hashing, idempotent payment flow.', 'Stress suite pushes 100,000 ledger rows and 1,000-tap storms through the real screens.']],
  ['ai-customer-support-agent', 'AI', 'Python', 'Classifies, drafts grounded replies, escalates and explains', 'Python · evaluation pipeline', '—', ['Built on 2.8M support tweets with 99.8% conversation-link integrity.', 'Reproducibility and honest evaluation over system size.']]
];
const REPO_URL = { FinPay: 'Fin_Pay' };
const LANG = { Java: '#B07219', KMP: '#7F52FF', Kotlin: '#A97BFF', Flutter: '#02569B', Python: '#3572A5' };
(function tower() {
  const root = $('tower');
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  REPOS.forEach((r, i) => {
    const [name, code, lang, tag, stack, cov, pts] = r;
    const li = el('li', 'row'); li.style.setProperty('--i', i); li.style.setProperty('--lang', LANG[lang]);
    const btn = el('button', 'row-btn'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'd' + i);
    btn.appendChild(el('span', 'pos', String(i + 1).padStart(2, '0')));
    btn.appendChild(el('span', 'bar'));
    const nm = el('span', 'rname'); nm.appendChild(el('b', null, name)); nm.appendChild(el('span', null, tag)); btn.appendChild(nm);
    btn.appendChild(el('span', 'code', code + ' · ' + lang));
    btn.appendChild(el('span', 'fig' + (i === 0 ? ' best' : ''), cov));
    btn.appendChild(el('span', 'chev'));
    const d = el('div', 'detail'); d.id = 'd' + i; const w = el('div'); const inr = el('div', 'detail-in');
    const left = el('div'); left.appendChild(el('p', null, stack)); const ul = el('ul'); pts.forEach((p) => ul.appendChild(el('li', null, p))); left.appendChild(ul);
    const a = el('a', 'btn ghost', 'Open repo ↗'); a.href = 'https://github.com/Darshan-05032003/' + (REPO_URL[name] || name); a.target = '_blank'; a.rel = 'noopener noreferrer';
    inr.appendChild(left); inr.appendChild(a); w.appendChild(inr); d.appendChild(w);
    btn.addEventListener('click', () => { const open = li.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open)); });
    li.appendChild(btn); li.appendChild(d); root.appendChild(li);
  });
})();

/* ---------------- copy mail ---------------- */
$('copy-mail').addEventListener('click', async () => { const o = $('copied'); try { await navigator.clipboard.writeText('sonawanedarshan35@gmail.com'); o.textContent = 'Copied'; } catch (e) { o.textContent = 'Select and copy the address above'; } setTimeout(() => { o.textContent = ''; }, 2400); });

/* ---------------- labs ---------------- */
initLabs({ reduce, setStatus: (id, text, cls) => { const n = $(id); n.textContent = text; n.className = cls || ''; } });

/* ---------------- 3D scroll cinema ---------------- */
const tier = deviceTier();
document.body.dataset.tier = tier;
progress(0.4);
if (tier === 'none') { loaderDone(); }
else {
  const canvas = $('stage');
  let S;
  try { S = createScene(canvas, { tier, road }); } catch (e) { document.body.dataset.tier = 'none'; loaderDone(); throw e; }
  progress(0.75);
  const sections = ['top', 'statement', 'work', 'labs', 'about', 'contact'].map((id) => $(id));
  // shot list (brief: reveal → silhouette → cockpit → rear/DRS → detail → exit); car-relative positions
  const SHOTS = [
    { pos: [11.6, 1.25, 8.6], look: [0.3, 0.5, 0], fov: 27, shift: [0.27, 0.04] },   // 3/4 front, parked right of the name
    { pos: [1.5, 1.3, 12.0], look: [0, 0.45, 0], fov: 26, shift: [0.22, -0.08] },     // side silhouette, low under the statement
    { pos: [-1.2, 2.2, 5.6], look: [-0.4, 0.7, 0], fov: 32, shift: [0.34, 0] },    // cockpit, right of the timing tower
    { pos: [-9.0, 1.8, 6.4], look: [-1.6, 0.6, 0], fov: 30, shift: [0.3, -0.3] },  // rear 3/4, DRS open, low right under the labs
    { pos: [2.5, 9.5, 4.0], look: [0, 0.3, 0], fov: 34, shift: [0.1, -0.34] },     // high detail, low under the kit
    { pos: [12.5, 1.2, 9.5], look: [2.0, 0.4, 0], fov: 28, shift: [-0.2, -0.1] }   // car leaves, bottom left
  ];
  const mobile = window.innerWidth < 1000;
  if (mobile) SHOTS.forEach((s, i) => { if (i === 0) { s.pos = [13.2, 1.45, 8.2]; s.fov = 44; s.shift = [-0.02, 0.2]; return; } s.pos = [s.pos[0] * 1.3, s.pos[1] * 1.15, s.pos[2] * 1.3]; s.shift = [0, -0.24]; });  // opening shot stays inside the pit wall
  let path, bounds = [];
  function measure() {
    const max = document.documentElement.scrollHeight - innerHeight;
    bounds = sections.map((s) => M.clamp((s.getBoundingClientRect().top + scrollY - innerHeight * 0.35) / Math.max(1, max), 0, 1));
    bounds[0] = 0;
    const kf = SHOTS.map((s, i) => Object.assign({ at: bounds[i] }, s));
    // holds: stay on each shot for 60% of the way to the next section
    for (let i = 0; i < kf.length - 1; i++) kf[i].hold = (kf[i + 1].at - kf[i].at) * 0.6;
    kf[kf.length - 1].at = 1; kf[kf.length - 1].hold = 0;
    for (let i = 1; i < kf.length; i++) if (kf[i].at <= kf[i - 1].at + kf[i - 1].hold) kf[i].at = kf[i - 1].at + kf[i - 1].hold + 0.001;
    path = C.path(kf);
  }
  measure();
  let mq = false;
  new ResizeObserver(() => { if (mq) return; mq = true; requestAnimationFrame(() => { mq = false; S.resize(); measure(); dirty = true; }); }).observe(document.body);

  // pointer parallax (desktop only)
  let px = 0, py = 0, tx = 0, ty = 0;
  if (!coarse) addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5); ty = (e.clientY / innerHeight - 0.5); }, { passive: true });

  let prog = M.scrollProgress(scrollY, document.documentElement.scrollHeight, innerHeight), lastY = scrollY, lastT = performance.now(), vel = 0, dirty = true;
  const drive = D.create();
  window.__drive = drive; window.__S = S; window.__road = road;
  const hud = initHud();
  const cam = S.camera;
  /* scroll → corners. A new scroll gesture asks the road for a corner just ahead (down = right-hander,
     up = left-hander, faster scroll = tighter radius); keep scrolling and the corners chain into esses. */
  let idleFor = 9, sinceTurn = 9, lastDir = 1, camH = road.sample(0).h;
  function steerFromScroll(dt, v) {
    const a = Math.abs(v);
    idleFor = a < 90 ? idleFor + dt : 0; sinceTurn += dt;
    if (reduce || a < 150) return;
    const fresh = idleFor === 0 && sinceTurn > 0.6 && !road.busy();
    const chain = sinceTurn > 1.4 && !road.busy();
    if (!fresh && !chain) return;
    const dir = fresh ? (v > 0 ? -1 : 1) : -lastDir;
    if (road.requestTurn(dir, M.clamp(115 - a / 40, 50, 115))) { lastDir = dir; sinceTurn = 0; }
  }
  function frame(now) {
    const tIn = performance.now();
    const dt = M.clamp((now - lastT) / 1000, 0, 0.1); lastT = now;
    const y = scrollY; const raw = dt > 0 ? (y - lastY) / dt : 0; lastY = y;
    vel = M.damp(vel, raw, 6, dt);
    const target = M.scrollProgress(y, document.documentElement.scrollHeight, innerHeight);
    prog = reduce ? target : M.damp(prog, target, 5, dt);
    px = M.damp(px, tx, 4, dt); py = M.damp(py, ty, 4, dt);
    // the car is always running: scroll adds throttle and asks for corners; the road decides braking
    steerFromScroll(dt, raw);
    road.update(dt);
    const here = road.sample(road.s);
    drive.step(dt, reduce ? 0 : vel, { k: here.k, kAhead: road.curvatureAhead(0, drive.speed * 1.8) });
    if (!reduce) road.advance(drive.speed * dt);
    const shake = reduce ? [0, 0] : S.update(dt, drive);
    // chase camera: lags the car's heading, so in a corner you see the car rotate against the frame
    const carH = road.sample(road.s).h;
    camH = M.damp(camH, carH, 1.8, dt);
    const dh = camH - carH, ch = Math.cos(dh), sh = Math.sin(dh);
    const rot = (p) => [p[0] * ch + p[2] * sh, p[1], -p[0] * sh + p[2] * ch];
    hud(drive, now);
    const s = path.sample(prog);
    const cp = rot(s.pos), cl = rot(s.look);
    cam.position.set(cp[0] + px * 0.6 + shake[0], cp[1] - py * 0.3 + shake[1], cp[2]);
    cam.lookAt(cl[0], cl[1], cl[2]);
    if (Math.abs(cam.fov - s.fov) > 0.01) cam.fov = s.fov;
    const W = canvas.clientWidth || innerWidth, Hh = canvas.clientHeight || innerHeight;
    cam.setViewOffset(W, Hh, -s.shift[0] * W, s.shift[1] * Hh, W, Hh); cam.updateProjectionMatrix();
    const bars = W / Hh > 1.3 && !reduce ? (1 - M.clamp(prog / 0.05, 0, 1)) * 0.085 : 0;
    const t0 = performance.now(); S.render({ time: now / 1000, blur: reduce ? 0 : M.clamp((drive.speed - 18) / 70, 0, 1), bars }); const t1 = performance.now(); dirty = false;
    S.noteFrame(dt * 1000, now);
    if (window.__perf) window.__perf.push([t0 - tIn, t1 - t0, S.renderer.getPixelRatio()]);
    if (!document.hidden && !reduce) requestAnimationFrame(frame);
  }
  // optional real model: model/car.glb next to the page (dropped in by the build); silent fallback to the code car
  const MODEL = 'model/car.glb';
  /* onboard broadcast HUD: speed, gear, shift lights, phase. Text writes throttled to ~15 Hz. */
  function initHud() {
    const root = $('hud'); if (!root) return () => {};
    const spd = $('hud-spd'), gear = $('hud-gear'), phase = $('hud-phase'), lights = [...root.querySelectorAll('.shift i')];
    const LABEL = { push: 'Push', brake: 'Braking', corner: 'Turn in', apex: 'Apex', exit: 'Full throttle' };
    let last = 0, ls = '', lg = '', lp = '', ll = -1;
    root.hidden = false;
    return (d, now) => {
      if (now - last < 66) return; last = now;
      const s = String(Math.round(d.kmh)), g = d.gear ? String(d.gear) : 'N', p = LABEL[d.state] || '';
      if (s !== ls) { spd.textContent = s; ls = s; } if (g !== lg) { gear.textContent = g; lg = g; } if (p !== lp) { phase.textContent = p; lp = p; }
      const n = Math.round(M.clamp((d.rpm - 0.5) / 0.48, 0, 1) * lights.length);
      if (n !== ll) { lights.forEach((l, i) => l.classList.toggle('on', i < n)); ll = n; }
    };
  }
  fetch('model/manifest.json').then((r) => r.ok ? r.json() : null).then((m) => {
    if (!m || !m.car) return null;
    return S.useModel(MODEL, (f) => progress(0.5 + f * 0.4)).then((v) => { window.__vehicle = { procedural: false, wheels: v.wheelCount }; dirty = true; }).catch((e) => { console.warn('model failed, keeping procedural car', e); });
  }).catch(() => null).finally(() => {
    S.render();
    canvas.classList.add('on');
    setTimeout(loaderDone, reduce ? 0 : 350);
    requestAnimationFrame(frame);
    if (reduce) { drive.step(0.016, 0, { k: 0, kAhead: 0 }); S.update(0.016, drive); S.render({ time: 0, blur: 0, bars: 0 }); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduce) { lastT = performance.now(); lastY = scrollY; dirty = true; requestAnimationFrame(frame); } });
}

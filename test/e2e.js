// End-to-end + performance check of the built page in headless Chrome.
// Run: node test/e2e.js   (exit code 1 on any failure)
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert/strict');

let PAGE = '';
const results = [];
const ok = (name) => results.push('ok   ' + name);
const fs = require('fs');

const http = require('http');
const root = path.join(__dirname, '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, res) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
const FONT_DIR = '/tmp/fontpkgs/node_modules';
async function serveFonts(ctx) {
  if (!fs.existsSync(FONT_DIR)) return;
  const css = `@font-face{font-family:'Archivo';font-weight:100 900;font-stretch:62% 125%;src:url(https://fonts.gstatic.com/l/archivo.woff2) format('woff2-variations');}@font-face{font-family:'JetBrains Mono';font-weight:100 800;src:url(https://fonts.gstatic.com/l/jb.woff2) format('woff2-variations');}`;
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', headers: { 'Access-Control-Allow-Origin': '*' }, body: css }));
  await ctx.route('https://fonts.gstatic.com/l/**', (r) => { const f = r.request().url().endsWith('archivo.woff2') ? '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2' : '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'; r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(path.join(FONT_DIR, f)) }); });
}
const LAUNCH = { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
(async () => {
  await new Promise((r) => srv.listen(0, r)); PAGE = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await serveFonts(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  });
  await page.goto(PAGE);

  // --- loader + 3D stage ---
  await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => document.body.dataset.tier !== 'none' && document.getElementById('stage').classList.contains('on')), true);
  assert.ok(await page.evaluate(() => document.querySelector('.name').classList.contains('in')));
  ok('loader finishes, WebGL stage is on, hero reveals');

  // --- timing tower ---
  await page.locator('#work').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#tower .row').count(), 8);
  await page.locator('#tower .row-btn').first().click();
  assert.equal(await page.locator('#tower .row-btn').first().getAttribute('aria-expanded'), 'true');
  assert.match(await page.locator('#tower .row').first().locator('.detail-in a').getAttribute('href'), /github\.com\/Darshan-05032003\/ecommerce-backend$/);
  ok('timing tower renders 8 repos and rows expand');

  // --- lab 1 ---
  const runRace = async (mode) => {
    await page.locator(`#lab-race input[value="${mode}"]`).check({ force: true });
    await page.locator('#race-run').click();
    await page.waitForFunction(() => !document.getElementById('race-run').disabled && document.getElementById('race-verdict').textContent.length > 0, null, { timeout: 15000 });
    return page.evaluate(() => ({ orders: +document.getElementById('race-orders').textContent, stock: +document.getElementById('race-stock').textContent, v: document.getElementById('race-verdict').className }));
  };
  await page.locator('#lab-race').scrollIntoViewIfNeeded();
  const naive = await runRace('naive');
  assert.ok(naive.orders > 5, 'naive mode should oversell, got ' + naive.orders);
  assert.match(naive.v, /bad/);
  await page.screenshot({ path: '/tmp/f1v2e/lab-race-naive.png', clip: await page.locator('#lab-race').boundingBox() });
  const safe = await runRace('safe');
  assert.equal(safe.orders, 5); assert.equal(safe.stock, 0); assert.match(safe.v, /good/);
  await page.screenshot({ path: '/tmp/f1v2e/lab-race-safe.png', clip: await page.locator('#lab-race').boundingBox() });
  ok(`race lab: naive oversold (${naive.orders} orders), conditional UPDATE sold exactly 5`);

  // rapid-fire: hammer the button during a run; only one run may happen
  await page.locator('#race-run').click();
  for (let i = 0; i < 30; i++) await page.locator('#race-run').click({ force: true, timeout: 200 }).catch(() => {});
  await page.waitForFunction(() => !document.getElementById('race-run').disabled, null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => +document.getElementById('race-orders').textContent), 5);
  ok('race lab survives 30 rapid clicks mid-run');

  // --- lab 2 ---
  const pay = async (key) => {
    await page.locator('#pay-key').setChecked(key, { force: true });
    await page.locator('#pay-run').click();
    await page.waitForFunction(() => !document.getElementById('pay-run').disabled && document.getElementById('pay-verdict').textContent.length > 0, null, { timeout: 15000 });
    return page.locator('#pay-charges').textContent();
  };
  await page.locator('#lab-pay').scrollIntoViewIfNeeded();
  assert.equal(await pay(false), '3 charges');
  assert.equal(await pay(true), '1 charge');
  await page.screenshot({ path: '/tmp/f1v2e/lab-pay.png', clip: await page.locator('#lab-pay').boundingBox() });
  ok('payment lab: 3 charges without a key, 1 with');

  // --- lab 3 ---
  await page.locator('#lab-ledger').scrollIntoViewIfNeeded();
  await page.locator('#journal button', { hasText: 'Edit' }).first().click();
  assert.match(await page.locator('#ledger-notice').textContent(), /append-only/);
  await page.locator('[data-op="big"]').click();
  await page.locator('#pending button', { hasText: 'Approve as Asha' }).click();
  assert.match(await page.locator('#ledger-notice').textContent(), /Four-eyes/);
  await page.locator('#pending button', { hasText: 'Approve as Checker' }).click();
  await page.locator('[data-op="bad"]').click();
  assert.match(await page.locator('#ledger-notice').textContent(), /unbalanced/);
  assert.equal(await page.locator('#tb-stamp').textContent(), 'Balanced');
  assert.equal(await page.locator('#tb-d').textContent(), await page.locator('#tb-c').textContent());
  ok('ledger lab: edit refused, four-eyes enforced, unbalanced journal refused, books balanced');

  // --- CSP + errors ---
  const csp = await page.evaluate(() => window.__csp);
  assert.deepEqual(csp.filter((v) => !/fonts\.g/.test(v)), [], 'CSP violations: ' + csp.join(', '));
  ok('no CSP violations from the page itself');

  // --- smoothness: scroll the whole page with wheel input and record frame times ---
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__frames = []; window.__long = [];
    let last = performance.now();
    (function f(t) { window.__frames.push(t - last); last = t; if (window.__frames.length < 100000) requestAnimationFrame(f); })(last);
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: false }); } catch (e) {}
  });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 120) { await page.mouse.wheel(0, 120); await page.waitForTimeout(16); }
  await page.waitForTimeout(400);
  const perf = await page.evaluate(() => {
    const f = window.__frames.slice(2).sort((a, b) => a - b);
    const pct = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))];
    return { frames: f.length, p50: pct(0.5), p95: pct(0.95), over33: f.filter((x) => x > 33.4).length, longTasks: window.__long.length, longest: Math.max(0, ...window.__long) };
  });
  results.push(`perf frames=${perf.frames} p50=${perf.p50.toFixed(1)}ms p95=${perf.p95.toFixed(1)}ms frames>33ms=${perf.over33} longtasks=${perf.longTasks} longest=${perf.longest.toFixed(0)}ms`);
  ok('scroll cinema loop ran across the whole page');

  // --- full-page and section screenshots, desktop ---
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/f1v2e/desktop-hero.png' });
  for (const id of ['work', 'about', 'contact']) {
    await page.locator('#' + id).scrollIntoViewIfNeeded(); await page.waitForTimeout(1600);
    await page.screenshot({ path: `/tmp/f1v2e/desktop-${id}.png` });
  }

  // --- mobile ---
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto(PAGE);
  await serveFonts(m);
  await mp.waitForTimeout(1500);
  await mp.screenshot({ path: '/tmp/f1v2e/mobile-hero.png' });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, 'horizontal overflow on mobile: ' + overflow + 'px');
  for (const id of ['work', 'lab-race', 'lab-ledger', 'contact']) {
    await mp.locator('#' + id).scrollIntoViewIfNeeded(); await mp.waitForTimeout(1500);
    await mp.screenshot({ path: `/tmp/f1v2e/mobile-${id}.png` });
  }
  ok('mobile: no horizontal overflow');

  // --- no-WebGL fallback: poster shows, labs still work ---
  const nw = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const np = await nw.newPage(); np.on('pageerror', (e) => errors.push('nowebgl: ' + e.message));
  await np.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/.test(t) ? null : g.call(this, t, ...r); }; });
  await np.goto(PAGE); await np.waitForTimeout(800);
  assert.equal(await np.evaluate(() => document.body.dataset.tier), 'none');
  assert.equal(await np.evaluate(() => getComputedStyle(document.getElementById('poster')).display), 'block');
  assert.equal(await np.evaluate(() => document.getElementById('loader').classList.contains('done')), true);
  await np.locator('#pay-run').click(); await np.waitForFunction(() => !document.getElementById('pay-run').disabled && document.getElementById('pay-verdict').textContent.length > 0, null, { timeout: 15000 });
  ok('no-WebGL fallback: poster shown, page unlocked, labs still run');
  await nw.close();

  assert.deepEqual(errors, [], errors.join('\n'));
  ok('no page errors');
  await browser.close(); srv.close();
  console.log(results.join('\n'));
})().catch((e) => { console.log(results.join('\n')); console.error('FAIL', e.message); process.exit(1); });

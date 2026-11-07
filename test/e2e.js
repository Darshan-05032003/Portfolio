// End-to-end + performance check of the built page in headless Chrome.
// Run: node test/e2e.js   (exit code 1 on any failure)
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert/strict');

const PAGE = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
const results = [];
const fs = require('fs');

// Serve the real Google Fonts from local @fontsource packages (the sandbox has no route to Google),
// so screenshots show true type metrics. Skipped when the packages are absent.
const FONT_DIR = '/tmp/fontpkgs/node_modules/@fontsource';
const FONTS = [
  ['Barlow Condensed', 'barlow-condensed', [600, 700, 800], ['normal', 'italic']],
  ['Barlow', 'barlow', [400, 500, 600], ['normal']],
  ['JetBrains Mono', 'jetbrains-mono', [400, 600, 700], ['normal']]
];
async function serveFonts(ctx) {
  if (!fs.existsSync(FONT_DIR)) return;
  let css = '';
  for (const [fam, pkg, weights, styles] of FONTS) for (const w of weights) for (const st of styles) {
    css += `@font-face{font-family:'${fam}';font-style:${st};font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/local/${pkg}/${pkg}-latin-${w}-${st}.woff2) format('woff2');}\n`;
  }
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', headers: { 'Access-Control-Allow-Origin': '*' }, body: css }));
  await ctx.route('https://fonts.gstatic.com/local/**', (r) => {
    const parts = new URL(r.request().url()).pathname.split('/');
    const file = path.join(FONT_DIR, parts[2], 'files', parts[3]);
    r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(file) });
  });
}
const ok = (name) => results.push('ok   ' + name);

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
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

  // --- intro lights ---
  await page.waitForSelector('#lights:not([hidden])', { timeout: 3000 });
  await page.waitForFunction(() => document.getElementById('lights').hidden === true, null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => document.body.classList.contains('locked')), false);
  assert.ok(await page.evaluate(() => document.querySelector('.title').classList.contains('in')));
  ok('start lights run, release the page and reveal the hero');

  // --- timing tower ---
  await page.locator('#grid').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#tower .row').count(), 9);
  await page.locator('#tower .row-btn').first().click();
  assert.equal(await page.locator('#tower .row-btn').first().getAttribute('aria-expanded'), 'true');
  ok('timing tower renders 9 repos and rows expand');

  // --- lab 1 ---
  const runRace = async (mode) => {
    await page.locator(`#race-mode input[value="${mode}"]`).check({ force: true });
    await page.locator('#race-run').click();
    await page.waitForFunction(() => !document.getElementById('race-run').disabled && document.getElementById('race-verdict').textContent.length > 0, null, { timeout: 15000 });
    return page.evaluate(() => ({ orders: +document.getElementById('race-orders').textContent, stock: +document.getElementById('race-stock').textContent, v: document.getElementById('race-verdict').className }));
  };
  await page.locator('#lab-race').scrollIntoViewIfNeeded();
  const naive = await runRace('naive');
  assert.ok(naive.orders > 5, 'naive mode should oversell, got ' + naive.orders);
  assert.match(naive.v, /bad/);
  await page.screenshot({ path: '/tmp/f1shots/lab-race-naive.png', clip: await page.locator('#lab-race').boundingBox() });
  const safe = await runRace('safe');
  assert.equal(safe.orders, 5); assert.equal(safe.stock, 0); assert.match(safe.v, /good/);
  await page.screenshot({ path: '/tmp/f1shots/lab-race-safe.png', clip: await page.locator('#lab-race').boundingBox() });
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
  await page.screenshot({ path: '/tmp/f1shots/lab-pay.png', clip: await page.locator('#lab-pay').boundingBox() });
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

  // --- lab 4 ---
  await page.locator('#lab-geo').scrollIntoViewIfNeeded();
  await page.locator('#geo-dot').focus();
  for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelectorAll('#geo-screen .notif').length === 1, null, { timeout: 6000 });
  assert.equal(await page.locator('#geo-status').textContent(), 'Track limits exceeded');
  for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#geo-screen .notif').count(), 1, 'second exit inside the cooldown must not push');
  await page.screenshot({ path: '/tmp/f1shots/lab-geo.png', clip: await page.locator('#lab-geo').boundingBox() });
  ok('geofence lab: exit pushes once, cooldown swallows the repeat');

  // --- reaction test ---
  await page.locator('#react').scrollIntoViewIfNeeded();
  await page.locator('#react-start').click();
  await page.locator('#react-pad').click();
  assert.equal(await page.locator('#react-out').textContent(), 'Jump start');
  ok('reaction test detects a jump start');

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
  const mapShown = await page.evaluate(() => document.getElementById('trackmap').classList.contains('show'));
  assert.ok(mapShown, 'track map should be visible after scrolling');
  ok('scroll telemetry loop ran across the whole page');

  // --- full-page and section screenshots, desktop ---
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/f1shots/desktop-hero.png' });
  for (const id of ['grid', 'pace', 'pitwall']) {
    await page.locator('#' + id).scrollIntoViewIfNeeded(); await page.waitForTimeout(1600);
    await page.screenshot({ path: `/tmp/f1shots/desktop-${id}.png` });
  }

  // --- mobile ---
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await serveFonts(m);
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto(PAGE);
  await mp.locator('#lights-skip').click();
  await mp.waitForTimeout(1500);
  await mp.screenshot({ path: '/tmp/f1shots/mobile-hero.png' });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, 'horizontal overflow on mobile: ' + overflow + 'px');
  for (const id of ['grid', 'lab-race', 'lab-ledger', 'pitwall']) {
    await mp.locator('#' + id).scrollIntoViewIfNeeded(); await mp.waitForTimeout(1500);
    await mp.screenshot({ path: `/tmp/f1shots/mobile-${id}.png` });
  }
  ok('mobile: no horizontal overflow');

  assert.deepEqual(errors, [], errors.join('\n'));
  ok('no page errors');
  await browser.close();
  console.log(results.join('\n'));
})().catch((e) => { console.log(results.join('\n')); console.error('FAIL', e.message); process.exit(1); });

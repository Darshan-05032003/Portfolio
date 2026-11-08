// Serves dist/ over http and takes screenshots at given scroll positions (desktop + mobile).
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..', 'dist');
const FONT_DIR = '/tmp/fontpkgs/node_modules';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const srv = http.createServer((q, res) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); fs.readFile(p.endsWith('/') ? p + 'index.html' : p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
async function fonts(ctx) {
  const css = `@font-face{font-family:'Archivo';font-weight:100 900;font-stretch:62% 125%;src:url(https://fonts.gstatic.com/l/archivo.woff2) format('woff2-variations');}
@font-face{font-family:'JetBrains Mono';font-weight:100 800;src:url(https://fonts.gstatic.com/l/jb.woff2) format('woff2-variations');}`;
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', headers: { 'Access-Control-Allow-Origin': '*' }, body: css }));
  await ctx.route('https://fonts.gstatic.com/l/**', (r) => { const f = r.request().url().endsWith('archivo.woff2') ? '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2' : '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'; r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(path.join(FONT_DIR, f)) }); });
}
(async () => {
  await new Promise((r) => srv.listen(0, r)); const port = srv.address().port;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    await fonts(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForTimeout(2500);
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    const stops = mobile ? [0, 0.42, 0.62] : [0, 0.2, 0.36, 0.52, 0.66, 0.86, 1];
    for (const s of stops) {
      await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), (H - h) * s);
      await p.waitForTimeout(1400);
      await p.screenshot({ path: `/tmp/f1v2/${name}-${Math.round(s * 100)}.png` });
    }
    await ctx.close();
  }
  if (errs.length) console.log('ERRORS\n' + errs.join('\n'));
  await b.close(); srv.close();
})();

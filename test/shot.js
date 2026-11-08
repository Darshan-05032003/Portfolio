// node test/shot.js <page-path> <out.png> [w] [h]  — serves the repo over http and screenshots with WebGL (SwiftShader)
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, res) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
(async () => {
  await new Promise((r) => srv.listen(0, r)); const port = srv.address().port;
  const [page, out, w = 1280, h = 800] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:${port}/${page}`);
  await p.waitForFunction(() => window.__done === true, null, { timeout: 60000 }).catch(() => errs.push('timeout waiting for __done'));
  await p.screenshot({ path: out });
  const tris = await p.evaluate(() => window.__tris); if (tris) console.log('triangles', tris);
  if (errs.length) { console.log('ERRORS', errs.join('\n')); }
  await b.close(); srv.close();
})();

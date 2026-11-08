// Screenshots of the launch sequence: grid → turn-in → launch → drive (desktop), printing the drive state.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const srv = http.createServer((q, res) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
(async () => {
  await new Promise((r) => srv.listen(0, r)); const port = srv.address().port;
  const [w = 1440, h = 900, out = '/tmp/launch'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts/.test(m.text())) errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForTimeout(4000);
  const state = () => p.evaluate(() => { const t = document.getElementById('hud-phase'); return (t && t.textContent) + ' | ' + (document.getElementById('hud-spd') || {}).textContent + ' km/h'; });
  await p.screenshot({ path: out + '/0-grid.png' }); console.log('grid:', await state());
  await p.mouse.move(700, 450);
  const shots = [[350, '1-turn'], [1300, '2-launch'], [3200, '3-drive']];
  const t0 = Date.now(); let k = 0;
  while (k < shots.length) {
    await p.mouse.wheel(0, 60); await p.waitForTimeout(40);
    if (Date.now() - t0 > shots[k][0]) { await p.screenshot({ path: `${out}/${shots[k][1]}.png` }); console.log(shots[k][1] + ':', await state()); k++; }
  }
  if (errs.length) console.log('ERRORS\n' + errs.join('\n'));
  await b.close(); srv.close();
})();

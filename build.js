// Assemble dist/: the page, its modules, the vendored Three.js, and a strict CSP.
//   dist/index.html carries the CSP meta (GitHub Pages); dist/artifact.html is the same page without it.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src'), dist = path.join(__dirname, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'vendor'), { recursive: true });
for (const f of ["style.css", "app.js", "labs.js", "scene.js", "car.js", "cinema.js", "motion.js", "sim.js", "drive.js", "track.js", "fx.js", "vehicle.js"]) fs.copyFileSync(path.join(src, f), path.join(dist, f));
for (const f of ['three.module.min.js', 'GLTFLoader.js', 'DRACOLoader.js', 'BufferGeometryUtils.js', 'meshopt_decoder.module.js']) fs.copyFileSync(path.join(__dirname, 'vendor', f), path.join(dist, 'vendor', f));
fs.mkdirSync(path.join(dist, 'vendor', 'draco'), { recursive: true });
for (const f of fs.readdirSync(path.join(__dirname, 'vendor', 'draco'))) fs.copyFileSync(path.join(__dirname, 'vendor', 'draco', f), path.join(dist, 'vendor', 'draco', f));
const hasModel = fs.existsSync(path.join(__dirname, 'model', 'car.glb'));
fs.mkdirSync(path.join(dist, 'model'), { recursive: true }); fs.writeFileSync(path.join(dist, 'model', 'manifest.json'), JSON.stringify({ car: hasModel ? 'car.glb' : null }));
if (hasModel) { fs.mkdirSync(path.join(dist, 'model'), { recursive: true }); fs.copyFileSync(path.join(__dirname, 'model', 'car.glb'), path.join(dist, 'model', 'car.glb')); if (fs.existsSync(path.join(__dirname, 'model', 'LICENSE.txt'))) fs.copyFileSync(path.join(__dirname, 'model', 'LICENSE.txt'), path.join(dist, 'model', 'LICENSE.txt')); }
// modules import '../vendor/...' relative to src/; in dist they sit beside vendor/
for (const f of ['scene.js', 'car.js', 'track.js', 'fx.js', 'vehicle.js']) { const p = path.join(dist, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/'\.\.\/vendor\//g, "'./vendor/")); }
const csp = ["default-src 'none'", "script-src 'self' 'wasm-unsafe-eval'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com', 'img-src data: blob:', "connect-src 'self'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"].join('; ');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
fs.writeFileSync(path.join(dist, 'index.html'), html.replace('<meta name="viewport"', '<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n<meta name="viewport"'));
fs.writeFileSync(path.join(dist, 'artifact.html'), html);
fs.copyFileSync(path.join(__dirname, 'docs-headers'), path.join(dist, '_headers'));
let total = 0; for (const f of fs.readdirSync(dist)) { const p = path.join(dist, f); if (fs.statSync(p).isFile()) total += fs.statSync(p).size; }
console.log('dist/ written,', (total / 1024).toFixed(0), 'KB + three.js', (fs.statSync(path.join(dist, 'vendor', 'three.module.min.js')).size / 1024).toFixed(0), 'KB');

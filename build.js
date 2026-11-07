// Inline CSS and JS into one self-contained page and pin the inline scripts with a CSP.
//   dist/index.html    -> GitHub Pages (strict Content-Security-Policy with script hashes)
//   dist/artifact.html -> same page without the CSP meta, for hosts that inject their own runtime
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
let html = src('index.html');
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + src('style.css') + '\n</style>');
const scripts = ['motion.js', 'sim.js', 'app.js'].map(src);
html = html.replace('<script src="motion.js"></script>\n<script src="sim.js"></script>\n<script src="app.js"></script>',
  () => scripts.map((s) => '<script>' + s + '</script>').join('\n'));
if (/href="style\.css"|src="(motion|sim|app)\.js"/.test(html)) throw new Error('inlining failed');
const hashes = scripts.map((s) => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'");
const csp = [
  "default-src 'none'",
  'script-src ' + hashes.join(' '),
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  'img-src data:',
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html.replace('<!--CSP-->', '<meta http-equiv="Content-Security-Policy" content="' + csp + '">'));
fs.writeFileSync(path.join(__dirname, 'dist', 'artifact.html'), html.replace('<!--CSP-->\n', ''));
console.log('dist/index.html', (html.length / 1024).toFixed(1), 'KB,', hashes.length, 'script hashes pinned');

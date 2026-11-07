// Inline CSS + JS into a single self-contained dist/index.html.
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
let html = src('index.html');
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + src('style.css') + '\n</style>');
html = html.replace('<script src="sim.js"></script>\n<script src="app.js"></script>', '<script>\n' + src('sim.js') + '\n</script>\n<script>\n' + src('app.js') + '\n</script>');
if (html.includes('href="style.css"') || html.includes('src="sim.js"')) throw new Error('inline failed');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(1), 'KB');

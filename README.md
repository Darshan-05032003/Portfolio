# Portfolio

**Live:** https://darshan-05032003.github.io/Portfolio/

A scroll-cinema portfolio: a procedural Formula car (4.3k triangles, built from primitives in `src/car.js`) sits in a fixed Three.js stage while the page scrolls over it. One 0–1 scroll value drives a camera shot list (reveal → silhouette → cockpit → rear/DRS → detail → exit), the wheels, and the text reveals. Four race-control labs let a visitor break an oversell race, a retried payment, an append-only ledger and a geofence.

Design decisions come from a 120-site study (54 award-winning portfolios, 35 motorsport/automotive sites, 31 3D scroll sites): one typeface with a width axis (Archivo expanded ↔ condensed, the F1 Torque/Turbo pairing), weights 400–500 only, graphite ladder plus one accent, hairlines instead of glows, one easing and one duration scale, transform/opacity only.

| Path | What it is |
|---|---|
| `src/car.js` | Procedural car: lofted monocoque, sidepods, wings with DRS flap, wheels; contact shadow |
| `src/scene.js` | Renderer, lights, procedural studio cubemap for reflections, adaptive pixel ratio, device tiers |
| `src/cinema.js` | Scroll → camera keyframe path with holds and per-shot screen offsets (pure math) |
| `src/motion.js` | Frame-rate-independent smoothing, easing, lab layout (pure math) |
| `src/sim.js` | Lab simulation engines (pure logic) |
| `src/app.js`, `src/labs.js` | DOM wiring: one rAF loop, render on demand, labs |
| `test/*.test.js` | 45 unit tests, written before the code, incl. 100k-sample and 10k-run stress tests |
| `test/e2e.js` | Headless Chrome: plays every lab, checks CSP, no-WebGL poster fallback, mobile overflow, frame times |
| `docs/` | Built site served by GitHub Pages (Settings → Pages → `main`, `/docs`) |

```bash
npm test        # unit tests
npm run build   # src/ + vendor/ → dist/ → docs/
npm run e2e     # needs Playwright + Chrome
```

Three.js (r170) is vendored in `vendor/` so the page has no CDN dependency. Content-Security-Policy: `script-src 'self'`, no inline scripts, no connections.

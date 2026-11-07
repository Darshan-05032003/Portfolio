# Portfolio — race weekend edition

**Live:** https://darshan-05032003.github.io/Portfolio/

One self-contained HTML page, no framework, no tracking. Start lights on arrival, a scroll-driven cockpit (speed, gear, shift lights) and track map, a timing tower of my repositories, and four race-control labs you can break live: an oversell race, a payment retried twice, an append-only ledger, and a geofence.

| Path | What it is |
|---|---|
| `src/motion.js` | Pure animation math: frame-rate-independent smoothing, easing, scroll-to-speed telemetry, start-light schedule, race-lab layout |
| `src/sim.js` | Pure simulation engines behind the labs |
| `src/app.js` | DOM wiring: one `requestAnimationFrame` loop, transform/opacity-only animation, Web Animations API |
| `test/*.test.js` | 36 unit tests, written before the code, including 10,000-run stress tests |
| `test/e2e.js` | Headless Chrome: plays every lab, asserts outcomes, checks CSP violations, measures frame times while scrolling, checks mobile overflow |
| `build.js` | Inlines everything into one file and pins the inline scripts with a SHA-256 Content-Security-Policy |
| `docs/index.html` | The built page, served by GitHub Pages (Settings → Pages → `main`, `/docs`) |

```bash
npm test        # unit tests
npm run build   # src/ → dist/index.html → docs/index.html
npm run e2e     # needs Playwright + Chrome
```

Motion rules: only `transform` and `opacity` animate; scroll-linked values are smoothed with `1 - e^(-λ·dt)` so they feel identical at 60, 120 or 144 Hz; the loop pauses in background tabs; `prefers-reduced-motion` turns animation off.

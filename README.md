# Portfolio

A single HTML file, no framework, no tracking. The interactive "labs" (an oversell race, idempotent payments, a double-entry ledger and a geofence) are driven by small simulation engines in `src/sim.js`, which are covered by unit tests written before the code.

| | |
|---|---|
| `src/` | `index.html`, `style.css`, `sim.js` (simulation engines), `app.js` (DOM wiring) |
| `test/sim.test.js` | Unit tests for every lab: safe mode never oversells across 300 seeds, idempotency keys never double-charge, unbalanced journals are refused, cooldown swallows repeat exits |
| `build.js` | Inlines CSS and JS into one self-contained `dist/index.html` |
| `docs/index.html` | The built page, served by GitHub Pages |

```bash
npm test          # node --test test/sim.test.js
npm run build     # dist/index.html → docs/index.html
```

docs/index.html is the built page served by GitHub Pages (Settings → Pages → main, /docs). Run `npm run build` after editing `src/` and commit the result.

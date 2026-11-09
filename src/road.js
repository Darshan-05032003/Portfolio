/* Endless racing line generated around the car. Arc-length samples every STEP metres from BEHIND
   metres back to AHEAD metres forward. Straight by default; requestTurn() plans a real corner
   (clothoid entry → constant-radius arc → clothoid exit) starting just beyond LOCK metres ahead, so the
   road under the car never changes. A re-planned road blends in over MORPH seconds instead of snapping.
   Heading h: direction (cos h, 0, -sin h); positive h turns toward -Z. Pure math, no Three.js.
   Browser: window.Road. Node: module.exports. */
(function (root) {
  'use strict';
  const STEP = 2, AHEAD = 200, BEHIND = 70, LOCK = 26, ENTRY = 30, EXIT = 30, MORPH = 0.4;
  const MIN_RADIUS = 45, MAX_RADIUS = 260, QUEUE = 140;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  function create() {
    let carS = 0;
    let pts = [{ s: -BEHIND - STEP, x: -BEHIND - STEP, z: 0, h: 0, k: 0 }];
    let old = null, morph = 1, pieces = [], cache = null;

    function kAt(s) {
      for (const p of pieces) if (s >= p.s0 && s <= p.s1) return p.k0 + (p.k1 - p.k0) * ((s - p.s0) / (p.s1 - p.s0));
      return 0;
    }
    function extend() {
      let last = pts[pts.length - 1];
      while (last.s < carS + AHEAD) {
        const km = kAt(last.s + STEP / 2), hc = last.h + km * STEP / 2;
        const n = { s: last.s + STEP, x: last.x + Math.cos(hc) * STEP, z: last.z - Math.sin(hc) * STEP, h: last.h + km * STEP, k: 0 };
        n.k = kAt(n.s); pts.push(n); last = n;
      }
    }
    function trim() {
      while (pts.length > 2 && pts[1].s < carS - BEHIND) pts.shift();
      if (old) while (old.length && old[0].s < pts[0].s) old.shift();
      pieces = pieces.filter((p) => p.s1 >= carS - BEHIND);
    }
    function blended() {
      if (cache) return cache;
      const e = smooth(morph);
      if (!old || e >= 1) { cache = pts; return cache; }
      const byS = new Map(old.map((p) => [Math.round(p.s / STEP), p]));
      cache = pts.map((p) => {
        const o = byS.get(Math.round(p.s / STEP));
        return o ? { s: p.s, x: o.x + (p.x - o.x) * e, z: o.z + (p.z - o.z) * e, h: o.h + (p.h - o.h) * e, k: p.k } : p;
      });
      return cache;
    }
    extend();

    const r = {
      get s() { return carS; },
      AHEAD, BEHIND, STEP,
      advance(ds) {
        if (!Number.isFinite(ds) || ds <= 0) return;
        carS += ds; extend(); trim(); cache = null;
      },
      update(dt) {
        if (!Number.isFinite(dt) || dt <= 0 || morph >= 1) return;
        morph = Math.min(1, morph + dt / MORPH); cache = null;
        if (morph >= 1) old = null;
      },
      busy() { return pieces.some((p) => p.s1 > carS); },
      requestTurn(dir, radius) {
        if (!Number.isFinite(dir) || !dir || !Number.isFinite(radius)) return false;
        const R = clamp(radius, MIN_RADIUS, MAX_RADIUS), k = Math.sign(dir) / R;
        const lastEnd = pieces.length ? Math.max(...pieces.map((p) => p.s1)) : -Infinity;
        const start = Math.ceil(Math.max(carS + LOCK, lastEnd + 12) / STEP) * STEP;
        if (start > carS + LOCK + QUEUE) return false;
        const arc = clamp(R * 0.6, 30, 70);
        pieces.push({ s0: start, s1: start + ENTRY, k0: 0, k1: k }, { s0: start + ENTRY, s1: start + ENTRY + arc, k0: k, k1: k },
          { s0: start + ENTRY + arc, s1: start + ENTRY + arc + EXIT, k0: k, k1: 0 });
        old = blended().map((p) => ({ ...p }));        // what's on screen now, to blend from
        pts = pts.filter((p) => p.s <= start);
        extend(); morph = 0; cache = null;
        return true;
      },
      points() { return blended(); },
      sample(s) {
        const P = blended();
        if (!Number.isFinite(s)) s = carS;
        const f = clamp((s - P[0].s) / STEP, 0, P.length - 1.000001), i = Math.floor(f), t = f - i;
        const a = P[i], b = P[Math.min(P.length - 1, i + 1)];
        return { s, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, h: a.h + (b.h - a.h) * t, k: a.k + (b.k - a.k) * t };
      },
      curvatureAhead(d0, d1) {
        let m = 0;
        for (const p of pts) if (p.s >= carS + d0 && p.s <= carS + d1) m = Math.max(m, Math.abs(p.k));
        return m;
      }
    };
    return r;
  }
  const api = { create, STEP, AHEAD, BEHIND, LOCK, ENTRY, EXIT, MORPH, MIN_RADIUS, MAX_RADIUS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Road = api;
})(typeof window !== 'undefined' ? window : this);

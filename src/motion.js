/* Pure math behind the portfolio's animations: smoothing, easing, scroll telemetry,
   start lights and the race-lab layout. No DOM. Browser: window.Motion. Node: module.exports. */
(function (root) {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Exponential smoothing that gives the same curve at any frame rate.
  function damp(current, target, lambda, dt) {
    return lerp(current, target, 1 - Math.exp(-lambda * dt));
  }

  const ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outQuint: (t) => 1 - Math.pow(1 - t, 5)
  };

  function scrollProgress(scrollY, scrollHeight, innerHeight) {
    const max = scrollHeight - innerHeight;
    if (max <= 0) return 0;
    return clamp(scrollY / max, 0, 1);
  }

  function sectorAt(progress, boundaries) {
    let idx = 0;
    for (let i = 0; i < boundaries.length; i++) if (progress >= boundaries[i]) idx = i;
    return idx;
  }

  // ---- scroll speed as car telemetry ----
  const TOP_SPEED = 340;
  const GEARS = [0, 70, 110, 150, 190, 230, 270, 305]; // speed where gears 1..8 begin

  function speedKmh(pxPerSecond) {
    return TOP_SPEED * (1 - Math.exp(-Math.abs(pxPerSecond) / 2600));
  }
  function gearFor(kmh) {
    let g = 1;
    for (let i = 0; i < GEARS.length; i++) if (kmh >= GEARS[i]) g = i + 1;
    return g;
  }
  function rpmFor(kmh) {
    const g = gearFor(kmh);
    const lo = GEARS[g - 1];
    const hi = g < GEARS.length ? GEARS[g] : TOP_SPEED;
    return 0.35 + 0.65 * clamp((kmh - lo) / (hi - lo), 0, 1);
  }
  function shiftLights(rpmFraction, n) {
    return Math.floor(clamp(rpmFraction, 0, 1) * n);
  }

  // ---- start lights and the reaction test ----
  function lightsSchedule(opts) {
    const { lights, stepMs, minHoldMs, maxHoldMs, rand } = opts;
    const onAt = [];
    for (let i = 1; i <= lights; i++) onAt.push(i * stepMs);
    const hold = minHoldMs + Math.floor(rand() * (maxHoldMs - minHoldMs));
    return { onAt, outAt: onAt[onAt.length - 1] + hold };
  }
  function judgeReaction(clickAt, outAt) {
    if (clickAt < outAt) return { jumpStart: true, ms: 0 };
    return { jumpStart: false, ms: Math.round(clickAt - outAt) };
  }
  const formatReaction = (ms) => (ms / 1000).toFixed(3) + ' s';
  function formatLap(ms) {
    ms = Math.max(0, Math.floor(ms));
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m + ':' + String(s).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
  }

  // ---- race lab: 20 cars on a staggered grid, 5 boxes, 15 overflow slots ----
  function raceLayout(width) {
    const gap = 4, minSep = 12, chipH = 26, rowH = 34;
    const chipW = Math.min(60, (width - minSep - 7 * gap) / 8);
    const colX = (c) => c * (chipW + gap);
    const right = width - (4 * chipW + 3 * gap);
    const grid = [];
    for (let i = 0; i < 20; i++) {
      const r = Math.floor(i / 4), c = i % 4;
      grid.push({ x: colX(c), y: r * rowH + (c % 2) * (rowH / 2) });
    }
    const boxes = [];
    for (let r = 0; r < 5; r++) boxes.push({ x: right, y: r * rowH + 8 });
    const overflow = [];
    for (let k = 0; k < 3; k++) for (let r = 0; r < 5; r++) overflow.push({ x: right + (k + 1) * (chipW + gap), y: r * rowH + 8 });
    return { chipW, chipH, height: 5 * rowH + rowH / 2, grid, boxes, overflow, boxesX: right };
  }

  const api = {
    clamp, lerp, damp, ease, scrollProgress, sectorAt,
    TOP_SPEED, GEARS, speedKmh, gearFor, rpmFor, shiftLights,
    lightsSchedule, judgeReaction, formatReaction, formatLap, raceLayout
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Motion = api;
})(typeof window !== 'undefined' ? window : this);

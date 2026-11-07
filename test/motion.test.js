// Unit tests for motion.js: the pure math behind the F1 portfolio's animations.
// Written before motion.js (TDD). Run: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/motion.js');

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);

// ---------- basics ----------
test('clamp keeps values in range', () => {
  assert.equal(M.clamp(5, 0, 1), 1);
  assert.equal(M.clamp(-5, 0, 1), 0);
  assert.equal(M.clamp(0.4, 0, 1), 0.4);
});
test('lerp interpolates', () => {
  assert.equal(M.lerp(0, 10, 0), 0);
  assert.equal(M.lerp(0, 10, 1), 10);
  assert.equal(M.lerp(2, 4, 0.5), 3);
});

// ---------- frame-rate independent smoothing ----------
test('damp converges to the same value at 30, 60, 120 and 144 fps', () => {
  const run = (fps) => { let v = 0; const dt = 1 / fps; for (let i = 0; i < fps; i++) v = M.damp(v, 100, 6, dt); return v; };
  const ref = run(60);
  for (const fps of [30, 120, 144]) close(run(fps), ref, 1e-9);
});
test('damp never overshoots and handles a zero or huge dt', () => {
  let v = 0;
  for (let i = 0; i < 1000; i++) { v = M.damp(v, 1, 10, 1 / 60); assert.ok(v <= 1); }
  assert.equal(M.damp(3, 9, 5, 0), 3);
  close(M.damp(3, 9, 5, 1e6), 9);
});

// ---------- easing ----------
test('easings start at 0, end at 1 and are monotonic', () => {
  for (const [name, f] of Object.entries(M.ease)) {
    close(f(0), 0, 1e-9); close(f(1), 1, 1e-9);
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) { const y = f(i / 100); assert.ok(y >= prev - 1e-12, name); prev = y; }
  }
});

// ---------- scroll ----------
test('scrollProgress maps scroll to 0..1 and is 0 when the page cannot scroll', () => {
  assert.equal(M.scrollProgress(0, 3000, 1000), 0);
  assert.equal(M.scrollProgress(2000, 3000, 1000), 1);
  assert.equal(M.scrollProgress(1000, 3000, 1000), 0.5);
  assert.equal(M.scrollProgress(500, 800, 1000), 0);
  assert.equal(M.scrollProgress(-50, 3000, 1000), 0);
  assert.equal(M.scrollProgress(99999, 3000, 1000), 1);
});
test('sectorAt finds the section a progress value falls in', () => {
  const b = [0, 0.2, 0.5, 0.8];
  assert.equal(M.sectorAt(0, b), 0);
  assert.equal(M.sectorAt(0.19, b), 0);
  assert.equal(M.sectorAt(0.2, b), 1);
  assert.equal(M.sectorAt(0.79, b), 2);
  assert.equal(M.sectorAt(1, b), 3);
});

// ---------- scroll-speed telemetry ----------
test('speed from scroll velocity starts at 0, rises monotonically and stays under the cap', () => {
  assert.equal(M.speedKmh(0), 0);
  let prev = -1;
  for (let v = 0; v <= 50000; v += 250) { const s = M.speedKmh(v); assert.ok(s >= prev); assert.ok(s < M.TOP_SPEED); prev = s; }
  assert.equal(M.speedKmh(-3000), M.speedKmh(3000), 'scrolling up is as fast as scrolling down');
});
test('gear is 1 at rest, 8 at top speed, and never goes down as speed rises', () => {
  assert.equal(M.gearFor(0), 1);
  assert.equal(M.gearFor(M.TOP_SPEED - 1), 8);
  let prev = 1;
  for (let s = 0; s < M.TOP_SPEED; s += 1) { const gr = M.gearFor(s); assert.ok(gr >= prev && gr <= 8); prev = gr; }
});
test('rpm fraction resets after each upshift and shift lights light up in order', () => {
  assert.ok(M.rpmFor(0) >= 0.3);
  for (const s of [0, 50, 100, 150, 200, 250, 300]) { const r = M.rpmFor(s); assert.ok(r >= 0 && r <= 1, `rpm ${r} at ${s}`); }
  assert.ok(M.rpmFor(M.GEARS[2] - 0.1) > M.rpmFor(M.GEARS[2] + 0.1), 'rpm drops after an upshift');
  assert.equal(M.shiftLights(0, 15), 0);
  assert.equal(M.shiftLights(1, 15), 15);
  assert.equal(M.shiftLights(0.5, 15), 7);
  assert.equal(M.shiftLights(2, 15), 15);
});

// ---------- start lights and reaction test ----------
test('start lights come on one per step, then go out after a random hold', () => {
  const s = M.lightsSchedule({ lights: 5, stepMs: 500, minHoldMs: 200, maxHoldMs: 1000, rand: () => 0.5 });
  assert.deepEqual(s.onAt, [500, 1000, 1500, 2000, 2500]);
  assert.equal(s.outAt, 2500 + 600);
  const lo = M.lightsSchedule({ lights: 5, stepMs: 500, minHoldMs: 200, maxHoldMs: 1000, rand: () => 0 });
  const hi = M.lightsSchedule({ lights: 5, stepMs: 500, minHoldMs: 200, maxHoldMs: 1000, rand: () => 0.999999 });
  assert.equal(lo.outAt, 2700);
  assert.ok(hi.outAt <= 3500 && hi.outAt > 3400);
});
test('a click before lights out is a jump start; after is a reaction time', () => {
  assert.deepEqual(M.judgeReaction(900, 1000), { jumpStart: true, ms: 0 });
  assert.deepEqual(M.judgeReaction(1231, 1000), { jumpStart: false, ms: 231 });
  assert.equal(M.formatReaction(231), '0.231 s');
  assert.equal(M.formatReaction(1045), '1.045 s');
});
test('lap clock formats as m:ss.mmm', () => {
  assert.equal(M.formatLap(0), '0:00.000');
  assert.equal(M.formatLap(83456), '1:23.456');
  assert.equal(M.formatLap(600000 + 5007), '10:05.007');
});

// ---------- race lab layout ----------
test('race layout: 20 grid slots, 5 boxes, 15 overflow slots, all inside the stage and never overlapping', () => {
  for (const width of [280, 320, 420, 560, 720]) {
    const L = M.raceLayout(width);
    assert.equal(L.grid.length, 20); assert.equal(L.boxes.length, 5); assert.equal(L.overflow.length, 15);
    const all = [...L.grid, ...L.boxes, ...L.overflow];
    for (const p of all) {
      assert.ok(p.x >= 0 && p.x + L.chipW <= width + 1e-9, `x out of stage at ${width}`);
      assert.ok(p.y >= 0 && p.y + L.chipH <= L.height + 1e-9, `y out of stage at ${width}`);
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const overlap = a.x < b.x + L.chipW && b.x < a.x + L.chipW && a.y < b.y + L.chipH && b.y < a.y + L.chipH;
      assert.ok(!overlap, `slots ${i} and ${j} overlap at width ${width}`);
    }
    assert.ok(L.chipW >= 28, 'chips stay tappable');
  }
});

// ---------- stress ----------
test('stress: 10,000 safe races never oversell, 10,000 damped frames stay finite', () => {
  const S = require('../src/sim.js');
  for (let seed = 1; seed <= 10000; seed++) {
    const r = S.race({ mode: 'safe', buyers: 20, stock: 5, seed });
    assert.equal(r.oversold, 0);
  }
  let v = 0;
  for (let i = 0; i < 10000; i++) { v = M.damp(v, Math.sin(i) * 1e4, 8, 1 / 60); assert.ok(Number.isFinite(v)); }
});

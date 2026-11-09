// Tests for road.js: an endless racing line generated ahead of the car. Straight by default; a turn
// request plans a proper corner (clothoid entry, constant-radius arc, clothoid exit) just ahead.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/road.js');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);

test('generates samples behind and ahead of the car, straight along +X by default', () => {
  const r = R.create();
  const pts = r.points();
  assert.ok(pts[0].s <= -R.BEHIND + R.STEP && pts[pts.length - 1].s >= R.AHEAD);
  for (const p of pts) { close(p.z, 0); close(p.h, 0); close(p.x, p.s, 1e-6); }
});

test('advancing keeps the window around the car and drops old samples', () => {
  const r = R.create();
  for (let i = 0; i < 1000; i++) r.advance(1.37);
  const pts = r.points();
  assert.ok(pts[0].s >= r.s - R.BEHIND - R.STEP && pts[0].s <= r.s - R.BEHIND + R.STEP);
  assert.ok(pts[pts.length - 1].s >= r.s + R.AHEAD);
  assert.ok(pts.length < (R.AHEAD + R.BEHIND) / R.STEP + 4, 'bounded memory');
});

test('a turn request plans a corner that starts beyond the lock distance, never under the car', () => {
  const r = R.create();
  r.advance(50);
  const before = r.points().filter((p) => p.s <= r.s + R.LOCK).map((p) => [p.s, p.x, p.z]);
  assert.equal(r.requestTurn(1, 90), true);
  for (let i = 0; i < 60; i++) r.update(1 / 60);              // finish the morph
  const after = r.points().filter((p) => p.s <= r.s + R.LOCK).map((p) => [p.s, p.x, p.z]);
  assert.deepEqual(after, before, 'road under and just ahead of the car is unchanged');
  const ks = r.points().map((p) => p.k);
  close(Math.max(...ks), 1 / 90, 1e-9);
  assert.ok(r.points().some((p) => p.s > r.s + R.LOCK && Math.abs(p.h) > 0.3), 'heading actually changes');
});

test('curvature ramps (clothoid) instead of jumping: continuous within a step', () => {
  const r = R.create();
  r.requestTurn(-1, 80);
  const pts = r.points();
  for (let i = 1; i < pts.length; i++) assert.ok(Math.abs(pts[i].k - pts[i - 1].k) <= (1 / 80) * R.STEP / R.ENTRY + 1e-9);
});

test('left and right: dir +1 bends heading positive, -1 negative', () => {
  const a = R.create(); a.requestTurn(1, 100); for (let i = 0; i < 400; i++) { a.update(1 / 60); a.advance(1); }
  const b = R.create(); b.requestTurn(-1, 100); for (let i = 0; i < 400; i++) { b.update(1 / 60); b.advance(1); }
  assert.ok(a.sample(a.s).h > 0.2 && b.sample(b.s).h < -0.2);
});

test('only one corner queued at a time near the car; a second request chains after it', () => {
  const r = R.create();
  assert.equal(r.requestTurn(1, 90), true);
  assert.equal(r.requestTurn(-1, 90), true, 'chains into an S');
  assert.equal(r.requestTurn(1, 90), false, 'does not stack corners far down the road');
  assert.equal(r.busy(), true);
});

test('morph: re-planned road blends in smoothly instead of snapping', () => {
  const r = R.create(); r.advance(10);
  const far = r.s + 100;
  const z0 = r.sample(far).z;
  r.requestTurn(1, 80);
  r.update(0.05);
  const zMid = r.sample(far).z;
  for (let i = 0; i < 60; i++) r.update(1 / 60);
  const zEnd = r.sample(far).z;
  assert.ok(Math.abs(zEnd - z0) > 5, 'the corner moves the far road');
  assert.ok(Math.abs(zMid - z0) < Math.abs(zEnd - z0) * 0.5, 'after 50 ms it is still mostly the old shape');
});

test('sample interpolates between samples: position continuous, heading tangent to motion', () => {
  const r = R.create(); r.requestTurn(1, 70); for (let i = 0; i < 60; i++) r.update(1 / 60);
  for (let s = 0; s < 150; s += 0.37) {
    const a = r.sample(s), b = r.sample(s + 0.05);
    const d = Math.hypot(b.x - a.x, b.z - a.z); close(d, 0.05, 2e-3);
    const dirH = Math.atan2(-(b.z - a.z), b.x - a.x); close(Math.atan2(Math.sin(dirH - a.h), Math.cos(dirH - a.h)), 0, 0.03);
  }
});

test('curvatureAhead reports the tightest corner in a window', () => {
  const r = R.create(); r.requestTurn(1, 75); for (let i = 0; i < 60; i++) r.update(1 / 60);
  close(r.curvatureAhead(0, R.AHEAD), 1 / 75, 1e-9);
  close(r.curvatureAhead(0, 5), 0, 1e-9);
});

test('radius is clamped to a sane range and garbage input is ignored', () => {
  const r = R.create();
  r.requestTurn(1, 3); for (let i = 0; i < 60; i++) r.update(1 / 60);
  assert.ok(r.curvatureAhead(0, R.AHEAD) <= 1 / R.MIN_RADIUS + 1e-12);
  const q = R.create();
  assert.equal(q.requestTurn(NaN, 90), false); assert.equal(q.requestTurn(1, NaN), false);
  q.advance(NaN); q.advance(-5); close(q.s, 0);
});

test('long drive with many corners stays finite and bounded', () => {
  const r = R.create();
  for (let i = 0; i < 20000; i++) {
    if (i % 97 === 0) r.requestTurn(i % 2 ? 1 : -1, 60 + (i % 7) * 15);
    r.update(1 / 60); r.advance(1.1);
    if (i % 500 === 0) for (const p of r.points()) for (const k of ['x', 'z', 'h', 'k', 's']) assert.ok(Number.isFinite(p[k]));
  }
  assert.ok(r.points().length < (R.AHEAD + R.BEHIND) / R.STEP + 4);
});

// Tests for cinema.js: scroll → camera keyframe path. Written before the code.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/cinema.js');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);

const KF = [
  { at: 0.0, pos: [8, 2, 6], look: [0, 0.5, 0], fov: 32 },
  { at: 0.3, pos: [0, 1, 9], look: [0, 0.5, 0], fov: 30 },
  { at: 0.6, pos: [-7, 2.5, 5], look: [0, 0.5, 0], fov: 34 },
  { at: 1.0, pos: [0, 9, 0.01], look: [0, 0, 0], fov: 40 }
];

test('path hits every keyframe exactly', () => {
  const p = C.path(KF);
  for (const k of KF) {
    const s = p.sample(k.at);
    for (let i = 0; i < 3; i++) { close(s.pos[i], k.pos[i], 1e-9); close(s.look[i], k.look[i], 1e-9); }
    close(s.fov, k.fov, 1e-9);
  }
});
test('path clamps outside 0..1 and is continuous', () => {
  const p = C.path(KF);
  assert.deepEqual(p.sample(-1).pos, KF[0].pos);
  assert.deepEqual(p.sample(2).pos, KF[3].pos);
  let prev = p.sample(0).pos;
  for (let t = 0.001; t <= 1; t += 0.001) {
    const cur = p.sample(t).pos;
    const d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
    assert.ok(d < 0.2, `jump of ${d} at ${t}`);
    prev = cur;
  }
});
test('path eases between keyframes: zero velocity at each keyframe (no visible kinks)', () => {
  const p = C.path(KF);
  for (const k of KF.slice(1, -1)) {
    const a = p.sample(k.at - 0.002).pos, b = p.sample(k.at + 0.002).pos;
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    assert.ok(d < 0.02, `velocity ${d} at keyframe ${k.at}`);
  }
});
test('keyframes must be sorted and unique', () => {
  assert.throws(() => C.path([{ at: 0.5, pos: [0, 0, 0], look: [0, 0, 0], fov: 30 }, { at: 0.2, pos: [0, 0, 0], look: [0, 0, 0], fov: 30 }]));
  assert.throws(() => C.path([KF[0]]));
});
test('holds: a keyframe with hold keeps the camera still for that scroll span', () => {
  const p = C.path([
    { at: 0, pos: [0, 0, 0], look: [0, 0, 0], fov: 30 },
    { at: 0.4, pos: [1, 1, 1], look: [0, 0, 0], fov: 30, hold: 0.2 },
    { at: 1, pos: [2, 2, 2], look: [0, 0, 0], fov: 30 }
  ]);
  assert.deepEqual(p.sample(0.45).pos, [1, 1, 1]);
  assert.deepEqual(p.sample(0.6).pos, [1, 1, 1]);
  assert.ok(p.sample(0.7).pos[0] > 1);
});
test('shift: optional screen offset interpolates and defaults to zero', () => {
  const p = C.path([{ at: 0, pos: [0, 0, 0], look: [0, 0, 0], fov: 30, shift: [0.3, 0] }, { at: 1, pos: [1, 1, 1], look: [0, 0, 0], fov: 30 }]);
  assert.deepEqual(p.sample(0).shift, [0.3, 0]);
  assert.deepEqual(p.sample(1).shift, [0, 0]);
  assert.ok(p.sample(0.5).shift[0] > 0 && p.sample(0.5).shift[0] < 0.3);
});
test('wheel spin and car yaw derive from scroll velocity, bounded', () => {
  close(C.wheelSpin(0, 1 / 60), 0);
  assert.ok(C.wheelSpin(5000, 1 / 60) > 0);
  assert.ok(C.carYaw(99999) <= 0.12 && C.carYaw(-99999) >= -0.12);
  close(C.carYaw(0), 0);
});
test('section opacity window fades HTML in and out around its scroll centre', () => {
  close(C.sectionAlpha(0.5, 0.5, 0.1), 1);
  close(C.sectionAlpha(0.5, 0.6, 0.1), 0);
  assert.ok(C.sectionAlpha(0.5, 0.55, 0.1) > 0 && C.sectionAlpha(0.5, 0.55, 0.1) < 1);
  close(C.sectionAlpha(0.5, 0.9, 0.1), 0);
});
test('stress: 100k samples stay finite and inside the bounding box of the keyframes', () => {
  const p = C.path(KF);
  for (let i = 0; i <= 100000; i++) {
    const s = p.sample(i / 100000);
    for (const v of [...s.pos, ...s.look, s.fov]) assert.ok(Number.isFinite(v));
    assert.ok(s.pos[1] >= 1 - 1e-9 && s.pos[1] <= 9 + 1e-9);
  }
});

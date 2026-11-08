// Tests for drive.js: the car's speed, suspension, steering and slip model. Written before the code.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/drive.js');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);

test('idle: the car cruises at base speed and never stops', () => {
  const d = D.create();
  for (let i = 0; i < 600; i++) d.step(1 / 60, 0);
  assert.ok(d.speed >= D.BASE_SPEED - 0.01 && d.speed <= D.BASE_SPEED + 0.01);
});
test('scrolling accelerates toward top speed, releasing decays back, never negative, never above cap', () => {
  const d = D.create();
  for (let i = 0; i < 300; i++) d.step(1 / 60, 6000);
  assert.ok(d.speed > D.BASE_SPEED + 20); assert.ok(d.speed <= D.TOP_SPEED);
  for (let i = 0; i < 2000; i++) d.step(1 / 60, 0);
  close(d.speed, D.BASE_SPEED, 0.05);
  for (let i = 0; i < 300; i++) d.step(1 / 60, -9000);
  assert.ok(d.speed >= 0 && d.speed <= D.TOP_SPEED, 'scrolling up is still forward motion');
});
test('frame-rate independent: same result at 30 and 120 fps', () => {
  const run = (fps) => { const d = D.create(); for (let i = 0; i < fps * 3; i++) d.step(1 / fps, i < fps ? 5000 : 0); return d.speed; };
  close(run(30), run(120), 0.6);
});
test('wheel angle advances by distance / radius', () => {
  const d = D.create();
  const before = d.wheelAngle; d.step(0.05, 0);
  close(d.wheelAngle - before, D.BASE_SPEED * 0.05 / D.WHEEL_R, 1e-3);
});
test('pitch: nose lifts under acceleration, dives under braking, settles to 0', () => {
  const d = D.create();
  d.step(1 / 60, 20000); assert.ok(d.pitch < 0, 'accelerating → rear squats (negative pitch)');
  const d2 = D.create(); for (let i = 0; i < 120; i++) d2.step(1 / 60, 20000); for (let i = 0; i < 3; i++) d2.step(1 / 60, 0);
  assert.ok(d2.pitch > -0.02, 'lift-off relieves the squat');
  for (let i = 0; i < 400; i++) d2.step(1 / 60, 0); close(d2.pitch, 0, 0.01);
  assert.ok(Math.abs(d.pitch) <= D.MAX_PITCH);
});
test('bob and steer are bounded for any input', () => {
  const d = D.create();
  for (let i = 0; i < 2000; i++) { d.step(1 / 60, (Math.random() - 0.5) * 50000); assert.ok(Math.abs(d.bob) <= 0.03); assert.ok(Math.abs(d.steer) <= 0.25); assert.ok(d.slip >= 0 && d.slip <= 1); }
});
test('slip spikes on a sudden scroll and decays within a second', () => {
  const d = D.create();
  for (let i = 0; i < 60; i++) d.step(1 / 60, 0);
  d.step(1 / 60, 30000); assert.ok(d.slip > 0.4);
  for (let i = 0; i < 60; i++) d.step(1 / 60, 0); assert.ok(d.slip < 0.05);
});
test('stress: 100k random steps stay finite', () => {
  const d = D.create();
  for (let i = 0; i < 100000; i++) { d.step(Math.random() * 0.05, (Math.random() - 0.5) * 100000); for (const v of [d.speed, d.pitch, d.bob, d.steer, d.slip, d.wheelAngle]) assert.ok(Number.isFinite(v)); }
});

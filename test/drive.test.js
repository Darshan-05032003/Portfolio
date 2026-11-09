// Tests for drive.js v3: the car is always running. Scroll is extra throttle; corners on the road
// ahead make it brake to a physically sensible corner speed, steer, roll, slip a little, then power out.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/drive.js');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);
const straight = { k: 0, kAhead: 0 };
const run = (d, secs, vel, road = straight, fps = 60) => { for (let i = 0; i < Math.round(secs * fps); i++) d.step(1 / fps, vel, road); return d; };

test('never starts from a standstill: rolling at cruise from the first frame', () => {
  const d = D.create();
  assert.equal(d.speed, D.CRUISE); assert.ok(d.gear >= 5); assert.notEqual(d.state, 'grid');
  run(d, 10, 0);
  close(d.speed, D.CRUISE, 0.2);
  assert.equal(d.state, 'push');
});

test('scroll adds throttle up to top speed and lets off back to cruise', () => {
  const d = run(D.create(), 5, 6000);
  assert.ok(d.speed > D.CRUISE + 20 && d.speed <= D.TOP_SPEED);
  run(d, 12, 0); close(d.speed, D.CRUISE, 0.5);
});

test('a corner ahead: brakes to v = sqrt(aLat / k), discs glow, nose dives, downshifts', () => {
  const d = run(D.create(), 4, 6000);
  const g0 = d.gear;
  const corner = { k: 0, kAhead: 1 / 70 };
  d.step(1 / 60, 0, corner); run(d, 0.3, 0, corner);
  assert.equal(d.state, 'brake'); assert.ok(d.brake > 0.5); assert.ok(d.pitch > 0);
  run(d, 4, 0, corner);
  close(d.speed, Math.sqrt(D.A_LAT * 70), 1.0);
  assert.ok(d.gear < g0, 'downshifted');
});

test('in the corner: front wheels steer into it, body rolls to the outside, rear slips a touch', () => {
  const d = run(D.create(), 3, 0, { k: 1 / 80, kAhead: 1 / 80 });
  assert.ok(d.steer > 0.03, 'steers toward positive heading');
  assert.ok(d.roll > 0, 'rolls to the outside (top leans away from the corner centre)');
  assert.ok(d.yaw > 0 && d.yaw < 0.1, 'small slip angle, nose pointing into the corner');
  assert.ok(['corner', 'apex'].includes(d.state));
  close(d.latAcc, d.speed * d.speed / 80, 1.5);
  const e = run(D.create(), 3, 0, { k: -1 / 80, kAhead: 1 / 80 });
  assert.ok(e.steer < -0.03 && e.yaw < 0, 'mirror for the other direction');
});

test('corner exit: unwinds steering and accelerates back to cruise', () => {
  const d = run(D.create(), 3, 0, { k: 1 / 50, kAhead: 1 / 50 });
  const v = d.speed;
  run(d, 0.8, 0, straight);
  assert.equal(d.state, 'exit');
  run(d, 6, 0, straight);
  assert.ok(d.speed > v + 5); close(d.steer, 0, 0.01); close(d.yaw, 0, 0.005);
});

test('wheel angle advances by distance / radius', () => {
  const d = D.create(); const a = d.wheelAngle; d.step(0.05, 0, straight);
  close(d.wheelAngle - a, d.speed * 0.05 / D.WHEEL_R, 1e-6);
});

test('gear, rpm and kmh stay consistent', () => {
  const d = D.create();
  for (let i = 0; i < 900; i++) {
    d.step(1 / 60, i < 400 ? 9000 : 0, i > 500 && i < 700 ? { k: 1 / 60, kAhead: 1 / 60 } : straight);
    assert.ok(d.gear >= 1 && d.gear <= 8); assert.ok(d.rpm >= 0 && d.rpm <= 1); close(d.kmh, d.speed * 3.6, 1e-9);
  }
});

test('frame-rate independent', () => {
  const seq = (fps) => { const d = D.create(); run(d, 2, 3000, straight, fps); run(d, 2, 0, { k: 1 / 70, kAhead: 1 / 70 }, fps); return d; };
  const a = seq(30), b = seq(144);
  close(a.speed, b.speed, 0.6); close(a.steer, b.steer, 0.01); close(a.roll, b.roll, 0.004);
});

test('bounded and finite under 100k random steps with garbage input', () => {
  const d = D.create();
  for (let i = 0; i < 100000; i++) {
    const k = (Math.random() - 0.5) * 0.06;
    d.step(Math.random() * 0.2 - 0.02, (Math.random() - 0.5) * 1e5, Math.random() < 0.01 ? { k: NaN, kAhead: Infinity } : { k, kAhead: Math.abs(k) * 1.5 });
    for (const key of ['speed', 'pitch', 'bob', 'steer', 'yaw', 'roll', 'slip', 'shake', 'brake', 'rpm', 'wheelAngle', 'latAcc']) assert.ok(Number.isFinite(d[key]), key);
    assert.ok(d.speed >= D.MIN_SPEED - 1e-9 && d.speed <= D.TOP_SPEED + 1e-9);
    assert.ok(Math.abs(d.pitch) <= D.MAX_PITCH + 1e-9 && Math.abs(d.steer) <= D.MAX_STEER + 1e-9 && Math.abs(d.yaw) <= D.MAX_SLIP + 1e-9);
    assert.ok(d.slip >= 0 && d.slip <= 1 && d.shake >= 0 && d.shake <= 1 && d.brake >= 0 && d.brake <= 1);
  }
});

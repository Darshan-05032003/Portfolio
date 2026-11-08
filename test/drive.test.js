// Tests for drive.js v2: the launch sequence. Written before the code.
// grid (engine idling, car angled in its box) → first scroll: turn-in with steering lock and a violent
// shake → launch (wheelspin, squat, smoke) → drive (scroll is the throttle) → back at the top and still:
// brake to a stop and return to the grid pose.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/drive.js');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);
const run = (d, secs, vel, atTop = false, fps = 60) => { for (let i = 0; i < Math.round(secs * fps); i++) d.step(1 / fps, vel, atTop); return d; };

test('starts on the grid: stopped, angled in the box, engine idling (small vibration, low rpm)', () => {
  const d = run(D.create(), 2, 0, true);
  assert.equal(d.state, 'grid');
  close(d.speed, 0, 0.01);
  close(d.yaw, D.GRID_YAW, 0.01);
  assert.ok(d.shake > 0 && d.shake < 0.2, 'idle vibration only');
  assert.ok(d.rpm > 0.05 && d.rpm < 0.35);
  assert.equal(d.gear, 0, 'neutral on the grid');
});

test('a scroll flick triggers turn-in: front wheels lock, body shakes hard, then launch', () => {
  const d = run(D.create(), 1, 0, true);
  d.step(1 / 60, 900, false);
  assert.equal(d.state, 'turn');
  run(d, D.TURN_TIME * 0.6, 900);
  assert.ok(Math.abs(d.steer) > 0.25, 'steering lock applied');
  assert.ok(d.shake > 0.6, 'engine rev shakes the car');
  assert.ok(d.slip > 0.3, 'rear tyres light up');
  run(d, D.TURN_TIME * 0.5, 900);
  assert.equal(d.state, 'launch');
});

test('tiny scroll jitter does not start the car', () => {
  const d = run(D.create(), 1, 0, true);
  run(d, 1, 10, true);
  assert.equal(d.state, 'grid');
});

test('launch accelerates hard, straightens the car and ends in drive', () => {
  const d = run(D.create(), 0.5, 0, true);
  run(d, D.TURN_TIME + 0.05, 1200);
  assert.equal(d.state, 'launch');
  const v0 = d.speed;
  d.step(1 / 60, 1200); assert.ok(d.pitch < 0, 'rear squats');
  run(d, D.LAUNCH_TIME, 1200);
  assert.equal(d.state, 'drive');
  assert.ok(d.speed > v0 + 15, 'big speed gain during launch');
  close(d.yaw, 0, 0.03); close(d.lateral, 0, 0.03); close(d.steer, 0, 0.05);
});

test('drive: keeps rolling at cruise without scroll, scroll is throttle up to the cap', () => {
  const d = run(D.create(), 0.2, 0, true);
  run(d, D.TURN_TIME + D.LAUNCH_TIME + 0.1, 1500);
  run(d, 6, 0, false);
  assert.equal(d.state, 'drive');
  close(d.speed, D.CRUISE, 0.3);
  run(d, 4, 8000, false);
  assert.ok(d.speed > D.CRUISE + 25 && d.speed <= D.TOP_SPEED);
});

test('back at the top and still: brakes (glow on), stops, returns to grid pose; scroll again relaunches', () => {
  const d = run(D.create(), 0.2, 0, true);
  run(d, D.TURN_TIME + D.LAUNCH_TIME + 0.1, 1500);
  run(d, D.STOP_AFTER + 0.1, 0, true);
  assert.equal(d.state, 'brake');
  d.step(1 / 60, 0, true); assert.ok(d.brake > 0.5, 'discs glow under braking'); assert.ok(d.pitch > 0, 'nose dives');
  run(d, 6, 0, true);
  assert.equal(d.state, 'grid'); close(d.speed, 0, 0.01); close(d.yaw, D.GRID_YAW, 0.02);
  run(d, 0.1, 900, false);
  assert.equal(d.state, 'turn');
});

test('scrolling while braking cancels the stop and goes straight back to drive', () => {
  const d = run(D.create(), 0.2, 0, true);
  run(d, D.TURN_TIME + D.LAUNCH_TIME + 0.1, 1500);
  run(d, D.STOP_AFTER + 0.3, 0, true);
  assert.equal(d.state, 'brake');
  d.step(1 / 60, 900, false);
  assert.equal(d.state, 'drive');
});

test('page opened mid-scroll starts already driving', () => {
  const d = D.create({ driving: true });
  assert.equal(d.state, 'drive'); close(d.speed, D.CRUISE, 0.01); close(d.yaw, 0, 1e-9);
});

test('wheel angle advances by distance / radius (plus wheelspin during launch)', () => {
  const d = D.create({ driving: true });
  const a = d.wheelAngle; d.step(0.05, 0, false);
  assert.ok(d.wheelAngle - a >= d.speed * 0.05 / D.WHEEL_R * 0.99);
});

test('gearbox: neutral on grid, 1–8 when moving, rises with speed; rpm and kmh consistent', () => {
  const d = run(D.create(), 0.2, 0, true);
  run(d, D.TURN_TIME + D.LAUNCH_TIME + 0.1, 1500);
  let lastGear = 0;
  for (let i = 0; i < 600; i++) {
    d.step(1 / 60, 9000, false);
    assert.ok(d.gear >= 1 && d.gear <= 8);
    assert.ok(d.gear >= lastGear - 0, 'never downshifts under full throttle'); lastGear = d.gear;
    assert.ok(d.rpm >= 0 && d.rpm <= 1);
    close(d.kmh, d.speed * 3.6, 1e-9);
  }
  assert.ok(d.gear >= 7, 'high gear at top speed');
});

test('frame-rate independent across the whole sequence', () => {
  const seq = (fps) => { const d = D.create(); run(d, 0.5, 0, true, fps); run(d, 2.5, 1500, false, fps); run(d, 2, 0, false, fps); return d; };
  const a = seq(30), b = seq(120);
  assert.equal(a.state, b.state); close(a.speed, b.speed, 0.8); close(a.yaw, b.yaw, 0.02);
});

test('everything bounded and finite under 100k random steps', () => {
  const d = D.create();
  for (let i = 0; i < 100000; i++) {
    d.step(Math.random() * 0.2 - 0.02, (Math.random() - 0.5) * 100000, Math.random() < 0.3);
    for (const k of ['speed', 'pitch', 'bob', 'steer', 'yaw', 'lateral', 'slip', 'shake', 'brake', 'rpm', 'wheelAngle']) assert.ok(Number.isFinite(d[k]), k);
    assert.ok(d.speed >= 0 && d.speed <= D.TOP_SPEED);
    assert.ok(Math.abs(d.pitch) <= D.MAX_PITCH + 1e-9);
    assert.ok(Math.abs(d.steer) <= D.MAX_STEER + 1e-9);
    assert.ok(d.slip >= 0 && d.slip <= 1 && d.shake >= 0 && d.shake <= 1 && d.brake >= 0 && d.brake <= 1);
  }
});

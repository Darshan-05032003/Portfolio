/* The car's motion model. Always running — it never starts from a standstill.
   Scroll is extra throttle. The road ahead (road.js) decides the rest: a corner makes it brake to a
   physically sensible speed v = sqrt(aLat / k), downshift, steer in, roll to the outside, slip a little,
   then unwind and power out. Pure math, no Three.js. Browser: window.Drive. Node: module.exports.
   Signs: k > 0 turns toward -Z (left); steer and yaw follow k; roll > 0 leans the top toward +Z. */
(function (root) {
  'use strict';
  const CRUISE = 58, TOP_SPEED = 92, MIN_SPEED = 25, WHEEL_R = 0.36, WHEELBASE = 3.6;
  const A_LAT = 36;                     // ≈ 3.7 g, what a modern car pulls in a fast corner
  const MAX_PITCH = 0.035, MAX_STEER = 0.32, MAX_SLIP = 0.09;
  const GEARS = [0, 22, 33, 44, 55, 66, 76, 85, 1e9];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));
  const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

  function create() {
    const s = {
      state: 'push', t: 0, speed: CRUISE, accel: 0, wheelAngle: 0, steer: 0, yaw: 0, lateral: 0,
      pitch: 0, roll: 0, bob: 0, slip: 0, shake: 0.1, brake: 0, rpm: 0.7, gear: 6, kmh: CRUISE * 3.6,
      latAcc: 0, sinceCorner: 99
    };
    s.step = function (dt, scrollVel, road) {
      dt = clamp(fin(dt), 0, 0.1);
      if (dt === 0) return s;
      scrollVel = fin(scrollVel);
      const k = clamp(fin(road && road.k), -1 / 30, 1 / 30);
      const kAhead = clamp(Math.abs(fin(road && road.kAhead)), 0, 1 / 30);
      s.t += dt;
      const prev = s.speed;
      const want = CRUISE + clamp(Math.abs(scrollVel) / 60, 0, TOP_SPEED - CRUISE);
      const vCorner = kAhead > 1e-5 ? Math.sqrt(A_LAT / kAhead) : Infinity;
      const target = clamp(Math.min(want, vCorner), MIN_SPEED, TOP_SPEED);
      const braking = s.speed > target + 2;
      s.speed = clamp(damp(s.speed, target, braking ? 2.6 : 0.9, dt), MIN_SPEED, TOP_SPEED);
      s.accel = (s.speed - prev) / dt;
      s.latAcc = s.speed * s.speed * Math.abs(k);

      const inCorner = Math.abs(k) > 1e-4;
      s.sinceCorner = inCorner ? 0 : s.sinceCorner + dt;
      s.state = braking && s.accel < -3 ? 'brake'
        : inCorner ? (Math.abs(k) > 0.8 * kAhead && kAhead > 0 ? 'apex' : 'corner')
        : s.sinceCorner < 1.6 ? 'exit' : 'push';

      // geometry: Ackermann angle, exaggerated so it reads on screen
      s.steer = clamp(damp(s.steer, clamp(Math.atan(WHEELBASE * k) * 3, -MAX_STEER, MAX_STEER), 6, dt), -MAX_STEER, MAX_STEER);
      s.yaw = clamp(damp(s.yaw, clamp(Math.sign(k) * s.latAcc * 0.0016, -MAX_SLIP, MAX_SLIP), 4, dt), -MAX_SLIP, MAX_SLIP);
      s.roll = damp(s.roll, Math.sign(k) * s.latAcc * 0.0005, 5, dt);
      s.pitch = clamp(damp(s.pitch, -s.accel * 0.0011, 6, dt), -MAX_PITCH, MAX_PITCH);
      s.brake = clamp(damp(s.brake, braking && s.accel < -3 ? 1 : 0, braking ? 9 : 1.1, dt), 0, 1);
      s.slip = clamp(damp(s.slip, s.state === 'exit' && s.accel > 4 ? 0.25 : 0, 3, dt), 0, 1);
      const v = s.speed / TOP_SPEED;
      s.shake = clamp(damp(s.shake, 0.08 + 0.12 * v + (s.state === 'apex' ? 0.25 : 0) + (s.state === 'brake' ? 0.15 : 0), 6, dt), 0, 1);
      s.wheelAngle = (s.wheelAngle + s.speed * dt / WHEEL_R) % (Math.PI * 2000);
      s.bob = Math.sin(s.t * 23) * 0.004 * v + Math.sin(s.t * 7.1) * 0.003 * v;

      let g = 1; while (g < 8 && s.speed > GEARS[g]) g++;
      s.gear = g;
      const lo = GEARS[g - 1], hi = g === 8 ? TOP_SPEED : GEARS[g];
      s.rpm = clamp(damp(s.rpm, 0.55 + 0.45 * clamp((s.speed - lo) / Math.max(1, hi - lo), 0, 1), 12, dt), 0, 1);
      s.kmh = s.speed * 3.6;
      return s;
    };
    return s;
  }
  const api = { create, CRUISE, TOP_SPEED, MIN_SPEED, WHEEL_R, WHEELBASE, A_LAT, MAX_PITCH, MAX_STEER, MAX_SLIP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Drive = api;
})(typeof window !== 'undefined' ? window : this);

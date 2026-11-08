/* The car's motion model. Pure math; the scene reads speed, wheelAngle, pitch, bob, steer, slip.
   Browser: window.Drive. Node: module.exports. */
(function (root) {
  'use strict';
  const BASE_SPEED = 16, TOP_SPEED = 92, WHEEL_R = 0.36, MAX_PITCH = 0.035;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));
  function create() {
    const s = { speed: BASE_SPEED, wheelAngle: 0, pitch: 0, bob: 0, steer: 0, slip: 0, accel: 0, t: 0, _prevScroll: 0 };
    s.step = function (dt, scrollVel) {
      dt = clamp(dt, 0, 0.1); s.t += dt;
      const demand = clamp(Math.abs(scrollVel) / 90, 0, TOP_SPEED - BASE_SPEED);   // px/s → extra m/s
      const target = BASE_SPEED + demand;
      const prev = s.speed;
      s.speed = damp(s.speed, target, target > s.speed ? 2.2 : 0.9, dt);
      s.speed = clamp(s.speed, 0, TOP_SPEED);
      s.accel = dt > 0 ? (s.speed - prev) / dt : 0;
      s.wheelAngle += s.speed * dt / WHEEL_R;
      // squat under acceleration, dive under braking
      s.pitch = damp(s.pitch, clamp(-s.accel * 0.0025, -MAX_PITCH, MAX_PITCH), 6, dt);
      // road bob grows with speed
      s.bob = Math.sin(s.t * 23) * 0.004 * (s.speed / TOP_SPEED) + Math.sin(s.t * 7.1) * 0.003 * (s.speed / TOP_SPEED);
      // steer leans into a fast scroll, then returns
      s.steer = damp(s.steer, clamp(scrollVel / 60000, -0.2, 0.2), 4, dt);
      // slip: how much the scroll velocity jumped this frame
      const jump = Math.abs(scrollVel - s._prevScroll); s._prevScroll = scrollVel;
      s.slip = clamp(damp(s.slip, 0, 5, dt) + clamp(jump / 25000, 0, 1), 0, 1);
      return s;
    };
    return s;
  }
  const api = { create, BASE_SPEED, TOP_SPEED, WHEEL_R, MAX_PITCH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Drive = api;
})(typeof window !== 'undefined' ? window : this);

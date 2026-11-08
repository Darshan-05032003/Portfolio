/* The car's motion model: a launch sequence driven by scroll. Pure math, no Three.js.
   grid  – stopped in its box, angled, engine idling (small vibration)
   turn  – first scroll: steering lock, engine revs, the car shakes hard and creeps out of the box
   launch– wheelspin, squat, smoke, straightens onto the racing line
   drive – keeps rolling at cruise; scroll speed is the throttle
   brake – back at the top and still: discs glow, nose dives, stops, returns to the grid pose
   Browser: window.Drive. Node: module.exports. */
(function (root) {
  'use strict';
  const CRUISE = 22, TOP_SPEED = 92, WHEEL_R = 0.36, MAX_PITCH = 0.04, MAX_STEER = 0.42;
  const GRID_YAW = -0.38, GRID_LAT = 0.9;              // parked angled, a little off the line
  const TURN_TIME = 0.75, LAUNCH_TIME = 1.25, STOP_AFTER = 1.4;
  const START_VEL = 120;                                 // px/s of scroll that counts as "go"
  const GEARS = [0, 22, 33, 44, 55, 66, 76, 85, 1e9];    // m/s upper bound of gears 1..8
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  function create(opts) {
    const driving = !!(opts && opts.driving);
    const s = {
      state: driving ? 'drive' : 'grid', stateT: 0, t: 0,
      speed: driving ? CRUISE : 0, accel: 0, wheelAngle: 0,
      steer: 0, yaw: driving ? 0 : GRID_YAW, lateral: driving ? 0 : GRID_LAT,
      pitch: 0, roll: 0, bob: 0, slip: 0, shake: driving ? 0 : 0.08, brake: 0,
      rpm: driving ? 0.6 : 0.15, gear: driving ? 1 : 0, kmh: 0, stillFor: 0
    };
    s.kmh = s.speed * 3.6;
    const go = (st) => { s.state = st; s.stateT = 0; };

    s.step = function (dt, scrollVel, atTop) {
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
      scrollVel = Number.isFinite(scrollVel) ? scrollVel : 0;
      s.t += dt; s.stateT += dt;
      const active = Math.abs(scrollVel) > START_VEL;
      s.stillFor = active || !atTop ? 0 : s.stillFor + dt;
      const prev = s.speed;
      let tSpeed = s.speed, lSpeed = 2, tSteer = 0, tYaw = 0, tLat = 0, tShake = 0, tBrake = 0, spin = 0;

      if (s.state === 'grid') {
        tSpeed = 0; lSpeed = 4; tYaw = GRID_YAW; tLat = GRID_LAT; tShake = 0.08;
        if (active) go('turn');
      }
      if (s.state === 'turn') {
        const k = s.stateT / TURN_TIME;
        tSteer = MAX_STEER * 0.92;                         // full lock out of the box
        tSpeed = 3.5 * smooth(k); lSpeed = 3;
        tYaw = GRID_YAW * (1 - 0.45 * smooth(k)); tLat = GRID_LAT * (1 - 0.3 * smooth(k));
        tShake = 0.95 - 0.25 * k;                          // engine at the limiter, car trembling
        spin = 30 * (1 - k);                               // rear wheels spinning on the spot
        s.slip = clamp(s.slip + dt * 3, 0, 1);
        if (s.stateT >= TURN_TIME) go('launch');
      }
      if (s.state === 'launch') {
        const k = s.stateT / LAUNCH_TIME;
        tSpeed = CRUISE + 26 + clamp(Math.abs(scrollVel) / 90, 0, 30); lSpeed = 2.6;
        tSteer = MAX_STEER * 0.6 * (1 - smooth(k * 1.6)) - 0.08 * Math.sin(k * Math.PI); // counter-steer as it straightens
        tYaw = 0; tLat = 0;
        tShake = 0.6 * (1 - k);
        spin = 18 * (1 - smooth(k * 1.4));
        if (s.stateT >= LAUNCH_TIME) go('drive');
      }
      if (s.state === 'drive') {
        tSpeed = CRUISE + clamp(Math.abs(scrollVel) / 90, 0, TOP_SPEED - CRUISE);
        lSpeed = tSpeed > s.speed ? 2.2 : 0.9;
        tSteer = clamp(scrollVel / 60000, -0.12, 0.12);
        tShake = 0.12 * (s.speed / TOP_SPEED);
        if (s.stillFor >= STOP_AFTER) go('brake');
      }
      if (s.state === 'brake') {
        if (active) { go('drive'); tSpeed = s.speed; }
        else {
          tSpeed = 0; lSpeed = 1.6; tBrake = s.speed > 1 ? 1 : 0;
          tYaw = s.speed < 6 ? GRID_YAW : 0; tLat = s.speed < 6 ? GRID_LAT : 0;   // swing back into the box at walking pace
          tSteer = s.speed < 6 ? -MAX_STEER * 0.5 : 0;
          if (s.speed < 0.3) { go('grid'); }
        }
      }

      s.speed = clamp(damp(s.speed, tSpeed, lSpeed, dt), 0, TOP_SPEED);
      if (s.speed < 0.02 && tSpeed === 0) s.speed = 0;
      s.accel = dt > 0 ? (s.speed - prev) / dt : 0;
      s.steer = clamp(damp(s.steer, tSteer, 7, dt), -MAX_STEER, MAX_STEER);
      s.yaw = damp(s.yaw, tYaw, s.state === 'turn' ? 2.2 : 3.4, dt);
      s.lateral = damp(s.lateral, tLat, s.state === 'launch' ? 3.6 : 2.4, dt);
      s.shake = clamp(damp(s.shake, tShake, 9, dt), 0, 1);
      s.brake = clamp(damp(s.brake, tBrake, tBrake ? 10 : 1.2, dt), 0, 1);
      s.wheelAngle = (s.wheelAngle + (s.speed + spin) * dt / WHEEL_R) % (Math.PI * 2000);
      // squat under acceleration, dive under braking
      s.pitch = clamp(damp(s.pitch, -s.accel * 0.0022 + (s.state === 'brake' && tBrake ? 0.02 : 0), 6, dt), -MAX_PITCH, MAX_PITCH);
      s.roll = damp(s.roll, -s.steer * 0.05 * clamp(s.speed / 10, 0, 1), 5, dt);
      const v = s.speed / TOP_SPEED;
      s.bob = Math.sin(s.t * 23) * 0.004 * v + Math.sin(s.t * 7.1) * 0.003 * v;
      if (s.state !== 'turn') s.slip = clamp(damp(s.slip, s.state === 'launch' ? 0.7 * (1 - s.stateT / LAUNCH_TIME) : 0, 3, dt), 0, 1);
      // gearbox + revs
      if (s.speed < 0.5 && (s.state === 'grid' || s.state === 'brake')) { s.gear = 0; s.rpm = clamp(0.15 + (s.state === 'grid' ? 0.03 * Math.sin(s.t * 9) : 0), 0, 1); }
      else {
        let g = 1; while (g < 8 && s.speed > GEARS[g]) g++;
        s.gear = g;
        const lo = GEARS[g - 1], hi = g === 8 ? TOP_SPEED : GEARS[g];
        const inBand = clamp((s.speed - lo) / Math.max(1, hi - lo), 0, 1);
        const tr = s.state === 'turn' ? 0.97 : 0.55 + 0.45 * inBand;
        s.rpm = clamp(damp(s.rpm, tr, 12, dt), 0, 1);
      }
      s.kmh = s.speed * 3.6;
      return s;
    };
    return s;
  }
  const api = { create, CRUISE, TOP_SPEED, WHEEL_R, MAX_PITCH, MAX_STEER, GRID_YAW, GRID_LAT, TURN_TIME, LAUNCH_TIME, STOP_AFTER, START_VEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Drive = api;
})(typeof window !== 'undefined' ? window : this);

/* Scroll → camera keyframe path and a few car-motion helpers. Pure math, no Three.js.
   Browser: window.Cinema. Node: module.exports. */
(function (root) {
  'use strict';
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smooth = (t) => t * t * (3 - 2 * t); // zero slope at both ends: no kinks at keyframes
  const lerp3 = (a, b, t) => (t >= 1 ? b.slice() : t <= 0 ? a.slice() : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);

  // keyframes: [{ at: 0..1, pos:[x,y,z], look:[x,y,z], fov, hold?: span }]
  function path(kf) {
    if (!Array.isArray(kf) || kf.length < 2) throw new Error('need at least two keyframes');
    for (let i = 1; i < kf.length; i++) if (!(kf[i].at > kf[i - 1].at)) throw new Error('keyframes must be sorted and unique');
    // expand holds into a duplicate keyframe at the end of the hold
    const ks = [];
    for (const k of kf) { ks.push(k); if (k.hold) ks.push(Object.assign({}, k, { at: k.at + k.hold, hold: 0 })); }
    function sample(t) {
      t = clamp(t, ks[0].at, ks[ks.length - 1].at);
      let i = 0;
      while (i < ks.length - 2 && t >= ks[i + 1].at) i++;
      const a = ks[i], b = ks[i + 1];
      const u = b.at === a.at ? 0 : smooth(clamp((t - a.at) / (b.at - a.at), 0, 1));
      const sa = a.shift || [0, 0], sb = b.shift || [0, 0];
      return { pos: lerp3(a.pos, b.pos, u), look: lerp3(a.look, b.look, u), fov: a.fov + (b.fov - a.fov) * u,
        shift: [sa[0] + (sb[0] - sa[0]) * u, sa[1] + (sb[1] - sa[1]) * u], seg: i };
    }
    return { sample, keyframes: ks };
  }

  // wheel rotation (radians) for a scroll velocity, as if the car rolled with the scroll
  const WHEEL_R = 0.36;
  function wheelSpin(pxPerSecond, dt) { return clamp(Math.abs(pxPerSecond) / 400, 0, 40) * dt / WHEEL_R; }
  // small yaw so the car leans into fast scrolls
  function carYaw(pxPerSecond) { return clamp(pxPerSecond / 25000, -0.12, 0.12); }
  // HTML overlay opacity: 1 at centre, fades over `width` on each side
  function sectionAlpha(centre, t, width) { return 1 - clamp(Math.abs(t - centre) / width, 0, 1); }

  const api = { path, wheelSpin, carYaw, sectionAlpha, smooth };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Cinema = api;
})(typeof window !== 'undefined' ? window : this);

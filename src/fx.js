/* Effects: tyre smoke, plank sparks, exhaust flicker, camera shake. All Points/Sprites, one draw call each. */
import * as THREE from '../vendor/three.module.min.js';
import { glowTex } from './track.js';

function particleSystem(n, size, color, blending, opacity) {
  const pos = new Float32Array(n * 3), life = new Float32Array(n), vel = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size, color, map: glowTex(), transparent: true, opacity, depthWrite: false, blending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  let head = 0;
  return {
    mesh: pts,
    emit(x, y, z, vx, vy, vz, l) { const i = head; head = (head + 1) % n; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; life[i] = l; },
    step(dt, drift, gravity) {
      let any = false;
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) { pos[i * 3 + 1] = -50; continue; }
        any = true; life[i] -= dt;
        vel[i * 3 + 1] += gravity * dt;
        pos[i * 3] += (vel[i * 3] + drift) * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0 && gravity) { pos[i * 3 + 1] = 0.01; vel[i * 3 + 1] *= -0.3; }
      }
      geo.attributes.position.needsUpdate = true; return any;
    }
  };
}

export function createFx(scene) {
  const smoke = particleSystem(160, 1.1, 0x9a9ca6, THREE.NormalBlending, 0.16);
  const sparks = particleSystem(220, 0.16, 0xffc070, THREE.AdditiveBlending, 0.95);
  scene.add(smoke.mesh); scene.add(sparks.mesh);
  // exhaust flame: small additive sprite at the rear
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.scale.set(0.5, 0.35, 1); scene.add(flame);
  let smokeAcc = 0, sparkAcc = 0;

  /* speed in m/s, accel in m/s², slip 0..1 (hard scroll), rearWheels: [{x,y,z}] world positions, exhaustPos */
  function update(dt, speed, accel, slip, rearWheels, exhaust, flameVis = 1) {
    // tyre smoke when slipping (hard acceleration / lock-up on sudden scroll)
    smokeAcc += slip * 60 * dt;
    while (smokeAcc >= 1) { smokeAcc -= 1; const w = rearWheels[Math.random() < 0.5 ? 0 : 1]; smoke.emit(w.x - 0.3, 0.1, w.z + (Math.random() - 0.5) * 0.3, -2 - Math.random() * 2, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 1.5, 0.9 + Math.random() * 0.6); }
    // plank sparks at high speed (bottoming out)
    const sparkRate = speed > 55 ? (speed - 55) / 35 * 90 : 0;
    sparkAcc += sparkRate * dt;
    while (sparkAcc >= 1) { sparkAcc -= 1; sparks.emit(-1.2 + Math.random() * 1.5, 0.03, (Math.random() - 0.5) * 1.2, -speed * 0.25 - Math.random() * 6, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 3, 0.25 + Math.random() * 0.35); }
    const a = smoke.step(dt, -speed * 0.35, 0), b = sparks.step(dt, 0, -14);
    // exhaust flicker on lift/accel
    flame.position.set(exhaust.x, exhaust.y, exhaust.z);
    const target = Math.min(1, Math.max(0, accel * 0.08 + (slip > 0.2 ? 0.6 : 0)));
    flame.material.opacity += (target * flameVis * (0.5 + Math.random() * 0.5) - flame.material.opacity) * 0.5;
    flame.scale.set(0.35 + flame.material.opacity * 0.6, 0.25 + flame.material.opacity * 0.3, 1);
    return a || b || flame.material.opacity > 0.02;
  }
  /* camera shake: returns [dx, dy] in metres for a given speed (noise, cheap) */
  let t = 0;
  function shake(dt, speed) {
    t += dt;
    const k = Math.min(1, speed / 90) * 0.022;
    return [Math.sin(t * 31.7) * k * 0.6 + Math.sin(t * 7.3) * k * 0.3, Math.sin(t * 41.3) * k + Math.sin(t * 5.1) * k * 0.4];
  }
  return { update, shake };
}

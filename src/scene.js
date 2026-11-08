/* Three.js scene: renderer with adaptive pixel ratio, cheap cinematic lighting, a procedural
   environment for reflections, a contact shadow, and the car. Rendering is on demand:
   the page calls scene.render() only when scroll, pointer or time-based motion changes. */
import * as THREE from '../vendor/three.module.min.js';
import { contactShadow } from './car.js';
import { buildTrack } from './track.js';
import { createFx } from './fx.js';
import { proceduralVehicle, loadVehicle } from './vehicle.js';
import { circuitEnv } from './env.js';
import { createPost } from './post.js';

export function createScene(canvas, opts = {}) {
  const tier = opts.tier || 'high';                 // 'low' | 'mid' | 'high'
  const maxDpr = tier === 'low' ? 1 : tier === 'mid' ? 1.5 : 1.75;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === 'low', alpha: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = tier === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06060a, 0.03); scene.background = new THREE.Color(0x06060a);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  camera.position.set(8, 2, 6); camera.lookAt(0, 0.5, 0);

  // --- lighting: hemisphere + key + cool rim + warm rim (no HDR) ---
  scene.add(new THREE.HemisphereLight(0x9aa0ac, 0x040406, 0.16));
  // floodlights: warm key from the lamp side, cool rim from the stands
  const key = new THREE.DirectionalLight(0xfff0d6, 3.0); key.position.set(3, 9, 6);
  if (tier === 'high') { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5; key.shadow.bias = -0.0005; }
  scene.add(key);
  const rimCool = new THREE.DirectionalLight(0x9db4ff, 2.6); rimCool.position.set(-5, 4, -7); scene.add(rimCool);
  const rimWarm = new THREE.DirectionalLight(opts.accent || 0xff5a1f, 1.6); rimWarm.position.set(-3, 2, 6); scene.add(rimWarm);

  // --- procedural environment (64 px cubemap of a dark studio gradient with a soft top light) ---
  scene.environment = circuitEnv(renderer);

  // --- track + contact shadow ---
  const track = buildTrack(tier); scene.add(track.group);
  scene.add(contactShadow());
  const fx = createFx(scene);

  // --- vehicle: procedural now, a loaded .glb when one is provided ---
  const carPivot = new THREE.Group(); scene.add(carPivot);
  let vehicle = proceduralVehicle({ livery: opts.livery, accent: opts.accentPaint, number: opts.number });
  carPivot.add(vehicle.root);
  if (tier !== 'high') vehicle.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  async function useModel(url, onProgress) {
    const v = await loadVehicle(url, onProgress);
    carPivot.remove(vehicle.root); vehicle = v; carPivot.add(v.root);
    if (tier !== 'high') v.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return v;
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (post) post.setSize(w, h, renderer.getPixelRatio());
  }
  const post = createPost(renderer, scene, camera, tier);
  resize();

  // adaptive pixel ratio: step down when frames are slow, up when fast (rolling window)
  const frameTimes = []; let dpr = renderer.getPixelRatio(); let lastAdjust = 0;
  function noteFrame(ms, now) {
    frameTimes.push(ms); if (frameTimes.length > 40) frameTimes.shift();
    if (frameTimes.length < 40 || now - lastAdjust < 1500) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    if (avg > 22 && dpr > 0.75) { dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); lastAdjust = now; frameTimes.length = 0; }
    else if (avg < 13 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + 0.25); renderer.setPixelRatio(dpr); resize(); lastAdjust = now; frameTimes.length = 0; }
  }

  /* Per-frame world update from the drive model (drive.js): the world streams past, wheels spin and
     steer, the car yaws out of its grid box, squats, dives, rolls and trembles with the engine; brake discs
     glow, LEDs blink, DRS opens at speed; smoke, sparks, exhaust; camera shake. */
  let drsOpen = 0, t = 0;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), rearW = [new THREE.Vector3(), new THREE.Vector3()], exW = new THREE.Vector3();
  const nz = (k) => Math.sin(t * 87.0 + k) * 0.6 + Math.sin(t * 131.7 + k * 2.1) * 0.4;   // engine-frequency jitter
  function update(dt, d) {
    t += dt;
    track.advance(d.speed * dt);
    for (const w of vehicle.wheels) {
      const a = -d.wheelAngle;
      if (w.axis === 'z') w.node.rotation.z = a; else if (w.axis === 'x') w.node.rotation.x = a; else w.node.rotation.y = a;
      if (w.front && vehicle.procedural) w.node.rotation.y = d.steer;
    }
    carPivot.position.z = d.lateral; carPivot.rotation.y = d.yaw;
    const sh = d.shake;
    vehicle.root.position.y = d.bob + sh * 0.007 * nz(0);
    vehicle.root.rotation.set(d.roll + sh * 0.006 * nz(1.3), sh * 0.003 * nz(2.7), -d.pitch + sh * 0.004 * nz(4.1));
    if (vehicle.drs) { drsOpen += ((d.speed > 70 ? 1 : 0) - drsOpen) * Math.min(1, dt * 4); vehicle.drs.rotation.z = drsOpen * 0.55; }
    const u = vehicle.root.userData || {};
    if (u.brakeM) for (const m of u.brakeM) m.emissiveIntensity = d.brake * 7;
    if (u.ledRed) { const blink = d.state === 'brake' ? (Math.sin(t * 25) > 0 ? 1 : 0) : d.state === 'grid' ? (Math.sin(t * 6.3) > 0.6 ? 1 : 0) : 0; u.ledRed.emissiveIntensity = blink * 6; }
    if (u.exhaustM) u.exhaustM.emissiveIntensity = (d.state === 'turn' ? 2.5 : d.state === 'launch' ? 1.6 : 0.15) * (0.7 + 0.3 * Math.random()) + d.rpm * 0.4;
    vehicle.root.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) rearW[i].copy(vehicle.rearWheels[i] || vehicle.rearWheels[0]).applyMatrix4(vehicle.root.matrixWorld);
    exW.copy(vehicle.exhaust).applyMatrix4(vehicle.root.matrixWorld);
    // the flame only reads from behind the car: fade it by how much the camera looks at the exhaust from the rear
    tmpA.set(-1, 0, 0).transformDirection(vehicle.root.matrixWorld); tmpB.copy(camera.position).sub(exW).normalize();
    fx.update(dt, d.speed, d.accel, d.slip, rearW, exW, Math.max(0, Math.min(1, (tmpA.dot(tmpB) - 0.2) * 2)));
    const s = fx.shake(dt, d.speed);
    return [s[0] + sh * 0.035 * nz(5.5), s[1] + sh * 0.03 * nz(6.9)];
  }
  const carWorld = new THREE.Vector3();
  /* film: { time, blur 0..1, bars } */
  function render(film) {
    if (post && film) { carPivot.getWorldPosition(carWorld); carWorld.y += 0.5; post.render(Object.assign({ carWorld, carRadius: 3.0 }, film)); }
    else renderer.render(scene, camera);
  }
  function dispose() { renderer.dispose(); }
  return { renderer, scene, camera, carPivot, key, rimWarm, post, resize, render, update, useModel, noteFrame, dispose, get vehicle() { return vehicle; } };
}

/* Device tier from cheap signals; a WebGL failure returns 'none' and the page shows a poster. */
export function deviceTier() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'none';
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    if (mobile && (cores <= 4 || mem <= 3)) return 'low';
    if (mobile) return 'mid';
    if (cores <= 4) return 'mid';
    return 'high';
  } catch (e) { return 'none'; }
}

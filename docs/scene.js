/* Three.js scene: renderer with adaptive pixel ratio, cheap cinematic lighting, a procedural
   environment for reflections, a contact shadow, and the car. Rendering is on demand:
   the page calls scene.render() only when scroll, pointer or time-based motion changes. */
import * as THREE from './vendor/three.module.min.js';
import { buildCar, contactShadow } from './car.js';

export function createScene(canvas, opts = {}) {
  const tier = opts.tier || 'high';                 // 'low' | 'mid' | 'high'
  const maxDpr = tier === 'low' ? 1 : tier === 'mid' ? 1.5 : 1.75;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: true, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = tier === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a0c, 10, 30);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  camera.position.set(8, 2, 6); camera.lookAt(0, 0.5, 0);

  // --- lighting: hemisphere + key + cool rim + warm rim (no HDR) ---
  scene.add(new THREE.HemisphereLight(0xaab4cc, 0x050507, 0.6));
  const key = new THREE.DirectionalLight(0xfff4e8, 3.6); key.position.set(5, 8, 4);
  if (tier === 'high') { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5; key.shadow.bias = -0.0005; }
  scene.add(key);
  const rimCool = new THREE.DirectionalLight(0x9db4ff, 2.2); rimCool.position.set(-6, 3.5, -5); scene.add(rimCool);
  const rimWarm = new THREE.DirectionalLight(opts.accent || 0xff5a1f, 1.6); rimWarm.position.set(-3, 2, 6); scene.add(rimWarm);

  // --- procedural environment (64 px cubemap of a dark studio gradient with a soft top light) ---
  scene.environment = studioEnv(renderer);

  // --- ground: dark plane that receives the key shadow, plus a contact shadow blob ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0b0b0f, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  scene.add(contactShadow());
  // faint lane lines (pit lane feel)
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(60, 0.04), new THREE.MeshBasicMaterial({ color: 0x1a1b21 }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.002, 2.6); scene.add(lane);

  // --- car ---
  const car = buildCar({ livery: opts.livery, accent: opts.accentPaint, number: opts.number });
  scene.add(car);
  if (tier !== 'high') car.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  const carPivot = new THREE.Group(); scene.add(carPivot); carPivot.add(car);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();

  // adaptive pixel ratio: step down when frames are slow, up when fast (rolling window)
  const frameTimes = []; let dpr = renderer.getPixelRatio(); let lastAdjust = 0;
  function noteFrame(ms, now) {
    frameTimes.push(ms); if (frameTimes.length > 40) frameTimes.shift();
    if (frameTimes.length < 40 || now - lastAdjust < 1500) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    if (avg > 22 && dpr > 0.8) { dpr = Math.max(0.8, dpr - 0.25); renderer.setPixelRatio(dpr); lastAdjust = now; frameTimes.length = 0; }
    else if (avg < 13 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + 0.25); renderer.setPixelRatio(dpr); lastAdjust = now; frameTimes.length = 0; }
  }

  function render() { renderer.render(scene, camera); }
  function dispose() { renderer.dispose(); }
  return { renderer, scene, camera, car, carPivot, key, rimWarm, resize, render, noteFrame, dispose, wheels: car.userData.wheels, drs: car.userData.drs };
}

function studioEnv(renderer) {
  const size = 64;
  const faces = [];
  for (let f = 0; f < 6; f++) {
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
    const c = cv.getContext('2d');
    // +Y (index 2) is the top: bright soft panel. Sides: dark gradient. -Y: black.
    if (f === 2) { const g = c.createRadialGradient(32, 32, 6, 32, 32, 44); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#9aa3b8'); g.addColorStop(1, '#1a1b22'); c.fillStyle = g; c.fillRect(0, 0, size, size); }
    else if (f === 3) { c.fillStyle = '#050506'; c.fillRect(0, 0, size, size); }
    else { const g = c.createLinearGradient(0, 0, 0, size); g.addColorStop(0, '#2a2d38'); g.addColorStop(0.45, '#121318'); g.addColorStop(1, '#050506'); c.fillStyle = g; c.fillRect(0, 0, size, size);
      // thin horizontal light strip, like studio softboxes
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(0, 14, size, 6); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, 30, size, 2); }
    faces.push(cv);
  }
  const tex = new THREE.CubeTexture(faces); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(tex).texture; pmrem.dispose();
  return env;
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

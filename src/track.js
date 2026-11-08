/* Night street-circuit environment. The car stays at the origin; the world streams past along -X
   and wraps, so the car reads as driving. Everything cheap: a few instanced meshes, canvas textures,
   emissive lamps instead of real lights. Axis: +X forward, +Y up, +Z right. */
import * as THREE from '../vendor/three.module.min.js';

const LOOP = 120;            // metres of trackside before it wraps
const HALF = 5.2;            // half track width

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildTrack(tier) {
  const g = new THREE.Group();
  const moving = new THREE.Group(); g.add(moving);   // translated along -X each frame

  // ---------- asphalt (UV scrolls) ----------
  const asphaltTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#0e0e11'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 10 + Math.random() * 22; c.fillStyle = `rgb(${v},${v},${v + 3})`; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    // rubbered racing line, darker
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0.28, 'rgba(0,0,0,0)'); gr.addColorStop(0.42, 'rgba(0,0,0,.45)'); gr.addColorStop(0.58, 'rgba(0,0,0,.45)'); gr.addColorStop(0.72, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    // white edge lines
    c.fillStyle = 'rgba(225,225,232,.6)'; c.fillRect(0, 6, w, 3); c.fillRect(0, h - 9, w, 3);
  }, 24, 1);
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(LOOP * 3, HALF * 2), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.82, metalness: 0.05 }));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.y = 0; asphalt.receiveShadow = true; g.add(asphalt);
  // wet-ish sheen stripe near camera-side edge (fake reflection of lamps)
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(LOOP * 3, HALF * 2), new THREE.MeshStandardMaterial({ color: 0x0a0b10, roughness: 0.18, metalness: 0.7, transparent: true, opacity: 0.22 }));
  sheen.rotation.x = -Math.PI / 2; sheen.position.y = 0.003; g.add(sheen);

  // ---------- kerbs (red/white, both edges) ----------
  const kerbTex = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#a9aab2' : '#8f1d16'; c.fillRect(i * 32, 0, 32, h); } }, LOOP / 1.6, 1);
  const kerbM = new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(LOOP * 3, 0.04, 0.38), kerbM); k.position.set(0, 0.02, s * (HALF + 0.17)); k.receiveShadow = true; g.add(k);
  }

  // ---------- run-off + barriers + catch fence (moving) ----------
  const runoff = new THREE.Mesh(new THREE.PlaneGeometry(LOOP * 3, 60), new THREE.MeshStandardMaterial({ color: 0x070709, roughness: 1 }));
  runoff.rotation.x = -Math.PI / 2; runoff.position.y = -0.01; g.add(runoff);
  const barrierM = new THREE.MeshStandardMaterial({ color: 0x6c6e78, roughness: 0.6, metalness: 0.15 });
  const tecproM = new THREE.MeshStandardMaterial({ color: 0x7a1a14, roughness: 0.85 });
  const segGeo = new THREE.BoxGeometry(3.9, 0.9, 0.35);
  const n = Math.ceil(LOOP * 3 / 4);
  for (const s of [-1, 1]) {
    const inst = new THREE.InstancedMesh(segGeo, barrierM, n);
    const tp = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 1.0, 0.6), tecproM, Math.ceil(n / 3));
    const m = new THREE.Matrix4(); let ti = 0;
    for (let i = 0; i < n; i++) {
      const x = -LOOP * 1.5 + i * 4;
      m.makeTranslation(x, 0.45, s * (HALF + 3.6)); inst.setMatrixAt(i, m);
      if (i % 3 === 0 && ti < tp.count) { m.makeTranslation(x + 1, 0.5, s * (HALF + 3.1)); tp.setMatrixAt(ti++, m); }
    }
    inst.castShadow = tier === 'high'; moving.add(inst); moving.add(tp);
    // catch fence: thin posts + translucent mesh plane
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 3.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a2b31, metalness: 0.7, roughness: 0.5 }), Math.ceil(n / 2));
    for (let i = 0; i < posts.count; i++) { m.makeTranslation(-LOOP * 1.5 + i * 8, 1.6 + 0.9, s * (HALF + 3.9)); posts.setMatrixAt(i, m); }
    moving.add(posts);
    const fence = new THREE.Mesh(new THREE.PlaneGeometry(LOOP * 3, 3.2), new THREE.MeshBasicMaterial({ color: 0x3a3b44, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
    fence.position.set(0, 0.9 + 1.6, s * (HALF + 3.92)); g.add(fence);
  }

  // ---------- lamp posts with emissive heads (moving) ----------
  const lamps = [];
  const poleM = new THREE.MeshStandardMaterial({ color: 0x1d1e24, metalness: 0.6, roughness: 0.5 });
  const headM = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff1d0, emissiveIntensity: 3.5 });
  for (let i = 0; i < Math.ceil(LOOP * 3 / 24); i++) {
    for (const s of [-1, 1]) {
      const x = -LOOP * 1.5 + i * 24 + (s > 0 ? 12 : 0);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 11, 8), poleM); pole.position.set(x, 5.5, s * (HALF + 3.4)); moving.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.6), poleM); arm.position.set(x, 10.9, s * (HALF + 2.2)); moving.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.9), headM); head.position.set(x, 10.85, s * (HALF + 1.0)); moving.add(head);
      // glow sprite
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff1d0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(4.5, 4.5, 1); glow.position.copy(head.position); moving.add(glow);
      lamps.push(head);
    }
  }

  // ---------- grandstand + skyline silhouettes (moving, far) ----------
  const standM = new THREE.MeshStandardMaterial({ color: 0x0e0f14, roughness: 1 });
  const stand = new THREE.InstancedMesh(new THREE.BoxGeometry(22, 9, 10), standM, Math.ceil(LOOP * 3 / 26));
  const mm = new THREE.Matrix4();
  for (let i = 0; i < stand.count; i++) { mm.makeTranslation(-LOOP * 1.5 + i * 26, 4.5, -(HALF + 14)); stand.setMatrixAt(i, mm); }
  moving.add(stand);
  // crowd/city lights: points
  const pts = []; const cols = [];
  for (let i = 0; i < 900; i++) {
    const x = -LOOP * 1.5 + Math.random() * LOOP * 3, y = 1 + Math.random() * 8, z = -(HALF + 9.2) - Math.random() * 1.2;
    pts.push(x, y, z); const warm = Math.random() < 0.7; cols.push(warm ? 1 : 0.6, warm ? 0.85 : 0.8, warm ? 0.55 : 1);
  }
  for (let i = 0; i < 500; i++) { pts.push(-LOOP * 1.5 + Math.random() * LOOP * 3, 6 + Math.random() * 22, -(HALF + 40) - Math.random() * 40); cols.push(0.9, 0.9, 1); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const crowd = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true }));
  moving.add(crowd);
  // towers behind
  for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(8 + Math.random() * 10, 20 + Math.random() * 30, 8), standM); t.position.set(-LOOP * 1.5 + i * 60 + Math.random() * 20, 10, -(HALF + 50) - Math.random() * 20); moving.add(t); }

  // ---------- pit wall on the camera side (moving) ----------
  const pit = new THREE.Mesh(new THREE.BoxGeometry(LOOP * 3, 1.1, 0.3), new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.9 }));
  pit.position.set(0, 0.55, HALF + 4.2); g.add(pit);

  let offset = 0;
  function advance(dx) {
    offset = (offset + dx) % LOOP;
    moving.position.x = -offset;
    asphaltTex.offset.x += dx / (LOOP * 3) * 24;   // texture repeats 24× over the plane
    kerbTex.offset.x += dx / (LOOP * 3) * (LOOP / 1.6);
  }
  return { group: g, advance, lamps, HALF };
}

let _glow;
function glowTex() {
  if (_glow) return _glow;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,240,210,.5)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
  c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(cv); return _glow;
}
export { glowTex };

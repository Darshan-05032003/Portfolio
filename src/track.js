/* Night circuit built along the endless racing line from road.js. Every frame the visible stretch is
   rebuilt in the car's own frame (car at the origin, facing +X), so corners bend the asphalt, kerbs,
   run-off, walls, fences and lamps around the car. Ribbons are fixed-size buffers updated in place;
   trackside objects are instanced. Axis: +X forward, +Y up, +Z right. Units: metres. */
import * as THREE from '../vendor/three.module.min.js';

const HALF = 6.0;            // half track width
const UV_WRAP = 3200;        // texture coordinates wrap here (multiple of every tile length)

function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* A ribbon swept along the road: profile = [[lateral, height, v], ...] across the road. */
function ribbon(maxN, profile, material, tile) {
  const P = profile.length;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(maxN * P * 3), uv = new Float32Array(maxN * P * 2), idx = [];
  for (let i = 0; i < maxN - 1; i++) for (let j = 0; j < P - 1; j++) {
    const a = i * P + j, b = a + 1, c = a + P, d = c + 1; idx.push(a, b, c, b, d, c);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, material); mesh.frustumCulled = false; mesh.receiveShadow = true;
  return {
    mesh,
    /* frame: list of {s, lx, lz, rx, rz} — local position and right-vector of each sample */
    update(frame) {
      const n = Math.min(frame.length, maxN);
      for (let i = 0; i < n; i++) {
        const f = frame[i], u = (((f.s % UV_WRAP) + UV_WRAP) % UV_WRAP) / tile;
        for (let j = 0; j < P; j++) {
          const [w, y, v] = profile[j], k = (i * P + j);
          pos[k * 3] = f.lx + f.rx * w; pos[k * 3 + 1] = y; pos[k * 3 + 2] = f.lz + f.rz * w;
          uv[k * 2] = u; uv[k * 2 + 1] = v;
        }
      }
      geo.setDrawRange(0, Math.max(0, n - 1) * (P - 1) * 6);
      geo.attributes.position.needsUpdate = true; geo.attributes.uv.needsUpdate = true;
      geo.computeVertexNormals();
    }
  };
}

export function buildTrack(tier, road) {
  const g = new THREE.Group();
  const maxN = Math.ceil((road.AHEAD + road.BEHIND) / road.STEP) + 6;
  const mats = [];
  const std = (o) => { const m = new THREE.MeshStandardMaterial(o); mats.push(m); return m; };

  /* ---------- textures ---------- */
  const asphaltTex = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#0c0c0d'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60000; i++) { const v = 8 + Math.random() * 18; c.fillStyle = `rgb(${v},${v},${v + 2})`; c.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3); }
    // rubbered racing line and tyre marks
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(0.44, 'rgba(0,0,0,.5)'); gr.addColorStop(0.56, 'rgba(0,0,0,.5)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 6; for (let i = 0; i < 6; i++) { c.beginPath(); const y = h * (0.38 + Math.random() * 0.24); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 10, w * 0.6, y - 10, w, y); c.stroke(); }
    // white edge lines
    c.fillStyle = 'rgba(200,200,206,.55)'; c.fillRect(0, 8, w, 9); c.fillRect(0, h - 17, w, 9);
  });
  const asphaltRough = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#d0d0d0'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8000; i++) { const v = 150 + Math.random() * 105; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    c.fillStyle = 'rgba(80,80,80,.6)'; c.fillRect(0, h * 0.42, w, h * 0.16);   // polished racing line: shinier
  }, false);
  const kerbTex = canvasTex(256, 64, (c, w, h) => {
    for (let i = 0; i < 2; i++) { c.fillStyle = i ? '#8e8f96' : '#7d1913'; c.fillRect(i * 128, 0, 128, h); }
    c.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 400; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 1);
  });
  const runoffTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#16191a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = 18 + Math.random() * 20; c.fillStyle = `rgb(${v - 4},${v + 2},${v})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 2); }
  });
  const wallTex = canvasTex(1024, 128, (c, w, h) => {
    // concrete wall panels with plain painted bands (no brands)
    for (let i = 0; i < 4; i++) {
      c.fillStyle = ['#222328', '#6e7076', '#222328', '#a8401a'][i]; c.fillRect(i * 256, 0, 256, h);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(i * 256, 0, 3, h);
    }
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, h - 22, w, 22);
  });

  /* ---------- ribbons ---------- */
  const R = [];
  const add = (profile, mat, tile, shadow = false) => { const r = ribbon(maxN, profile, mat, tile); r.mesh.castShadow = shadow; g.add(r.mesh); R.push(r); return r; };
  const asphaltM = std({ map: asphaltTex, roughnessMap: asphaltRough, roughness: 0.92, metalness: 0.0 });
  asphaltTex.repeat.set(1, 1);
  add([[-HALF, 0, 0], [HALF, 0, 1]], asphaltM, 16);
  const kerbM = std({ map: kerbTex, roughness: 0.55 });
  for (const s of [-1, 1]) add([[s * HALF, 0.0, 0], [s * (HALF + 0.2), 0.04, 0.5], [s * (HALF + 0.55), 0.04, 1]].sort((a, b) => a[0] - b[0]), kerbM, 3.2);
  const runoffM = std({ map: runoffTex, roughness: 0.95 });
  for (const s of [-1, 1]) add([[s * (HALF + 0.55), 0.0, 0], [s * (HALF + 4.0), 0.0, 1]].sort((a, b) => a[0] - b[0]), runoffM, 8);
  const farM = std({ color: 0x050506, roughness: 1 });
  for (const s of [-1, 1]) add([[s * (HALF + 4.4), -0.02, 0], [s * 140, -0.02, 1]].sort((a, b) => a[0] - b[0]), farM, 50);
  const wallM = std({ map: wallTex, roughness: 0.7 });
  for (const s of [-1, 1]) add(s > 0 ? [[HALF + 4.0, 0, 1], [HALF + 4.0, 1.05, 0], [HALF + 4.3, 1.05, 0]] : [[-(HALF + 4.3), 1.05, 0], [-(HALF + 4.0), 1.05, 0], [-(HALF + 4.0), 0, 1]], wallM, 12.8, tier === 'high');
  const fenceTex = canvasTex(64, 64, (c, w, h) => { c.strokeStyle = 'rgba(200,205,215,.6)'; c.lineWidth = 1; for (let i = -64; i < 128; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 64, 64); c.stroke(); c.beginPath(); c.moveTo(i + 64, 0); c.lineTo(i, 64); c.stroke(); } });
  const fenceM = new THREE.MeshBasicMaterial({ map: fenceTex, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  fenceTex.repeat.set(1, 8);
  for (const s of [-1, 1]) add([[s * (HALF + 4.15), 1.05, 0], [s * (HALF + 4.15), 4.4, 1]], fenceM, 1.0);

  /* ---------- instanced trackside objects ---------- */
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const poleM = std({ color: 0x1d1e24, metalness: 0.6, roughness: 0.5 });
  const headM = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff1d0, emissiveIntensity: 4 });
  const set = (spacing, place, meshes) => ({ spacing, place, meshes });
  const inst = (geo, mat, n, shadow = false) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = shadow; m.count = 0; g.add(m); return m; };
  const N = (spacing, per = 1) => Math.ceil((road.AHEAD + road.BEHIND) / spacing + 2) * per;
  const lampSp = 30;
  const poles = inst(new THREE.CylinderGeometry(0.08, 0.12, 12, 8).translate(0, 6, 0), poleM, N(lampSp, 2));
  const arms = inst(new THREE.BoxGeometry(0.12, 0.12, 3.2).translate(0, 11.9, -1.6), poleM, N(lampSp, 2));
  const heads = inst(new THREE.BoxGeometry(0.9, 0.2, 1.2).translate(0, 11.8, -3.0), headM, N(lampSp, 2));
  const postSp = 6;
  const posts = inst(new THREE.BoxGeometry(0.08, 3.4, 0.08).translate(0, 2.75, 0), poleM, N(postSp, 2));
  const tecM = std({ color: 0x8c1e16, roughness: 0.85 });
  const tecSp = 18;
  const tecpro = inst(new THREE.BoxGeometry(2.0, 1.0, 0.7).translate(0, 0.5, 0), tecM, N(tecSp, 2), tier === 'high');
  // grandstands with a lit crowd texture (emissive), left side
  const crowdTex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#07080a'; c.fillRect(0, 0, w, h);
    for (let row = 0; row < 18; row++) for (let i = 0; i < 120; i++) {
      if (Math.random() < 0.35) continue;
      const warm = Math.random() < 0.7, b = 60 + Math.random() * 160;
      c.fillStyle = warm ? `rgb(${b},${b * 0.8},${b * 0.55})` : `rgb(${b * 0.7},${b * 0.8},${b})`;
      c.fillRect(i * (w / 120) + Math.random() * 2, 10 + row * 13 + Math.random() * 3, 2, 3);
    }
    c.fillStyle = '#ff5a1f'; c.fillRect(0, h - 10, w, 3);
  });
  const standM = new THREE.MeshStandardMaterial({ color: 0x0b0c10, emissive: 0xffffff, emissiveMap: crowdTex, emissiveIntensity: 1.2, roughness: 1 });
  const standGeo = new THREE.BoxGeometry(26, 11, 12).translate(0, 5.5, 0);
  // only the trackside face shows the crowd
  { const uvA = standGeo.attributes.uv; for (let i = 0; i < uvA.count; i++) if (i < 16 || i >= 20) { uvA.setXY(i, 0.001, 0.001); } }
  const standSp = 34;
  const stands = inst(standGeo, standM, N(standSp));
  // distant skyline towers with lit windows, both sides
  const winTex = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#060608'; c.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 9) for (let x = 6; x < w; x += 10) if (Math.random() < 0.4) { const b = 90 + Math.random() * 140; c.fillStyle = `rgb(${b},${b * 0.85},${b * 0.6})`; c.fillRect(x, y, 5, 4); } });
  const towerM = new THREE.MeshStandardMaterial({ color: 0x050507, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9, roughness: 1 });
  const towerSp = 45;
  const towers = inst(new THREE.BoxGeometry(14, 1, 12).translate(0, 0.5, 0), towerM, N(towerSp, 2));
  // light shafts under every lamp: additive cones, bright at the lamp, fading to the ground and at the
  // silhouette edges, faded with distance (the haze that makes a night circuit look filmed)
  const beamGeo = new THREE.ConeGeometry(4.2, 11.4, 28, 1, true).translate(0, 5.7, 0);
  const beamM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0xffe6c0) }, uK: { value: tier === 'low' ? 0 : 0.075 } },
    vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ vec4 p = vec4(position, 1.0); mat3 nm = mat3(modelViewMatrix);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; nm = nm * mat3(instanceMatrix);
        #endif
        vec4 mv = modelViewMatrix * p; vN = normalize(nm * normal); vV = normalize(-mv.xyz); vD = length(mv.xyz); vH = position.y;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uK; varying float vH; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float t = clamp(vH / 11.4, 0.0, 1.0);
        float a = uK * (0.25 + 0.75 * t * t) * pow(abs(dot(normalize(vN), normalize(vV))), 2.2) * exp(-vD / 85.0) * smoothstep(5.0, 16.0, vD);
        gl_FragColor = vec4(uColor * a, 1.0); }`
  });
  const beams = inst(beamGeo, beamM, N(lampSp, 2)); beams.renderOrder = 2;
  // lamp glows: one Points draw call, additive
  const glowN = N(lampSp, 2), glowPos = new Float32Array(glowN * 3);
  const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3).setUsage(THREE.DynamicDrawUsage));
  const glows = new THREE.Points(glowGeo, new THREE.PointsMaterial({ size: 7, map: glowTex(), color: 0xfff1d0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  glows.frustumCulled = false; g.add(glows);

  // the reflection environment is tuned for the car's paint; the circuit takes only a little of it
  for (const m of mats) m.envMapIntensity = m.metalness > 0.5 ? 0.5 : 0.2;

  const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  let car = { x: 0, z: 0, h: 0 };
  // world (x, z, heading) → car-local (lx, lz) and right vector
  const toLocal = (x, z) => { const dx = x - car.x, dz = z - car.z, c = Math.cos(car.h), s = Math.sin(car.h); return [dx * c - dz * s, dx * s + dz * c]; };
  function placeAlong(meshArr, spacing, sides, fn) {
    const s0 = Math.ceil((road.s - road.BEHIND + 4) / spacing) * spacing, s1 = road.s + road.AHEAD - 4;
    let n = 0;
    for (let s = s0; s <= s1; s += spacing) for (const side of sides) {
      const p = road.sample(s), [lx, lz] = toLocal(p.x, p.z), dh = p.h - car.h;
      const rx = Math.sin(-dh), rz = Math.cos(-dh);          // right vector of the road at s, in car frame
      const idx = Math.round(s / spacing) * 2 + (side > 0 ? 1 : 0);
      fn(n, lx, lz, rx, rz, dh, side, idx);
      n++;
    }
    for (const m of meshArr) { m.count = Math.min(n, m.instanceMatrix.count); m.instanceMatrix.needsUpdate = true; }
    return n;
  }
  const put = (mesh, i, x, y, z, yaw, sx = 1, sy = 1, sz = 1) => {
    if (i >= mesh.instanceMatrix.count) return;
    q.setFromAxisAngle(up, yaw); v3.set(x, y, z); sc.set(sx, sy, sz); m4.compose(v3, q, sc); mesh.setMatrixAt(i, m4);
  };

  /* road: road.js instance; carS: arc length of the car; returns the car pose for the camera rig */
  function update() {
    car = road.sample(road.s);
    const frame = road.points().map((p) => {
      const [lx, lz] = toLocal(p.x, p.z), dh = p.h - car.h;
      return { s: p.s, lx, lz, rx: Math.sin(-dh), rz: Math.cos(-dh) };
    });
    for (const r of R) r.update(frame);
    placeAlong([poles, arms, heads, beams], lampSp, [-1, 1], (i, lx, lz, rx, rz, dh, side, idx) => {
      const w = side * (HALF + 4.6), x = lx + rx * w, z = lz + rz * w, yaw = dh + (side > 0 ? 0 : Math.PI);
      put(poles, i, x, 0, z, yaw); put(arms, i, x, 0, z, yaw); put(heads, i, x, 0, z, yaw);
      put(beams, i, lx + rx * side * (HALF + 1.6), 0.05, lz + rz * side * (HALF + 1.6), dh);
      glowPos[i * 3] = lx + rx * side * (HALF + 1.6); glowPos[i * 3 + 1] = 11.7; glowPos[i * 3 + 2] = lz + rz * side * (HALF + 1.6);
    });
    glowGeo.setDrawRange(0, poles.count); glowGeo.attributes.position.needsUpdate = true;
    placeAlong([posts], postSp, [-1, 1], (i, lx, lz, rx, rz, dh, side) => { const w = side * (HALF + 4.15); put(posts, i, lx + rx * w, 0, lz + rz * w, dh); });
    placeAlong([tecpro], tecSp, [-1, 1], (i, lx, lz, rx, rz, dh, side) => { const w = side * (HALF + 3.6); put(tecpro, i, lx + rx * w, 0, lz + rz * w, dh); });
    placeAlong([stands], standSp, [-1], (i, lx, lz, rx, rz, dh, side) => { const w = -(HALF + 13); put(stands, i, lx + rx * w, 0, lz + rz * w, dh); });
    placeAlong([towers], towerSp, [-1, 1], (i, lx, lz, rx, rz, dh, side, idx) => {
      const w = side * (70 + hash(idx) * 50), hgt = 18 + hash(idx + 7) * 50;
      put(towers, i, lx + rx * w, 0, lz + rz * w, dh, 1 + hash(idx + 3), hgt, 1 + hash(idx + 5));
    });
    return car;
  }
  return { group: g, update, HALF };
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

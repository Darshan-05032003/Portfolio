/* Procedural modern ground-effect Formula car with an original livery (graphite, bare carbon, one
   orange accent, "DS 05"). Built from lofted surfaces, extruded aerofoils bent along their span,
   lathe tyres and tubes. Axis: +X nose, +Y up, +Z right. Units: metres. */
import * as THREE from './vendor/three.module.min.js';

const ACCENT = '#ff5a1f', GRAPHITE = '#202228', PIN = '#e9e9ec';
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- textures ---------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(cv, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
let _weave;
function weave() { // 2x2 twill carbon weave: colour + roughness tile
  if (_weave) return _weave;
  const n = 8, cs = 16, cv = canvas(n * cs, n * cs), rv = canvas(n * cs, n * cs);
  const c = cv.getContext('2d'), r = rv.getContext('2d');
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const horiz = ((i + j) >> 1) % 2 === 0;
    const g = horiz ? c.createLinearGradient(i * cs, 0, i * cs + cs, 0) : c.createLinearGradient(0, j * cs, 0, j * cs + cs);
    g.addColorStop(0, '#0d0e11'); g.addColorStop(0.5, horiz ? '#2a2c33' : '#1b1c21'); g.addColorStop(1, '#0d0e11');
    c.fillStyle = g; c.fillRect(i * cs, j * cs, cs, cs);
    r.fillStyle = horiz ? '#5a5a5a' : '#808080'; r.fillRect(i * cs, j * cs, cs, cs);
  }
  _weave = { map: tex(cv, { repeat: [1, 1] }), rough: tex(rv, { srgb: false, repeat: [1, 1] }) };
  return _weave;
}
function carbonMat(repeat = 20) {
  const w = weave(); const map = w.map.clone(), rough = w.rough.clone();
  map.repeat.set(repeat, repeat); rough.repeat.set(repeat, repeat); map.needsUpdate = rough.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, roughnessMap: rough, roughness: 0.55, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
}

/* Livery: paints colour + ORM (G roughness, B metalness) for a loft whose UV is u = along the car
   (1 = nose), v = around the section (0 right-mid, .25 top, .5 left-mid, .75 bottom). */
function liveryMaps(kind, W = 1024, H = 256) {
  const cv = canvas(W, H), om = canvas(W, H);
  const c = cv.getContext('2d'), o = om.getContext('2d');
  const col = c.createImageData(W, H), orm = o.createImageData(W, H);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = hex(ACCENT), G = hex(GRAPHITE), P = hex(PIN), CB = [22, 23, 27];
  // accent sweep height (sin of section angle) along the car, body only
  const sweep = (u) => u > 0.62 ? 0.15 + (u - 0.62) / 0.38 * 0.8 : u > 0.32 ? 0.15 : 0.15 + (0.32 - u) / 0.32 * 0.62;
  for (let y = 0; y < H; y++) {
    const a = (y / H) * Math.PI * 2, h = Math.sin(a);
    for (let x = 0; x < W; x++) {
      const u = x / W; let rgb = G, rough = 70, metal = 150;
      const grain = (Math.random() - 0.5) * 6;
      if (h < -0.35) { rgb = CB; rough = 120; metal = 60; }                           // bare carbon underneath
      if (kind === 'body') {
        const f = sweep(u), wdt = 0.09 + 0.05 * smoothstep(0.62, 1, u);
        if (h > f - wdt && h < f + wdt && u < 0.97) { rgb = A; rough = 80; metal = 25; }
        else if (h > f - wdt - 0.045 && h < f - wdt - 0.02 && u < 0.95 && u > 0.08) { rgb = P; rough = 80; metal = 20; }
        if (h > 0.975 && u > 0.08 && u < 0.6) { rgb = A; rough = 80; metal = 25; }      // spine line
        if (u > 0.965) { rgb = A; rough = 80; metal = 25; }                               // nose tip
      } else if (kind === 'pod') {
        if (h > 0.42 && h < 0.62 && u > 0.12) { rgb = A; rough = 80; metal = 25; }
        if (h > 0.34 && h < 0.38 && u > 0.2) { rgb = P; rough = 80; metal = 20; }
      } else if (kind === 'airbox') {
        if (h > 0.55 && u > 0.55) { rgb = A; rough = 80; metal = 25; }
      }
      const i = (y * W + x) * 4;
      col.data[i] = Math.max(0, Math.min(255, rgb[0] + grain)); col.data[i + 1] = Math.max(0, Math.min(255, rgb[1] + grain)); col.data[i + 2] = Math.max(0, Math.min(255, rgb[2] + grain)); col.data[i + 3] = 255;
      orm.data[i] = 255; orm.data[i + 1] = rough; orm.data[i + 2] = metal; orm.data[i + 3] = 255;
    }
  }
  c.putImageData(col, 0, 0); o.putImageData(orm, 0, 0);
  const map = tex(cv), orm2 = tex(om, { srgb: false }); map.flipY = false; orm2.flipY = false; // canvas row = v
  return { map, orm: orm2 };
}
let _peel;
function peel() { // clearcoat orange-peel + metallic flake: tiny normal-map noise, tiled
  if (_peel) return _peel;
  const n = 256, cv = canvas(n, n), c = cv.getContext('2d'), img = c.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const x = i % n, y = (i / n) | 0;
    const wv = Math.sin(x * 0.19) * Math.sin(y * 0.23) * 6 + Math.sin(x * 0.07 + y * 0.05) * 5;   // orange peel
    const fl = Math.random() < 0.06 ? (Math.random() - 0.5) * 70 : 0;                              // flakes
    img.data[i * 4] = 128 + wv + fl; img.data[i * 4 + 1] = 128 + wv * 0.8 - fl * 0.7; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  _peel = tex(cv, { srgb: false, repeat: [24, 6] });
  return _peel;
}
function paintMat(kind) {
  const m = liveryMaps(kind);
  return new THREE.MeshPhysicalMaterial({ map: m.map, roughnessMap: m.orm, metalnessMap: m.orm, roughness: 1, metalness: 1, normalMap: peel(), normalScale: new THREE.Vector2(0.18, 0.18), clearcoat: 1, clearcoatRoughness: 0.035, clearcoatNormalMap: peel(), clearcoatNormalScale: new THREE.Vector2(0.06, 0.06), envMapIntensity: 1.5 });
}
function decal(draw, w, h) {
  const cv = canvas(w, h); const paint = () => { const c = cv.getContext('2d'); c.clearRect(0, 0, w, h); draw(c, w, h); };
  paint();
  const t = tex(cv);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { paint(); t.needsUpdate = true; });
  return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.3, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -4 });
}
const FONT = (px) => `500 ${px}px "Archivo", "Arial Narrow", Arial, sans-serif`;

/* ---------- geometry helpers ---------- */
// Loft through superellipse sections {x, w, ht, hb, y, z, n}; top and bottom half-heights differ.
function loft(sections, segs = 56) {
  const pos = [], uv = [], idx = [];
  const x0 = Math.min(...sections.map((s) => s.x)), x1 = Math.max(...sections.map((s) => s.x));
  sections.forEach((sc, si) => {
    const n = sc.n || 3;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const pz = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n) * (sc.w / 2);
      const py = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n) * (sa >= 0 ? sc.ht : sc.hb);
      pos.push(sc.x, sc.y + py, (sc.z || 0) + pz); uv.push((sc.x - x0) / (x1 - x0 || 1), i / segs);
    }
    if (si > 0) for (let i = 0; i < segs; i++) {
      const a = (si - 1) * (segs + 1) + i, b = a + 1, c = si * (segs + 1) + i, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  });
  for (const end of [0, sections.length - 1]) { // caps
    const s = sections[end], f = pos.length / 3; pos.push(s.x, s.y, s.z || 0); uv.push(end ? 1 : 0, 0.75);
    for (let i = 0; i < segs; i++) { const a = end * (segs + 1) + i; if (end) idx.push(f, a + 1, a); else idx.push(f, a, a + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // the sections run nose → tail, so winding depends on direction; make normals point outward
  const nrm = g.attributes.normal, p = g.attributes.position; let dot = 0;
  for (let i = 0; i < p.count; i += 7) { const s = sections[Math.min(sections.length - 1, Math.floor(i / (segs + 1)))]; dot += (p.getY(i) - s.y) * nrm.getY(i) + (p.getZ(i) - (s.z || 0)) * nrm.getZ(i); }
  if (dot < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// Aerofoil extruded along Z (span), leading edge at x=0, chord toward -X.
function aerofoil(span, chord, thick, camber, segs = 40) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(-chord * 0.05, thick * 0.9 + camber, -chord * 0.45, thick + camber, -chord, camber * 0.4 + 0.004);
  sh.lineTo(-chord, camber * 0.4 - 0.002);
  sh.bezierCurveTo(-chord * 0.5, camber * 0.8, -chord * 0.1, -thick * 0.25, 0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: span, steps: segs, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -span / 2);
  return g;
}
// bend a geometry: f(t, v) mutates vertex v (THREE.Vector3) given t = |z| / halfSpan
function bend(g, half, f) {
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); f(Math.min(1, Math.abs(v.z) / half), v); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function rod(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  m.scale.set(1, 1, 0.45); m.castShadow = true; return m;
}
function tube(points, r, mat, segs = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.4);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 12, false), mat); m.castShadow = true; return m;
}
function plate(shapePts, depth, mat) { // flat plate from [x,y] points, extruded along Z, centred
  const sh = new THREE.Shape(); sh.moveTo(...shapePts[0]); for (let i = 1; i < shapePts.length; i++) sh.lineTo(...shapePts[i]);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -depth / 2); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
function curvedPlate(build, depth, mat) { const sh = new THREE.Shape(); build(sh); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 16 }); g.translate(0, 0, -depth / 2); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; }

/* ---------- the car ---------- */
export function buildCar(opts = {}) {
  const number = String(opts.number || '05');
  const g = new THREE.Group();
  const add = (m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = g) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const mesh = (geo, mat) => new THREE.Mesh(geo, mat);

  const body = paintMat('body'), pod = paintMat('pod'), airboxM = paintMat('airbox');
  const carbon = carbonMat(20), carbonFine = carbonMat(40);
  const graphite = new THREE.MeshPhysicalMaterial({ color: GRAPHITE, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5 });
  const accent = new THREE.MeshPhysicalMaterial({ color: ACCENT, metalness: 0.1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 });
  const black = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9, metalness: 0 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x08090b, roughness: 0.08, metalness: 0.2, clearcoat: 1 });
  const mirrorM = new THREE.MeshStandardMaterial({ color: 0xc8ccd6, metalness: 1, roughness: 0.04 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8b8e98, metalness: 1, roughness: 0.25 });
  const ledRed = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a12, emissiveIntensity: 0 });

  /* --- monocoque, nose, engine cover: one lofted surface --- */
  add(mesh(loft([
    { x: 2.98, w: 0.08, ht: 0.035, hb: 0.03, y: 0.3, n: 2.2 },
    { x: 2.85, w: 0.15, ht: 0.06, hb: 0.05, y: 0.31, n: 2.4 },
    { x: 2.6, w: 0.22, ht: 0.09, hb: 0.07, y: 0.33, n: 2.6 },
    { x: 2.25, w: 0.3, ht: 0.12, hb: 0.09, y: 0.37, n: 2.8 },
    { x: 1.85, w: 0.4, ht: 0.15, hb: 0.12, y: 0.42, n: 3 },
    { x: 1.45, w: 0.5, ht: 0.18, hb: 0.15, y: 0.45, n: 3.2 },
    { x: 1.05, w: 0.6, ht: 0.2, hb: 0.2, y: 0.47, n: 3.4 },
    { x: 0.6, w: 0.72, ht: 0.19, hb: 0.26, y: 0.46, n: 3.6 },
    { x: 0.15, w: 0.8, ht: 0.19, hb: 0.3, y: 0.45, n: 3.6 },
    { x: -0.35, w: 0.82, ht: 0.25, hb: 0.3, y: 0.45, n: 3.4 },
    { x: -0.8, w: 0.68, ht: 0.32, hb: 0.28, y: 0.46, n: 3 },
    { x: -1.25, w: 0.54, ht: 0.31, hb: 0.26, y: 0.45, n: 2.8 },
    { x: -1.7, w: 0.4, ht: 0.24, hb: 0.22, y: 0.42, n: 2.6 },
    { x: -2.1, w: 0.28, ht: 0.16, hb: 0.15, y: 0.38, n: 2.5 },
    { x: -2.45, w: 0.18, ht: 0.09, hb: 0.09, y: 0.36, n: 2.4 },
    { x: -2.62, w: 0.11, ht: 0.05, hb: 0.05, y: 0.36, n: 2.2 }
  ]), body));
  // pitot + antennas
  g.add(rod([2.72, 0.4, 0], [2.72, 0.52, 0], 0.006, metal)); g.add(rod([2.72, 0.52, 0], [2.86, 0.52, 0], 0.005, metal));
  g.add(rod([-1.6, 0.66, 0.05], [-1.62, 0.84, 0.05], 0.004, black));

  /* --- cockpit: opening, coaming, driver, wheel, headrest --- */
  const opening = mesh(new THREE.CircleGeometry(0.5, 40), black); opening.scale.set(0.82, 0.5, 1);
  add(opening, 0.08, 0.645, 0, -Math.PI / 2, 0, 0);
  const coaming = mesh(new THREE.TorusGeometry(0.5, 0.025, 8, 48), graphite); coaming.scale.set(0.82, 0.5, 1);
  add(coaming, 0.08, 0.648, 0, -Math.PI / 2, 0, 0);
  add(mesh(new THREE.BoxGeometry(0.2, 0.16, 0.54), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.85 })), -0.3, 0.7, 0);
  const helmetTex = decal((c, w, h) => { c.fillStyle = PIN; c.fillRect(0, 0, w, h); c.fillStyle = GRAPHITE; c.fillRect(0, h * 0.55, w, h * 0.45); c.fillStyle = ACCENT; c.fillRect(0, h * 0.42, w, h * 0.1); c.fillRect(w * 0.46, 0, w * 0.08, h * 0.45); }, 256, 128);
  helmetTex.transparent = false; helmetTex.polygonOffset = false; helmetTex.roughness = 0.2;
  const helmet = add(mesh(new THREE.SphereGeometry(0.125, 32, 20), helmetTex), -0.1, 0.79, 0);
  helmet.rotation.y = Math.PI;
  add(mesh(new THREE.SphereGeometry(0.128, 32, 12, -0.9, 1.8, 1.15, 0.42), gloss), -0.1, 0.79, 0, 0, Math.PI / 2, 0); // visor
  add(mesh(new THREE.BoxGeometry(0.03, 0.11, 0.25), black), 0.24, 0.72, 0, 0, 0, 0.35);              // steering wheel
  add(mesh(new THREE.PlaneGeometry(0.07, 0.04), new THREE.MeshBasicMaterial({ color: 0xff7a40 })), 0.256, 0.725, 0, 0, Math.PI / 2, 0.35);

  /* --- halo (painted) --- */
  g.add(tube([[-0.42, 0.66, -0.31], [-0.3, 0.88, -0.33], [-0.02, 0.97, -0.3], [0.26, 1.0, -0.17], [0.36, 1.005, 0], [0.26, 1.0, 0.17], [-0.02, 0.97, 0.3], [-0.3, 0.88, 0.33], [-0.42, 0.66, 0.31]], 0.03, graphite, 96));
  const pillar = tube([[0.36, 1.0, 0], [0.5, 0.9, 0], [0.66, 0.72, 0], [0.72, 0.64, 0]], 0.026, graphite, 24); pillar.scale.z = 0.7; g.add(pillar);

  /* --- airbox / roll hoop + T-cam --- */
  add(mesh(loft([
    { x: -0.2, w: 0.25, ht: 0.12, hb: 0.13, y: 0.86, n: 2.8 },
    { x: -0.42, w: 0.34, ht: 0.13, hb: 0.2, y: 0.83, n: 3 },
    { x: -0.8, w: 0.38, ht: 0.1, hb: 0.24, y: 0.77, n: 3 },
    { x: -1.25, w: 0.3, ht: 0.06, hb: 0.22, y: 0.7, n: 2.8 },
    { x: -1.75, w: 0.16, ht: 0.03, hb: 0.16, y: 0.6, n: 2.4 }
  ], 40), airboxM));
  const intake = mesh(new THREE.CircleGeometry(0.1, 32), black); intake.scale.set(1.1, 0.95, 1); add(intake, -0.195, 0.87, 0, 0, Math.PI / 2, 0);
  add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.24), black), -0.32, 1.02, 0); g.add(rod([-0.32, 0.97, 0], [-0.32, 1.0, 0], 0.012, black));

  /* --- shark fin with the race number on both faces --- */
  const fin = plate([[-0.95, 0.8], [-2.32, 0.54], [-2.32, 0.9], [-1.4, 0.95], [-0.95, 0.83]], 0.012, body);
  fin.material = graphite; g.add(fin);
  const finNum = decal((c, w, h) => {
    c.font = FONT(150); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 10; c.strokeStyle = ACCENT; c.strokeText(number, w * 0.5, h * 0.56); c.fillStyle = PIN; c.fillText(number, w * 0.5, h * 0.56);
    c.font = FONT(40); c.fillStyle = ACCENT; c.fillText('DS', w * 0.5, h * 0.12);
  }, 256, 256);
  for (const s of [-1, 1]) { const p = mesh(new THREE.PlaneGeometry(0.3, 0.3), finNum); add(p, -1.88, 0.76, s * 0.0075, 0, s > 0 ? 0 : Math.PI, 0); }
  // nose number
  const noseNum = decal((c, w, h) => { c.font = FONT(170); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = PIN; c.fillText(number, w / 2, h * 0.55); }, 256, 256);
  add(mesh(new THREE.PlaneGeometry(0.17, 0.17), noseNum), 2.1, 0.503, 0, -Math.PI / 2 + 0.12, 0, -Math.PI / 2);

  /* --- sidepods (downwash ramp, deep undercut) + inlets + mirrors --- */
  for (const s of [-1, 1]) {
    add(mesh(loft([
      { x: 0.78, w: 0.34, ht: 0.19, hb: 0.13, y: 0.52, z: s * 0.6, n: 4.2 },
      { x: 0.55, w: 0.44, ht: 0.2, hb: 0.15, y: 0.51, z: s * 0.61, n: 3.8 },
      { x: 0.1, w: 0.46, ht: 0.16, hb: 0.13, y: 0.48, z: s * 0.6, n: 3.4 },
      { x: -0.45, w: 0.4, ht: 0.11, hb: 0.11, y: 0.41, z: s * 0.56, n: 3 },
      { x: -1.0, w: 0.3, ht: 0.08, hb: 0.08, y: 0.33, z: s * 0.48, n: 2.8 },
      { x: -1.5, w: 0.2, ht: 0.05, hb: 0.05, y: 0.27, z: s * 0.4, n: 2.6 },
      { x: -1.95, w: 0.1, ht: 0.03, hb: 0.03, y: 0.23, z: s * 0.33, n: 2.4 }
    ], 40), pod));
    const mouth = new THREE.Shape(); const mw = 0.15, mh = 0.15;
    for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); const px = Math.sign(ca) * Math.pow(Math.abs(ca), 0.5) * mw, py = Math.sign(sa) * Math.pow(Math.abs(sa), 0.5) * mh * (sa > 0 ? 1.1 : 0.8); if (i) mouth.lineTo(px, py); else mouth.moveTo(px, py); }
    add(mesh(new THREE.ShapeGeometry(mouth), black), 0.785, 0.53, s * 0.6, 0, Math.PI / 2, 0);
    // mirror on a stalk from the sidepod shoulder
    g.add(rod([0.5, 0.68, s * 0.46], [0.56, 0.84, s * 0.52], 0.012, carbon));
    const hous = mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 12), graphite); add(hous, 0.57, 0.86, s * 0.53, Math.PI / 2, 0, 0);
    add(mesh(new THREE.PlaneGeometry(0.13, 0.05), mirrorM), 0.535, 0.86, s * 0.53, 0, -Math.PI / 2, 0);
    // floor edge wing (curled)
    const edge = mesh(bend(aerofoil(1.0, 0.12, 0.012, 0.02, 20), 0.5, (t, v) => { v.y += 0.03 * t * t; }), carbonFine);
    add(edge, 0.25, 0.2, s * 0.86, 0, Math.PI / 2, 0.15);
  }

  /* --- floor, fences, plank, diffuser with strakes --- */
  const fl = new THREE.Shape();
  fl.moveTo(1.3, -0.5); fl.bezierCurveTo(1.1, -0.82, 0.9, -0.86, 0.6, -0.86); fl.lineTo(-1.3, -0.86); fl.bezierCurveTo(-1.5, -0.86, -1.55, -0.66, -1.75, -0.62);
  fl.lineTo(-2.25, -0.6); fl.lineTo(-2.25, 0.6); fl.lineTo(-1.75, 0.62); fl.bezierCurveTo(-1.55, 0.66, -1.5, 0.86, -1.3, 0.86); fl.lineTo(0.6, 0.86); fl.bezierCurveTo(0.9, 0.86, 1.1, 0.82, 1.3, 0.5); fl.lineTo(1.3, -0.5);
  const floorG = new THREE.ExtrudeGeometry(fl, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 18 });
  const floorM = carbonMat(20); floorM.color.setScalar(0.45); floorM.clearcoat = 0; floorM.roughness = 0.9; floorM.envMapIntensity = 0.35;
  add(mesh(floorG, floorM), 0, 0.15, 0, Math.PI / 2, 0, 0);
  add(mesh(new THREE.BoxGeometry(3.0, 0.012, 0.3), new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.8 })), -0.4, 0.105, 0); // plank
  for (const s of [-1, 1]) for (const z of [0.32, 0.46, 0.6]) add(plate([[1.25, 0], [0.75, 0], [0.75, 0.05], [1.2, 0.07]], 0.01, carbonFine), 0, 0.09, s * z);
  const diff = mesh(new THREE.BoxGeometry(0.7, 0.02, 1.2), carbon); add(diff, -2.55, 0.25, 0, 0, 0, -0.32);
  for (const z of [-0.6, -0.3, 0, 0.3, 0.6]) add(plate([[-2.22, 0.12], [-2.9, 0.38], [-2.9, 0.42], [-2.22, 0.18]], 0.012, carbon), 0, 0, z);

  /* --- front wing: 4 elements bent along the span into rounded endplates --- */
  const fw = new THREE.Group(); fw.position.set(2.98, 0.11, 0); g.add(fw);
  const fwHalf = 0.97;
  for (let e = 0; e < 4; e++) {
    const chord = [0.34, 0.2, 0.15, 0.1][e], lift = [0, 0.05, 0.1, 0.15][e], back = [0, 0.26, 0.38, 0.47][e];
    const geo = bend(aerofoil(fwHalf * 2, chord, e === 3 ? 0.01 : 0.018, 0.02 + e * 0.006, 60), fwHalf, (t, v) => {
      const out = smoothstep(0.08, 1, t);                 // flaps meet the nose high and roll down outboard
      const tip = smoothstep(0.8, 1, t);
      v.x *= 1 - 0.35 * tip;
      v.y += lift * (1 - 0.5 * out) + 0.02 * tip;
      v.x += -back * (1 - 0.15 * out) + 0.06 * tip;
    });
    const el = mesh(geo, e === 3 ? accent : e === 0 ? carbon : graphite); el.rotation.z = -0.08 - e * 0.13; el.castShadow = true; fw.add(el);
  }
  for (const s of [-1, 1]) {
    const ep = curvedPlate((sh) => { sh.moveTo(0.03, 0); sh.lineTo(-0.62, 0); sh.quadraticCurveTo(-0.72, 0.02, -0.7, 0.14); sh.quadraticCurveTo(-0.6, 0.3, -0.36, 0.3); sh.quadraticCurveTo(-0.1, 0.26, 0.03, 0.1); sh.lineTo(0.03, 0); }, 0.014, carbon);
    ep.position.set(0, -0.01, s * fwHalf); fw.add(ep);
  }
  for (const s of [-1, 1]) g.add(rod([2.55, 0.3, s * 0.06], [2.7, 0.15, s * 0.08], 0.018, carbon)); // nose pillars

  /* --- rear wing: spoon main plane wrapping into rounded endplates, DRS flap, swan neck, beam wing --- */
  const rw = new THREE.Group(); rw.position.set(-2.38, 0.9, 0); g.add(rw);
  const rwHalf = 0.5;
  const mainG = bend(aerofoil(rwHalf * 2, 0.34, 0.03, 0.035, 50), rwHalf, (t, v) => { const o = smoothstep(0.65, 1, t); v.y -= 0.12 * o * o; v.x *= 1 - 0.25 * o; });
  const main = mesh(mainG, carbon); main.rotation.z = -0.2; rw.add(main);
  const drs = new THREE.Group(); drs.position.set(-0.27, 0.075, 0); rw.add(drs);
  const flapG = bend(aerofoil(rwHalf * 2 - 0.02, 0.19, 0.018, 0.02, 50), rwHalf, (t, v) => { const o = smoothstep(0.7, 1, t); v.y -= 0.08 * o * o; });
  const flap = mesh(flapG, accent); flap.rotation.z = -0.55; drs.add(flap);
  const rwNum = decal((c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.fillRect(0, 0, w, h); c.font = FONT(120); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ACCENT; c.fillText('DS', w / 2, h * 0.55); }, 256, 128);
  for (const s of [-1, 1]) {
    const ep = curvedPlate((sh) => { sh.moveTo(0.06, -0.62); sh.lineTo(0.06, 0.02); sh.quadraticCurveTo(0.04, 0.16, -0.12, 0.17); sh.lineTo(-0.36, 0.14); sh.quadraticCurveTo(-0.44, 0.1, -0.44, 0.0); sh.lineTo(-0.44, -0.4); sh.quadraticCurveTo(-0.38, -0.6, -0.2, -0.62); sh.lineTo(0.06, -0.62); }, 0.014, graphite);
    ep.position.set(0, 0, s * (rwHalf + 0.006)); rw.add(ep);
    const lab = mesh(new THREE.PlaneGeometry(0.28, 0.14), rwNum); lab.position.set(-0.19, -0.22, s * (rwHalf + 0.015)); lab.rotation.y = s > 0 ? 0 : Math.PI; rw.add(lab);
    const led = mesh(new THREE.BoxGeometry(0.012, 0.22, 0.016), ledRed); led.position.set(-0.445, -0.18, s * (rwHalf + 0.006)); rw.add(led);
  }
  g.add(tube([[-2.15, 0.6, 0], [-2.38, 0.66, 0], [-2.5, 0.8, 0], [-2.44, 0.95, 0]], 0.03, carbon, 24)); // swan-neck pylon
  for (const k of [0, 1]) { const bw = mesh(aerofoil(0.86, 0.13 - k * 0.03, 0.012, 0.012, 10), carbon); bw.rotation.z = -0.25 - k * 0.3; add(bw, -2.5 - k * 0.1, 0.42 + k * 0.08, 0); bw.rotation.z = -0.25 - k * 0.3; }
  // crash structure + rain light + exhaust
  add(mesh(loft([{ x: -2.4, w: 0.16, ht: 0.06, hb: 0.06, y: 0.36 }, { x: -2.78, w: 0.1, ht: 0.04, hb: 0.04, y: 0.33 }], 24), carbon));
  const rain = add(mesh(new THREE.BoxGeometry(0.02, 0.05, 0.07), ledRed), -2.79, 0.33, 0);
  const exhaust = add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.2, 20, 1, true), metal), -2.45, 0.52, 0, 0, 0, Math.PI / 2);
  exhaust.material = new THREE.MeshStandardMaterial({ color: 0x4a3a30, metalness: 1, roughness: 0.35, side: THREE.DoubleSide, emissive: 0xff4a10, emissiveIntensity: 0 });

  /* --- wheels: lathe tyres with sidewall marks, wheel covers, brake glow, suspension --- */
  const tyreTex = (() => {
    const cv = canvas(1024, 64), c = cv.getContext('2d');
    c.fillStyle = '#121214'; c.fillRect(0, 0, 1024, 64);
    c.fillStyle = '#19191c'; c.fillRect(0, 18, 1024, 28);                 // tread, slightly worn
    // the car never stops, so a real camera sees the sidewall marks smeared into faint rings:
    // paint them pre-blurred (a 1/50 s shutter at 200 km/h turns a wheel ~180°)
    for (const y of [9, 51]) { c.fillStyle = '#c4232a'; c.fillRect(0, y, 1024, 3); c.fillStyle = 'rgba(201,201,207,.16)'; c.fillRect(0, y - 5, 1024, 2); }
    c.fillStyle = 'rgba(255,255,255,.025)'; for (let k = 0; k < 200; k++) c.fillRect(Math.random() * 1024, 18 + Math.random() * 28, 1, 1);
    return tex(cv);
  })();
  const tyreM = new THREE.MeshStandardMaterial({ map: tyreTex, roughness: 0.88, metalness: 0 });
  const coverTex = (() => {
    const cv = canvas(512, 512), c = cv.getContext('2d'), r = 256;
    const g2 = c.createRadialGradient(r, r, 10, r, r, r); g2.addColorStop(0, '#2a2c33'); g2.addColorStop(1, '#141519'); c.fillStyle = g2; c.fillRect(0, 0, 512, 512);
    c.strokeStyle = ACCENT; c.lineWidth = 14; c.beginPath(); c.arc(r, r, r - 18, 0, Math.PI * 2); c.stroke();
    // spokes smeared by the rotation into a soft ring (motion blur baked in)
    const sp = c.createRadialGradient(r, r, 40, r, r, 220); sp.addColorStop(0, 'rgba(233,233,236,0)'); sp.addColorStop(0.5, 'rgba(233,233,236,.07)'); sp.addColorStop(1, 'rgba(233,233,236,0)');
    c.fillStyle = sp; c.beginPath(); c.arc(r, r, 220, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1; for (let k = 0; k < 40; k++) { c.beginPath(); c.arc(r, r, 60 + k * 4, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#0b0b0d'; c.beginPath(); c.arc(r, r, 34, 0, Math.PI * 2); c.fill();
    return tex(cv);
  })();
  const coverM = new THREE.MeshPhysicalMaterial({ map: coverTex, roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const brakeM = []; const wheels = [];
  const mkWheel = (x, z, width, front) => {
    const R = 0.36, rim = 0.232, h = width / 2;
    const w = new THREE.Group(); w.position.set(x, R, z); g.add(w);
    const inner = new THREE.Group(); inner.rotation.x = Math.PI / 2; w.add(inner);   // lathe axis Y → wheel axle Z
    const prof = [[rim, -h + 0.01], [0.3, -h - 0.004], [0.345, -h + 0.02], [R, -h + 0.06], [R, h - 0.06], [0.345, h - 0.02], [0.3, h + 0.004], [rim, h - 0.01]].map((p) => new THREE.Vector2(p[0], p[1]));
    const tyre = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), tyreM); tyre.castShadow = true; tyre.receiveShadow = true; inner.add(tyre);
    const outerSide = z > 0 ? 1 : -1;
    // wheel cover on the outside (slight dome), dark rim barrel on the inside
    const cover = new THREE.Mesh(new THREE.CircleGeometry(rim, 48), coverM); cover.position.y = outerSide * (h - 0.006); cover.rotation.x = outerSide > 0 ? -Math.PI / 2 : Math.PI / 2; inner.add(cover);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rim - 0.002, rim - 0.002, width - 0.02, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.6, side: THREE.DoubleSide })); inner.add(barrel);
    const bm = new THREE.MeshStandardMaterial({ color: 0x1a0a04, emissive: 0xff5a10, emissiveIntensity: 0, roughness: 0.5 }); brakeM.push(bm);
    const disc = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 40), bm); disc.rotation.x = Math.PI / 2; disc.position.y = -outerSide * (h - 0.04); inner.add(disc);
    // brake duct drum (static: lives on the upright, not the spinning wheel)
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 28), carbon); duct.rotation.x = Math.PI / 2; duct.position.set(x, R, z - outerSide * (h + 0.05)); duct.castShadow = true; g.add(duct);
    wheels.push(w);
    // suspension: wishbones + push/pull rod + track rod, carbon aero tubes
    const sz = outerSide, zi = sz * (front ? 0.2 : 0.24), zo = z - sz * (h + 0.06);
    if (front) {
      g.add(rod([x + 0.25, 0.52, zi], [x, 0.56, zo], 0.016, carbonFine)); g.add(rod([x - 0.25, 0.5, zi], [x, 0.56, zo], 0.016, carbonFine));
      g.add(rod([x + 0.28, 0.3, zi], [x, 0.2, zo], 0.016, carbonFine)); g.add(rod([x - 0.28, 0.3, zi], [x, 0.2, zo], 0.016, carbonFine));
      g.add(rod([x - 0.02, 0.22, zo + sz * 0.02], [x - 0.12, 0.6, sz * 0.16], 0.014, carbonFine));          // pushrod
      g.add(rod([x + 0.12, 0.4, zo], [x + 0.12, 0.42, zi], 0.01, carbonFine));                                // track rod
      // wheel wake deflector over the front tyre
      const arc = curvedPlate((sh) => { sh.absarc(0, 0, R + 0.05, Math.PI * 0.25, Math.PI * 0.75, false); sh.absarc(0, 0, R + 0.025, Math.PI * 0.75, Math.PI * 0.25, true); }, 0.08, carbonFine);
      arc.position.set(x, R, z - sz * (h - 0.06)); g.add(arc);
    } else {
      g.add(rod([x + 0.3, 0.48, zi], [x, 0.56, zo], 0.016, carbonFine)); g.add(rod([x - 0.2, 0.5, zi], [x, 0.56, zo], 0.016, carbonFine));
      g.add(rod([x + 0.32, 0.26, zi], [x, 0.18, zo], 0.016, carbonFine)); g.add(rod([x - 0.2, 0.26, zi], [x, 0.18, zo], 0.016, carbonFine));
      g.add(rod([x + 0.02, 0.56, zo + sz * 0.02], [x + 0.12, 0.24, sz * 0.18], 0.014, carbonFine));          // pullrod
      g.add(rod([x - 0.12, 0.36, zo], [x - 0.12, 0.36, zi], 0.01, carbonFine));                               // toe link
    }
  };
  mkWheel(1.75, 0.79, 0.305, true); mkWheel(1.75, -0.79, 0.305, true);
  mkWheel(-1.85, 0.79, 0.405, false); mkWheel(-1.85, -0.79, 0.405, false);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { wheels, drs, fw, rw, brakeM, ledRed, exhaustM: exhaust.material, rain };
  return g;
}

/* Soft contact shadow: a dark ellipse under the car (no shadow maps needed on mobile). */
export function contactShadow() {
  const cv = canvas(256, 128);
  const c = cv.getContext('2d');
  const gr = c.createRadialGradient(128, 64, 10, 128, 64, 120);
  gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.scale(1, 0.5); c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.renderOrder = 1;
  return m;
}

/* Procedural modern (ground-effect era) Formula car, built from low-poly primitives.
   Axis: +X nose, +Y up, +Z right. Units in metres. ~6k triangles. */
import * as THREE from './vendor/three.module.min.js';

export function buildCar(opts = {}) {
  const livery = opts.livery || 0x1b1c22;      // paint (carbon black)
  const accent = opts.accent || 0xff5a1f;      // one accent line + number
  const carbon = 0x15161a;
  const g = new THREE.Group();

  const paint = new THREE.MeshPhysicalMaterial({ color: livery, metalness: 0.7, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4 });
  const carbonM = new THREE.MeshStandardMaterial({ color: carbon, metalness: 0.5, roughness: 0.45 });
  const matte = new THREE.MeshStandardMaterial({ color: 0x1d1e24, metalness: 0.2, roughness: 0.75 });
  const accentM = new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0.2, roughness: 0.35, clearcoat: 0.8 });
  const tyreM = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.92, metalness: 0 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0x3a3b42, metalness: 0.9, roughness: 0.3 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, metalness: 0, roughness: 0.05, transmission: 0, clearcoat: 1 });
  const halo = new THREE.MeshStandardMaterial({ color: 0x2b2c33, metalness: 0.8, roughness: 0.35 });

  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = g) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // Loft a smooth tube through cross-sections. section = { x, w, h, y, z?, n? } (superellipse, n = squareness)
  const loft = (sections, segs = 24, closed = true) => {
    const pos = [], idx = [];
    sections.forEach((sc, si) => {
      const n = sc.n || 3.2;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const cx = Math.cos(a), sy = Math.sin(a);
        const px = Math.sign(cx) * Math.pow(Math.abs(cx), 2 / n) * (sc.w / 2);
        const py = Math.sign(sy) * Math.pow(Math.abs(sy), 2 / n) * (sc.h / 2);
        pos.push(sc.x, sc.y + py, (sc.z || 0) + px);
      }
      if (si > 0) for (let i = 0; i < segs; i++) {
        const a = (si - 1) * segs + i, b = (si - 1) * segs + (i + 1) % segs, c = si * segs + i, d = si * segs + (i + 1) % segs;
        idx.push(a, c, b, b, c, d);
      }
    });
    if (closed) { // cap both ends with a fan
      const f0 = pos.length / 3; pos.push(sections[0].x, sections[0].y, sections[0].z || 0);
      for (let i = 0; i < segs; i++) idx.push(f0, (i + 1) % segs, i);
      const last = sections.length - 1, f1 = pos.length / 3; pos.push(sections[last].x, sections[last].y, sections[last].z || 0);
      for (let i = 0; i < segs; i++) idx.push(f1, last * segs + i, last * segs + (i + 1) % segs);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  };

  // ---------- floor + diffuser ----------
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-2.35, -0.78); floorShape.lineTo(1.25, -0.78); floorShape.lineTo(1.45, -0.55); floorShape.lineTo(1.45, 0.55);
  floorShape.lineTo(1.25, 0.78); floorShape.lineTo(-2.35, 0.78); floorShape.lineTo(-2.35, -0.78);
  const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 0.05, bevelEnabled: false });
  const floor = new THREE.Mesh(floorGeo, carbonM); floor.rotation.x = Math.PI / 2; floor.position.y = 0.12; floor.castShadow = true; floor.receiveShadow = true; g.add(floor);
  // diffuser kick
  add(box(0.6, 0.05, 1.4), carbonM, -2.45, 0.22, 0, 0, 0, -0.35);
  add(box(0.55, 0.3, 0.03), carbonM, -2.45, 0.3, -0.62, 0, 0, -0.3);
  add(box(0.55, 0.3, 0.03), carbonM, -2.45, 0.3, 0.62, 0, 0, -0.3);

  // ---------- monocoque + engine cover: one lofted body ----------
  const bodyGeo = loft([
    { x: 2.95, w: 0.12, h: 0.10, y: 0.44, n: 2.2 },
    { x: 2.5, w: 0.26, h: 0.2, y: 0.43, n: 2.4 },
    { x: 1.9, w: 0.42, h: 0.3, y: 0.44, n: 2.8 },
    { x: 1.3, w: 0.62, h: 0.42, y: 0.42, n: 3.2 },
    { x: 0.8, w: 0.72, h: 0.5, y: 0.44, n: 3.4 },
    { x: 0.35, w: 0.74, h: 0.58, y: 0.47, n: 3.4 },
    { x: -0.2, w: 0.74, h: 0.6, y: 0.5, n: 3.2 },
    { x: -0.8, w: 0.62, h: 0.62, y: 0.55, n: 2.8 },
    { x: -1.4, w: 0.5, h: 0.5, y: 0.52, n: 2.6 },
    { x: -2.0, w: 0.34, h: 0.34, y: 0.46, n: 2.4 },
    { x: -2.4, w: 0.2, h: 0.2, y: 0.42, n: 2.2 }
  ]);
  const bodyM = add(bodyGeo, paint);
  // cockpit opening, headrest, screen, helmet
  add(box(0.7, 0.14, 0.46), matte, 0.25, 0.76, 0);
  add(box(0.22, 0.2, 0.48), matte, -0.22, 0.86, 0);
  add(box(0.26, 0.07, 0.44), glassM, 0.62, 0.78, 0, 0, 0, 0.55);
  add(new THREE.SphereGeometry(0.135, 16, 12), accentM, -0.02, 0.9, 0);
  // halo
  const haloT = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.028, 8, 24, Math.PI), halo);
  haloT.rotation.x = -Math.PI / 2; haloT.position.set(0.02, 1.02, 0); haloT.scale.set(1.25, 1, 1); g.add(haloT);
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.42, 8), halo, 0.62, 0.86, 0, 0, 0, 0.95);
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.3, 8), halo, -0.42, 0.95, -0.33, 0.3, 0, 0);
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.3, 8), halo, -0.42, 0.95, 0.33, -0.3, 0, 0);
  // airbox + intake
  add(loft([{ x: -0.3, w: 0.3, h: 0.22, y: 1.08, n: 3 }, { x: -0.7, w: 0.44, h: 0.3, y: 1.0, n: 3 }, { x: -1.3, w: 0.3, h: 0.2, y: 0.9, n: 2.6 }, { x: -1.9, w: 0.1, h: 0.08, y: 0.72, n: 2.2 }]), paint);
  add(box(0.06, 0.16, 0.22), matte, -0.28, 1.08, 0);
  // shark fin
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.lineTo(1.4, 0); fin.lineTo(1.4, 0.06); fin.lineTo(0.1, 0.36); fin.lineTo(0, 0.36);
  const finM = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.02, bevelEnabled: false }), paint);
  finM.position.set(-2.35, 0.6, -0.01); finM.castShadow = true; g.add(finM);

  // ---------- sidepods (lofted, coke-bottle) ----------
  for (const sgn of [-1, 1]) {
    add(loft([
      { x: 0.6, w: 0.5, h: 0.44, y: 0.5, z: sgn * 0.62, n: 3.6 },
      { x: 0.2, w: 0.56, h: 0.46, y: 0.5, z: sgn * 0.62, n: 3.4 },
      { x: -0.5, w: 0.48, h: 0.4, y: 0.5, z: sgn * 0.6, n: 3.0 },
      { x: -1.2, w: 0.3, h: 0.28, y: 0.44, z: sgn * 0.5, n: 2.6 },
      { x: -1.8, w: 0.12, h: 0.12, y: 0.34, z: sgn * 0.42, n: 2.2 }
    ]), paint);
    add(box(0.05, 0.3, 0.36), matte, 0.62, 0.52, sgn * 0.62);         // inlet (dark mouth)
    add(box(0.9, 0.08, 0.02), carbonM, 0.9, 0.18, sgn * 0.8);           // floor edge wing
    add(box(0.08, 0.05, 0.13), carbonM, 0.75, 0.9, sgn * 0.55);          // mirror
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), carbonM, 0.75, 0.8, sgn * 0.47, 0.55 * sgn, 0, 0);
  }

  // ---------- front wing ----------
  const fw = new THREE.Group(); fw.position.set(2.55, 0.14, 0);
  const wingProfile = (w, chord, thick, camber) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.quadraticCurveTo(chord * 0.5, camber + thick, chord, 0.02); sh.lineTo(chord, -0.01); sh.quadraticCurveTo(chord * 0.5, camber, 0, -0.02); sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    return geo;
  };
  for (let e = 0; e < 4; e++) {
    const el = new THREE.Mesh(wingProfile(1.9 - e * 0.08, 0.26 - e * 0.03, 0.035, 0.03), e === 0 ? carbonM : paint);
    el.position.set(-e * 0.14, e * 0.045, 0); el.rotation.z = -0.12 - e * 0.1; el.castShadow = true; if (e === 3) el.material = accentM; fw.add(el);
  }
  for (const s of [-1, 1]) {
    const ep = new THREE.Mesh(box(0.5, 0.26, 0.02), carbonM); ep.position.set(-0.2, 0.1, s * 0.98); fw.add(ep);
    const ep2 = new THREE.Mesh(box(0.3, 0.02, 0.18), carbonM); ep2.position.set(-0.3, 0.24, s * 0.92); fw.add(ep2);
  }
  g.add(fw);

  // ---------- rear wing + DRS flap ----------
  const rw = new THREE.Group(); rw.position.set(-2.35, 0.78, 0);
  const main = new THREE.Mesh(wingProfile(0.95, 0.3, 0.05, 0.05), carbonM); main.rotation.z = -0.25; main.position.set(0.05, 0, 0); main.castShadow = true; rw.add(main);
  const drs = new THREE.Group(); drs.position.set(-0.12, 0.13, 0);
  const flap = new THREE.Mesh(wingProfile(0.95, 0.16, 0.03, 0.02), paint); flap.rotation.z = -0.45; flap.position.set(-0.08, 0, 0); drs.add(flap);
  rw.add(drs);
  for (const s of [-1, 1]) {
    const ep = new THREE.Mesh(box(0.42, 0.3, 0.015), carbonM); ep.position.set(-0.08, 0.1, s * 0.49); ep.castShadow = true; rw.add(ep);
    const sw = new THREE.Mesh(box(0.04, 0.5, 0.03), carbonM); sw.position.set(0.3, -0.3, s * 0.25); sw.rotation.z = 0.35; rw.add(sw); // swan-neck pylons
  }
  add(box(0.3, 0.06, 0.6), carbonM, -2.6, 0.5, 0); // beam wing
  g.add(rw);
  // rain light
  add(box(0.04, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.2 }), -2.68, 0.32, 0);

  // ---------- wheels + suspension ----------
  const wheels = [];
  const mkWheel = (x, z, width, rear) => {
    const w = new THREE.Group(); w.position.set(x, 0.36, z);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, width, 28), tyreM); tyre.rotation.x = Math.PI / 2; tyre.castShadow = true; w.add(tyre);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, width + 0.01, 20), rimM); rim.rotation.x = Math.PI / 2; w.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, width + 0.03, 10), carbonM); hub.rotation.x = Math.PI / 2; w.add(hub);
    for (let k = 0; k < 6; k++) { // spokes
      const sp = new THREE.Mesh(box(0.03, 0.2, width + 0.012), rimM); sp.rotation.z = k * Math.PI / 3; sp.position.y = 0; w.add(sp);
    }
    // compound band (soft = red)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.362, 0.362, 0.03, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xff1e1e, roughness: 0.8, side: THREE.DoubleSide }));
    band.rotation.x = Math.PI / 2; band.position.z = (z > 0 ? 1 : -1) * (width / 2 - 0.03); w.add(band);
    g.add(w); wheels.push(w);
    // suspension arms + pushrod
    const inZ = z > 0 ? 0.36 : -0.36;
    const arm = (y1, dx) => { const L = Math.abs(z - inZ); const a = add(new THREE.CylinderGeometry(0.014, 0.014, L, 6), carbonM, x + dx, y1, (z + inZ) / 2, Math.PI / 2, 0, 0); a.rotation.set(Math.PI / 2, 0, 0); };
    arm(0.5, 0.1); arm(0.5, -0.1); arm(0.26, 0.05);
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), carbonM, x, 0.42, (z + inZ) / 2, 0.9 * (z > 0 ? 1 : -1), 0, 0);
    void rear;
  };
  mkWheel(1.75, 0.76, 0.3, false); mkWheel(1.75, -0.76, 0.3, false);
  mkWheel(-1.85, 0.8, 0.4, true); mkWheel(-1.85, -0.8, 0.4, true);

  // ---------- livery details ----------
  add(box(2.2, 0.04, 0.02), accentM, 0.1, 0.62, 0.36);              // side pinstripes
  add(box(2.2, 0.04, 0.02), accentM, 0.1, 0.62, -0.36);
  // number plates
  const numberCanvas = document.createElement('canvas'); numberCanvas.width = 256; numberCanvas.height = 256;
  const c = numberCanvas.getContext('2d'); c.fillStyle = '#' + accent.toString(16).padStart(6, '0'); c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#0a0a0c'; c.font = '500 170px "Archivo", "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(opts.number || 5), 128, 138);
  const numTex = new THREE.CanvasTexture(numberCanvas); numTex.colorSpace = THREE.SRGBColorSpace;
  const numM = new THREE.MeshStandardMaterial({ map: numTex, roughness: 0.5 });
  add(box(0.22, 0.22, 0.02), numM, 1.0, 0.48, 0.33); add(box(0.22, 0.22, 0.02), numM, 1.0, 0.48, -0.33);
  add(box(0.02, 0.16, 0.16), numM, 2.25, 0.48, 0);

  g.userData = { wheels, drs, fw, rw };
  return g;
}

/* Fake contact shadow: a soft dark ellipse under the car (no shadow maps needed on mobile). */
export function contactShadow() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d');
  const gr = c.createRadialGradient(128, 64, 10, 128, 64, 120);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.scale(1, 0.5); c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.005; m.renderOrder = 1;
  return m;
}

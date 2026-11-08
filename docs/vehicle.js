/* Vehicle loader. Loads a .glb (any scale/orientation), normalises it to a 5.6 m car facing +X with its
   wheels on y = 0, finds the wheels by name so they can spin, and upgrades materials for the night look.
   Falls back to the procedural car when no model is available. */
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import { buildCar } from './car.js';

const LENGTH = 5.6;

export function proceduralVehicle(opts) {
  const car = buildCar(opts);
  const d = car.userData;
  return { root: car, wheels: d.wheels.map((w) => ({ node: w, axis: 'z', front: w.position.x > 0 })), drs: d.drs, exhaust: new THREE.Vector3(-2.56, 0.52, 0), rearWheels: d.wheels.filter((w) => w.position.x < 0).map((w) => w.position), procedural: true };
}

export function loadVehicle(url, onProgress) {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader(); draco.setDecoderPath('./vendor/draco/'); loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      try { resolve(normalise(gltf.scene)); } catch (e) { reject(e); }
    }, (ev) => { if (onProgress && ev.total) onProgress(ev.loaded / ev.total); }, reject);
  });
}

function normalise(model) {
  // 1. longest horizontal axis → X
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  let size = box.getSize(new THREE.Vector3());
  const wrap = new THREE.Group(); wrap.add(model);
  if (size.z > size.x) { model.rotation.y = Math.PI / 2; }
  // 2. scale to LENGTH, 3. centre x/z and put the lowest point on y = 0
  wrap.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(wrap); size = box.getSize(new THREE.Vector3());
  const s = LENGTH / Math.max(size.x, 0.001); wrap.scale.setScalar(s);
  wrap.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(wrap);
  const c = box.getCenter(new THREE.Vector3());
  wrap.position.set(-c.x, -box.min.y, -c.z);
  wrap.updateMatrixWorld(true);

  // 4. wheels: meshes named like wheel/tyre/tire/rim; re-centre their geometry so they spin about their hub
  const wheels = [], rear = [];
  const tmpBox = new THREE.Box3(), ctr = new THREE.Vector3();
  const named = [];
  model.traverse((o) => { if (o.isMesh && /wheel|tyre|tire|rim|w[hl]_?[frlb]/i.test(o.name + ' ' + (o.parent ? o.parent.name : ''))) named.push(o); });
  // group by parent when the parent is a wheel node, else the mesh itself
  const groups = new Map();
  for (const m of named) { const key = /wheel|tyre|tire/i.test(m.parent.name) ? m.parent : m; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(m); }
  for (const [node, meshes] of groups) {
    tmpBox.makeEmpty(); for (const m of meshes) tmpBox.expandByObject(m);
    if (tmpBox.isEmpty()) continue;
    tmpBox.getCenter(ctr);
    const sz = tmpBox.getSize(new THREE.Vector3());
    if (Math.max(sz.x, sz.y, sz.z) > LENGTH * 0.35) continue; // not a wheel: too big
    // pivot: a new group at the wheel centre in the node's parent space; re-parent node under it
    const parent = node.parent; const pivot = new THREE.Group();
    parent.updateMatrixWorld(true);
    const local = parent.worldToLocal(ctr.clone()); pivot.position.copy(local);
    parent.add(pivot); pivot.attach(node);
    // spin axis is the one along which the wheel is thinnest, in world space ≈ Z after normalisation
    const axis = sz.x < sz.y && sz.x < sz.z ? 'x' : sz.z <= sz.x && sz.z <= sz.y ? 'z' : 'y';
    wheels.push({ node: pivot, axis, front: ctr.x > 0 });
    if (ctr.x <= 0) rear.push(ctr.clone());
  }
  // 5. materials: clearcoat on paint-like materials, keep textures
  model.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      if (!m || !m.isMeshStandardMaterial) return;
      if (m.map === null && m.metalness < 0.5 && m.roughness < 0.6 && !m.transparent) {
        const p = new THREE.MeshPhysicalMaterial({ color: m.color, map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap, metalness: Math.max(0.5, m.metalness), roughness: Math.min(0.35, m.roughness), clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 });
        if (Array.isArray(o.material)) o.material[i] = p; else o.material = p;
      } else { m.envMapIntensity = 1.1; }
    });
  });
  const exhaust = new THREE.Vector3(box.min.x + (box.max.x - box.min.x) * 0.1 - c.x, 0.45, 0);
  const rearWheels = rear.length ? rear.map((p) => new THREE.Vector3(p.x, 0.36, p.z)) : [new THREE.Vector3(-1.85, 0.36, 0.8), new THREE.Vector3(-1.85, 0.36, -0.8)];
  return { root: wrap, wheels, drs: null, exhaust, rearWheels, procedural: false, wheelCount: wheels.length };
}

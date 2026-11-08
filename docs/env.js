/* Reflection environment for a night circuit, built as a tiny HDR scene and baked with PMREM:
   a dark sky dome, a row of warm floodlight banks, a cool overhead softbox, pit-lane strips.
   Emissive values above 1 give the paint and clearcoat proper bright highlights. */
import * as THREE from './vendor/three.module.min.js';

export function circuitEnv(renderer) {
  const s = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 sky = mix(vec3(.018,.02,.03), vec3(.05,.06,.09), smoothstep(-.05,.5,h)); vec3 gnd = vec3(.006,.006,.008); vec3 c = h > 0. ? sky : mix(vec3(.03,.028,.03), gnd, smoothstep(0.,-.3,h)); gl_FragColor = vec4(c,1.); }'
  }));
  s.add(dome);
  const em = (color, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide });
  const panel = (w, h, mat, x, y, z, lookAt = [0, 0, 0]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.lookAt(...lookAt); s.add(m); return m; };
  // overhead softbox (long, along the car): gives the long highlight down the bodywork
  panel(26, 5, em(0xdfe6ff, 2.2), 0, 16, 0, [0, 0, 0]).rotation.set(Math.PI / 2, 0, 0);
  // floodlight banks either side, warm
  for (const z of [-1, 1]) for (let i = -3; i <= 3; i++) panel(3.2, 1.1, em(0xffe2b0, 9), i * 8, 11, z * 14, [i * 8, 0, 0]);
  // pit-lane strip lights, low and long: horizon line in the paint
  for (const z of [-1, 1]) panel(60, 0.35, em(0xf2f4ff, 3.5), 0, 2.2, z * 18, [0, 2.2, 0]);
  // warm accent glow low on one side, cool on the other (sells the clearcoat)
  panel(14, 3, em(0xff6a2a, 0.9), -10, 1.5, 12, [0, 1, 0]);
  panel(14, 3, em(0x6f86ff, 0.7), 10, 1.5, -12, [0, 1, 0]);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.035);
  pm.dispose();
  s.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}

/* Camera-like finishing, so the 3D reads as filmed footage rather than a render:
   HDR bloom on lamps, brake discs and LEDs; motion blur along the optical flow of the track
   (radial from its vanishing point, the car kept sharp); lens chromatic aberration; vignette;
   film grain; a slight teal/amber grade; letterbox bars for the opening shot.
   'high' tier: MSAA x4 + full chain. 'mid': no MSAA, fewer blur taps. 'low': no post at all. */
import * as THREE from '../vendor/three.module.min.js';
import { EffectComposer } from '../vendor/post/EffectComposer.js';
import { RenderPass } from '../vendor/post/RenderPass.js';
import { ShaderPass } from '../vendor/post/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/post/UnrealBloomPass.js';
import { OutputPass } from '../vendor/post/OutputPass.js';

const FilmShader = (taps) => ({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 },
    uVp: { value: new THREE.Vector3(1, 0, 0) },        // vanishing point of the track axis, homogeneous NDC
    uCar: { value: new THREE.Vector3(0.5, 0.5, 0.2) }, // car centre (uv) + radius
    uBlur: { value: 0 }, uCA: { value: 0.004 }, uGrain: { value: 0.045 }, uVig: { value: 0.32 }, uBars: { value: 0 }
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    #define TAPS ${taps}
    uniform sampler2D tDiffuse; uniform float uTime, uAspect, uBlur, uCA, uGrain, uVig, uBars;
    uniform vec3 uVp, uCar; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 uv = vUv;
      vec2 ndc = uv * 2.0 - 1.0;
      // optical flow under pure translation radiates from the vanishing point; sign doesn't matter (symmetric taps)
      vec2 flow = ndc * uVp.z - uVp.xy; flow.x *= uAspect;
      float fl = length(flow); flow = fl > 1e-5 ? flow / fl : vec2(1.0, 0.0); flow.x /= uAspect;
      vec2 dc = (uv - uCar.xy) * vec2(uAspect, 1.0);
      float keep = smoothstep(uCar.z * 0.55, uCar.z * 1.35, length(dc));              // car stays sharp
      float amt = uBlur * keep;
      vec2 cdir = (uv - 0.5); float cd = dot(cdir * vec2(uAspect, 1.0), cdir * vec2(uAspect, 1.0));
      vec2 ca = cdir * uCA * (0.4 + cd * 2.2);
      vec3 col = vec3(0.0);
      for (int i = 0; i < TAPS; i++) {
        float t = (float(i) / float(TAPS - 1) - 0.5) * amt;
        vec2 o = uv + flow * t;
        col.r += texture2D(tDiffuse, o - ca).r; col.g += texture2D(tDiffuse, o).g; col.b += texture2D(tDiffuse, o + ca).b;
      }
      col /= float(TAPS);
      // grade: cool the shadows, warm the highlights a touch
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col *= mix(vec3(0.93, 0.98, 1.06), vec3(1.04, 1.0, 0.95), smoothstep(0.05, 0.9, l));
      // vignette
      float v = smoothstep(1.25, 0.35, length(cdir * vec2(uAspect * 0.85, 1.0)) * 1.4);
      col *= mix(1.0 - uVig, 1.0, v);
      // grain (luminance-weighted, animated)
      float n = hash(uv * vec2(1931.0, 1373.0) + fract(uTime * 7.31)) - 0.5;
      col += n * uGrain * (0.08 + sqrt(max(l, 0.0)));
      // letterbox
      if (uv.y < uBars || uv.y > 1.0 - uBars) col = vec3(0.0);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`
});

export function createPost(renderer, scene, camera, tier) {
  if (tier === 'low' || tier === 'none') return null;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: tier === 'high' ? 4 : 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.62, 0.55, 1.05);
  composer.addPass(bloom);
  const film = new ShaderPass(FilmShader(tier === 'high' ? 12 : 7));
  composer.addPass(film);
  composer.addPass(new OutputPass());
  const U = film.uniforms;
  const v4 = new THREE.Vector4(), v3 = new THREE.Vector3();

  function setSize(w, h, dpr) { composer.setPixelRatio(Math.min(dpr, tier === 'high' ? 1.25 : 1)); composer.setSize(w, h); U.uAspect.value = w / h; }
  /* params: { time, blur 0..1, bars 0..0.15, carWorld: Vector3, carRadius metres } */
  function render(p) {
    camera.updateMatrixWorld();
    // vanishing point of world +X: clip coords of a direction (w = 0)
    v4.set(1, 0, 0, 0).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    U.uVp.value.set(v4.x, v4.y, v4.w);
    // car centre and on-screen radius
    v3.copy(p.carWorld).project(camera);
    const cx = v3.x * 0.5 + 0.5, cy = v3.y * 0.5 + 0.5;
    const dist = camera.position.distanceTo(p.carWorld);
    const r = Math.min(0.9, p.carRadius / (dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 0.5);
    U.uCar.value.set(cx, cy, r);
    U.uTime.value = p.time; U.uBlur.value = p.blur * 0.07; U.uBars.value = p.bars;
    composer.render();
  }
  return { composer, bloom, film, setSize, render };
}

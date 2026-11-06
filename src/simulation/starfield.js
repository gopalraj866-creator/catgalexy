// Star field with a simple physically-motivated circle-of-confusion depth of field,
// per-star diffraction-spike sprites (Hubble 4-point / Webb 8-point) and HDR brightness.
import * as THREE from 'three';
import { rng } from '../animations/ease.js';

const VERT = /* glsl */`
attribute float aSize; attribute vec3 aColor; attribute float aPhase;
uniform float uUnit, uFocus, uAperture, uTime, uSizeScale;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(-mv.z, 0.01);
  float coc = abs(1.0/dist - 1.0/uFocus) * uAperture;                // circle of confusion (px at 1080p)
  float tw = 1.0 + 0.10*sin(uTime*1.7 + aPhase*40.0);
  gl_PointSize = max(1.0, (aSize*uSizeScale + coc*2.0) * uUnit);
  vAlpha = tw / (1.0 + coc*coc*0.35);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uTexH, uTexW; uniform float uSpike, uGain, uUseTex;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float disc = exp(-r*r*5.5);
  float a = disc;
  if (uUseTex > 0.5){
    float sp = mix(texture2D(uTexH, gl_PointCoord).r, texture2D(uTexW, gl_PointCoord).r, uSpike);
    a = max(disc, sp) ;
  }
  if (r > 1.0) discard;
  gl_FragColor = vec4(vColor * a * vAlpha * uGain, a * vAlpha * 0.0);   // additive (alpha 0 under premultiplied blend)
}`;

export class StarField {
  // opts: {count, spikeCount, rMin, rMax, seed, cone:[dirVec, halfAngleRad] | null}
  constructor(ctx, opts) {
    this.ctx = ctx;
    const r = rng(opts.seed ?? 5);
    const mk = (n, spiky) => {
      const pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3), ph = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let x, y, z;
        if (opts.box) {          // axis-aligned slab (x,y in view, z depth)
          x = (r() - 0.5) * opts.box[0]; y = (r() - 0.5) * opts.box[1]; z = opts.box[2] + r() * opts.box[3];
        } else {
          const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rad = opts.rMin + (opts.rMax - opts.rMin) * r();
          x = Math.cos(th) * s * rad; y = u * rad; z = Math.sin(th) * s * rad;
        }
        pos[i * 3] = x + (opts.center?.[0] ?? 0); pos[i * 3 + 1] = y + (opts.center?.[1] ?? 0); pos[i * 3 + 2] = z + (opts.center?.[2] ?? 0);
        const m = Math.pow(r(), spiky ? 1.2 : 3.2);          // brightness distribution
        size[i] = spiky ? 70 + 170 * m : 2.2 + 5.5 * m;
        const k = r();                                       // spectral colour: blue-white .. yellow .. orange
        const c = k < 0.45 ? [0.65, 0.78, 1.0] : k < 0.8 ? [1.0, 0.92, 0.72] : [1.0, 0.72, 0.45];
        const b = spiky ? 0.9 : 0.35 + 0.9 * m;
        col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b; ph[i] = r();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      g.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
      return g;
    };
    const u = {
      uUnit: { value: ctx.unit }, uFocus: { value: opts.focus ?? 12 }, uAperture: { value: opts.aperture ?? 0.5 }, uTime: { value: 0 }, uSizeScale: { value: 1 },
      uTexH: { value: ctx.tex.spikeH }, uTexW: { value: ctx.tex.spikeW }, uSpike: { value: 0 }, uGain: { value: 1 }, uUseTex: { value: 0 },
    };
    const material = (useTex) => {
      const uu = Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v])); uu.uUseTex = { value: useTex ? 1 : 0 };
      return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uu, transparent: true, premultipliedAlpha: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, depthTest: false, depthWrite: false });
    };
    this.dots = new THREE.Points(mk(opts.count ?? 3000, false), material(false));
    this.spikes = new THREE.Points(mk(opts.spikeCount ?? 40, true), material(true));
    for (const o of [this.dots, this.spikes]) { o.frustumCulled = false; o.renderOrder = opts.order ?? -5; }
    this.group = new THREE.Group(); this.group.add(this.dots, this.spikes);
  }
  update(T, { spike = 0, gain = 1, focus, sizeScale = 1 } = {}) {
    for (const o of [this.dots, this.spikes]) {
      const u = o.material.uniforms; u.uTime.value = T; u.uSpike.value = spike; u.uGain.value = gain; u.uUnit.value = this.ctx.unit; u.uSizeScale.value = sizeScale;
      if (focus !== undefined) u.uFocus.value = focus;
    }
  }
}

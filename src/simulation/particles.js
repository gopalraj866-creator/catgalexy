// CPU-driven soft-sprite particle system. Positions are written every frame by the scene code as a pure
// function of time, so any frame can be rendered independently (deterministic, parallel-safe).
// Sizes are in WORLD units (diameter), so particles keep correct scale and perspective.
import * as THREE from 'three';

const VERT = /* glsl */`
attribute vec4 aColor; attribute float aSize;
uniform float uScale, uMax;
varying vec4 vColor;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(-mv.z, 0.01);
  float px = aSize * uScale / d;
  float s = clamp(px, 1.5, uMax);
  gl_PointSize = s;
  vColor = vec4(aColor.rgb, aColor.a * min(1.0, (px * px) / (s * s)));
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
precision highp float; varying vec4 vColor;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a = exp(-r * r * 3.5) * (1.0 - smoothstep(0.78, 1.0, r));
  gl_FragColor = vec4(vColor.rgb, a * vColor.a);
}`;

export class Particles {
  constructor(ctx, n, { additive = true } = {}) {
    this.ctx = ctx; this.n = n;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aColor', this.aCol); g.setAttribute('aSize', this.aSize);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 1000 }, uMax: { value: Math.min(ctx.maxPoint || 256, 512) } },
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
  }
  set(i, x, y, z, r, g, b, a, s) {
    const p = i * 3, c = i * 4; this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = a; this.size[i] = s;
  }
  hide(i) { this.col[i * 4 + 3] = 0; }
  commit(camera) {
    this.mat.uniforms.uScale.value = (this.ctx.H * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
  }
}

// A star as glow + diffraction-spike sprites (HDR colour)
export function starSprite(ctx, parent, pos, size, color, { spike = 'webb', gain = 1 } = {}) {
  const mk = (map, s, k) => {
    const m = new THREE.SpriteMaterial({ map, color: new THREE.Color(...color).multiplyScalar(gain * k), blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false });
    const sp = new THREE.Sprite(m); sp.position.set(...pos); sp.scale.set(s, s, 1); parent.add(sp); return sp;
  };
  return { glow: mk(ctx.tex.glow, size, 1), spike: mk(spike === 'hubble' ? ctx.tex.spikeH : ctx.tex.spikeW, size * 2.4, 0.9), setScale(k) { this.glow.scale.set(size * k, size * k, 1); this.spike.scale.set(size * 2.4 * k, size * 2.4 * k, 1); }, setGain(g) { this.glow.material.color.set(...color).multiplyScalar(g); this.spike.material.color.set(...color).multiplyScalar(g * 0.9); } };
}

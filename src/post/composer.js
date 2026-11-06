// Cinematic post pipeline (all passes are cheap enough for software WebGL):
//   scene -> HDR target -> bright-pass + 2-level separable bloom -> composite
//   composite = exposure + ACES tone-map + bloom + chromatic aberration + vignette + film grain + fades.
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold;
void main(){
  vec3 c = vec3(0.0);
  for (int i=-1;i<=1;i++) for (int j=-1;j<=1;j++) c += texture2D(tSrc, vUv + vec2(float(i),float(j))*uTexel*1.5).rgb;
  c /= 9.0;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.9, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + uDir*1.3846153846).rgb * 0.3162162162; c += texture2D(tSrc, vUv - uDir*1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + uDir*3.2307692308).rgb * 0.0702702703; c += texture2D(tSrc, vUv - uDir*3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tScene, tBloom1, tBloom2;
uniform float uExposure, uBloom1, uBloom2, uVignette, uGrain, uTime, uFade, uChroma, uSat, uContrast;
uniform vec3 uFadeColor, uTint;
uniform vec2 uRes;
float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
void main(){
  vec2 c = vUv - 0.5;
  float r2 = dot(c,c);
  vec2 off = c * r2 * uChroma;
  vec3 col;
  col.r = texture2D(tScene, vUv + off).r; col.g = texture2D(tScene, vUv).g; col.b = texture2D(tScene, vUv - off).b;
  col += texture2D(tBloom1, vUv).rgb * uBloom1 + texture2D(tBloom2, vUv).rgb * uBloom2;
  col *= uExposure * uTint;
  col = aces(col);
  float l = dot(col, vec3(0.2126,0.7152,0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  col *= 1.0 - uVignette * smoothstep(0.12, 0.62, r2 * (uRes.x > uRes.y ? 1.0 : 1.6));
  col = pow(max(col, 0.0), vec3(1.0/2.2));
  col += (hash(vUv*uRes + fract(uTime)*91.7) - 0.5) * uGrain;     // film grain (in display space)
  col = mix(col, uFadeColor, uFade);
  gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);
}`;

export class Post {
  constructor(renderer, width, height, opts = {}) {
    this.r = renderer; this.w = width; this.h = height;
    this.scale = opts.renderScale || 1;
    const rw = Math.round(width * this.scale), rh = Math.round(height * this.scale);
    this.rw = rw; this.rh = rh;
    const half = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const mk = (w, h, depth = false) => new THREE.WebGLRenderTarget(w, h, { type: half, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth, generateMipmaps: false });
    this.rtScene = mk(rw, rh, true);
    const q1 = [Math.max(8, rw >> 2), Math.max(8, rh >> 2)], q2 = [Math.max(8, rw >> 3), Math.max(8, rh >> 3)];
    this.b1 = [mk(...q1), mk(...q1)]; this.b2 = [mk(...q2), mk(...q2)]; this.q1 = q1; this.q2 = q2;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mBright = mat(BRIGHT, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.9 } });
    this.mBlur = mat(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.mComp = mat(COMPOSITE, {
      tScene: { value: this.rtScene.texture }, tBloom1: { value: this.b1[0].texture }, tBloom2: { value: this.b2[0].texture },
      uExposure: { value: 1 }, uBloom1: { value: 0.55 }, uBloom2: { value: 0.45 }, uVignette: { value: 0.55 }, uGrain: { value: 0.035 },
      uTime: { value: 0 }, uFade: { value: 0 }, uChroma: { value: 0.0035 }, uSat: { value: 1.08 }, uContrast: { value: 1.04 },
      uFadeColor: { value: new THREE.Vector3(0, 0, 0) }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uRes: { value: new THREE.Vector2(width, height) },
    });
    this.quad = new THREE.Mesh(geo, this.mBright); this.quad.frustumCulled = false;
    this.pscene = new THREE.Scene(); this.pscene.add(this.quad);
    this.params = { exposure: 1, bloom1: 0.55, bloom2: 0.45, threshold: 0.9, vignette: 0.55, grain: 0.035, chroma: 0.0035, sat: 1.08, contrast: 1.04, fade: 0, fadeColor: [0, 0, 0], tint: [1, 1, 1] };
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.pscene, this.cam); }
  blur(chain, size, strength) {
    const [a, b] = chain; const dx = 1 / size[0], dy = 1 / size[1];
    this.mBlur.uniforms.tSrc.value = a.texture; this.mBlur.uniforms.uDir.value.set(dx * strength, 0); this.pass(this.mBlur, b);
    this.mBlur.uniforms.tSrc.value = b.texture; this.mBlur.uniforms.uDir.value.set(0, dy * strength); this.pass(this.mBlur, a);
  }
  // render(sceneFn): sceneFn draws everything into the HDR target
  render(drawScene, time) {
    const r = this.r, p = this.params;
    r.setRenderTarget(this.rtScene); r.setClearColor(0x000000, 1); r.clear(true, true, true);
    drawScene(this.rtScene);
    // bloom
    this.mBright.uniforms.tSrc.value = this.rtScene.texture; this.mBright.uniforms.uTexel.value.set(1 / this.rw, 1 / this.rh); this.mBright.uniforms.uThreshold.value = p.threshold;
    this.pass(this.mBright, this.b1[0]); this.blur(this.b1, this.q1, 1.0); this.blur(this.b1, this.q1, 2.0);
    this.mBright.uniforms.tSrc.value = this.b1[0].texture; this.mBright.uniforms.uTexel.value.set(1 / this.q1[0], 1 / this.q1[1]); this.mBright.uniforms.uThreshold.value = 0.0;
    this.pass(this.mBright, this.b2[0]); this.blur(this.b2, this.q2, 1.0); this.blur(this.b2, this.q2, 2.2);
    const u = this.mComp.uniforms;
    u.uExposure.value = p.exposure; u.uBloom1.value = p.bloom1; u.uBloom2.value = p.bloom2; u.uVignette.value = p.vignette; u.uGrain.value = p.grain;
    u.uTime.value = time; u.uFade.value = p.fade; u.uChroma.value = p.chroma; u.uSat.value = p.sat; u.uContrast.value = p.contrast;
    u.uFadeColor.value.set(...p.fadeColor); u.uTint.value.set(...p.tint);
    r.setRenderTarget(null); r.setViewport(0, 0, this.w, this.h);
    this.pass(this.mComp, null);
  }
}

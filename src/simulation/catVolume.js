// Real-time volumetric ray-marcher for the Cat's Head dust pillar and for the larger Carina field.
//
// IMPORTANT (scientific honesty): the pillar's 3-D shape is an ARTISTIC reconstruction built from the
// published 2-D images (an SDF of body, head, ears, tail and base, plus turbulence). The images give no
// line-of-sight depth, so the depth structure is illustrative. What IS physically motivated:
//  - dust opacity falls with wavelength  (visible: opaque -> near-IR: translucent -> mid-IR: glowing)
//  - ionised, light-facing rim where UV from massive stars photoevaporates the surface
//  - erosion proceeds from the star-facing side while the dense spine resists
import * as THREE from 'three';
import { basis } from '../camera/rig.js';

const VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */`
precision highp float; precision highp sampler3D;
uniform highp sampler3D uNoise;
float n4(vec3 p){ vec4 v = texture(uNoise, p); return dot(v, vec4(0.5,0.25,0.125,0.0625)) / 0.9375; }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

const FRAG = /* glsl */`
${COMMON}
varying vec2 vUv;
uniform vec3 uCamPos, uRight, uUp, uFwd, uLightDir, uEyePos, uCavity;
uniform float uTanH, uAspect, uTime, uMode, uErode, uSteps, uEyeGlow, uLightGain, uAmbient, uSeed, uEyeSize, uSigma;
uniform vec4 uCat;     // xyz = position, w = scale
uniform vec4 uBound;   // xyz = centre, w = radius of the marched sphere
uniform float uField;  // 0 = cat only, 1 = carina field + embedded cat
uniform float uFieldGain;

float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba,ba); float rr = r1 - r2; float a2 = l2 - rr*rr; float il2 = 1.0/l2;
  vec3 pa = p - a; float y = dot(pa,ba); float z = y - l2;
  vec3 w = pa*l2 - ba*y; float x2 = dot(w,w); float y2 = y*y*l2; float z2 = z*z*l2;
  float k = sign(rr)*rr*rr*x2;
  if (sign(z)*a2*z2 > k) return sqrt(x2 + z2)*il2 - r2;
  if (sign(y)*a2*y2 < k) return sqrt(x2 + y2)*il2 - r1;
  return (sqrt(x2*a2*il2) + y*rr)*il2 - r1;
}
float sdEllipsoid(vec3 p, vec3 r){ float k0 = length(p/r); float k1 = length(p/(r*r)); return k0*(k0-1.0)/k1; }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }

// The cat: a sitting silhouette seen from behind, head turned to the right, tail trailing into a squarish base cloud.
float sdCat(vec3 p){
  float body  = sdRoundCone(p, vec3(0.0,-1.55,0.0), vec3(0.02,0.55,0.0), 0.60, 0.33);
  float haunch= sdEllipsoid(p - vec3(-0.12,-0.55,0.0), vec3(0.56,0.78,0.5));
  float head  = sdEllipsoid(p - vec3(0.30,1.12,0.0), vec3(0.50,0.40,0.42));
  float earL  = sdRoundCone(p, vec3(-0.06,1.30,0.0), vec3(-0.17,1.92,0.0), 0.17, 0.035);
  float earR  = sdRoundCone(p, vec3(0.58,1.36,0.0), vec3(0.76,1.90,0.0), 0.16, 0.035);
  float tail  = sdRoundCone(p, vec3(-0.10,-1.7,0.0), vec3(-0.30,-2.35,0.0), 0.30, 0.22);
  float base  = sdBox(p - vec3(0.05,-2.55,0.0), vec3(0.85,0.30,0.50)) - 0.15;
  float d = smin(body, haunch, 0.25);
  d = smin(d, head, 0.22); d = smin(d, earL, 0.07); d = smin(d, earR, 0.07);
  d = smin(d, tail, 0.20); d = smin(d, base, 0.35);
  return d;
}

float catDensity(vec3 pw, out float sdOut){
  vec3 q = (pw - uCat.xyz) / uCat.w;
  float d = sdCat(q);
  sdOut = d;
  if (d > 1.1) return 0.0;
  float n  = n4(q*0.55 + vec3(0.0, uTime*0.003, 0.0) + uSeed);
  float n2 = n4(q*1.70 + 3.1);
  float disp = (n - 0.5)*0.55 + (n2 - 0.5)*0.22;
  float facing = clamp(dot(normalize(q + vec3(0.0001)), uLightDir)*0.5 + 0.5, 0.0, 1.0);
  float er = uErode * (0.40 + 0.95*facing) * (0.50 + 0.95*n2);      // erosion bites the star-facing side first
  float sd = d + disp*0.8 + er;
  sdOut = sd;
  float dd = smoothstep(0.10, -0.22, sd);
  dd *= 0.65 + 0.70*n4(q*1.2 + 9.0);
  float wn = n4(q*vec3(2.4,1.1,2.4) + vec3(0.0, uTime*0.008, 5.0));
  float wisp = smoothstep(0.56, 0.82, wn) * exp(-max(sd,0.0)*1.9) * (1.0 - smoothstep(-0.2, 0.9, q.x));
  dd += wisp*0.16*(1.0 - uErode*0.7);
  return dd / uCat.w;
}

float carinaDensity(vec3 p){
  float c  = n4(p*0.03 + uSeed);
  float c2 = n4(p*0.07 + 4.0);
  float base = smoothstep(0.40, 0.80, c*0.7 + c2*0.45);
  float cav = smoothstep(17.0, 6.0, length(p - uCavity));
  return base * (1.0 - 0.97*cav) * 0.30 * uFieldGain;
}

float totalDensity(vec3 p, out float sd){
  sd = 1.0;
  float rho = catDensity(p, sd);
  if (uField > 0.5) rho += carinaDensity(p);
  return rho;
}

void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 rd = normalize(uFwd + uRight*(ndc.x*uTanH*uAspect) + uUp*(ndc.y*uTanH));
  vec3 ro = uCamPos;
  vec3 oc = ro - uBound.xyz; float b = dot(oc, rd); float c = dot(oc,oc) - uBound.w*uBound.w; float h = b*b - c;
  vec3 C = vec3(0.0); float T = 1.0;
  float tEye = dot(uEyePos - ro, rd); float Teye = -1.0;
  float t1 = 0.0;
  if (h > 0.0){
    h = sqrt(h); float t0 = max(-b - h, 0.0); t1 = -b + h;
    if (t1 > 0.0){
      float nS = uSteps;
      bool two = uField > 0.5;
      float dtC = (t1 - t0)/(two ? nS*0.8 : nS*1.5);
      // analytic entry/exit of the small cat sphere (field mode): refine the step inside it
      float cr = uCat.w*3.3, tc0 = 1e9, tc1 = -1e9;
      if (two){ vec3 oc2 = ro - uCat.xyz; float b2 = dot(oc2, rd), h2 = b2*b2 - (dot(oc2,oc2) - cr*cr); if (h2 > 0.0){ h2 = sqrt(h2); tc0 = -b2 - h2; tc1 = -b2 + h2; } }
      float dtF = two ? max((tc1 - tc0)/(nS*1.0), 0.002) : dtC;
      float dt = dtC; float sdPrev = 9.0;
      float t = t0 + dtC*ign(gl_FragCoord.xy + fract(uTime*7.31)*64.0);
      float m1 = clamp(uMode, 0.0, 1.0), m2 = clamp(uMode - 1.0, 0.0, 1.0);
      float sigmaK = mix(mix(6.0, 2.8, m1), 4.2, m2) * uSigma;
      for (int i = 0; i < 112; i++){
        if (t > t1 || T < 0.02) break;
        dt = dtC;
        if (two){
          if (t >= tc0 && t < tc1) dt = (sdPrev < 1.7) ? dtF : min(dtC, max(uCat.w*0.9, dtF));
          else if (t < tc0 && t + dtC > tc0){ dt = max(tc0 - t, 1e-3); sdPrev = 0.0; }
        }
        vec3 p = ro + rd*t;
        if (Teye < 0.0 && t >= tEye) Teye = T;
        float sd; float rho = totalDensity(p, sd); sdPrev = sd;
        if (rho > 0.002){
          vec3 L = (uField > 0.5 && sd > 0.9) ? normalize(uCavity - p) : uLightDir;
          bool fld = (uField > 0.5 && sd > 0.9);
          float sd2; float rho2 = totalDensity(p + L*(fld ? 5.0 : 0.16*max(uCat.w, 0.5)), sd2);
          float lit = clamp((rho - rho2)/(rho + 1e-4)*(fld ? 3.0 : 1.25) + 0.22, 0.0, 1.0);
          float rim = pow(lit, 3.0);
          vec3 cVis = vec3(0.060,0.040,0.030)*uAmbient + vec3(1.00,0.72,0.28)*rim*2.4*uLightGain + vec3(0.30,0.20,0.10)*lit*0.25*uLightGain;
          vec3 cNir = vec3(0.50,0.28,0.14)*(0.50 + 0.95*lit)*uAmbient + vec3(1.0,0.70,0.35)*rim*1.3*uLightGain;
          vec3 cMir = vec3(0.40,0.52,0.70)*(0.55 + 0.55*lit)*uAmbient + vec3(0.98,0.50,0.40)*pow(lit,2.0)*0.95*uLightGain;
          vec3 col = mix(mix(cVis, cNir, m1), cMir, m2);
          if (fld) col *= 0.22;
          float a = 1.0 - exp(-sigmaK*rho*dt);
          C += T*a*col; T *= (1.0 - a);
        }
        t += dt;
      }
    }
  }
  if (Teye < 0.0) Teye = T;
  if (uEyeGlow > 0.0 && tEye > 0.0){
    float s = uEyeSize*uCat.w;
    float dd = length(ro + rd*tEye - uEyePos);
    float g1 = exp(-dd*dd/(s*s)), g2 = exp(-dd*dd/(0.0625*s*s));
    float m1 = clamp(uMode, 0.0, 1.0), m2 = clamp(uMode - 1.0, 0.0, 1.0);
    vec3 eyeCol = mix(mix(vec3(1.0,0.10,0.05), vec3(1.0,0.82,0.30), m1), vec3(1.0,0.97,0.92), m2);
    float vis = 0.35 + 0.65*Teye;
    C += vis*uEyeGlow*(g1*eyeCol*1.2 + g2*vec3(1.0,0.95,0.9)*2.6);
  }
  gl_FragColor = vec4(C, 1.0 - T);
}`;

const GAS_FRAG = /* glsl */`
${COMMON}
varying vec2 vUv;
uniform vec3 uRight, uUp, uFwd;
uniform float uTanH, uAspect, uMode, uGain, uSeed, uTime;
void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 rd = normalize(uFwd + uRight*(ndc.x*uTanH*uAspect) + uUp*(ndc.y*uTanH));
  float v = n4(rd*2.1 + uSeed), w = n4(rd*5.3 + 11.0 + uSeed);
  float cloud = 0.55 + 0.75*(v - 0.5) + 0.35*(w - 0.5);
  // sky coordinate: top blue -> diagonal band -> yellow, orange, red toward the bottom (Hubble view)
  float s = rd.y*1.15 + rd.x*0.30 + (v - 0.5)*0.22;
  vec3 blue = vec3(0.05,0.30,0.72), cyan = vec3(0.10,0.52,0.70), yel = vec3(0.78,0.62,0.12), org = vec3(0.72,0.30,0.06), red = vec3(0.50,0.07,0.04);
  vec3 vis = mix(red, org, smoothstep(-0.55,-0.30,s)); vis = mix(vis, yel, smoothstep(-0.30,-0.08,s)); vis = mix(vis, blue, smoothstep(-0.08,0.12,s)); vis = mix(vis, cyan, smoothstep(0.30,0.65,s)*0.45);
  vis *= 0.42*cloud;
  vec3 nir = mix(vec3(0.03,0.13,0.40), vec3(0.08,0.30,0.70), smoothstep(-0.5,0.4,s)) * (0.40*cloud);
  nir *= 1.0 - smoothstep(0.30, 0.75, rd.y*0.8 + rd.x*0.85);               // dark gap of space at the top right
  vec3 mir = mix(vec3(0.34,0.05,0.04), vec3(0.78,0.20,0.14), smoothstep(0.35,0.75,v)) * (0.55*cloud);
  mir *= 1.0 - 0.8*smoothstep(0.35, 0.8, abs(rd.x)*0.9 + max(rd.y,0.0)*0.8);
  float m1 = clamp(uMode, 0.0, 1.0), m2 = clamp(uMode - 1.0, 0.0, 1.0);
  vec3 col = mix(mix(vis, nir, m1), mir, m2) * uGain;
  gl_FragColor = vec4(col, 1.0);
}`;

function fullscreen(material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const m = new THREE.Mesh(geo, material); m.frustumCulled = false; return m;
}

export class CatVolume {
  constructor(ctx, { field = false } = {}) {
    const u = {
      uNoise: { value: ctx.noise3D }, uCamPos: { value: new THREE.Vector3() }, uRight: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector3() },
      uLightDir: { value: new THREE.Vector3(0.62, 0.70, 0.35).normalize() }, uEyePos: { value: new THREE.Vector3(0.62, 1.12, 0.18) }, uCavity: { value: new THREE.Vector3(-22, 8, -14) },
      uTanH: { value: 0.4 }, uAspect: { value: 1.78 }, uTime: { value: 0 }, uMode: { value: 0 }, uErode: { value: 0 }, uSteps: { value: ctx.quality.steps },
      uEyeGlow: { value: 1 }, uLightGain: { value: 1 }, uAmbient: { value: 1 }, uSeed: { value: 0.37 }, uEyeSize: { value: 0.09 }, uSigma: { value: 1 },
      uCat: { value: new THREE.Vector4(0, 0, 0, 1) }, uBound: { value: new THREE.Vector4(0, -0.25, 0, 3.6) }, uField: { value: field ? 1 : 0 }, uFieldGain: { value: 0.22 },
    };
    this.u = u;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, premultipliedAlpha: true, blending: THREE.NormalBlending, depthTest: false, depthWrite: false });
    this.mesh = fullscreen(this.mat); this.mesh.renderOrder = 10;
    const g = {
      uNoise: { value: ctx.noise3D }, uRight: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector3() },
      uTanH: { value: 0.4 }, uAspect: { value: 1.78 }, uMode: { value: 0 }, uGain: { value: 1 }, uSeed: { value: 0.0 }, uTime: { value: 0 },
    };
    this.g = g;
    this.gasMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: GAS_FRAG, uniforms: g, depthTest: false, depthWrite: false });
    this.gas = fullscreen(this.gasMat); this.gas.renderOrder = -10;
    this.sceneGas = new THREE.Scene(); this.sceneGas.add(this.gas);
    this.sceneVol = new THREE.Scene(); this.sceneVol.add(this.mesh);
    this.ctx = ctx;
  }
  // push camera + common params every frame
  update(camera, T, p = {}) {
    const b = basis(camera), u = this.u, g = this.g;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    u.uCamPos.value.copy(camera.position); u.uRight.value.copy(b.right); u.uUp.value.copy(b.up); u.uFwd.value.copy(b.forward);
    u.uTanH.value = tanH; u.uAspect.value = camera.aspect; u.uTime.value = T; u.uSteps.value = p.steps ?? this.ctx.quality.steps;
    if (p.mode !== undefined) { u.uMode.value = p.mode; g.uMode.value = p.mode; }
    if (p.erode !== undefined) u.uErode.value = p.erode;
    if (p.eyeGlow !== undefined) u.uEyeGlow.value = p.eyeGlow;
    if (p.light !== undefined) u.uLightGain.value = p.light;
    if (p.ambient !== undefined) u.uAmbient.value = p.ambient;
    if (p.sigma !== undefined) u.uSigma.value = p.sigma;
    if (p.seed !== undefined) { u.uSeed.value = p.seed; }
    if (p.cat) u.uCat.value.set(...p.cat);
    if (p.bound) u.uBound.value.set(...p.bound);
    if (p.eyePos) u.uEyePos.value.set(...p.eyePos);
    if (p.eyeSize !== undefined) u.uEyeSize.value = p.eyeSize;
    if (p.cavity) u.uCavity.value.set(...p.cavity);
    if (p.lightDir) u.uLightDir.value.set(...p.lightDir).normalize();
    if (p.fieldGain !== undefined) u.uFieldGain.value = p.fieldGain;
    g.uRight.value.copy(b.right); g.uUp.value.copy(b.up); g.uFwd.value.copy(b.forward); g.uTanH.value = tanH; g.uAspect.value = camera.aspect; g.uTime.value = T;
    g.uGain.value = p.gas ?? 1; if (p.gasSeed !== undefined) g.uSeed.value = p.gasSeed;
  }
  // eye position follows the cat transform
  eyeFromCat(cat) { const [x, y, z, s] = cat; return [x + 0.60 * s, y + 1.13 * s, z + 0.17 * s]; }
  drawGas(renderer, camera) { renderer.render(this.sceneGas, camera); }
  drawVolume(renderer, camera) { renderer.render(this.sceneVol, camera); }
}

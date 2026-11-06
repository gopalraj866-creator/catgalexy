// Cinematic camera rig: keyframed Catmull-Rom paths for position + look target, animated FOV and roll,
// plus subtle handheld drift. Deterministic function of time.
import * as THREE from 'three';
import { path, track, noise1, easeInOut } from '../animations/ease.js';

const _up = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();

export class Rig {
  constructor(camera) { this.camera = camera; }
  // spec: { pos: [[t,[x,y,z]]...], look: [[t,[x,y,z]]...], fov: [[t,deg]...], roll: [[t,deg]...], shake: amount }
  apply(spec, T) {
    const c = this.camera;
    const p = path(spec.pos, T), l = path(spec.look, T);
    const s = spec.shake ?? 0.0;
    if (s > 0) {
      p[0] += noise1(T * 0.35, 1) * s; p[1] += noise1(T * 0.31, 2) * s; p[2] += noise1(T * 0.27, 3) * s * 0.5;
      l[0] += noise1(T * 0.41, 4) * s * 0.6; l[1] += noise1(T * 0.37, 5) * s * 0.6;
    }
    c.position.set(p[0], p[1], p[2]);
    c.up.set(0, 1, 0);
    c.lookAt(l[0], l[1], l[2]);
    if (spec.roll) c.rotateZ(THREE.MathUtils.degToRad(track(spec.roll, T)));
    c.fov = spec.fov ? track(spec.fov, T) : c.fov;
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    return { pos: p, look: l };
  }
}

// Camera basis for ray-marching shaders: returns {right, up, forward} in world space
export function basis(camera) {
  camera.updateMatrixWorld(true);
  const e = camera.matrixWorld.elements;
  return {
    right: new THREE.Vector3(e[0], e[1], e[2]).normalize(),
    up: new THREE.Vector3(e[4], e[5], e[6]).normalize(),
    forward: new THREE.Vector3(-e[8], -e[9], -e[10]).normalize(),
  };
}

// Distance at which an object of the given height (world units) fills `fill` of the frame for the camera
export function fitDistance(height, width, fovDeg, aspect, fill = 0.8) {
  const vf = THREE.MathUtils.degToRad(fovDeg);
  const dV = (height / fill) / 2 / Math.tan(vf / 2);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  const dH = (width / fill) / 2 / Math.tan(hf / 2);
  return Math.max(dV, dH);
}

// Project a world position to normalized screen coords (0..1, y down); returns null if behind camera
export function project(camera, v3) {
  const v = v3.clone().project(camera);
  if (v.z > 1 || v.z < -1) return null;
  return { x: v.x * 0.5 + 0.5, y: 1 - (v.y * 0.5 + 0.5), z: v.z };
}

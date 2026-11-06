// 01:57-02:09  The two observatories at true relative scale: Hubble (2.4 m mirror, visible/UV/near-IR)
// and Webb (6.5 m gold mirror of 18 hexagonal segments, 5-layer sunshield, infrared).
// PBR materials, a directional "Sun" with soft shadows and a dim environment for specular reflections.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { StarField } from '../simulation/starfield.js';
import { foilNormalMap, panelTexture } from '../simulation/textures.js';
import { Rig } from '../camera/rig.js';
import { makeCamera, window01, labelAt, farKeys } from './common.js';
import { smoothstep } from '../animations/ease.js';

function hubbleModel() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 0.55, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262c, metalness: 0.4, roughness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.95, roughness: 0.3 });
  const x = (geo, m, px, py = 0, pz = 0) => { const o = new THREE.Mesh(geo, m); o.rotation.z = Math.PI / 2; o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  x(new THREE.CylinderGeometry(2.1, 2.1, 4.6, 56), white, 3.7);            // light shield
  x(new THREE.CylinderGeometry(2.1, 2.1, 5.2, 56), gold, -0.6);            // equipment section (MLI foil)
  x(new THREE.CylinderGeometry(2.1, 2.1, 3.4, 56), dark, -4.9);           // aft shroud
  x(new THREE.CylinderGeometry(1.55, 1.55, 0.3, 40), dark, 6.1);          // aperture ring
  const door = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.12, 40), white); door.position.set(6.9, 1.9, 0); door.rotation.set(0, 0, 0.4 + Math.PI / 2 * 0.0); door.castShadow = true; g.add(door);
  const tex = panelTexture(); tex.repeat.set(2, 6);
  const panelMat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.35, emissive: 0x0a1a40, emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 7.1), panelMat); p.position.set(-1.0, 0, s * 6.2); p.castShadow = p.receiveShadow = true; g.add(p);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), white); arm.rotation.x = Math.PI / 2; arm.position.set(-1.0, 0, s * 3.3); g.add(arm);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), white); dish.position.set(0.6, 2.3 * s, 0.0); dish.rotation.z = s > 0 ? 0 : Math.PI; g.add(dish);
  }
  return g;
}

function webbModel() {
  const g = new THREE.Group();
  const foil = foilNormalMap(256); foil.repeat.set(3, 2);
  const shieldMat = new THREE.MeshStandardMaterial({ color: 0xb9a98f, metalness: 0.9, roughness: 0.42, normalMap: foil, normalScale: new THREE.Vector2(0.8, 0.8), side: THREE.DoubleSide });
  const shape = new THREE.Shape(); shape.moveTo(-10.5, 0); shape.lineTo(0, -7); shape.lineTo(10.5, 0); shape.lineTo(0, 7); shape.closePath();
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, geo.attributes.position.getX(k) / 21 + 0.5, geo.attributes.position.getZ(k) / 14 + 0.5);
    const m = new THREE.Mesh(geo, shieldMat); m.position.y = i * 0.34 - 0.7; m.scale.set(1 - i * 0.012, 1, 1 - i * 0.02); m.rotation.y = i * 0.006; m.castShadow = m.receiveShadow = true; g.add(m);
  }
  const bus = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 3.0), new THREE.MeshStandardMaterial({ color: 0xcfd2d8, metalness: 0.7, roughness: 0.35 })); bus.position.set(0, -2.4, 1.2); bus.castShadow = bus.receiveShadow = true; g.add(bus);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 2.0), new THREE.MeshStandardMaterial({ map: panelTexture(), metalness: 0.4, roughness: 0.4, emissive: 0x0a1a40, emissiveIntensity: 0.5 })); panel.position.set(0, -3.9, 1.2); g.add(panel);
  // telescope (cold side): backplane + 18 gold hexagonal segments + secondary on 3 struts
  const scope = new THREE.Group(); scope.position.set(0, 3.4, -1.2); scope.rotation.x = -0.32; g.add(scope);
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 3.4), new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.5, roughness: 0.55 })); back.position.y = -0.8; back.castShadow = true; scope.add(back);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc247, metalness: 1.0, roughness: 0.16 });
  const R = 0.78, dd = R * Math.sqrt(3) * 1.03, hexGeo = new THREE.CylinderGeometry(R, R, 0.1, 6);
  const centres = [];
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; centres.push([Math.cos(a) * dd, Math.sin(a) * dd], [Math.cos(a) * dd * 2, Math.sin(a) * dd * 2], [Math.cos(a + Math.PI / 6) * dd * Math.sqrt(3), Math.sin(a + Math.PI / 6) * dd * Math.sqrt(3)]); }
  for (const [cx, cz] of centres) { const m = new THREE.Mesh(hexGeo, gold); m.position.set(cx, 0.02 + (cx * cx + cz * cz) * 0.004, cz); m.castShadow = m.receiveShadow = true; scope.add(m); }
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x4a4d55, metalness: 0.6, roughness: 0.5 });
  for (const a of [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 - 2.094]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 7.6, 8), strutMat);
    s.position.set(Math.cos(a) * 1.9, 3.6, Math.sin(a) * 1.9); s.rotation.set(Math.sin(a) * 0.46, 0, -Math.cos(a) * 0.46); s.castShadow = true; scope.add(s);
  }
  const sec = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), gold); sec.position.y = 7.3; sec.scale.y = 0.55; sec.castShadow = true; scope.add(sec);
  return g;
}

export function create(ctx) {
  const cam = makeCamera(ctx, 34), rig = new Rig(cam);
  const S = ctx.start('telescopes'), END = ctx.end('telescopes');
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(ctx.renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
  const sun = new THREE.DirectionalLight(0xfff2de, 4.2); sun.position.set(-18, 16, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 18, bottom: -18, near: 1, far: 80 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, new THREE.HemisphereLight(0x5577aa, 0x110a08, 0.35));
  const hub = hubbleModel(); hub.position.set(-9, 0, 0); hub.rotation.y = -0.5; scene.add(hub);
  const web = webbModel(); web.position.set(9, -0.5, 0); web.rotation.y = 0.55; scene.add(web);
  ctx.renderer.shadowMap.enabled = true; ctx.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const stars = new StarField(ctx, { count: ctx.quality.stars, spikeCount: 8, rMin: 80, rMax: 200, seed: 9, focus: 40, aperture: 0.1 });
  const sBg = new THREE.Scene(); sBg.add(stars.group);
  const keys = {
    pos: [[S, [-22, 3, 15]], [S + 5, [-14, 5, 20]], [S + 8.5, [4, 7, 31]], [END, [20, 8, 24]]],
    look: [[S, [-9, 0, 0]], [S + 5, [-8, 0, 0]], [S + 8.5, [6, 0, 0]], [END, [9, 2, 0]]],
    fov: [[S, ctx.portrait ? 48 : 34]],
  };

  return {
    draw(T) {
      const rd = ctx.renderer, p = ctx.post.params;
      rig.apply(farKeys(ctx, keys, 1.5), T);
      hub.rotation.y = -0.5 + (T - S) * 0.03; web.rotation.y = 0.55 - (T - S) * 0.02;
      stars.update(T, { spike: 1, gain: 0.9, focus: 80 });
      rd.render(sBg, cam); rd.render(scene, cam);
      p.exposure = 1.0; p.bloom1 = 0.4; p.bloom2 = 0.3; p.vignette = 0.5;
      const it = [], lab = (v, text, a0, a1, sub, dx, dy) => { const l = labelAt(cam, v, text, window01(T, a0, a1, 0.6, 0.6), { sub, dx, dy }); if (l) it.push(l); };
      lab([-9, 2.4, 0], 'Hubble', S + 1, S + 7, '2.4 m mirror · visible, UV and near-infrared', 6, -8);
      lab([9, 6.2, -1.5], 'James Webb', S + 7.2, END - 0.3, '6.5 m gold mirror · 18 segments · infrared', -7, -8);
      lab([9, -0.2, 0], 'Sunshield', S + 9, END - 0.3, 'Five layers keep the optics cold', 8, 7);
      it.push({ kind: 'tag', text: 'Shown at true relative scale', a: 0.85 });
      return it;
    },
  };
}

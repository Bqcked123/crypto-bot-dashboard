// SUIT rig: the licensed CC0 "Sci-fi Soldier" by Irondust (https://opengameart.org/content/sci-fi-soldier), repainted
// candy-red metal + gold + gunmetal, with proportion fixes, skeleton poses that blend, additive idle motion,
// a flush chest light and thruster emitter points on the hands and feet. Shared by v11/holo.js and suit-preview/.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const SUIT_CREDIT = { name: 'Sci-fi Soldier', author: 'Irondust', url: 'https://opengameart.org/content/sci-fi-soldier', licence: 'CC0' };
const COL = { red: new THREE.Color(0xb3101c), gold: new THREE.Color(0xe8b04a), gun: new THREE.Color(0x3a3f46) };
const key = n => n.toLowerCase().replace(/[^a-z0-9]/g, '');

// Repaint by the albedo's own regions: blue plates -> candy red, brown under-suit -> gold, the rest -> gunmetal.
function paint(src, env) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: .8, roughness: .3, clearcoat: 1, clearcoatRoughness: .06, envMap: env, envMapIntensity: 1.25,
    map: src.map || null, normalMap: src.normalMap || null, normalScale: src.normalScale ? src.normalScale.clone() : new THREE.Vector2(1, 1),
    emissiveMap: src.emissiveMap || null, emissive: src.emissiveMap ? new THREE.Color(0xbfe8ff) : new THREE.Color(0), emissiveIntensity: src.emissiveMap ? 3 : 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.cRed = { value: COL.red }; sh.uniforms.cGold = { value: COL.gold }; sh.uniforms.cGun = { value: COL.gun };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 cRed, cGold, cGun;
      float hueDist(float a, float b){ float d = abs(a-b); return min(d, 1.-d); }
      float band(float h, float c, float w){ return 1. - smoothstep(w*.6, w, hueDist(h,c)); }
      vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0., -1./3., 2./3., -1.); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
      float gGold, gDark;`)
      .replace('#include <map_fragment>', `
      float gold = 0., dark = 0., det = 1.;
      #ifdef USE_MAP
        vec3 sc = pow(max(texture2D(map, vMapUv).rgb, 0.), vec3(1./2.2));
        vec3 hsv = rgb2hsv(sc); float h = hsv.x, s = hsv.y, v = hsv.z, l = dot(sc, vec3(.299,.587,.114));
        float blue = band(h,.57,.12)*step(.18,s); float brown = band(h,.06,.10)*step(.18,s);
        gold = brown*smoothstep(.09,.115,v); dark = (1.-blue)*(1.-gold);
        det = clamp(l / .45, .6, 1.25);
      #endif
      gold = clamp(gold,0.,1.); dark = clamp(dark,0.,1.)*(1.-gold); gGold = gold; gDark = dark;
      diffuseColor.rgb = mix(mix(cRed, cGold, gold), cGun, dark) * mix(1., det, mix(.55, .2, max(gold, dark)));`)
      .replace('#include <emissivemap_fragment>', `
      #ifdef USE_EMISSIVEMAP
        vec4 emTx = texture2D(emissiveMap, vEmissiveMapUv); totalEmissiveRadiance *= vec3(max(max(emTx.r, emTx.g), emTx.b));
      #endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(mix(.26, .22, gGold), .42, gDark);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = mix(mix(.72, 1., gGold), .92, gDark);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
      #ifdef USE_CLEARCOAT
      material.clearcoat *= (1. - gDark*.85);
      #endif`);
  };
  m.customProgramCacheKey = () => 'suit-paint-v1';
  return m;
}

// studio-ish reflection map: room environment plus a few bright strip lights for crisp highlights on the paint
export async function makeSuitEnv(renderer) {
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const pm = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const strip = (w, h, x, y, z, c, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .05), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) })); m.position.set(x, y, z); m.lookAt(0, 1, 0); room.add(m); };
  strip(6, .5, 0, 9, 4, 0xffffff, 6); strip(.5, 6, -9, 4, -2, 0x9fd0ff, 5); strip(.5, 6, 9, 4, -3, 0xffe6c8, 4); strip(8, .4, 0, 1, -9, 0x6fb6ff, 4);
  const t = pm.fromScene(room, .03).texture; pm.dispose(); return t;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
// Poses, in model space (+Z = the suit's front, +Y up, +X = the suit's LEFT). Ops run in order:
//  ['rot', bone, axis, rad]  rotate the bone about a model-space axis      ['aim', bone, dir, childKey?]  point the bone at dir
//  ['move', bone, [dx,dy,dz]] translate (model units, height = 1)           ['curl', side, amount]          curl that hand's fingers
//  ['foot', side, pitch, splay] re-aim the foot to its rest direction, pitched (+ = toes down) and splayed outward
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const POSE_SPECS = {
  stand: [ // relaxed hero stance: weight on the left leg, soft knees, loose hands, small head tilt
    ['move', 'hips', [.012, -.006, 0]], ['rot', 'hips', Z, .05], ['rot', 'spine', Z, -.075], ['rot', 'spine', X, -.03], ['rot', 'chest', Y, .07],
    ['aim', 'thighl', V(-.015, -1, .035)], ['aim', 'shinl', V(.005, -1, -.035)], ['foot', 'l', 0, .12],
    ['aim', 'thighr', V(-.11, -1, .1)], ['aim', 'shinr', V(-.045, -1, -.1)], ['foot', 'r', 0, .3],
    ['rot', 'shoulderl', Z, -.05], ['rot', 'shoulderr', Z, .03],
    ['aim', 'upperarml', V(.2, -1, -.05)], ['aim', 'forearml', V(.08, -1, .42)], ['aim', 'handl', V(.03, -1, .3), 'palm02l'],
    ['aim', 'upperarmr', V(-.17, -1, .01)], ['aim', 'forearmr', V(-.07, -1, .36)], ['aim', 'handr', V(-.02, -1, .24), 'palm02r'],
    ['curl', 'l', .55], ['curl', 'r', .45],
    ['rot', 'neck', X, .03], ['rot', 'head', Z, .035], ['rot', 'head', Y, -.1]],
  hover: [ // decelerating: upright, legs dangling with bent knees, arms down-back with palms driving down
    ['rot', 'spine', X, .08],
    ['aim', 'thighl', V(.04, -1, .14)], ['aim', 'shinl', V(.02, -1, -.28)], ['foot', 'l', .35, .08],
    ['aim', 'thighr', V(-.04, -1, .03)], ['aim', 'shinr', V(-.02, -1, -.4)], ['foot', 'r', .35, .08],
    ['aim', 'upperarml', V(.36, -1, -.3)], ['aim', 'forearml', V(.24, -1, -.04)], ['aim', 'handl', V(.08, -1, .32), 'palm02l'],
    ['aim', 'upperarmr', V(-.36, -1, -.3)], ['aim', 'forearmr', V(-.24, -1, -.04)], ['aim', 'handr', V(-.08, -1, .32), 'palm02r'],
    ['curl', 'l', .15], ['curl', 'r', .15], ['rot', 'neck', X, .12], ['rot', 'head', X, .12]],
  crouch: [ // touchdown impact: deep staggered crouch, right fist planted, left arm back for balance
    ['rot', 'hips', X, .3], ['rot', 'spine', X, .25], ['rot', 'chest', X, .12],
    ['aim', 'thighl', V(.14, -.5, .86)], ['aim', 'shinl', V(.02, -1, -.33)], ['foot', 'l', 0, .15],
    ['aim', 'thighr', V(-.14, -.62, .74)], ['aim', 'shinr', V(-.02, -1, -.45)], ['foot', 'r', 0, .2],
    ['aim', 'upperarmr', V(-.22, -.92, .38)], ['aim', 'forearmr', V(-.08, -1, .18)], ['aim', 'handr', V(-.04, -1, .05), 'palm02r'],
    ['aim', 'upperarml', V(.62, -.6, -.5)], ['aim', 'forearml', V(.5, -.5, -.15)], ['aim', 'handl', V(.4, -.6, .1), 'palm02l'],
    ['curl', 'r', 1], ['curl', 'l', .35], ['rot', 'neck', X, -.25], ['rot', 'head', X, -.3]],
  launch: [ // take-off crouch: knees loaded, arms swept back
    ['rot', 'hips', X, .22], ['rot', 'spine', X, .22],
    ['aim', 'thighl', V(.12, -.6, .78)], ['aim', 'shinl', V(.02, -1, -.36)], ['foot', 'l', 0, .12],
    ['aim', 'thighr', V(-.12, -.6, .78)], ['aim', 'shinr', V(-.02, -1, -.36)], ['foot', 'r', 0, .12],
    ['aim', 'upperarml', V(.3, -.7, -.65)], ['aim', 'forearml', V(.2, -.9, -.3)], ['aim', 'handl', V(.1, -1, -.1), 'palm02l'],
    ['aim', 'upperarmr', V(-.3, -.7, -.65)], ['aim', 'forearmr', V(-.2, -.9, -.3)], ['aim', 'handr', V(-.1, -1, -.1), 'palm02r'],
    ['curl', 'l', .8], ['curl', 'r', .8], ['rot', 'neck', X, -.2], ['rot', 'head', X, -.25]],
  fly: [ // flight (the flight rig pitches the whole body forward): arms back along the body, legs together, toes pointed, head up
    ['rot', 'spine', X, -.1],
    ['aim', 'thighl', V(.04, -1, -.04)], ['aim', 'shinl', V(.02, -1, -.1)], ['foot', 'l', .9, .05],
    ['aim', 'thighr', V(-.04, -1, -.04)], ['aim', 'shinr', V(-.02, -1, -.1)], ['foot', 'r', .9, .05],
    ['aim', 'upperarml', V(.2, -1, -.12)], ['aim', 'forearml', V(.12, -1, -.18)], ['aim', 'handl', V(.05, -1, -.22), 'palm02l'],
    ['aim', 'upperarmr', V(-.2, -1, -.12)], ['aim', 'forearmr', V(-.12, -1, -.18)], ['aim', 'handr', V(-.05, -1, -.22), 'palm02r'],
    ['curl', 'l', .25], ['curl', 'r', .25], ['rot', 'neck', X, -.35], ['rot', 'head', X, -.6]],
  tuck: [ // accelerating: compact and streamlined, arms pinned back, chin down a little
    ['rot', 'chest', X, .08],
    ['aim', 'thighl', V(.02, -1, -.02)], ['aim', 'shinl', V(.01, -1, -.05)], ['foot', 'l', .95, .03],
    ['aim', 'thighr', V(-.02, -1, -.02)], ['aim', 'shinr', V(-.01, -1, -.05)], ['foot', 'r', .95, .03],
    ['aim', 'upperarml', V(.08, -1, -.26)], ['aim', 'forearml', V(.04, -1, -.32)], ['aim', 'handl', V(.02, -1, -.34), 'palm02l'],
    ['aim', 'upperarmr', V(-.08, -1, -.26)], ['aim', 'forearmr', V(-.04, -1, -.32)], ['aim', 'handr', V(-.02, -1, -.34), 'palm02r'],
    ['curl', 'l', .4], ['curl', 'r', .4], ['rot', 'neck', X, -.25], ['rot', 'head', X, -.5]],
  brake: [ // braking: torso back, arms pushed forward-down with the palms turned to face forward, knees up
    ['rot', 'spine', X, -.12],
    ['aim', 'thighl', V(.05, -1, .3)], ['aim', 'shinl', V(.02, -1, -.18)], ['foot', 'l', .25, .08],
    ['aim', 'thighr', V(-.05, -1, .2)], ['aim', 'shinr', V(-.02, -1, -.25)], ['foot', 'r', .25, .08],
    ['aim', 'upperarml', V(.32, -.8, .48)], ['aim', 'forearml', V(.22, -.4, .9)], ['aim', 'handl', V(.06, .75, .65), 'palm02l'],
    ['aim', 'upperarmr', V(-.32, -.8, .48)], ['aim', 'forearmr', V(-.22, -.4, .9)], ['aim', 'handr', V(-.06, .75, .65), 'palm02r'],
    ['curl', 'l', .08], ['curl', 'r', .08], ['rot', 'neck', X, .05], ['rot', 'head', X, .05]],
  turnL: [ // banking left: inside (left) arm drops and opens as a stabiliser, outside arm tucks, chest and head lead into the turn
    ['rot', 'spine', Y, .1], ['rot', 'chest', Y, .1], ['rot', 'spine', Z, .06],
    ['aim', 'thighl', V(.07, -1, -.1)], ['aim', 'shinl', V(.03, -1, -.24)], ['foot', 'l', .85, .05],
    ['aim', 'thighr', V(-.02, -1, 0)], ['aim', 'shinr', V(-.01, -1, -.06)], ['foot', 'r', .9, .05],
    ['aim', 'upperarml', V(.42, -1, .02)], ['aim', 'forearml', V(.32, -1, .1)], ['aim', 'handl', V(.2, -1, .3), 'palm02l'],
    ['aim', 'upperarmr', V(-.1, -1, -.3)], ['aim', 'forearmr', V(-.06, -1, -.36)], ['aim', 'handr', V(-.02, -1, -.36), 'palm02r'],
    ['curl', 'l', .15], ['curl', 'r', .35], ['rot', 'neck', X, -.35], ['rot', 'head', X, -.6], ['rot', 'head', Y, .22]],
};
// mirror helper: turnR = turnL with sides swapped (X -> -X, l <-> r, Y/Z rotations negated)
POSE_SPECS.turnR = POSE_SPECS.turnL.map(op => {
  const sw = k => typeof k === 'string' ? k.replace(/l$/, '#').replace(/r$/, 'l').replace(/#$/, 'r') : k;
  const [kind, a1, a2, a3, a4] = op;
  if (kind === 'aim') return [kind, sw(a1), new THREE.Vector3(-a2.x, a2.y, a2.z), a3 ? sw(a3) : a3];
  if (kind === 'rot') return [kind, ['spine', 'chest', 'neck', 'head', 'hips'].includes(a1) ? a1 : sw(a1), a2, a2 === X ? a3 : -a3];
  if (kind === 'curl' || kind === 'foot') return [kind, a1 === 'l' ? 'r' : 'l', a2, a3, a4];
  return op;
});

export async function loadSuit({ renderer, envTex, url = new URL(globalThis.SUIT_MODEL_URL || '../models/scifi_soldier/model.glb', import.meta.url).href, curlSign = 1 } = {}) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const root = new THREE.Group(), model = gltf.scene; root.add(model); root.name = 'suit-rig';
  const meshes = [];
  model.traverse(o => { if (!o.isMesh) return; o.frustumCulled = false; o.material = paint(o.material, envTex); meshes.push(o); });
  const B = {}; model.traverse(o => { if (o.isBone) B[key(o.name)] = o; });
  const need = ['hips', 'spine', 'chest', 'neck', 'head', 'upperarml', 'forearml', 'handl', 'thighl', 'shinl', 'footl', 'toel'];
  need.forEach(k => { if (!B[k]) throw new Error('suit rig: missing bone ' + k); });
  const upd = () => { model.updateMatrixWorld(true); model.traverse(o => o.isSkinnedMesh && o.skeleton.update()); };

  // ---- proportion fixes (bone scale; children counter-scaled so only the intended segment changes) ----
  // forearms ~20% slimmer + shorter (hands kept near their original size); upper arms a touch fuller to match
  for (const s of ['l', 'r']) { B['upperarm' + s].scale.setScalar(1.04); B['forearm' + s].scale.setScalar(.8 / 1.04); B['hand' + s].scale.setScalar(.94 / .8); }
  B.head.position.multiplyScalar(.5);   // shorter neck: the helmet sits lower on the shoulders (no non-uniform scale, so no shear)

  // ---- normalize: height 1, hips at the origin ----
  const bounds = () => { const b = new THREE.Box3(), v = new THREE.Vector3(); upd();
    for (const o of meshes) { const n = o.geometry.attributes.position.count; for (let i = 0; i < n; i += 2) { o.getVertexPosition(i, v); b.expandByPoint(v.applyMatrix4(o.matrixWorld)); } } return b; };
  let bb = bounds(); model.scale.multiplyScalar(1 / (bb.max.y - bb.min.y)); upd();
  const hp = B.hips.getWorldPosition(new THREE.Vector3()); model.position.sub(hp); upd(); bb = bounds();
  const rest = {}; Object.entries(B).forEach(([k, b]) => (rest[k] = { q: b.quaternion.clone(), p: b.position.clone() }));
  const footKeys = ['footl', 'footr', 'toel', 'toer', 'heel02l', 'heel02r', 'heell', 'heelr', 'shinl', 'shinr'].filter(k => B[k]);
  const lowBone = () => Math.min(...footKeys.map(k => B[k].getWorldPosition(new THREE.Vector3()).y));
  const sole = lowBone() - bb.min.y;   // boot sole thickness under the lowest foot bone
  const restFootDir = {}; for (const s of ['l', 'r']) restFootDir[s] = B['toe' + s].getWorldPosition(new THREE.Vector3()).sub(B['foot' + s].getWorldPosition(new THREE.Vector3())).normalize();

  // ---- pose builder ----
  const _q = new THREE.Quaternion(), _w = new THREE.Quaternion(), _p = new THREE.Quaternion(), _a = new THREE.Vector3(), _c = new THREE.Vector3();
  const rotW = (b, q) => { b.getWorldQuaternion(_w); b.parent.getWorldQuaternion(_p); b.quaternion.copy(_p.invert().multiply(q.clone().multiply(_w))); b.updateMatrixWorld(true); };
  const childOf = (b, ck) => (ck && B[ck]) || b.children.find(c => c.isBone);
  const aim = (b, dir, ck) => { const c = childOf(b, ck); if (!c) return; b.getWorldPosition(_a); c.getWorldPosition(_c); const cur = _c.sub(_a).normalize(); rotW(b, _q.setFromUnitVectors(cur, dir.clone().normalize())); };
  const fingers = s => Object.keys(B).filter(k => /^(findex|fmiddle|fring|fpinky|thumb)0[123]/.test(k) && k.endsWith(s));
  function buildPose(spec) {
    Object.entries(rest).forEach(([k, r]) => { B[k].quaternion.copy(r.q); B[k].position.copy(r.p); }); upd();
    for (const op of spec) {
      const [kind, a1, a2, a3, a4] = op;
      if (kind === 'rot') { const b = B[a1]; if (b) rotW(b, _q.setFromAxisAngle(new THREE.Vector3(...a2).normalize(), a3)); }
      else if (kind === 'aim') { const b = B[a1]; if (b) aim(b, a2, a3); }
      else if (kind === 'move') { const b = B[a1], w = b.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...a2)); b.position.copy(b.parent.worldToLocal(w)); b.updateMatrixWorld(true); }
      else if (kind === 'curl') { for (const k of fingers(a1)) { const thumb = k.startsWith('thumb'), seg = +k.match(/0(\d)/)[1];
          const amt = a2 * (thumb ? [0, .25, .45, .4][seg] : [0, .75, 1.1, .9][seg]); B[k].quaternion.multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), curlSign * amt)); B[k].updateMatrixWorld(true); } }
      else if (kind === 'foot') { const s = a1, side = s === 'l' ? 1 : -1, d = restFootDir[s].clone();
        d.applyAxisAngle(new THREE.Vector3(0, 1, 0), side * a3); const flat = Math.atan2(-d.y, Math.hypot(d.x, d.z)), yaw = Math.atan2(d.x, d.z);
        const pitch = flat + a2; aim(B['foot' + s], new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)), 'toe' + s); }
    }
    upd();
    const out = { q: {}, p: {}, hipH: B.hips.getWorldPosition(new THREE.Vector3()).y - lowBone() + sole };
    Object.keys(B).forEach(k => { out.q[k] = B[k].quaternion.clone(); out.p[k] = B[k].position.clone(); });
    return out;
  }
  const POSES = {}; for (const [n, spec] of Object.entries(POSE_SPECS)) POSES[n] = buildPose(spec);

  // ---- attachments, made in the rest pose (feet flat), then pinned to bones so they follow the skeleton ----
  Object.entries(rest).forEach(([k, r]) => { B[k].quaternion.copy(r.q); B[k].position.copy(r.p); }); upd();
  const groundY = bb.min.y;
  const emitters = [];
  const pin = (bone, pos, dir, kind, side) => { const em = new THREE.Object3D(); em.position.copy(pos); em.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize()); root.add(em); em.updateMatrixWorld(true); bone.attach(em); emitters.push({ em, kind, side }); return em; };
  for (const s of ['l', 'r']) {
    const f = B['foot' + s].getWorldPosition(new THREE.Vector3()), t = B['toe' + s].getWorldPosition(new THREE.Vector3());
    pin(B['foot' + s], new THREE.Vector3((f.x + t.x) / 2, groundY + .004, (f.z + t.z) * .5 - .01), new THREE.Vector3(0, -1, 0), 'foot', s);
    const h = B['hand' + s].getWorldPosition(new THREE.Vector3()), m = (B['fmiddle01' + s] || B['palm02' + s]).getWorldPosition(new THREE.Vector3());
    pin(B['hand' + s], h.clone().lerp(m, .7), m.clone().sub(h), 'hand', s);
  }
  // chest light: find the armour surface at upper-chest height with a ray from the front, seat a gold-rimmed lens flush in it
  const chestY = groundY + .745, ray = new THREE.Raycaster(new THREE.Vector3(0, chestY, 3), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObjects(meshes, false)[0];
  const cp = hit ? hit.point.clone() : new THREE.Vector3(0, chestY, .1);
  let cn = hit && hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 0, 1); if (cn.z < .5) cn = new THREE.Vector3(0, .15, 1).normalize();
  const chest = new THREE.Group(); chest.position.copy(cp).addScaledVector(cn, .0015); chest.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), cn);
  const R = .02;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(R, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe2f8ff).multiplyScalar(2.2), toneMapped: false })); lens.position.z = .0005;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.12, R * .2, 10, 40), new THREE.MeshPhysicalMaterial({ color: COL.gold, metalness: 1, roughness: .22, clearcoat: .6, envMap: envTex })); rim.position.z = .001; rim.scale.z = .5;
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.3, R * 1.42, .012, 6).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: COL.gun, metalness: .9, roughness: .4, envMap: envTex })); housing.position.z = -.0068;
  const gtc = document.createElement('canvas'); gtc.width = gtc.height = 128; const g2 = gtc.getContext('2d'), gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(230,250,255,1)'); gr.addColorStop(.22, 'rgba(140,220,255,.6)'); gr.addColorStop(1, 'rgba(60,160,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
  const chestGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gtc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  chestGlow.scale.setScalar(.11); chestGlow.position.z = .01;
  chest.add(housing, rim, lens, chestGlow); root.add(chest); chest.updateMatrixWorld(true); B.chest.attach(chest);
  // two separate angled eye slits (our own blade shape) set into the faceplate, pinned to the head bone
  const headP = B.head.getWorldPosition(new THREE.Vector3()), eyes = [], eyeGlows = [];
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa9e2ff).multiplyScalar(1.7), toneMapped: false, side: THREE.DoubleSide });
  for (const side of [1, -1]) {
    const sh = new THREE.Shape();   // blade: thin inner tip, swept-up wider outer end with a raked cut
    [[-.0115, -.0012], [.0085, .0006], [.0125, .0042], [.0095, .0052], [-.009, .0022], [-.0122, .0002]].forEach(([x, y], i) => (i ? sh.lineTo(x * side, y) : sh.moveTo(x * side, y)));
    const geo = new THREE.ShapeGeometry(sh); geo.translate(0, -.002, 0);
    const ex = side * .0175, ey = headP.y + .052, er = new THREE.Raycaster(new THREE.Vector3(ex, ey, 3), new THREE.Vector3(0, 0, -1));
    const eh = er.intersectObjects(meshes, false)[0]; const ep = eh ? eh.point.clone() : new THREE.Vector3(ex, ey, headP.z + .065);
    let en = eh && eh.face ? eh.face.normal.clone().transformDirection(eh.object.matrixWorld) : new THREE.Vector3(side * .25, 0, 1).normalize(); if (en.z < .4) en.set(side * .25, 0, 1).normalize();
    const eg = new THREE.Group(); eg.position.copy(ep).addScaledVector(en, .0016); eg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), en);
    const slit = new THREE.Mesh(geo, eyeMat); slit.rotation.z = side * .14; eg.add(slit);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: chestGlow.material.map, color: 0xbfe9ff, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false, opacity: .8 }));
    halo.renderOrder = 5; halo.scale.set(.036, .02, 1); halo.position.z = .004; eg.add(halo); eyeGlows.push(halo);
    root.add(eg); eg.updateMatrixWorld(true); B.head.attach(eg); eyes.push(eg);
  }
  const metalParts = [rim, housing], glowParts = [lens, chestGlow, ...eyes];

  // ---- runtime pose blending + additive idle ----
  const weights = { stand: 1 }; let headYaw = 0, headPitch = 0, breathe = 1, flight = 0;
  const axisIn = (k, axis) => { Object.entries(POSES.stand.q).forEach(([b, q]) => B[b].quaternion.copy(q)); upd(); const w = B[k].getWorldQuaternion(new THREE.Quaternion()).invert(); return new THREE.Vector3(...axis).applyQuaternion(w).normalize(); };
  const AX = { thighXl: axisIn('thighl', X), thighXr: axisIn('thighr', X), shinXl: axisIn('shinl', X), shinXr: axisIn('shinr', X), spineZ: axisIn('spine', Z), handXl: axisIn('handl', X), handXr: axisIn('handr', X), chestX: axisIn('chest', X), spineX: axisIn('spine', X), headY: axisIn('head', Y), headX: axisIn('head', X), shoulderZl: B.shoulderl ? axisIn('shoulderl', Z) : null, shoulderZr: B.shoulderr ? axisIn('shoulderr', Z) : null };
  const keys = Object.keys(B), _t = new THREE.Quaternion(), _v = new THREE.Vector3(), _hq = new THREE.Quaternion();
  function apply(t = 0) {
    let tot = 0; const list = Object.entries(weights).filter(([n, w]) => w > 1e-4 && POSES[n]); list.forEach(([, w]) => (tot += w));
    if (!tot) return;
    let acc = 0; let hipH = 0;
    for (const k of keys) {
      const b = B[k]; acc = 0;
      for (const [n, w] of list) { const P = POSES[n]; if (!acc) { b.quaternion.copy(P.q[k]); b.position.copy(P.p[k]); } else { b.quaternion.slerp(P.q[k], w / (acc + w)); b.position.lerp(P.p[k], w / (acc + w)); } acc += w; }
    }
    for (const [n, w] of list) hipH += POSES[n].hipH * w / tot;
    // idle: breathing (chest/spine), shoulders rise a hair, plus the scan head turn
    const br = Math.sin(t * 1.6) * breathe;
    B.chest.quaternion.multiply(_t.setFromAxisAngle(AX.chestX, -.022 * br)); B.spine.quaternion.multiply(_t.setFromAxisAngle(AX.spineX, .01 * br));
    if (AX.shoulderZl) B.shoulderl.quaternion.multiply(_t.setFromAxisAngle(AX.shoulderZl, .012 * br)); if (AX.shoulderZr) B.shoulderr.quaternion.multiply(_t.setFromAxisAngle(AX.shoulderZr, -.012 * br));
    if (flight > .001) { // in the air: legs trail with a soft knee and small independent sway, torso rolls a touch, palms trim
      const f = flight;
      B.thighl.quaternion.multiply(_t.setFromAxisAngle(AX.thighXl, f * (.05 * Math.sin(t * 1.7) + .03))); B.thighr.quaternion.multiply(_t.setFromAxisAngle(AX.thighXr, f * (.05 * Math.sin(t * 2.13 + 1.3) + .02)));
      B.shinl.quaternion.multiply(_t.setFromAxisAngle(AX.shinXl, f * (.1 + .07 * Math.sin(t * 1.9 + .7)))); B.shinr.quaternion.multiply(_t.setFromAxisAngle(AX.shinXr, f * (.08 + .07 * Math.sin(t * 2.4 + 2.1))));
      B.spine.quaternion.multiply(_t.setFromAxisAngle(AX.spineZ, f * .025 * Math.sin(t * .9)));
      B.handl.quaternion.multiply(_t.setFromAxisAngle(AX.handXl, f * .08 * Math.sin(t * 1.3 + .4))); B.handr.quaternion.multiply(_t.setFromAxisAngle(AX.handXr, f * .08 * Math.sin(t * 1.5 + 1.9)));
    }
    if (headYaw || headPitch) { // yaw about the true world vertical (works upright and when flying horizontal)
      B.head.parent.updateWorldMatrix(true, false); B.head.parent.getWorldQuaternion(_hq).multiply(B.head.quaternion).invert(); _v.set(0, 1, 0).applyQuaternion(_hq).normalize();
      B.head.quaternion.multiply(_t.setFromAxisAngle(_v, headYaw)); B.head.quaternion.multiply(_t.setFromAxisAngle(AX.headX, headPitch)); }
    rig.hipH = hipH;
  }
  const cam = new THREE.Vector3(), cw = new THREE.Vector3(), cdir = new THREE.Vector3(), nW = new THREE.Vector3();
  const rig = {
    root, model, bones: B, meshes, metalParts, glowParts, emitters, chest, chestGlow, POSES, weights, hipH: POSES.stand.hipH, sole,
    setPose(name) { Object.keys(weights).forEach(k => delete weights[k]); weights[name] = 1; },
    setWeights(w) { Object.keys(weights).forEach(k => delete weights[k]); Object.assign(weights, w); },
    set headYaw(v) { headYaw = v; }, get headYaw() { return headYaw; }, set headPitch(v) { headPitch = v; }, set breathe(v) { breathe = v; }, set flight(v) { flight = v; }, eyes,
    update(t, camera) {
      apply(t);
      const f = 1 + .07 * Math.sin(t * 6) + .03 * Math.sin(t * 17); chestGlow.scale.setScalar(.11 * f);
      if (camera) { // the halo only shows when the lens faces the camera, so it never floats off the chest in side views
        chest.updateWorldMatrix(true, false); chest.getWorldPosition(cw); camera.getWorldPosition(cam); cdir.subVectors(cam, cw).normalize();
        nW.set(0, 0, 1).transformDirection(chest.matrixWorld); const d = nW.dot(cdir); chestGlow.material.opacity = THREE.MathUtils.smoothstep(d, .15, .7);
        for (let i = 0; i < eyes.length; i++) { eyes[i].getWorldPosition(cw); cdir.subVectors(cam, cw).normalize(); nW.set(0, 0, 1).transformDirection(eyes[i].matrixWorld); eyeGlows[i].material.opacity = .85 * THREE.MathUtils.smoothstep(nW.dot(cdir), .05, .6); }
      }
    },
  };
  rig.setPose('stand'); rig.update(0);
  return rig;
}

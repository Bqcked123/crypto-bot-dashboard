// suit.js: original powered-armor figure built in code from Three.js primitives (no external models, no logos).
// buildSuit(renderer) -> { root, bankG, figure, helm, chest, arms, legs, metal, BLACK, envTex, glowBits, setPose(), setThrust(), update() }
// Hierarchy: root (position/heading) > bankG (roll) > figure (pitch) > pivot groups (helm, chest, shoulders, elbows, hips, knees).
// Metal meshes are merged per pivot group + material and live on layers 0 and 1; glowing bits are on both layers too.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, 'rgba(160,235,255,.85)'); r.addColorStop(.45, 'rgba(60,180,255,.25)'); r.addColorStop(1, 'rgba(0,80,160,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const glow = (s, o = 1, c = 0xffffff) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(s); return sp; };
const meshMat = (c, o = 1, extra = {}) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, ...extra });
const add = (o, p) => (p.add(o), o);

export function buildSuit(renderer) {
const root = new THREE.Group(), bankG = add(new THREE.Group(), root), figure = add(new THREE.Group(), bankG);
// ===== Powered armor: original design built from faceted / extruded primitives (no external models, no logos) =====
// Look: deep candy-apple red main plates, champagne-gold secondary plates (faceplate, abs, forearms, thighs, trim),
// gunmetal joints, pistons and under-layer. Static pieces are merged per pivot group + material for performance.
// --- environment: RoomEnvironment plus bright strip "softboxes" so the metal gets crisp highlight streaks along edges
const envScene = new RoomEnvironment(), stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 16, 16) });
[[0, 13, 2, 16, .35, 1.4, 0], [-13, 6, 5, .35, 11, 1.2, .2], [12, 7, -7, .35, 12, 1.2, -.25], [3, 2, 14, 10, .3, 1, 0], [0, -9, 6, 14, .3, 4, 0]].forEach(([x, y, z, w, h, d, r]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stripMat); m.position.set(x, y, z); m.rotation.y = r; envScene.add(m); });
const pmrem = new THREE.PMREMGenerator(renderer), envTex = pmrem.fromScene(envScene, 0.02).texture; pmrem.dispose();
// --- procedural surface textures: brushed grain + fine scratches + wear (roughness) and a matching normal map
const TEX = (() => {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 3200; i++) { const y = Math.random() * N, x = Math.random() * N - 100, l = 60 + Math.random() * 300, v = 95 + Math.random() * 70 | 0;
    g.strokeStyle = `rgba(${v},${v},${v},.16)`; g.lineWidth = .5 + Math.random(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (Math.random() - .5) * 2); g.stroke(); }
  for (let i = 0; i < 26; i++) { const x = Math.random() * N, y = Math.random() * N, r = 20 + Math.random() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(150,150,150,.18)'); gr.addColorStop(1, 'rgba(150,150,150,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }   // smudges / wear (rougher)
  for (let i = 0; i < 45; i++) { const x = Math.random() * N, y = Math.random() * N, a = Math.random() * Math.PI, l = 6 + Math.random() * 55;
    g.strokeStyle = `rgba(60,60,60,${.15 + Math.random() * .2})`; g.lineWidth = .6 + Math.random() * .6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } // scratches
  const rough = new THREE.CanvasTexture(c);
  const src = g.getImageData(0, 0, N, N).data, n = document.createElement('canvas'); n.width = n.height = N; const ng = n.getContext('2d'), out = ng.createImageData(N, N);
  const H = (x, y) => src[(((y + N) % N) * N + ((x + N) % N)) * 4] / 255;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    out.data[i] = (-dx / l * .5 + .5) * 255; out.data[i + 1] = (dy / l * .5 + .5) * 255; out.data[i + 2] = (1 / l * .5 + .5) * 255; out.data[i + 3] = 255; }
  ng.putImageData(out, 0, 0); const normal = new THREE.CanvasTexture(n);
  [rough, normal].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; });
  return { rough, normal };
})();
const metalMat = (o) => new THREE.MeshPhysicalMaterial({ envMap: envTex, roughnessMap: TEX.rough, normalMap: TEX.normal, normalScale: new THREE.Vector2(.16, .16), side: THREE.DoubleSide, ...o });
const RED = metalMat({ color: 0xa10d16, metalness: .88, roughness: .5, clearcoat: .2, clearcoatRoughness: .12, envMapIntensity: 1.7 });     // candy-apple red
const RED_E = metalMat({ color: 0xb02a26, metalness: 1, roughness: .36, envMapIntensity: 1.6 });                                                // worn/bright plate edges
const GOLD = metalMat({ color: 0xe6b65c, metalness: 1, roughness: .48, clearcoat: .15, clearcoatRoughness: .15, envMapIntensity: 2.0, anisotropy: .25 });                                // champagne gold
const GOLD_E = metalMat({ color: 0xf2cf84, metalness: 1, roughness: .32, envMapIntensity: 2.0, anisotropy: .4 });
const STEEL = metalMat({ color: 0x3e434b, metalness: 1, roughness: .7, envMapIntensity: 1.2, anisotropy: .5 });         // gunmetal joints / pistons
const CHROME = metalMat({ color: 0xc9ced6, metalness: 1, roughness: .28, envMapIntensity: 1.6 });                                                              // piston rods
const DARK = new THREE.MeshStandardMaterial({ color: 0x0d0f12, metalness: .7, roughness: .7, envMap: envTex, envMapIntensity: .45 });                           // under-layer / recesses
const BLACK = new THREE.MeshBasicMaterial({ color: 0x000000 });
const metal = [];
const both = o => { o.traverse(c => c.layers.enable(1)); return o; };   // glowing bits: bloom pass AND drawn over the metal
const solidGlow = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra });
// --- geometry helpers (all faceted: flat normals, low segment counts, chamfered extrusions)
const V2 = pts => pts.map(([x, y]) => new THREE.Vector2(x, y));
function ext(pts, depth, bevel = .004, segs = 1) {           // polygon in XY, extruded along Z (centred), chamfered edges
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(V2(pts)), { depth: Math.max(.0005, depth), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 1 });
  return g.translate(0, 0, -Math.max(.0005, depth) / 2);
}
const bbox = (w, h, d, b = .004) => ext([[-w / 2 + b, -h / 2 + b], [w / 2 - b, -h / 2 + b], [w / 2 - b, h / 2 - b], [-w / 2 + b, h / 2 - b]], d - 2 * b, b);
const trap = (wt, wb, h, d, b = .004) => ext([[-wb / 2, -h / 2], [wb / 2, -h / 2], [wt / 2, h / 2], [-wt / 2, h / 2]], d, b);
const profile = (pts, width, b = .006, segs = 1) => ext(pts, width, b, segs).rotateY(-Math.PI / 2);   // side profile (z,y) extruded along X
const prism = (rt, rb, h, n = 6) => new THREE.CylinderGeometry(rt, rb, h, n);
const facet = r => new THREE.IcosahedronGeometry(r, 0);
const rivet = () => new THREE.CylinderGeometry(.0045, .0055, .004, 6).rotateX(Math.PI / 2);   // faces +z
const pending = new Map(), _o = new THREE.Object3D();
function boxUV(g) {   // per-face box projection (all 3 vertices of a flat triangle share a normal, so no seams inside a face)
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * 5; uv[i * 2 + 1] = v * 5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function part(geom, parent, pos, rot, scl, mat = RED, edge = null, smooth = false) {
  _o.position.set(...(pos || [0, 0, 0])); _o.rotation.set(...(rot || [0, 0, 0])); _o.scale.set(...(scl || [1, 1, 1])); _o.updateMatrix();
  const g = geom.index ? geom.toNonIndexed() : geom.clone(); g.applyMatrix4(_o.matrix);
  const p = g.attributes.position, groups = g.groups.length ? g.groups : [{ start: 0, count: p.count, materialIndex: 0 }];
  if (!pending.has(parent)) pending.set(parent, new Map()); const byMat = pending.get(parent);
  groups.forEach(gr => { const m = gr.materialIndex > 0 && edge ? edge : mat, s = new THREE.BufferGeometry();
    s.setAttribute('position', new THREE.BufferAttribute(p.array.slice(gr.start * 3, (gr.start + gr.count) * 3), 3));
    if (smooth && g.attributes.normal) {
      s.setAttribute('normal', new THREE.BufferAttribute(g.attributes.normal.array.slice(gr.start * 3, (gr.start + gr.count) * 3), 3));
      const uv0 = g.attributes.uv, uv = new Float32Array(gr.count * 2);
      for (let i = 0; i < gr.count; i++) { uv[i * 2] = uv0 ? uv0.getX(gr.start + i) * 2.5 : 0; uv[i * 2 + 1] = uv0 ? uv0.getY(gr.start + i) * 1.2 : 0; }
      s.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    } else { s.computeVertexNormals(); boxUV(s); }
    if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push(s); });
}
const R = (geom, parent, pos, rot, scl) => part(geom, parent, pos, rot, scl, RED, RED_E);
const RS = (prof, parent, pos, scl, n = 12) => part(new THREE.LatheGeometry(V2(prof), n), parent, pos, null, scl, RED, null, true);   // smooth muscular red shell (lathe: [radius, y])
const glowBits = [];
const slit = (parent, pos, rot, w = .022, h = .005) => { const m = both(add(new THREE.Mesh(new THREE.BoxGeometry(w, h, .004), solidGlow(0xc8f2ff)), parent)); m.position.set(...pos); if (rot) m.rotation.set(...rot); glowBits.push(m); };       // red plate with bright chamfers
const Gd = (geom, parent, pos, rot, scl) => part(geom, parent, pos, rot, scl, GOLD, GOLD_E);    // gold plate
const S = (geom, parent, pos, rot, scl) => part(geom, parent, pos, rot, scl, STEEL);
const D = (geom, parent, pos, rot, scl) => part(geom, parent, pos, rot, scl, DARK);
const vents = (parent, x, y, z, n, w, gap, rot) => { for (let i = 0; i < n; i++) D(bbox(w, .005, .006, .0015), parent, [x, y - i * gap, z], rot); };
function piston(parent, a, b, r = .007) {                     // hydraulic piston between two points: gunmetal sleeve + chrome rod
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q), mid = (t) => A.clone().addScaledVector(d, t).toArray();
  S(prism(r * 1.5, r * 1.5, L * .55, 6), parent, mid(.3), [e.x, e.y, e.z]);
  part(prism(r * .75, r * .75, L * .5, 6), parent, mid(.72), [e.x, e.y, e.z], null, CHROME);
}
function finalizeSuit() {                                      // merge per (pivot group, material); box-projected UVs for the grain textures
  pending.forEach((byMat, parent) => byMat.forEach((list, mat) => {
    const g = mergeGeometries(list, false);
    const m = new THREE.Mesh(g, mat); m.userData.mat = mat; m.layers.enable(1); metal.push(m); parent.add(m);
  }));
  pending.clear();
}
const MX = pts => pts.map(([x, y]) => [-x, y]), MXs = (s, pts) => s > 0 ? pts : MX(pts);
const SP = (r, ws, hs, p0 = 0, pl = Math.PI * 2, t0 = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, p0, pl, t0, tl);
const sm = (geom, parent, pos, rot, scl, mat = RED) => part(geom, parent, pos, rot, scl, mat, null, true);   // smooth-shaded sculpted shell
// pivot helper: a joint group at `at` (in parent space) plus a content group offset back, so parts keep parent-space coords
function joint(parent, at, name) { const j = add(new THREE.Group(), parent); j.position.set(...at); j.name = name; const c = add(new THREE.Group(), j); c.position.set(-at[0], -at[1], -at[2]); return [j, c]; }
// ================= rig: figure > hips (pelvis, legs) + torso (waist pivot) > head, arms =================
const hips = add(new THREE.Group(), figure); hips.name = 'hips';
const [torso, T] = joint(figure, [0, .02, 0], 'torso');
// ---------------- torso: broad smooth chest shell, sculpted pecs, gold side-chest plates, narrow gunmetal waist ----------------
S(prism(.088, .07, .3, 12), T, [0, .1, 0], null, [1, 1, .66]);                                                         // gunmetal waist / under-layer
RS([[.084, .02], [.09, .06], [.094, .1], [.104, .15], [.15, .215], [.166, .265], [.158, .305], [.124, .336], [.064, .352]], T, [0, 0, -.01], [1, 1, .62], 18);   // chest shell
[-1, 1].forEach(s => {
  sm(SP(.068, 24, 10, 0, Math.PI * 2, 0, Math.PI * .5), T, [s * .06, .272, .078], [Math.PI / 2 - .28, s * .32, 0], [1.05, .22, .66]);   // sculpted pec plate
  Gd(ext(MXs(s, [[.0, .02], [.1, -.004], [.128, -.058], [.088, -.07], [.058, -.032], [0, -.014]]), .012, .004), T, [s * .03, .205, .082], [-.05, s * .45, 0]);  // gold side-chest plate
  Gd(ext(MXs(s, [[0, .012], [.05, .0], [.056, -.012], [0, -.004]]), .008, .003), T, [s * .1, .29, .07], [-.1, s * .75, s * -.15]);  // gold collar-bone accent
  slit(T, [s * .122, .305, .066], [0, s * .62, s * -.32], .024, .0045);                                                // chest light slits
  slit(T, [s * .11, .16, .062], [0, s * .6, s * .25], .02, .004);
  Gd(trap(.034, .03, .05, .012, .003), T, [s * .118, .13, .03], [0, s * 1.05, s * .1]);                                 // gold oblique plates
});
for (let k = 0; k < 3; k++) {                                                                                           // segmented gold abs (two columns)
  const y = .118 - k * .031;
  [-1, 1].forEach(s => Gd(trap(.044 - k * .004, .04 - k * .004, .022, .012, .004), T, [s * .026, y, .062 - k * .003], [0, s * .25, 0]));
}
S(prism(.096, .096, .028, 12), hips, [0, .0, 0], null, [1, 1, .74]);                                                     // gunmetal belt
Gd(ext([[0, .015], [.013, .0075], [.013, -.0075], [0, -.015], [-.013, -.0075], [-.013, .0075]], .006, .002), hips, [0, 0, .072]);  // buckle
RS([[.07, -.115], [.088, -.09], [.1, -.05], [.1, -.015]], hips, [0, 0, 0], [1, 1, .76], 16);                             // pelvis
R(trap(.075, .028, .068, .016, .005), hips, [0, -.072, .066], [.2, 0, 0]);                                             // cod plate
[-1, 1].forEach(s => R(trap(.05, .06, .065, .014, .004), hips, [s * .088, -.065, 0], [0, s * Math.PI / 2, s * .12])); // hip side plates
// back: smooth back plate, twin flight packs with intakes and nozzles
R(ext([[-.12, .325], [.12, .325], [.145, .245], [.08, .145], [-.08, .145], [-.145, .245]], .016, .006), T, [0, 0, -.088]);
D(bbox(.006, .16, .01, .001), T, [0, .235, -.1]);
[-1, 1].forEach(s => { S(bbox(.046, .15, .05, .008), T, [s * .062, .218, -.112], [.12, 0, s * .08]);
  vents(T, s * .062, .26, -.139, 5, .028, .011, [.12, 0, s * .08]); S(prism(.016, .021, .03, 10), T, [s * .066, .132, -.118], [.12, 0, 0]); });
S(prism(.054, .072, .03, 12), T, [0, .348, -.006], null, [1, 1, .85]);                                                    // collar ring
// ---------------- head (pivot at the neck): smooth skull, crown ridge, curved gold mask with angular jaw + split chin ----------------
const [head, Hc] = joint(T, [0, .38, -.004], 'head');
S(prism(.034, .042, .055, 10), Hc, [0, .38, -.004]);                                                                        // neck
const helm = add(new THREE.Group(), Hc); helm.position.set(0, .448, -.004); helm.scale.setScalar(1.14);
sm(SP(.07, 28, 20), helm, [0, .005, -.006], null, [.9, 1.1, 1.14]);                                                        // skull
part(new THREE.TorusGeometry(.0775, .004, 6, 30, Math.PI * .9), helm, [0, .005, -.006], [0, Math.PI / 2, 0], [1.03, 1, 1], STEEL);   // crown ridge
{ const m = SP(.0728, 10, 9, Math.PI / 2 - .86, 1.72, 1.02, 1.72), q = m.attributes.position;     // faceted gold mask: flat facets = angular cheek planes
  for (let i = 0; i < q.count; i++) { const y = q.getY(i); if (y < -.012) { const k = Math.min(1, (-.012 - y) / .06); q.setX(i, q.getX(i) * (1 - .38 * k)); q.setZ(i, q.getZ(i) + .006 * k); } }   // taper to a sharp jaw
  part(m, helm, [0, .005, -.006], null, [.9, 1.1, 1.14], GOLD, GOLD_E); }
[-1, 1].forEach(s => {
  R(bbox(.032, .007, .009, .0025), helm, [s * .021, .034, .083], [-.35, s * .3, s * .17]);                              // brow ridge
  D(bbox(.031, .011, .004, .0012), helm, [s * .019, .018, .0815], [0, s * .33, s * .22]);                              // eye recess
  const e = both(add(new THREE.Mesh(new THREE.BoxGeometry(.026, .0062, .004), solidGlow(0xeaf8ff)), helm)); e.position.set(s * .019, .018, .0835); e.rotation.set(0, s * .33, s * .22);
  S(ext([[0, .02], [.017, .01], [.017, -.01], [0, -.02], [-.017, -.01], [-.017, .01]], .008, .0025), helm, [s * .061, -.004, -.01], [0, Math.PI / 2, 0]);  // hex ear housings
});
D(bbox(.0022, .022, .004, .0008), helm, [0, -.07, .061], [.5, 0, 0]);                                                  // split-chin seam
D(bbox(.03, .0028, .004, .001), helm, [0, -.036, .0745]);                                                                  // mouth seam
const eyeGlow = both(add(glow(.09, .4, 0xbfe9ff), helm)); eyeGlow.position.set(0, .02, .1); eyeGlow.material.toneMapped = false;
// ---------------- chest light: bright round lens in an octagonal housing with two gold clamps ----------------
const chest = add(new THREE.Group(), T); chest.position.set(0, .2, .093);
S(ext([...Array(8)].map((_, i) => [Math.cos(i / 8 * Math.PI * 2 + Math.PI / 8) * .034, Math.sin(i / 8 * Math.PI * 2 + Math.PI / 8) * .034]), .012, .004), chest);
[-1, 1].forEach(s => { Gd(bbox(.011, .03, .012, .003), chest, [s * .04, 0, .004]); S(rivet(), chest, [s * .04, .009, .011]); S(rivet(), chest, [s * .04, -.009, .011]); });
both(add(new THREE.Mesh(new THREE.CircleGeometry(.024, 32), solidGlow(0xbdeeff)), chest)).position.z = .0105;
both(add(new THREE.Mesh(new THREE.CircleGeometry(.0135, 24), solidGlow(0xffffff)), chest)).position.z = .0112;
const chestGlow = both(add(glow(.26, 1, 0xbff2ff), chest)); chestGlow.material.toneMapped = false;
const chestGlow2 = both(add(glow(.55, .35, 0x7fd8ff), chest)); chestGlow2.material.toneMapped = false;
// ---------------- thrusters (palms + boots) ----------------
const emitters = [];
const flameGeo = new THREE.ConeGeometry(.024, .12, 14, 1, true).rotateX(Math.PI).translate(0, -.06, 0), flameCoreGeo = new THREE.ConeGeometry(.011, .07, 10, 1, true).rotateX(Math.PI).translate(0, -.035, 0);
const thrusterGlow = (parent, y) => {
  const g = both(add(glow(.28, 1, 0xd8f8ff), parent)); g.position.y = y; g.material.toneMapped = false;
  const fl = both(add(new THREE.Mesh(flameGeo, meshMat(0x8fdcff, .75, { toneMapped: false })), parent)); fl.position.y = y;
  const fc = both(add(new THREE.Mesh(flameCoreGeo, meshMat(0xffffff, .95, { toneMapped: false })), parent)); fc.position.y = y;
  const em = new THREE.Object3D(); em.position.y = y; parent.add(em); emitters.push({ em, g, fl, fc }); return g;
};
// ---------------- arms: shoulder (upper arm) > elbow (forearm) > wrist (hand) ----------------
const arms = [-1, 1].map(s => {
  const sh = add(new THREE.Group(), T); sh.position.set(s * .205, .275, 0); sh.name = (s < 0 ? 'L' : 'R') + '_upperArm';
  S(facet(.048), sh);
  sm(SP(.074, 20, 8, 0, Math.PI * 2, 0, Math.PI * .42), sh, [s * .01, .014, 0], [0, 0, s * -.34], [1.12, .82, 1.08]);           // layered pauldron: red cap
  sm(SP(.072, 20, 5, 0, Math.PI * 2, Math.PI * .4, Math.PI * .13), sh, [s * .012, .006, 0], [0, 0, s * -.34], [1.16, 1, 1.1], GOLD);  //   gold band
  sm(SP(.068, 20, 5, 0, Math.PI * 2, Math.PI * .52, Math.PI * .13), sh, [s * .014, -.004, 0], [0, 0, s * -.34], [1.14, 1, 1.08]);    //   lower red lame
  R(bbox(.08, .01, .016, .003), sh, [s * .03, .072, 0], [0, 0, s * -.34]);                                                       //   ridge fin
  D(prism(.032, .029, .19, 8), sh, [0, -.1, 0]);
  RS([[.036, -.085], [.046, -.05], [.052, -.005], [.048, .045], [.042, .07]], sh, [0, -.11, 0]);                                // upper-arm (muscular) shell
  Gd(ext([[-.026, .045], [.026, .04], [.03, -.03], [0, -.05], [-.03, -.03]], .012, .004), sh, [s * .035, -.115, .022], [0, s * .9, 0]);  // gold bicep plate
  const el = add(new THREE.Group(), sh); el.position.y = -.21; el.name = (s < 0 ? 'L' : 'R') + '_forearm';
  S(facet(.036), el); S(prism(.019, .019, .068, 8), el, [0, 0, 0], [0, 0, Math.PI / 2]);                                         // elbow joint
  R(trap(.044, .03, .044, .015, .004), el, [0, -.004, -.037], [-.35, 0, 0]);                                                    // elbow cop
  RS([[.034, -.085], [.045, -.04], [.05, .02], [.044, .07], [.036, .085]], el, [0, -.1, 0]);                                    // forearm shell
  Gd(trap(.048, .06, .13, .012, .005), el, [s * .03, -.1, .028], [-.03, s * .8, 0]);                                              // gold forearm plate
  D(bbox(.003, .09, .008, .001), el, [s * .046, -.1, -.004], [0, s * .8, 0]);                                                   // panel seam
  Gd(bbox(.064, .008, .068, .002), el, [0, -.183, 0]);                                                                         // gold cuff
  const [hand, Hn] = joint(el, [0, -.195, 0], (s < 0 ? 'L' : 'R') + '_hand');
  R(bbox(.058, .052, .052, .007), Hn, [0, -.218, 0]);                                                                          // hand
  Gd(bbox(.038, .028, .008, .002), Hn, [0, -.215, .029]);                                                                      // back-of-hand plate
  for (let f = 0; f < 4; f++) for (let k = 0; k < 3; k++)                                                                      // segmented finger plates (closed fist)
    (k % 2 ? S : R)(bbox(.0125, .015, .014, .002), Hn, [-.0195 + f * .013, -.25 - k * .013, .012 - k * .012], [-.6 * k, 0, 0]);
  R(bbox(.014, .028, .014, .003), Hn, [s * -.034, -.232, .014], [0, 0, s * .45]);                                              // thumb plate
  const palm = both(add(new THREE.Mesh(new THREE.CircleGeometry(.01, 16), solidGlow(0xdff6ff)), Hn)); palm.position.set(s * -.03, -.218, 0); palm.rotation.y = s * -Math.PI / 2;  // repulsor palm
  glowBits.push(palm);
  thrusterGlow(Hn, -.272); return { s, sh, el, hand, upperArm: sh, forearm: el };
});
// ---------------- legs: hip (thigh) > knee (shin) > ankle (foot) ----------------
const legsS = [-1, 1].map(s => {
  const hp = add(new THREE.Group(), hips); hp.position.set(s * .08, -.155, 0); hp.name = (s < 0 ? 'L' : 'R') + '_thigh';
  S(facet(.05), hp);
  RS([[.044, -.135], [.05, -.09], [.062, -.02], [.068, .06], [.062, .12], [.05, .14]], hp, [0, -.135, 0], [1, 1, .95]);          // thigh shell
  R(ext([[-.044, .1], [.044, .1], [.04, -.06], [0, -.094], [-.04, -.06]], .006, .004), hp, [0, -.12, .062], [-.04, 0, 0]);  // front thigh plate
  D(bbox(.058, .003, .006, .001), hp, [0, -.075, .071], [-.04, 0, 0]);
  Gd(trap(.05, .03, .1, .012, .004), hp, [s * .058, -.16, .022], [0, s * 1.0, 0]);                                              // gold outer-thigh accent
  slit(hp, [s * .062, -.205, .028], [0, s * 1.0, Math.PI / 2], .03, .0045);                                                     // thigh light slit
  sm(SP(.07, 16, 6, 0, Math.PI * 2, 0, Math.PI * .4), hp, [s * .005, -.012, 0], [0, 0, s * .1], [1.05, .6, 1]);                  // hip cap
  const kn = add(new THREE.Group(), hp); kn.position.y = -.27; kn.name = (s < 0 ? 'L' : 'R') + '_shin';
  S(facet(.043), kn); S(prism(.021, .021, .088, 8), kn, [0, 0, 0], [0, 0, Math.PI / 2]);
  Gd(ext([[-.031, .031], [.031, .031], [.037, -.004], [0, -.041], [-.037, -.004]], .016, .005), kn, [0, .004, .043], [.15, 0, 0]);  // gold knee cop
  RS([[.036, -.11], [.042, -.07], [.052, -.01], [.054, .04], [.046, .1]], kn, [0, -.13, 0]);                                    // shin / calf shell
  Gd(trap(.058, .048, .085, .014, .005), kn, [0, -.08, .05]);                                                                   // split shin plates (gold upper, red lower)
  R(trap(.048, .064, .09, .014, .005), kn, [0, -.175, .046]);
  Gd(trap(.028, .02, .12, .01, .003), kn, [s * .045, -.13, .02], [0, s * 1.1, 0]);                                               // gold side shin accent
  slit(kn, [s * .05, -.145, .028], [0, s * 1.1, Math.PI / 2], .034, .0045);                                                      // shin light slit
  vents(kn, 0, -.07, -.054, 3, .03, .011, [0, 0, 0]);                                                                           // calf vents
  const [foot, F] = joint(kn, [0, -.236, 0], (s < 0 ? 'L' : 'R') + '_foot');
  S(facet(.039), F, [0, -.236, 0]);                                                                                             // ankle
  R(profile([[-.05, .036], [.026, .036], [.062, .006], [.108, -.012], [.108, -.04], [-.056, -.04], [-.062, .002]], .072, .008), F, [0, -.27, 0]);  // boot
  Gd(bbox(.086, .006, .02, .002), F, [0, -.233, .03]);                                                                         // boot gold trim
  Gd(trap(.048, .058, .03, .012, .004), F, [0, -.262, .072], [-.55, 0, 0]);                                                     // gold instep plate
  S(bbox(.088, .012, .176, .003), F, [0, -.315, .024]);                                                                         // sole
  thrusterGlow(F, -.324); return { s, hp, kn, foot, thigh: hp, shin: kn };
});
finalizeSuit();
// ---- posing ----
let thrust = 1;
function setThrust(p) { thrust = p; emitters.forEach(({ g, fl, fc }) => { fl.visible = fc.visible = p > .05; g.visible = p > .02; }); }
const POSES = {   // sz/sx: shoulder roll/pitch, ex: elbow, wx: wrist, hz/hx: hip, kx: knee, fx: ankle, tx: torso pitch, nx: head pitch
  hero: { sz: .2, sx: .04, ex: -.22, wx: .1, hz: .085, hx: 0, kx: .04, fx: -.03, tx: 0, nx: -.04 },
  hover: { sz: .42, sx: -.25, ex: -.5, wx: .3, hz: .08, hx: .05, kx: .2, fx: .3, tx: 0, nx: 0 },
  fly: { sz: .14, sx: .12, ex: 0, wx: 0, hz: .03, hx: -.06, kx: .1, fx: .5, tx: 0, nx: -.5 } };
function setPose(name) { applyPose(POSES[name]); }
function applyPose(P) {
  arms.forEach(({ s, sh, el, hand }) => { sh.rotation.z = s * P.sz; sh.rotation.x = P.sx; el.rotation.x = P.ex; hand.rotation.x = P.wx; });
  legsS.forEach(({ s, hp, kn, foot }) => { hp.rotation.z = s * P.hz; hp.rotation.x = P.hx; kn.rotation.x = P.kx; foot.rotation.x = P.fx; });
  torso.rotation.x = P.tx; head.rotation.x = P.nx;
}
function update(t) {                // flicker glows (call each frame)
  chestGlow.material.opacity = .85 + .15 * Math.sin(t * 6); chestGlow2.material.opacity = .3 + .08 * Math.sin(t * 6);
  emitters.forEach(({ g, fl, fc }) => { if (thrust <= .02) return; g.material.opacity = .45 + .35 * Math.random(); g.scale.setScalar((.09 + .07 * thrust) * (.85 + .3 * Math.random()));
    const L = (.45 + .85 * thrust) * (.8 + .4 * Math.random()); fl.scale.set(1, L, 1); fc.scale.set(1, L * 1.1, 1); fl.material.opacity = .5 + .3 * Math.random(); });
}
const joints = { hips, torso, head, helm, chest,
  L_upperArm: arms[0].sh, L_forearm: arms[0].el, L_hand: arms[0].hand, R_upperArm: arms[1].sh, R_forearm: arms[1].el, R_hand: arms[1].hand,
  L_thigh: legsS[0].hp, L_shin: legsS[0].kn, L_foot: legsS[0].foot, R_thigh: legsS[1].hp, R_shin: legsS[1].kn, R_foot: legsS[1].foot };
return { root, bankG, figure, joints, helm, chest, chestGlow, chestGlow2, arms, legs: legsS, emitters, metal, BLACK, envTex, glowBits, POSES, setPose, applyPose, setThrust, update };
}

// v11 holographic center: Three.js scene + scan-driven flying armored suit. Data comes from ../shared/common.js (window.SD).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SD = window.SD, host = document.getElementById('holo');
const CY = 0x5fd8ff, CYB = 0x9eeaff, WHITE = 0xe8fbff;
const MOBILE = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
let W = host.clientWidth || innerWidth, H = host.clientHeight || innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(MOBILE ? Math.min(devicePixelRatio || 1, 1.25) : 1); renderer.setSize(W, H); renderer.setClearColor(0x01070f, 1);
host.appendChild(renderer.domElement);
const labels = new CSS2DRenderer(); labels.setSize(W, H);
Object.assign(labels.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
host.appendChild(labels.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
camera.position.set(0, 1.6, 11.5); camera.lookAt(0, 0.05, 0);
// mouse / touch orbit: left-drag (or one-finger drag) rotates, wheel / pinch zooms, no panning
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.05, 0); controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.enablePan = false; controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.8;
controls.minDistance = 6.5; controls.maxDistance = 17; controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.9;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.update();
let autoSpin = true, resumeTimer = null;
controls.addEventListener('start', () => { autoSpin = false; clearTimeout(resumeTimer); renderer.domElement.style.cursor = 'grabbing'; });
controls.addEventListener('end', () => { renderer.domElement.style.cursor = 'grab'; clearTimeout(resumeTimer); resumeTimer = setTimeout(() => (autoSpin = true), 3500); });
renderer.domElement.style.cursor = 'grab';
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), MOBILE ? 0.75 : 0.85, 0.45, 0.12); composer.addPass(bloom);
if (MOBILE) composer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));

const world = new THREE.Group(); scene.add(world);
const add = (o, p = world) => (p.add(o), o);
const addMat = (c, o = 1, extra = {}) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, ...extra });
const meshMat = (c, o = 1, extra = {}) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, ...extra });

// glow sprite texture
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, 'rgba(160,235,255,.85)'); r.addColorStop(.45, 'rgba(60,180,255,.25)'); r.addColorStop(1, 'rgba(0,80,160,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const glow = (s, o = 1, c = 0xffffff) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(s); return sp; };
const circle = (r, seg = 128, y = 0) => { const p = []; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; p.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } return new THREE.BufferGeometry().setFromPoints(p); };

// ---------- static hologram furniture ----------
const BASE_Y = -2.35;
const base = add(new THREE.Group()); base.position.y = BASE_Y;
[0.5, 0.9, 1.6, 2.4, 3.2, 3.5].forEach((r, i) => add(new THREE.Line(circle(r), addMat(CY, i === 5 ? .55 : .28)), base));
for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r0 = i % 4 ? 3.2 : 0.9; add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * r0, 0, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * 3.5, 0, Math.sin(a) * 3.5)]), addMat(CY, .22)), base); }
const baseDisk = add(new THREE.Mesh(new THREE.CircleGeometry(3.5, 64), meshMat(0x1aa8ff, .06, { side: THREE.DoubleSide })), base); baseDisk.rotation.x = -Math.PI / 2;
const beam = add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 0.7, 5.6, 64, 1, true), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { t: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'varying vec2 vUv; uniform float t; void main(){ float a=(1.0-vUv.y)*0.0+ (1.0-vUv.y)*0.0; float f=pow(1.0-vUv.y,2.2)*0.045 + 0.004; float s=0.75+0.25*sin(vUv.x*80.0+t*2.0); gl_FragColor=vec4(0.25,0.8,1.0,f*s); }'
})), scene); beam.position.y = BASE_Y + 2.8;
const baseGlow = add(glow(3.2, .22, 0x3fbfff), scene); baseGlow.position.y = BASE_Y;
// rotating holographic rings
const rings = [];
[[3.75, .35, 0, [0.08, 0.08]], [3.95, .22, 0.12, [0.02, 0.05]], [2.5, .2, -0.3, [0.05, 0.03]], [4.2, .14, 0.5, [0.12, 0.06]], [1.15, .35, 0, [0.03, 0.03]]].forEach(([r, o, tilt, dash], i) => {
  const l = new THREE.Line(circle(r, 256), new THREE.LineDashedMaterial({ color: CY, transparent: true, opacity: o, dashSize: dash[0] * r, gapSize: dash[1] * r, blending: THREE.AdditiveBlending, depthWrite: false }));
  l.computeLineDistances(); const g = add(new THREE.Group(), scene); g.add(l); g.rotation.x = tilt; g.rotation.z = tilt * .6; g.position.y = i === 4 ? -0.35 : 0.1; rings.push({ g, s: (i % 2 ? -1 : 1) * (0.05 + i * 0.03) }); });
// tick ring
const ticks = add(new THREE.Group(), scene); ticks.position.y = 2.75;
for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, r = 2.2, l = i % 10 ? .06 : .16; add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), new THREE.Vector3(Math.cos(a) * (r + l), 0, Math.sin(a) * (r + l))]), addMat(CY, .4)), ticks); }
// faint wire globe
add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(3.45, 2)), addMat(0x2fa8ff, .045)));
// particles
const PN = MOBILE ? 360 : 800, pg = new THREE.BufferGeometry(), pp = new Float32Array(PN * 3), pv = new Float32Array(PN);
for (let i = 0; i < PN; i++) { const r = Math.sqrt(Math.random()) * 4.4, a = Math.random() * Math.PI * 2; pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = BASE_Y + Math.random() * 6; pp[i * 3 + 2] = Math.sin(a) * r; pv[i] = .1 + Math.random() * .35; }
pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
const particles = add(new THREE.Points(pg, new THREE.PointsMaterial({ color: CYB, size: .035, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex })), scene);

// ---------- graph ----------
let G, nodesById = {}, edges = [], adj = {}, missions = [], built = false, stopAmb;
const label = (html, cls) => { const el = document.createElement('div'); el.className = 'hl ' + cls; el.innerHTML = html; return new CSS2DObject(el); };
function nodeAt(n) {
  const g = add(new THREE.Group()); g.position.copy(n.pos);
  const on = n.type === 'source' ? n.seen : n.on, tr = n.kind === 'trader', r = n.type === 'source' ? .075 : tr ? .3 : .21;
  if (n.type === 'source') {
    add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.OctahedronGeometry(r, 0)), addMat(on ? CYB : 0x2d6f8a, on ? .9 : .6)), g);
    n.glow = add(glow(on ? .34 : .2, on ? .55 : .25), g);
    n.lab = add(label(SD.esc(n.label), 'src' + (on ? '' : ' dim')), g); n.lab.position.set(0, .2, 0);
  } else {
    n.core = add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(r, tr ? 1 : 0)), addMat(tr ? WHITE : CYB, on ? .7 : .3)), g);
    add(new THREE.Mesh(new THREE.SphereGeometry(r * .32, 16, 12), meshMat(0x6fdcff, on ? .3 : .08)), g);
    n.orbit = add(new THREE.Line(circle(r * 1.7, 64), addMat(CY, on ? .6 : .25)), g); n.orbit.rotation.x = .5;
    if (tr) { n.orbit2 = add(new THREE.Line(circle(r * 2.1, 64), addMat(WHITE, .35)), g); n.orbit2.rotation.z = 1.1; }
    n.glow = add(glow(tr ? .95 : .7, on ? .45 : .14), g);
    n.lab = add(label(`<b>${SD.esc(SD.botName(n.id))}</b><small>${SD.esc(SD.botSub(n))}</small>`, 'bot' + (on ? '' : ' off')), g); n.lab.position.set(0, tr ? -.62 : (n.pos.y > .7 ? .48 : -.45), 0);
  }
  const hit = new THREE.Mesh(new THREE.SphereGeometry(n.type === 'source' ? .2 : n.kind === 'trader' ? .45 : .34, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.node = n; g.add(hit); pickables.push(hit);
  n.obj = g;
}
function build(d) {
  G = SD.graph(d);
  const src = G.nodes.filter(n => n.type === 'source'), N = src.length;
  src.forEach((n, i) => { const a = i / N * Math.PI * 2 + 0.25; n.ang = a; n.pos = new THREE.Vector3(Math.cos(a) * 3.0, 1.3 * Math.sin(i * 2.399) + .2, Math.sin(a) * 3.0); });
  const scs = SD.SCANNERS.map(id => G.byId[id]).filter(Boolean);
  scs.forEach(n => { const mine = src.filter(s => s.by[0] === n.id); let x = 0, z = 0; mine.forEach(s => { x += Math.cos(s.ang); z += Math.sin(s.ang); }); n.ang = mine.length ? Math.atan2(z, x) : 0; });
  scs.sort((a, b) => a.ang - b.ang).forEach((n, k) => { n.pos = new THREE.Vector3(Math.cos(n.ang) * 1.9, [.3, 1.2, .75][k % 3], Math.sin(n.ang) * 1.9); });
  G.byId.core.pos = new THREE.Vector3(-.85, -.75, .25); G.byId.meme.pos = new THREE.Vector3(.85, -.75, -.25);
  G.nodes.forEach(n => { nodesById[n.id] = n; nodeAt(n); });
  G.links.forEach(l => {
    const a = l.s.pos, b = l.t.pos, mid = a.clone().add(b).multiplyScalar(.5);
    if (l.type === 'scan' || l.type === 'price') mid.add(mid.clone().setY(0).normalize().multiplyScalar(.25)).add(new THREE.Vector3(0, .25, 0)); else mid.y -= .12;
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    const live = l.type === 'scan' || l.type === 'price' ? l.s.seen && l.t.on !== false : l.s.on;
    const base = l.type === 'signal' ? .5 : l.type === 'peer' ? .25 : live ? .32 : .1;
    const line = add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), addMat(l.type === 'signal' ? WHITE : CY, base)));
    const e = { l, curve, line, base, a: l.s.id, b: l.t.id, len: curve.getLength() }; edges.push(e);
    (adj[e.a] = adj[e.a] || []).push({ to: e.b, e, rev: false }); (adj[e.b] = adj[e.b] || []).push({ to: e.a, e, rev: true });
  });
  built = true;
  if (stopAmb) stopAmb();
  stopAmb = SD.pulses(G, (l, k) => { const e = edges.find(x => x.l === l); if (e) pulses.push({ e, t0: performance.now(), dur: (k === 'signal' ? 1600 : 2200), s: add(glow(k === 'signal' ? .32 : .22, .95, k === 'signal' ? 0xffffff : 0x9eeaff)) }); }, { scan: 900, price: 2200, signal: 2600 });
}
const pulses = [];

// ---------- missions (suit route) ----------
const RULES = [['farside', /farside|ETF (out|in)flow/i], ['macro', /FOMC|yield|10y|CPI|Waller|macro|\bFed\b/i], ['x', /@\w+|\bon X\b/i], ['telegram', /telegram/i], ['discord', /discord/i],
  ['cg_trend', /trending/i], ['cmc', /CoinMarketCap|\bCMC\b/i], ['dex', /DexScreener|\bliq\b|liquidity/i], ['pumpfun', /pump\.fun|pumpswap/i], ['geckoterminal', /GeckoTerminal/i], ['birdeye', /Birdeye/i],
  ['solscan', /Solscan/i], ['etherscan', /Etherscan/i], ['smart', /whale|smart.?(money|wallet)|Lookonchain|Arkham/i], ['coindesk', /CoinDesk/i], ['theblock', /The Block/i], ['decrypt', /Decrypt/i], ['cointelegraph', /Cointelegraph/i]];
const rr = {};
function pickSource(scanner, text) {
  const cand = G.nodes.filter(n => n.type === 'source' && n.by.includes(scanner)); if (!cand.length) return null;
  for (const [id, re] of RULES) { const c = cand.find(n => n.sid === id); if (c && re.test(text || '')) return { n: c, matched: true }; }
  const pool = cand.filter(n => n.seen).length ? cand.filter(n => n.seen) : cand; rr[scanner] = ((rr[scanner] ?? -1) + 1) % pool.length; return { n: pool[rr[scanner]], matched: false };
}
const mins = s => { const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/.exec(s || ''); if (!m) return 1e9; let h = +m[1]; if (m[3] === 'PM' && h < 12) h += 12; if (m[3] === 'AM' && h === 12) h = 0; return h * 60 + +m[2]; };
function buildMissions(d) {
  const out = [];
  d.signals.slice().sort((a, b) => mins(a.time) - mins(b.time)).forEach(g => { if (!nodesById[g.from] || !nodesById[g.to]) return; const s = pickSource(g.from, g.text); if (!s) return;
    out.push({ scanner: g.from, source: s.n.id, matched: s.matched, trader: g.to, sig: g }); });
  d.bots.filter(b => b.kind === 'scanner' && SD.isOn(b) && !d.signals.some(g => g.from === b.id)).sort((a, b) => mins(a.last_activity) - mins(b.last_activity))
    .forEach(b => { const s = pickSource(b.id, ''); if (s) out.push({ scanner: b.id, source: s.n.id, matched: false, trader: null, working: true }); });
  if (!out.length) G.nodes.filter(n => n.type === 'source').forEach(s => { const sc = s.by.find(b => SD.SCANNERS.includes(b)) || s.by[0]; out.push({ scanner: sc, source: s.id, trader: null, patrol: true }); });
  missions = out;
}
function path(from, to) { if (from === to) return []; const prev = { [from]: null }, q = [from];
  while (q.length) { const u = q.shift(); for (const h of adj[u] || []) if (!(h.to in prev)) { prev[h.to] = { u, h }; if (h.to === to) { const p = []; let v = to; while (prev[v]) { p.unshift(prev[v].h); v = prev[v].u; } return p; } q.push(h.to); } } return []; }
const hop = (a, b) => { const h = (adj[a] || []).find(x => x.to === b); return h ? [h] : path(a, b); };

// ---------- armored suit (original design built from primitives; solid metal, NOT part of the hologram) ----------
// Metal plates live on layers 0+1. In the bloom pass (layer 0) they are swapped to flat black, so they occlude the glow
// behind them but never bloom; afterwards layer 1 is drawn on top with real PBR lighting + tone mapping (see frame()).
const suit = add(new THREE.Group());           // position + heading (slerped)
const bankG = add(new THREE.Group(), suit);    // roll into turns
const figure = add(new THREE.Group(), bankG);  // pitch: upright (hover) <-> horizontal (flight)
suit.scale.setScalar(1.12);
const pmrem = new THREE.PMREMGenerator(renderer), envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
// Original design (not any film character): crimson lacquered plates over gunmetal sub-plates, thin champagne-gold trim,
// an elongated helmet with ONE continuous wraparound visor band + top crest, and a round lens in a hexagonal housing.
const RED = new THREE.MeshPhysicalMaterial({ color: 0x9c1219, metalness: .55, roughness: .3, clearcoat: 1, clearcoatRoughness: .04, envMap: envTex, envMapIntensity: 1.5 });   // painted metal
const STEEL = new THREE.MeshPhysicalMaterial({ color: 0x454b55, metalness: .9, roughness: .5, clearcoat: .2, envMap: envTex, envMapIntensity: .75 });                         // gunmetal plates
const GOLD = new THREE.MeshPhysicalMaterial({ color: 0xd2a55a, metalness: 1, roughness: .18, clearcoat: .5, clearcoatRoughness: .1, envMap: envTex, envMapIntensity: 1.4 });    // trim only
const GAP = new THREE.MeshStandardMaterial({ color: 0x121418, metalness: .6, roughness: .6, envMap: envTex, envMapIntensity: .4 });                                             // under-suit
const BLACK = new THREE.MeshBasicMaterial({ color: 0x000000 });
const metal = [];
const both = o => { o.traverse(c => c.layers.enable(1)); return o; };   // glowing bits: bloom pass AND drawn over the metal
function part(geom, parent, pos, rot, scl, mat = RED) {
  const m = new THREE.Mesh(geom, mat); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); if (scl) m.scale.set(...scl);
  m.userData.mat = mat; m.layers.enable(1); metal.push(m); parent.add(m); return m;
}
const solidGlow = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (rt, rb, h, n = 20) => new THREE.CylinderGeometry(rt, rb, h, n);
// torso (broad chest, dark under-suit visible in the gaps)
part(cyl(.09, .078, .36, 16), figure, [0, .1, 0], null, [1, 1, .74], GAP);
part(cyl(.158, .118, .17, 28), figure, [0, .22, 0], null, [1, 1, .78]);                                  // chest shell
part(cyl(.084, .118, .03, 28), figure, [0, .318, 0], null, [1, 1, .8], STEEL);                          // shoulder yoke
part(box(.034, .16, .02), figure, [0, .215, .113], [-.08, 0, 0], null, STEEL);                          // centre keel
[-1, 1].forEach(s => {
  part(box(.085, .05, .02), figure, [s * .07, .262, .1], [-.18, s * .42, s * .2]);                       // upper chest plate (layered over shell)
  part(box(.08, .006, .024), figure, [s * .07, .236, .106], [-.18, s * .42, s * .2], null, GOLD);       // gold trim line
  part(box(.03, .1, .06), figure, [s * .135, .2, .005], [0, 0, s * -.12], null, STEEL);                 // flank plates
});
for (let k = 0; k < 3; k++) part(cyl(.102 - k * .007, .096 - k * .007, .028, 24), figure, [0, .12 - k * .036, 0], null, [1, 1, .74], STEEL); // segmented abdomen
part(cyl(.101, .101, .022, 24), figure, [0, -.03, 0], null, [1, 1, .78], STEEL);                        // belt
part(cyl(.0145, .0145, .006, 6), figure, [0, -.03, .08], [Math.PI / 2, 0, 0], null, GOLD);              // hex buckle
part(cyl(.098, .077, .09, 24), figure, [0, -.083, 0], null, [1, 1, .78]);                               // pelvis
part(cyl(.038, .046, .06, 12), figure, [0, .335, 0], null, null, GAP);                                  // neck
// helmet: elongated crimson shell, gunmetal lower mask, top crest, ONE wraparound visor band
const helm = add(new THREE.Group(), figure); helm.position.set(0, .405, -.004);
part(new THREE.SphereGeometry(.086, 32, 22), helm, [0, 0, 0], null, [1, 1.12, 1.2]);
part(new THREE.SphereGeometry(.0885, 32, 14, Math.PI / 2 - 1.15, 2.3, 1.72, .95), helm, [0, 0, 0], null, [1, 1.12, 1.2], STEEL);  // lower mask / jaw
part(box(.012, .016, .17), helm, [0, .088, -.02], [.1, 0, 0], null, STEEL);                              // crest ridge
part(box(.014, .003, .1), helm, [0, .097, 0], [.1, 0, 0], null, GOLD);                               // crest trim
[-1, 1].forEach(s => part(box(.012, .04, .05), helm, [s * .085, -.012, -.01], [0, 0, 0], null, STEEL));  // cheek vents
const visor = both(add(new THREE.Mesh(new THREE.CylinderGeometry(.0905, .0905, .015, 32, 1, true, -1.25, 2.5), solidGlow(0xe4f6ff, { side: THREE.DoubleSide })), helm));
visor.position.y = .012; visor.scale.set(1, 1, 1.2);
const eyeGlow = both(add(glow(.11, .4, 0xbfe9ff), helm)); eyeGlow.position.set(0, .012, .11); eyeGlow.material.toneMapped = false;
// chest light: round lens in a hexagonal gunmetal housing
const chest = add(new THREE.Group(), figure); chest.position.set(0, .222, .124);
part(cyl(.036, .036, .014, 6), chest, [0, 0, 0], [Math.PI / 2, 0, 0], null, STEEL);
both(add(new THREE.Mesh(new THREE.CircleGeometry(.021, 28), solidGlow(0xdff8ff)), chest)).position.z = .0075;
const chestGlow = both(add(glow(.2, .8, 0xbff2ff), chest)); chestGlow.material.toneMapped = false;
// back thruster packs
[-1, 1].forEach(s => part(box(.036, .16, .07), figure, [s * .06, .18, -.095], [.2, 0, s * .12], null, STEEL));
// limbs: pivot groups so arms/legs can pose
const emitters = [];
const flameGeo = new THREE.ConeGeometry(.024, .12, 14, 1, true).rotateX(Math.PI).translate(0, -.06, 0), flameCoreGeo = new THREE.ConeGeometry(.011, .07, 10, 1, true).rotateX(Math.PI).translate(0, -.035, 0);
const thrusterGlow = (parent, y) => {
  const g = both(add(glow(.28, 1, 0xd8f8ff), parent)); g.position.y = y; g.material.toneMapped = false;
  const fl = both(add(new THREE.Mesh(flameGeo, meshMat(0x8fdcff, .75, { toneMapped: false })), parent)); fl.position.y = y;
  const fc = both(add(new THREE.Mesh(flameCoreGeo, meshMat(0xffffff, .95, { toneMapped: false })), parent)); fc.position.y = y;
  const em = new THREE.Object3D(); em.position.y = y; parent.add(em); emitters.push({ em, g, fl, fc }); return g;
};
const arms = [-1, 1].map(s => {
  const sh = add(new THREE.Group(), figure); sh.position.set(s * .19, .252, 0);
  part(new THREE.SphereGeometry(.051, 16, 12), sh, [0, 0, 0], null, null, GAP);
  part(new THREE.SphereGeometry(.072, 24, 14, 0, Math.PI * 2, 0, Math.PI * .5), sh, [0, .012, 0], null, [1.12, .9, 1.05]);          // pauldron (layer 1)
  part(new THREE.SphereGeometry(.068, 24, 8, 0, Math.PI * 2, Math.PI * .5, Math.PI * .14), sh, [0, .0, 0], null, [1.16, 1, 1.08], STEEL); // pauldron lower lip (layer 2)
  part(cyl(.043, .037, .17, 18), sh, [0, -.11, 0]);
  part(box(.016, .1, .05), sh, [s * .04, -.1, 0], null, null, STEEL);                                    // bicep side plate
  const el = add(new THREE.Group(), sh); el.position.y = -.21;
  part(new THREE.SphereGeometry(.038, 14, 10), el, [0, 0, 0], null, null, GAP);
  part(cyl(.04, .05, .16, 18), el, [0, -.1, 0]);
  part(box(.02, .12, .06), el, [s * .043, -.1, 0], [0, 0, s * .06], null, STEEL);                        // bracer plate
  part(cyl(.054, .054, .008, 18), el, [0, -.184, 0], null, null, GOLD);                                  // thin cuff trim
  part(box(.064, .068, .056), el, [0, -.232, 0], null, null, STEEL);                                     // gauntlet
  part(box(.066, .022, .024), el, [0, -.214, .022], null, null, RED);                                    // knuckle plate
  thrusterGlow(el, -.272); return { s, sh, el };
});
const legsS = [-1, 1].map(s => {
  const hp = add(new THREE.Group(), figure); hp.position.set(s * .072, -.15, 0);
  part(new THREE.SphereGeometry(.05, 14, 10), hp, [0, 0, 0], null, null, GAP);
  part(cyl(.063, .05, .24, 18), hp, [0, -.135, 0]);
  part(box(.018, .16, .07), hp, [s * .058, -.13, 0], [0, 0, s * -.06], null, STEEL);                     // outer thigh plate
  const kn = add(new THREE.Group(), hp); kn.position.y = -.27;
  part(new THREE.SphereGeometry(.044, 14, 10), kn, [0, 0, 0], null, null, GAP);
  part(new THREE.SphereGeometry(.036, 14, 10), kn, [0, .002, .032], null, [1.1, 1.2, .6], STEEL);        // knee cap
  part(new THREE.TorusGeometry(.024, .003, 6, 20), kn, [0, .002, .05], null, [1.1, 1.2, 1], GOLD);      // knee trim
  part(cyl(.048, .056, .2, 18), kn, [0, -.125, 0]);
  part(box(.046, .055, .016), kn, [0, -.075, .053], [-.06, 0, 0], null, STEEL);                          // layered shin plates
  part(box(.05, .055, .016), kn, [0, -.135, .057], [-.06, 0, 0], null, STEEL);
  part(cyl(.06, .06, .008, 18), kn, [0, -.232, 0], null, null, GOLD);                                    // thin boot trim
  part(box(.078, .062, .13), kn, [0, -.282, .025], null, null, STEEL);                                   // boot
  part(box(.07, .03, .05), kn, [0, -.27, .075], [-.2, 0, 0], null, RED);                                 // toe cap
  thrusterGlow(kn, -.316); return { s, hp, kn };
});
// key + rim light ride with the camera so the suit always reads clearly; they only affect the metal (hologram is unlit)
scene.add(camera);
const keyL = new THREE.DirectionalLight(0xfff1e2, 3.4); keyL.position.set(3, 4, 2.5); camera.add(keyL);
const rimL = new THREE.DirectionalLight(0x86dcff, 3.2); rimL.position.set(-3, 3, -24); camera.add(rimL);
const rimL2 = new THREE.DirectionalLight(0xffc89a, 1.2); rimL2.position.set(4, -1, -20); camera.add(rimL2);
const fillL = new THREE.HemisphereLight(0xbfe6ff, 0x200c06, .55); scene.add(fillL);
[keyL, rimL, rimL2, fillL].forEach(l => l.layers.enable(1));
// thruster particle trails (in scene space so they stream behind the suit)
const TP = 700, tpg = new THREE.BufferGeometry(), tpos = new Float32Array(TP * 3), tcol = new Float32Array(TP * 3), tvel = new Float32Array(TP * 3), tlife = new Float32Array(TP);
tpg.setAttribute('position', new THREE.BufferAttribute(tpos, 3)); tpg.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
const trailPts = new THREE.Points(tpg, new THREE.PointsMaterial({ size: .065, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(trailPts); let tNext = 0;
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _d = new THREE.Vector3();
function emit(dt, power) {
  emitters.forEach(({ em, g, fl, fc }) => {
    g.material.opacity = .45 + .35 * Math.random(); g.scale.setScalar((.09 + .07 * power) * (0.85 + .3 * Math.random()));
    const L = (.45 + .85 * power) * (.8 + .4 * Math.random()); fl.scale.set(1, L, 1); fc.scale.set(1, L * 1.1, 1); fl.material.opacity = .5 + .3 * Math.random();
    const n = Math.round(2 + 3 * power);
    em.getWorldPosition(_p); em.getWorldQuaternion(_q); _d.set(0, -1, 0).applyQuaternion(_q);
    for (let k = 0; k < n; k++) { const i = tNext; tNext = (tNext + 1) % TP;
      tpos[i * 3] = _p.x; tpos[i * 3 + 1] = _p.y; tpos[i * 3 + 2] = _p.z; const sp = .6 + power * 1.2;
      tvel[i * 3] = _d.x * sp + (Math.random() - .5) * .25; tvel[i * 3 + 1] = _d.y * sp + (Math.random() - .5) * .25; tvel[i * 3 + 2] = _d.z * sp + (Math.random() - .5) * .25; tlife[i] = .45 + Math.random() * .2; }
  });
  for (let i = 0; i < TP; i++) { if (tlife[i] <= 0) { tcol[i * 3] = tcol[i * 3 + 1] = tcol[i * 3 + 2] = 0; continue; }
    tlife[i] -= dt; const f = Math.max(0, tlife[i] / .6); tpos[i * 3] += tvel[i * 3] * dt; tpos[i * 3 + 1] += tvel[i * 3 + 1] * dt; tpos[i * 3 + 2] += tvel[i * 3 + 2] * dt;
    tcol[i * 3] = .7 * f; tcol[i * 3 + 1] = .95 * f; tcol[i * 3 + 2] = 1 * f; }
  tpg.attributes.position.needsUpdate = true; tpg.attributes.color.needsUpdate = true;
}
let pitch = 0.15, bank = 0; const prevF = new THREE.Vector3(0, 0, 1), curF = new THREE.Vector3(), dummy = new THREE.Object3D();
function poseSuit(dt, t, flying) {
  pitch += ((flying ? 1.32 : 0.12) - pitch) * (1 - Math.exp(-dt * 4)); figure.rotation.x = pitch;
  const fl = THREE.MathUtils.clamp((pitch - .12) / 1.2, 0, 1); // 0 hover .. 1 flight
  arms.forEach(({ s, sh, el }) => { sh.rotation.z = s * THREE.MathUtils.lerp(.42, .14, fl); sh.rotation.x = THREE.MathUtils.lerp(-.25, .12, fl) + (flying ? 0 : Math.sin(t * 2 + s) * .05); el.rotation.x = THREE.MathUtils.lerp(-.5, 0, fl); });
  legsS.forEach(({ s, hp, kn }) => { hp.rotation.z = s * THREE.MathUtils.lerp(.08, .03, fl); hp.rotation.x = THREE.MathUtils.lerp(.05, -.06, fl) + Math.sin(t * 2.4 + s) * .03; kn.rotation.x = THREE.MathUtils.lerp(.2, .1, fl); });
  chestGlow.material.opacity = .75 + .25 * Math.sin(t * 6); emit(dt, flying ? 1 : .35);
}
const trail = add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new Array(30).fill(0).map(() => new THREE.Vector3())), addMat(0xffffff, .9)));
// suit state machine (same scan-driven route as before)
let route = [], cur = null, curT = 0, atNode = 'core', pause = 0, mIdx = -1, mission = null, phase = '', readFx = null;
const SPEED = 1.35; // units / s
const cap = document.getElementById('mission');
function caption(m, ph) {
  const sc = SD.botName(m.scanner).toUpperCase(), so = nodesById[m.source].label.toUpperCase();
  let top, sub = '';
  if (ph === 'out') top = `${sc} ⟶ SCANNING ${so}`;
  else if (ph === 'read') top = `◉ READING ${so}`;
  else if (ph === 'back') top = `${so} ⟶ ${sc}`;
  else top = `SIGNAL ${m.sig.coin || 'MARKET'} ${SD.dirIcon(m.sig.direction)} ${m.sig.direction.toUpperCase()} ⟶ ${SD.botName(m.trader).toUpperCase()}`;
  if (m.sig) sub = `signal on file ${SD.hm(m.sig.time)} ET · ${m.sig.from === 'x' ? 'X' : SD.botName(m.sig.from)} → ${m.trader === 'core' ? 'Crypto Paper Trader' : 'Memecoin Paper Trader'} · "${SD.trunc(m.sig.text, 70)}" · source ${m.matched ? 'named in signal text' : 'inferred from scanner coverage'}`;
  else if (m.working) sub = `${SD.botName(m.scanner)}: working files present, no signals published yet`;
  else if (m.patrol) sub = 'no scan/signal events on file yet: patrolling sources';
  cap.innerHTML = `${SD.esc(top)}<small>${SD.esc(sub)}</small>`;
}
function nextMission() {
  if (!missions.length) return;
  mIdx = (mIdx + 1) % missions.length; mission = missions[mIdx];
  const legsOut = [...hop(atNode, mission.scanner).map(h => ({ h, ph: 'out' })), ...hop(mission.scanner, mission.source).map(h => ({ h, ph: 'out' }))];
  route = [...legsOut, { read: 2.2 }, ...hop(mission.source, mission.scanner).map(h => ({ h, ph: 'back' }))];
  if (mission.trader) route.push(...hop(mission.scanner, mission.trader).map(h => ({ h, ph: 'signal' })), { deliver: 1.0 });
  phase = ''; advance();
}
function advance() {
  cur = route.shift(); curT = 0;
  if (!cur) return nextMission();
  if (cur.read) { pause = cur.read; phase = 'read'; caption(mission, 'read'); const n = nodesById[mission.source]; n.lab.element.classList.add('hot'); readFx = { n, t0: performance.now() }; return; }
  if (cur.deliver) { pause = cur.deliver; const n = nodesById[mission.trader]; ripples.push({ s: add(glow(.4, 1, 0xffffff)), pos: n.pos.clone(), t0: performance.now() }); return; }
  if (cur.ph !== phase) { phase = cur.ph; caption(mission, phase); }
}
const ripples = [];
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), HOVER_UP = .5, FLY_UP = .12;
function stepSuit(dt, t) {
  if (!cur) return;
  if (cur.read || cur.deliver) {
    pause -= dt;
    const n = nodesById[cur.read ? mission.source : mission.trader], target = n.pos.clone(); target.y += HOVER_UP + Math.sin(t * 3) * .035;
    suit.position.lerp(target, 1 - Math.exp(-dt * 5));
    bank += (0 - bank) * (1 - Math.exp(-dt * 3)); bankG.rotation.z = bank; poseSuit(dt, t, false);
    if (cur.read && readFx) { const k = (performance.now() - readFx.t0) / 1000; readFx.n.glow.scale.setScalar(.35 + .45 * Math.abs(Math.sin(k * 5))); if (k % .45 < dt) ripples.push({ s: add(glow(.3, 1, 0x9eeaff)), pos: readFx.n.pos.clone(), t0: performance.now() }); }
    if (pause <= 0) { if (cur.read && readFx) { readFx.n.glow.scale.setScalar(readFx.n.seen ? .34 : .2); readFx.n.lab.element.classList.remove('hot'); readFx = null; } advance(); }
    trail.visible = false; return;
  }
  const { h } = cur, e = h.e; curT += dt * SPEED / e.len;
  const u = Math.min(1, curT), p = h.rev ? 1 - u : u, p2 = h.rev ? Math.max(0, p - .03) : Math.min(1, p + .03);
  e.curve.getPoint(p, tmpA); e.curve.getPoint(p2, tmpB); tmpA.y += FLY_UP; tmpB.y += FLY_UP;
  suit.position.lerp(tmpA, 1 - Math.exp(-dt * 12));
  // heading: smooth slerp toward the direction of travel; bank from the signed yaw rate
  const wA = world.localToWorld(suit.position.clone()), wB = world.localToWorld(tmpB.clone());
  curF.subVectors(wB, wA); if (curF.lengthSq() > 1e-8) { curF.normalize();
    dummy.position.copy(suit.position); world.add(dummy); dummy.lookAt(wB); world.remove(dummy);
    suit.quaternion.slerp(dummy.quaternion, 1 - Math.exp(-dt * 6));
    const yaw = Math.atan2(prevF.x * curF.z - prevF.z * curF.x, prevF.x * curF.x + prevF.z * curF.z) / Math.max(dt, 1e-3);
    bank += (THREE.MathUtils.clamp(yaw * .45, -.85, .85) - bank) * (1 - Math.exp(-dt * 4)); prevF.copy(curF); }
  bankG.rotation.z = bank; poseSuit(dt, t, true);
  e.line.material.opacity = Math.min(1, e.base + .55);
  const sp = trail.geometry.attributes.position, start = h.rev ? 1 : 0;
  for (let k = 0; k < 30; k++) { const q = start + (p - start) * k / 29; e.curve.getPoint(q, tmpB); sp.setXYZ(k, tmpB.x, tmpB.y, tmpB.z); }
  sp.needsUpdate = true; trail.visible = true; trail.material.color.set(cur.ph === 'signal' ? 0xffffff : 0x9eeaff);
  if (curT >= 1) { e.line.material.opacity = e.base; atNode = h.to; if (cur.ph === 'signal' || cur.ph === 'back') ripples.push({ s: add(glow(.25, 1, 0xffffff)), pos: nodesById[atNode].pos.clone(), t0: performance.now() }); advance(); }
}

// ---------- interaction: hover, click (not drag), info cards ----------
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), pickables = [];
let hovered = null, downAt = null;
const cardEl = document.getElementById('card');
function pickAt(x, y) {
  // 3D hit spheres first (exact node under the pointer), then the nearest label containing the point
  const rect = renderer.domElement.getBoundingClientRect(); ndc.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(ndc, camera); const hit = raycaster.intersectObjects(pickables, false)[0]; if (hit) return hit.object.userData.node;
  let best = null, bd = 1e9;
  G.nodes.forEach(n => { const el = n.lab.element; if (+el.style.opacity < .3) return; const r = el.getBoundingClientRect();
    if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 3 && y <= r.bottom + 3) { const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2); if (d < bd) { bd = d; best = n; } } });
  return best;
}
function setHover(n) {
  if (hovered === n) return;
  if (hovered) { hovered.lab.element.classList.remove('hover'); hovered.glow.scale.multiplyScalar(1 / 1.7); }
  hovered = n; renderer.domElement.style.cursor = n ? 'pointer' : 'grab';
  if (n) { n.lab.element.classList.add('hover'); n.glow.scale.multiplyScalar(1.7); }
}
let cardNode = null;
function showCard(n) {
  const d = SD.data; cardNode = n; let html;
  const sigRow = g => `<li class="${g.link ? 'sd-link' : ''}" ${g.link ? `data-link="${SD.esc(g.link)}" title="Open ${SD.esc(g.link_kind || g.link)}"` : ''}><span class="d-${g.direction}">${SD.dirIcon(g.direction)} ${SD.esc(g.coin || 'MARKET')}</span> <i>${SD.esc(SD.hm(g.time))}</i><br>${SD.esc(SD.trunc(g.text, 110))}</li>`;
  const rank = s => -((/(\d{1,2}):(\d{2})/.exec(s.time) || [0, 0, 0]).slice(1).reduce((a, b, i) => a + (i ? +b : +b * 60), 0));
  if (n.kind === 'trader') {
    const t = d.traders[n.id], sg = d.signals.filter(g => g.to === n.id).sort((a, b) => rank(a) - rank(b)).slice(0, 3);
    html = `<h4>${SD.esc(t.name)}</h4><div class="st">${SD.esc(SD.botSub(n))}</div>${t.available ? `<div class="kv">${SD.usd(t.equity)} <span class="${SD.cls(t.pnl)}">${SD.signedUsd(t.pnl)} (${SD.pct(t.pnl_pct)})</span></div><div class="mut">last check ${SD.esc(t.last_check || '—')} · ${t.positions.length} positions · paper money</div>` : '<div class="mut">waiting for data</div>'}<div class="hd">Latest signals received</div><ul>${sg.map(sigRow).join('') || '<li class="mut">none yet</li>'}</ul>`;
  } else {
    const b = d.bots.find(x => x.id === n.id) || {}, sg = d.signals.filter(g => g.from === n.id).sort((a, b) => rank(a) - rank(b)).slice(0, 3), sc = (d.scanners || {})[n.id] || {};
    html = `<h4>${SD.esc(b.name || n.label)}</h4><div class="st">${SD.esc(SD.botSub(n))}</div><div class="mut">last activity ${SD.esc(b.last_activity || '—')}${b.note ? ' · ' + SD.esc(b.note) : ''}</div><div class="mut">feeds: ${d.links.filter(l => l.type === 'signal' && l.source === n.id).map(l => SD.botName(l.target)).join(', ')} · sources: ${d.sources.filter(s => s.scanned_by.includes(n.id)).map(s => SD.esc(s.label)).join(', ')}</div><div class="hd">Latest signals</div><ul>${sg.map(sigRow).join('') || '<li class="mut">no signals published yet</li>'}</ul>`;
  }
  cardEl.innerHTML = `<button class="x" aria-label="close">✕</button>` + html; cardEl.classList.add('on'); placeCard();
}
function hideCard() { cardNode = null; cardEl.classList.remove('on'); }
function placeCard() { if (!cardNode) return; const v = new THREE.Vector3(); cardNode.obj.getWorldPosition(v); v.project(camera);
  const rc = renderer.domElement.getBoundingClientRect(), x = rc.left + (v.x + 1) / 2 * W, y = rc.top + (1 - v.y) / 2 * H, cw = cardEl.offsetWidth, ch = cardEl.offsetHeight, mob = innerWidth < 760;
  const left = mob ? (innerWidth - cw) / 2 : THREE.MathUtils.clamp(x + 24, 350, innerWidth - 350 - cw), top = mob ? THREE.MathUtils.clamp(y + 30, 8, innerHeight - ch - 8) : THREE.MathUtils.clamp(y - ch / 2, 70, innerHeight - ch - 70);
  cardEl.style.left = left + 'px'; cardEl.style.top = top + 'px'; }
cardEl.addEventListener('click', e => { if (e.target.closest('.x')) hideCard(); });
const cv = renderer.domElement;
cv.addEventListener('pointermove', e => { if (e.buttons || !built) return; setHover(pickAt(e.clientX, e.clientY)); });
cv.addEventListener('pointerleave', () => setHover(null));
cv.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
cv.addEventListener('pointerup', e => {
  if (!downAt || !built) return; const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y), quick = performance.now() - downAt.t < 650; downAt = null;
  if (moved > 6 || !quick) return; // that was a drag, not a click
  const n = pickAt(e.clientX, e.clientY);
  if (!n) return hideCard();
  if (n.type === 'source') { const url = (SD.data.sources.find(s => 's_' + s.id === n.id) || {}).url; if (url) window.open(url, '_blank', 'noopener'); }
  else showCard(n);
});
document.addEventListener('click', e => { const li = e.target.closest('.sd-link'); if (li && li.dataset.link) window.open(li.dataset.link, '_blank', 'noopener'); });

// ---------- loop ----------
const clock = new THREE.Clock(), v3 = new THREE.Vector3(); let spinY = 0, suitFrozen = false;
function frame() {
  const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime, now = performance.now();
  if (autoSpin) spinY += dt * .07; world.rotation.y = spinY; world.rotation.x = Math.sin(t * .23) * .035;
  controls.update(); const camD = camera.position.distanceTo(controls.target);
  rings.forEach(r => r.g.rotation.y += r.s * dt); ticks.rotation.y -= dt * .1; base.rotation.y += dt * .05;
  beam.material.uniforms.t.value = t;
  const a = pg.attributes.position; for (let i = 0; i < PN; i++) { let y = a.getY(i) + pv[i] * dt; if (y > 3.4) y = BASE_Y; a.setY(i, y); } a.needsUpdate = true;
  if (built) {
    G.nodes.forEach(n => { if (n.core) n.core.rotation.y += dt * (n.kind === 'trader' ? .6 : .9); if (n.orbit) n.orbit.rotation.z += dt * 1.4; if (n.orbit2) n.orbit2.rotation.y += dt;
      n.obj.getWorldPosition(v3); const depth = camD - v3.distanceTo(camera.position), k = THREE.MathUtils.clamp((depth + 1.2) / 3.6, 0, 1); n.lab.element.style.opacity = (n.type === 'source' ? (n.lab.element.classList.contains('hot') ? 1 : 0.06 + 0.94 * k * k) : 0.4 + 0.6 * k).toFixed(2); });
    for (let i = pulses.length - 1; i >= 0; i--) { const p = pulses[i], q = (now - p.t0) / p.dur; if (q >= 1) { world.remove(p.s); pulses.splice(i, 1); continue; } p.e.curve.getPoint(q, p.s.position); }
    for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i], q = (now - r.t0) / 900; if (q >= 1) { world.remove(r.s); ripples.splice(i, 1); continue; } r.s.position.copy(r.pos); r.s.scale.setScalar(.3 + q * 1.4); r.s.material.opacity = (1 - q) * .5; }
    if (!suitFrozen) stepSuit(dt, t); else poseSuit(dt, t, false); placeCard();
  }
  for (const m of metal) m.material = BLACK;            // metal never blooms; it only masks glow behind it
  composer.render();
  for (const m of metal) m.material = m.userData.mat;
  renderer.autoClear = false; renderer.clearDepth(); camera.layers.set(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.render(scene, camera);                       // lit, tone-mapped metal + its glowing eye/chest/thrusters
  renderer.toneMapping = THREE.NoToneMapping; camera.layers.set(0); renderer.autoClear = true;
  labels.render(scene, camera);
  requestAnimationFrame(frame);
}
function onData(d, first) {
  if (!built) { build(d); buildMissions(d); nextMission(); document.getElementById('hsub').textContent = `${d.bots.length} bots · ${d.sources.length} sources · suit route from ${missions.filter(m => m.sig).length} signals on file`; return; }
  buildMissions(d); if (mIdx >= missions.length) mIdx = -1;
}
window.addEventListener('sd-data', e => onData(e.detail.d, e.detail.first));
if (SD.data) onData(SD.data, true);
function resize() { W = host.clientWidth || innerWidth; H = host.clientHeight || innerHeight; renderer.setSize(W, H); composer.setSize(W, H); labels.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); fitCamera(); }
// keep the whole hologram in frame on narrow (portrait) screens
function fitCamera() { const d = Math.max(11.6, 9.4 / (W / H)), dir = camera.position.clone().sub(controls.target).normalize(); camera.position.copy(controls.target).addScaledVector(dir, d); controls.maxDistance = Math.max(17, d * 1.45); controls.update(); }
fitCamera(); addEventListener('resize', resize); new ResizeObserver(resize).observe(host);
window.__holo = {
  // test helper: freeze the suit and put the camera close to it (yaw 0 = facing the suit's front)
  inspectSuit(yawDeg = 0, dist = 1.9, up = .15) { suitFrozen = true; autoSpin = false; clearTimeout(resumeTimer); const p = new THREE.Vector3(); suit.getWorldPosition(p); const q = new THREE.Quaternion(); suit.getWorldQuaternion(q); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); f.y = 0; f.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yawDeg * Math.PI / 180); controls.minDistance = .5; controls.target.copy(p); camera.position.copy(p).addScaledVector(f, dist).add(new THREE.Vector3(0, up, 0)); controls.update(); }, get mission() { return mission; }, get phase() { return phase; }, get autoSpin() { return autoSpin; },
  view() { const p = camera.position, d = p.distanceTo(controls.target); return { azimuthDeg: +(controls.getAzimuthalAngle() * 180 / Math.PI).toFixed(1), polarDeg: +(controls.getPolarAngle() * 180 / Math.PI).toFixed(1), distance: +d.toFixed(2), spinDeg: +(spinY * 180 / Math.PI).toFixed(1) }; },
  labelXY(id) { const n = nodesById[id]; if (!n) return null; const r = n.lab.element.getBoundingClientRect(), v = new THREE.Vector3(); n.obj.getWorldPosition(v); v.project(camera); const rc = renderer.domElement.getBoundingClientRect(); return { label: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, node: { x: rc.left + (v.x + 1) / 2 * W, y: rc.top + (1 - v.y) / 2 * H } }; }, pick(x, y) { const n = pickAt(x, y); return n && n.id; }, suitXY() { return this.spiderXY(); }, openCard(id) { showCard(nodesById[id]); }, spiderXY() { const v = new THREE.Vector3(); suit.getWorldPosition(v); v.project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, phase, scanner: mission && mission.scanner, source: mission && mission.source }; } };
requestAnimationFrame(frame);

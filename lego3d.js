// Shared three.js renderer for the brick model: part meshes, stage, camera framing and the showreel timeline.
// Units: 1 = one stud pitch (8 mm). A plate is 0.4 tall, a brick 1.2.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const PH = 0.4;
const STUD_R = 0.3, STUD_H = 0.17, GAP = 0.03;
const HIGHLIGHT = 0xffd500;

const studGeo = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 20);
const geoCache = new Map();
const matCache = new Map();
const edgeMat = new THREE.LineBasicMaterial({ color: 0x0d1b2a, transparent: true, opacity: 0.28 });
const outlineMat = new THREE.MeshBasicMaterial({ color: HIGHLIGHT, side: THREE.BackSide });

function bodyGeo(p) {
  const round = p.kind.startsWith('round');
  const key = `${round ? 'r' : 'b'}${p.w}x${p.d}x${p.h}`;
  if (!geoCache.has(key)) {
    const h = p.h * PH - 0.012;
    const g = round
      ? new THREE.CylinderGeometry(0.5 - GAP, 0.5 - GAP, h, 28)
      : new THREE.BoxGeometry(p.w - GAP, h, p.d - GAP);
    geoCache.set(key, { g, edges: new THREE.EdgesGeometry(g, 30) });
  }
  return geoCache.get(key);
}

function material(model, color) {
  if (!matCache.has(color)) {
    const c = model.colors[color];
    matCache.set(color, new THREE.MeshStandardMaterial({
      color: c.hex, roughness: c.trans ? 0.08 : 0.3, metalness: 0,
      transparent: c.trans, opacity: c.trans ? 0.6 : 1,
    }));
  }
  return matCache.get(color);
}

export function createPart(model, p, { edges = true } = {}) {
  const group = new THREE.Group();
  const { g, edges: eg } = bodyGeo(p);
  const mat = material(model, p.color);
  const body = new THREE.Mesh(g, mat);
  body.position.y = (p.h * PH) / 2;
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  if (edges) {
    const lines = new THREE.LineSegments(eg, edgeMat);
    lines.position.copy(body.position);
    group.add(lines);
  }
  if (p.kind !== 'tile') {
    for (let i = 0; i < p.w; i++) for (let j = 0; j < p.d; j++) {
      const s = new THREE.Mesh(studGeo, mat);
      s.position.set(i - p.w / 2 + 0.5, p.h * PH + STUD_H / 2, j - p.d / 2 + 0.5);
      s.castShadow = true;
      group.add(s);
    }
  }
  const outline = new THREE.Mesh(g, outlineMat);
  outline.position.copy(body.position);
  outline.scale.set(1 + 0.14 / p.w, 1 + 0.14 / (p.h * PH), 1 + 0.14 / p.d);
  outline.visible = false;
  group.add(outline);
  group.userData = { part: p, outline, base: new THREE.Vector3(p.x + p.w / 2, p.y * PH, p.z + p.d / 2) };
  group.position.copy(group.userData.base);
  return group;
}

export function setHighlight(group, on) {
  group.userData.outline.visible = on;
}

export function bounds(parts) {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y1: 0 };
  for (const p of parts) {
    b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x + p.w);
    b.z0 = Math.min(b.z0, p.z); b.z1 = Math.max(b.z1, p.z + p.d);
    b.y1 = Math.max(b.y1, (p.y + p.h) * PH);
  }
  b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2; b.cy = b.y1 / 2;
  b.radius = Math.hypot(b.x1 - b.x0, b.y1, b.z1 - b.z0) / 2;
  return b;
}

// A renderer + scene with lighting and a shadow catcher. The model group is centred on the origin.
export function createStage(canvas, model, { shadows = true, edges = true, pixelRatio } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(pixelRatio ?? Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9ab4c8, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-8, 22, -12);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const b = bounds(model.parts);
  const root = new THREE.Group();
  root.position.set(-b.cx, 0, -b.cz);
  scene.add(root);
  const groups = model.parts.map((p) => {
    const g = createPart(model, p, { edges });
    root.add(g);
    return g;
  });

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const stage = {
    renderer, scene, camera, root, groups, ground, bounds: b,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    render() { renderer.render(scene, camera); },
  };
  return stage;
}

// Place the camera on a sphere around the model. az 0 looks at the front (the -z face); positive az swings right.
export function aim(stage, { az = -35, el = 24, zoom = 1, target, radius } = {}) {
  const b = stage.bounds;
  const t = target ?? new THREE.Vector3(0, b.cy, 0);
  const fov = THREE.MathUtils.degToRad(stage.camera.fov);
  const fit = (radius ?? b.radius) / Math.sin(Math.min(fov, fov * stage.camera.aspect) / 2);
  const dist = (fit * 1.02) / zoom;
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  stage.camera.position.set(
    t.x + dist * Math.sin(a) * Math.cos(e),
    t.y + dist * Math.sin(e),
    t.z - dist * Math.cos(a) * Math.cos(e),
  );
  stage.camera.lookAt(t);
  return t;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

// Pose every part for an exploded view: layers lift apart and spread out from the centre line.
// `amount` is a number, or a function of the part index for staggered motion.
export function explode(stage, amount) {
  const b = stage.bounds;
  stage.groups.forEach((g, i) => {
    const { part: p, base } = g.userData;
    const a = typeof amount === 'function' ? amount(i) : amount;
    g.position.set(
      base.x + (base.x - b.cx) * 0.32 * a,
      base.y + p.layer * 0.42 * a,
      base.z + (base.z - b.cz) * 0.32 * a,
    );
  });
}

// The 30-second showreel: build piece by piece, hold, explode, snap back together layer by layer, finish the turn.
export const SHOWREEL = { duration: 30, buildEnd: 19, explodeAt: 21, explodeHold: 23, explodeBack: 24.2, settle: 27, drop: 0.34 };

// When each part starts sliding in and when it clicks home. Parts in a step go one after another.
// The sound track is scheduled from these same times, so picture and clicks stay in sync.
const timelines = new WeakMap();
export function timeline(steps, parts) {
  if (timelines.has(steps)) return timelines.get(steps);
  const S = SHOWREEL, per = S.buildEnd / steps.length;
  const maxLayer = Math.max(...parts.map((p) => p.layer));
  const tl = new Map();
  steps.forEach((st, s) => st.parts.forEach((i, k) => {
    const start = s * per + k * (per * 0.72 / st.parts.length);
    const f = parts[i].layer / maxLayer;
    const backStart = S.explodeBack + f * (S.settle - S.explodeBack) * 0.6;
    tl.set(i, { step: s, start, land: start + S.drop, backStart, backLand: backStart + (S.settle - S.explodeBack) * 0.4 });
  }));
  timelines.set(steps, tl);
  return tl;
}

// Sound cues for the showreel, in time order: a slide and a click per part, whooshes around the explosion,
// and a click per part as it snaps back.
export function showreelCues(steps, parts) {
  const S = SHOWREEL, tl = timeline(steps, parts), cues = [];
  tl.forEach((e, i) => {
    cues.push({ t: e.start, type: 'slide', part: i, dur: S.drop });
    cues.push({ t: e.land, type: 'click', part: i });
    // parts in a layer land together; spread their clicks a little so the snap-back crackles instead of stacking
    cues.push({ t: e.backLand + ((i * 0.618) % 1) * 0.09, type: 'click', part: i, gain: 0.45 });
  });
  cues.push({ t: S.explodeAt, type: 'whoosh', dur: S.explodeHold - S.explodeAt, rising: true });
  cues.push({ t: S.explodeBack, type: 'whoosh', dur: 1.2, rising: false });
  return cues.sort((a, b) => a.t - b.t);
}

export function showreel(stage, steps, t) {
  const S = SHOWREEL;
  const tl = timeline(steps, stage.groups.map((g) => g.userData.part));

  const out = easeInOut(clamp01((t - S.explodeAt) / (S.explodeHold - S.explodeAt)));
  const exOf = (i) => {
    if (t <= S.explodeBack) return out;
    const e = tl.get(i);
    return 1 - easeInOut(clamp01((t - e.backStart) / (e.backLand - e.backStart)));
  };
  explode(stage, exOf);

  stage.groups.forEach((g, i) => {
    const e = tl.get(i);
    const u = clamp01((t - e.start) / S.drop);
    g.visible = t >= e.start;
    // decelerating slide that seats exactly at `land`, where the click plays
    g.position.y += (1 - u) * (1 - u) * 3.2 * (steps[e.step].fromBelow ? -1 : 1);
    setHighlight(g, false);
  });

  // zoom out while exploded; the last part in (the top layer) decides when the zoom returns
  const ex = t <= S.explodeBack ? out : exOf(stage.groups.length - 1);
  aim(stage, { az: -40 + (t / S.duration) * 360, el: 20 + 6 * Math.sin((t / S.duration) * Math.PI * 2), zoom: 1 - 0.28 * ex });
  stage.render();
}

// Show the model as it stands after `step` (0-based), new parts outlined.
export function poseStep(stage, steps, step, { highlight = true } = {}) {
  const stepOf = new Map();
  steps.forEach((st, s) => st.parts.forEach((i) => stepOf.set(i, s)));
  explode(stage, 0);
  stage.groups.forEach((g, i) => {
    const s = stepOf.get(i);
    g.visible = s <= step;
    setHighlight(g, highlight && s === step);
  });
}

// Render a single part on its own (for parts callouts and the inventory) and return a PNG data URL.
export function partThumbnail(model, spec, size = 160) {
  if (!partThumbnail.stage) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(2);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-4, 10, -6);
    scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x9ab4c8, 0.6));
    partThumbnail.stage = { renderer, scene, camera: new THREE.PerspectiveCamera(22, 1, 0.1, 100), cache: new Map() };
  }
  const st = partThumbnail.stage;
  const key = `${spec.id}/${spec.color}/${size}`;
  if (st.cache.has(key)) return st.cache.get(key);
  const p = { ...spec, x: 0, y: 0, z: 0, w: spec.w, d: spec.d, h: spec.kind.includes('brick') ? 3 : 1 };
  const g = createPart(model, p);
  g.position.set(0, 0, 0);
  st.scene.add(g);
  const r = Math.hypot(p.w, p.d, p.h * PH + 0.3) / 2;
  const dist = r / Math.sin(THREE.MathUtils.degToRad(11)) * 1.05;
  const a = THREE.MathUtils.degToRad(-35), e = THREE.MathUtils.degToRad(30);
  const target = new THREE.Vector3(0, (p.h * PH) / 2 + 0.08, 0);
  st.camera.position.set(dist * Math.sin(a) * Math.cos(e), target.y + dist * Math.sin(e), -dist * Math.cos(a) * Math.cos(e));
  st.camera.lookAt(target);
  st.renderer.setSize(size, size, false);
  st.renderer.render(st.scene, st.camera);
  const url = st.renderer.domElement.toDataURL('image/png');
  st.scene.remove(g);
  st.cache.set(key, url);
  return url;
}

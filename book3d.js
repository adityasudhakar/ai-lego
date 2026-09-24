// The instruction booklet as a 3D book lying open on the table, riffled through page by page.
// Each leaf is a strip that curls as it turns over the spine, with a booklet page image on each side.
import { THREE } from './lego3d.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 10, H = W * 148 / 210;   // one A5-landscape page
const SEG = 28, GAP = 0.014;       // strip segments; paper thickness per leaf
const FLIP = 0.62;                 // seconds for one leaf to turn

// Intro timing: a slow first few pages, then faster and faster, then the book slides away.
export const INTRO = { start: 0.5, exit: 5.3, duration: 6 };

export function leafStarts(leaves) {
  const starts = [];
  let t = INTRO.start;
  for (let j = 0; j < leaves; j++) {
    starts.push(t);
    t += Math.max(0.11, 0.62 * Math.pow(0.78, j));
  }
  return starts;
}

// Paper sounds for the intro: one swish per page turn.
export function introCues(leaves) {
  return leafStarts(leaves).map((t) => ({ t, type: 'flip', dur: FLIP }));
}

export async function loadPageTextures(count, urlOf) {
  const loader = new THREE.TextureLoader();
  const load = (i) => loader.loadAsync(urlOf(i)).then((tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex; });
  return Promise.all(Array.from({ length: count }, (_, i) => load(i)));
}

function leafGeometry() {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((SEG + 1) * 2 * 3), uv = new Float32Array((SEG + 1) * 2 * 2), idx = [];
  for (let i = 0; i <= SEG; i++) {
    // vertex 2i sits on the near edge (+z), 2i+1 on the far edge (-z, the page top)
    uv.set([i / SEG, 0, i / SEG, 1], i * 4);
    if (i < SEG) {
      const a = 2 * i, b = 2 * i + 1, c = 2 * i + 2, d = 2 * i + 3;
      idx.push(a, c, b, c, d, b);  // counter-clockwise from above, so the front face points up
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Lay a leaf over the spine at turn angle theta (0 = flat on the right, PI = flat on the left).
// The outer edge lags behind the spine, which gives the page its curl.
function bendLeaf(geo, theta, lift) {
  const pos = geo.attributes.position.array;
  const curl = 0.95 * Math.sin(theta);
  let x = 0, y = lift;
  for (let i = 0; i <= SEG; i++) {
    pos.set([x, y, H / 2, x, y, -H / 2], i * 6);
    const phi = theta - curl * (i / SEG);
    x += (W / SEG) * Math.cos(phi);
    y += (W / SEG) * Math.sin(phi);
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
}

// pages: textures in reading order. The book opens on the cover (left) and page 2 (right).
export function createBook(renderer, pages) {
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9ab4c8, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(-6, 20, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.2 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const book = new THREE.Group();
  book.rotation.y = 0.12;
  scene.add(book);

  const paper = new THREE.MeshStandardMaterial({ color: 0xf2f4f3, roughness: 0.95 });
  const pageMat = (tex, back) => {
    const t = tex.clone();
    if (back) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, envMapIntensity: 0.35, side: back ? THREE.BackSide : THREE.FrontSide });
  };
  const blank = new THREE.MeshStandardMaterial({ color: 0xdcedf8, roughness: 0.9 });

  // leaf 0 is the cover already turned to the left; leaf j carries pages 2j-1 (front) and 2j (back)
  const leaves = Math.ceil((pages.length - 1) / 2);
  const block = leaves * GAP;
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, block, H), paper);
    m.position.set(side * W / 2, block / 2 - 0.01, 0);
    m.castShadow = m.receiveShadow = true;
    book.add(m);
  }
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: pages[0], roughness: 0.88, envMapIntensity: 0.35 }));
  cover.rotation.x = -Math.PI / 2;
  cover.position.set(-W / 2, block + 0.002, 0);
  cover.receiveShadow = true;
  book.add(cover);

  const leafMeshes = [];
  for (let j = 1; j <= leaves; j++) {
    const geo = leafGeometry();
    const front = new THREE.Mesh(geo, pages[2 * j - 1] ? pageMat(pages[2 * j - 1], false) : blank);
    const back = new THREE.Mesh(geo, pages[2 * j] ? pageMat(pages[2 * j], true) : new THREE.MeshStandardMaterial({ color: 0xdcedf8, side: THREE.BackSide }));
    front.castShadow = back.castShadow = true;
    front.receiveShadow = back.receiveShadow = true;
    book.add(front, back);
    leafMeshes.push({ geo, j });
  }
  const starts = leafStarts(leaves);

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 120);
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

  function pose(t) {
    for (const { geo, j } of leafMeshes) {
      const u = Math.min(1, Math.max(0, (t - starts[j - 1]) / FLIP));
      const theta = Math.PI * ease(u);
      // unturned leaves stack on the right with the next page on top; turned ones pile up on the left
      const right = block + (leaves - j) * 0.003 + 0.004;
      const left = block + j * 0.003 + 0.006;
      bendLeaf(geo, theta, right + (left - right) * u);
    }
    const out = Math.min(1, Math.max(0, (t - INTRO.exit) / (INTRO.duration - INTRO.exit)));
    book.position.set(0, 0, out * out * 26);
    const drift = t / INTRO.duration;
    camera.aspect = renderer.domElement.width / renderer.domElement.height;
    camera.updateProjectionMatrix();
    const fit = camera.aspect < 1.2 ? 1.9 : 1;
    camera.position.set(-1.5 + 3 * drift, 20 * fit, 14.5 * fit);
    camera.lookAt(0, 0, 0.2);
    renderer.render(scene, camera);
  }
  return { scene, camera, pose, leaves };
}

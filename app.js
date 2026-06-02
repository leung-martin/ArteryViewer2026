'use strict';

// ── Renderer ───────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:0;';
document.body.insertBefore(renderer.domElement, document.body.firstChild);

// ── Scene & Camera ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 0.001, 100
);
camera.position.set(0, 0, 4);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Lights ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
keyLight.position.set(1.5, 2, 3);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(-2, -0.5, 1);
scene.add(fillLight);

// ── OrbitControls ──────────────────────────────────────────────────────────
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.06;
controls.minDistance    = 0.4;
controls.maxDistance    = 15;

// Snapshot used by Reset View
const INIT_CAM_POS = camera.position.clone();
const INIT_TARGET  = controls.target.clone();

// ── Artery Definitions ─────────────────────────────────────────────────────
// Control-point coordinates assume the FBX has been normalised so its
// longest axis spans 2 units and is centred at the world origin.
// x: −left / +right   y: −down / +up   z: −back / +forward (nose tip ≈ +0.28)
const ARTERY_DEFS = [
  {
    id:   'dorsal',
    name: 'Dorsal Nasal Arteries',
    params: { diameter: 0.025, length: 1.0, zPos: 0 },
    // Two branches forming the )( bracket shape on either side of the nose bridge
    branches: [
      // Left branch  )
      [[-0.04,  0.70, 0.16], [-0.17,  0.43, 0.22], [-0.09,  0.17, 0.28], [-0.05,  0.02, 0.25]],
      // Right branch (
      [[ 0.04,  0.70, 0.16], [ 0.17,  0.43, 0.22], [ 0.09,  0.17, 0.28], [ 0.05,  0.02, 0.25]],
    ],
  },
  {
    id:   'lateral',
    name: 'Lateral Nasal Artery',
    params: { diameter: 0.022, length: 1.0, zPos: 0 },
    // Single arc across the alar/nostril crease
    branches: [
      [[-0.27,  0.06, 0.19], [-0.13,  0.10, 0.26], [0,  0.08, 0.30], [0.13,  0.10, 0.26], [0.27,  0.06, 0.19]],
    ],
  },
  {
    id:   'labial',
    name: 'Superior Labial Artery',
    params: { diameter: 0.025, length: 1.0, zPos: 0 },
    // Wide arc tracing the upper-lip vermilion border
    branches: [
      [[-0.39, -0.26, 0.11], [-0.19, -0.18, 0.20], [0, -0.21, 0.23], [0.19, -0.18, 0.20], [0.39, -0.26, 0.11]],
    ],
  },
];

// ── Runtime State ──────────────────────────────────────────────────────────
let selectedId = null;
const arteryGroups = {};   // id → THREE.Group
const meshToId     = new Map(); // Mesh → artery id

// ── Geometry Helpers ───────────────────────────────────────────────────────
function makeCurve(rawPts, dz) {
  return new THREE.CatmullRomCurve3(
    rawPts.map(([x, y, z]) => new THREE.Vector3(x, y, z + dz))
  );
}

// Build a TubeGeometry that shows the central `length` fraction of `curve`,
// growing symmetrically outward from the midpoint.
function buildTubeGeo(curve, diameter, length) {
  const SEG = 64;
  const tA  = Math.max(0, 0.5 - length / 2);
  const tB  = Math.min(1, 0.5 + length / 2);
  const pts = [];
  for (let i = 0; i <= SEG; i++) {
    pts.push(curve.getPoint(tA + (tB - tA) * (i / SEG)));
  }
  const sub = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(sub, SEG, diameter / 2, 8, false);
}

function makeMat(selected) {
  return new THREE.MeshPhongMaterial({
    color:     selected ? 0x00cc55 : 0x8b0000,
    shininess: selected ? 90 : 50,
    specular:  selected ? 0x88ffbb : 0x330000,
  });
}

// ── Build / Rebuild Artery ─────────────────────────────────────────────────
function buildArtery(def) {
  // Tear down previous group for this artery
  const old = arteryGroups[def.id];
  if (old) {
    old.children.forEach(m => {
      meshToId.delete(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    scene.remove(old);
  }

  const { diameter, length, zPos } = def.params;
  const selected = selectedId === def.id;
  const group    = new THREE.Group();

  def.branches.forEach(rawPts => {
    const curve = makeCurve(rawPts, zPos);
    const geo   = buildTubeGeo(curve, diameter, length);
    const mesh  = new THREE.Mesh(geo, makeMat(selected));
    mesh.renderOrder = 1;
    group.add(mesh);
    meshToId.set(mesh, def.id);
  });

  scene.add(group);
  arteryGroups[def.id] = group;
}

function buildAllArteries() {
  ARTERY_DEFS.forEach(buildArtery);
}

// ── FBX Loading ────────────────────────────────────────────────────────────
// The FBX lives one directory up, inside ArteryViewer1.
// If you serve from a different root, adjust this path accordingly.
const FBX_PATH   = './narizBoca.fbx';
const loadingEl  = document.getElementById('loading');

const fbxLoader = new THREE.FBXLoader();
fbxLoader.load(
  FBX_PATH,
  fbx => {
    loadingEl.style.display = 'none';

    // Centre and normalise: scale so the longest dimension is 2 units
    const box = new THREE.Box3().setFromObject(fbx);
    const ctr = new THREE.Vector3();
    box.getCenter(ctr);
    const sz  = new THREE.Vector3();
    box.getSize(sz);
    const s   = 2 / Math.max(sz.x, sz.y, sz.z);

    fbx.scale.setScalar(s);
    fbx.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);

    // Translucent light-grey material; depthWrite:false lets arteries show through
    fbx.traverse(child => {
      if (!child.isMesh) return;
      child.material = new THREE.MeshPhongMaterial({
        color:       0xd4cdc8,
        transparent: true,
        opacity:     0.28,
        side:        THREE.DoubleSide,
        depthWrite:  false,
        shininess:   15,
      });
      child.renderOrder = 0;
    });

    scene.add(fbx);
    buildAllArteries();
  },
  xhr => {
    if (xhr.total)
      loadingEl.textContent = `Loading… ${Math.round(xhr.loaded / xhr.total * 100)}%`;
  },
  err => {
    console.error('FBX load error:', err);
    // file:// protocol blocks XHR; model loads fine when served over HTTP (e.g. GitHub Pages)
    loadingEl.innerHTML =
      'Model unavailable locally — arteries shown.<br>' +
      '<span style="font-size:11px;color:#555">FBX loads correctly on GitHub Pages (HTTP).</span>';
    buildAllArteries();
  }
);

// ── Raycasting (click vs drag) ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const ndcMouse  = new THREE.Vector2();
let   mdPos     = null;

renderer.domElement.addEventListener('pointerdown', e => {
  mdPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', e => {
  if (!mdPos) return;
  const dx = e.clientX - mdPos.x;
  const dy = e.clientY - mdPos.y;
  mdPos = null;
  if (dx * dx + dy * dy > 36) return; // >6 px movement = drag, not click

  ndcMouse.set(
     (e.clientX / window.innerWidth)  * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(ndcMouse, camera);

  const targets = [];
  for (const id in arteryGroups) arteryGroups[id].children.forEach(m => targets.push(m));

  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length) {
    const id = meshToId.get(hits[0].object);
    if (id) { selectArtery(id); return; }
  }
  deselectArtery();
});

// ── Selection ──────────────────────────────────────────────────────────────
function recolorArtery(id, selected) {
  const g = arteryGroups[id];
  if (!g) return;
  const mat = makeMat(selected);
  g.children.forEach(m => { m.material.dispose(); m.material = mat.clone(); });
  mat.dispose();
}

function selectArtery(id) {
  const prev = selectedId;
  selectedId = id;
  if (prev && prev !== id) recolorArtery(prev, false);
  recolorArtery(id, true);
  showPanel(ARTERY_DEFS.find(d => d.id === id));
}

function deselectArtery() {
  if (selectedId) recolorArtery(selectedId, false);
  selectedId = null;
  hidePanel();
}

// ── Parameter Panel ────────────────────────────────────────────────────────
const panel      = document.getElementById('panel');
const panelTitle = document.getElementById('panel-title');
const slDiameter = document.getElementById('sl-diameter');
const slLength   = document.getElementById('sl-length');
const slZPos     = document.getElementById('sl-zpos');
const valDiam    = document.getElementById('val-diameter');
const valLen     = document.getElementById('val-length');
const valZ       = document.getElementById('val-zpos');

function showPanel(def) {
  panelTitle.textContent = def.name;
  slDiameter.value = def.params.diameter;
  slLength.value   = def.params.length;
  slZPos.value     = def.params.zPos;
  syncLabels(def.params);
  panel.classList.add('open');
}

function hidePanel() { panel.classList.remove('open'); }

function syncLabels(p) {
  valDiam.textContent = p.diameter.toFixed(3);
  valLen.textContent  = Math.round(p.length * 100) + '%';
  valZ.textContent    = (p.zPos >= 0 ? '+' : '') + p.zPos.toFixed(2);
}

function onSlider() {
  if (!selectedId) return;
  const def = ARTERY_DEFS.find(d => d.id === selectedId);
  def.params.diameter = +slDiameter.value;
  def.params.length   = +slLength.value;
  def.params.zPos     = +slZPos.value;
  syncLabels(def.params);
  buildArtery(def); // hot-rebuild only the selected artery
}

[slDiameter, slLength, slZPos].forEach(sl => sl.addEventListener('input', onSlider));
document.getElementById('close-panel').addEventListener('click', deselectArtery);

// ── Hamburger Menu ─────────────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const menu      = document.getElementById('menu');

hamburger.addEventListener('click', e => {
  e.stopPropagation();
  menu.classList.toggle('open');
});
document.addEventListener('click', () => menu.classList.remove('open'));

document.getElementById('btn-reset').addEventListener('click', () => {
  camera.position.copy(INIT_CAM_POS);
  controls.target.copy(INIT_TARGET);
  controls.update();
  menu.classList.remove('open');
});

document.getElementById('btn-about').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('open');
  menu.classList.remove('open');
});

document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('open');
});

// ── Render Loop ────────────────────────────────────────────────────────────
(function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
})();

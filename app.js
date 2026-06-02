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

const INIT_CAM_POS = camera.position.clone();
const INIT_TARGET  = controls.target.clone();

// ── Vessel Data Table ──────────────────────────────────────────────────────
// Imported directly from anatomical reference spreadsheet.
//
// trueValue   — internal diagram value (overrides the mm→fraction mapping when
//               set; used to shmoo artery position/size to fit the 3D mesh).
//               Invisible to the end user. null = derive from displayedValue.
// displayedValue — what the user sees in the panel, in mm.
// modifiable  — whether a slider is exposed in the panel.
// range       — half-range of the slider in mm (slider spans
//               [displayedValue − range, displayedValue + range]).
const VESSEL_DATA = [
  // ── Dorsal Nasal Artery ────────────────────────────────────────────────
  { vessel: 'dorsal',  id:  1, desc: 'length',                               trueValue: null, displayedValue:  7.4,  modifiable: true,  range:  6.4  },
  { vessel: 'dorsal',  id:  2, desc: 'depth',                                trueValue: null, displayedValue:  2.0,  modifiable: false, range: null  },
  { vessel: 'dorsal',  id:  3, desc: 'diameter',                             trueValue: null, displayedValue:  0.68, modifiable: false, range: null  },
  { vessel: 'dorsal',  id:  4, desc: 'branching point to midline (right)',   trueValue: null, displayedValue:  3.2,  modifiable: true,  range:  1.5  },
  { vessel: 'dorsal',  id:  5, desc: 'branching point to midline (left)',    trueValue: null, displayedValue:  3.1,  modifiable: true,  range:  1.5  },
  { vessel: 'dorsal',  id:  6, desc: 'branching point to medial canthal line', trueValue: null, displayedValue: 7.2, modifiable: true,  range:  0.3  },
  { vessel: 'dorsal',  id:  7, desc: 'height of bridging part to branch point', trueValue: null, displayedValue: 8.5, modifiable: true, range:  3.5  },
  { vessel: 'dorsal',  id:  9, desc: 'left depth to periosteum',             trueValue: null, displayedValue:  1.48, modifiable: false, range: null  },
  { vessel: 'dorsal',  id: 10, desc: 'left depth to skin',                   trueValue: null, displayedValue:  2.52, modifiable: false, range: null  },
  { vessel: 'dorsal',  id: 11, desc: 'right depth to periosteum',            trueValue: null, displayedValue:  1.64, modifiable: false, range: null  },
  { vessel: 'dorsal',  id: 12, desc: 'right depth to skin',                  trueValue: null, displayedValue:  2.62, modifiable: false, range: null  },

  // ── Lateral Nasal Artery ───────────────────────────────────────────────
  { vessel: 'lateral', id:  1, desc: 'length',                               trueValue: null, displayedValue: 10.6,  modifiable: true,  range:  4.5  },
  { vessel: 'lateral', id:  2, desc: 'distance to oral commissure',          trueValue: null, displayedValue: 10.0,  modifiable: true,  range:  6.8  },
  { vessel: 'lateral', id:  3, desc: 'width overall',                        trueValue: null, displayedValue:  1.23, modifiable: true,  range:  0.37 },
  { vessel: 'lateral', id:  4, desc: 'width right',                          trueValue: null, displayedValue:  1.55, modifiable: true,  range:  0.15 },
  { vessel: 'lateral', id:  5, desc: 'width left',                           trueValue: null, displayedValue:  1.43, modifiable: true,  range:  0.17 },
  { vessel: 'lateral', id:  6, desc: 'starting point from alar base',        trueValue: null, displayedValue:  1.15, modifiable: true,  range:  1.25 },

  // ── Superior Labial Artery ─────────────────────────────────────────────
  { vessel: 'labial',  id:  1, desc: 'length',                               trueValue: null, displayedValue: 21.0,  modifiable: true,  range:  9.8  },
  { vessel: 'labial',  id:  2, desc: 'no significant difference between sides (p>0.18)', trueValue: null, displayedValue: null, modifiable: true, range: null },
  { vessel: 'labial',  id:  3, desc: 'depth more superficial towards midline', trueValue: null, displayedValue: null, modifiable: true, range: null },
  { vessel: 'labial',  id:  4, desc: 'width at midline',                     trueValue: null, displayedValue:  1.1,  modifiable: true,  range:  0.2  },
  { vessel: 'labial',  id:  5, desc: 'width at labial commissure',           trueValue: null, displayedValue:  1.65, modifiable: true,  range:  0.28 },
  { vessel: 'labial',  id:  6, desc: 'width tapering in between',            trueValue: null, displayedValue:  1.36, modifiable: true,  range:  0.28 },
  { vessel: 'labial',  id:  7, desc: 'depth at cheilion',                    trueValue: null, displayedValue:  5.3,  modifiable: true,  range:  0.3  },
  { vessel: 'labial',  id:  8, desc: "depth at cupid's bow peak",            trueValue: null, displayedValue:  3.8,  modifiable: true,  range:  0.9  },
  { vessel: 'labial',  id:  9, desc: "depth at cupid's bow midline",         trueValue: null, displayedValue:  3.3,  modifiable: true,  range:  1.2  },
];

// Retrieve a single parameter entry.
function vp(vesselId, paramId) {
  return VESSEL_DATA.find(d => d.vessel === vesselId && d.id === paramId) || null;
}

// Convert a displayed mm value to the internal 0–1 length fraction.
// If trueValue is set on the param, it is used directly as the fraction
// (allows shmoo-ing the artery to fit the diagram without changing what
// the user sees).
// The full curve (fraction = 1.0) is defined as displayedValue + range mm.
function mmToFraction(vesselId, mm) {
  const p = vp(vesselId, 1);
  if (!p) return 1.0;
  if (p.trueValue !== null) return p.trueValue;         // diagram override
  const maxMm = p.displayedValue + (p.range || 0);
  return maxMm > 0 ? Math.min(1, Math.max(0, mm / maxMm)) : 1.0;
}

// Slider bounds for the length parameter of a given vessel.
function lengthSliderConfig(vesselId) {
  const p = vp(vesselId, 1);
  if (!p) return { min: 0, max: 20, step: 0.1, defaultVal: 10 };
  return {
    min:        Math.max(0, p.displayedValue - (p.range || 0)),
    max:        p.displayedValue + (p.range || 0),
    step:       0.1,
    defaultVal: p.displayedValue,
  };
}

// ── Artery Definitions ─────────────────────────────────────────────────────
// params.length is stored in mm (matches the slider and VESSEL_DATA).
// It is converted to an internal 0–1 fraction in buildArtery() via mmToFraction().
const ARTERY_DEFS = [
  {
    id:   'dorsal',
    name: 'Dorsal Nasal Arteries',
    params: {
      diameter: 0.025,
      length:   vp('dorsal',  1).displayedValue,  // 7.4 mm
      zPos:     0,
    },
    branches: [
      [[-0.04,  0.70, 0.16], [-0.17,  0.43, 0.22], [-0.09,  0.17, 0.28], [-0.05,  0.02, 0.25]],
      [[ 0.04,  0.70, 0.16], [ 0.17,  0.43, 0.22], [ 0.09,  0.17, 0.28], [ 0.05,  0.02, 0.25]],
    ],
  },
  {
    id:   'lateral',
    name: 'Lateral Nasal Artery',
    params: {
      diameter: 0.022,
      length:   vp('lateral', 1).displayedValue,  // 10.6 mm
      zPos:     0,
    },
    branches: [
      [[-0.27, 0.06, 0.19], [-0.13, 0.10, 0.26], [0, 0.08, 0.30], [0.13, 0.10, 0.26], [0.27, 0.06, 0.19]],
    ],
  },
  {
    id:   'labial',
    name: 'Superior Labial Artery',
    params: {
      diameter: 0.025,
      length:   vp('labial',  1).displayedValue,  // 21.0 mm
      zPos:     0,
    },
    branches: [
      [[-0.39, -0.26, 0.11], [-0.19, -0.18, 0.20], [0, -0.21, 0.23], [0.19, -0.18, 0.20], [0.39, -0.26, 0.11]],
    ],
  },
];

// ── Runtime State ──────────────────────────────────────────────────────────
let selectedId = null;
const arteryGroups = {};
const meshToId     = new Map();

// ── Geometry Helpers ───────────────────────────────────────────────────────
function makeCurve(rawPts, dz) {
  return new THREE.CatmullRomCurve3(
    rawPts.map(([x, y, z]) => new THREE.Vector3(x, y, z + dz))
  );
}

// Shows the central `fraction` of the curve, growing symmetrically from midpoint.
function buildTubeGeo(curve, diameter, fraction) {
  const SEG = 64;
  const tA  = Math.max(0, 0.5 - fraction / 2);
  const tB  = Math.min(1, 0.5 + fraction / 2);
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
  const fraction  = mmToFraction(def.id, length); // mm → internal 0–1
  const selected  = selectedId === def.id;
  const group     = new THREE.Group();

  def.branches.forEach(rawPts => {
    const curve = makeCurve(rawPts, zPos);
    const geo   = buildTubeGeo(curve, diameter, fraction);
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
const MODEL_PATH = './human_head.glb';
const loadingEl  = document.getElementById('loading');

const gltfLoader = new THREE.GLTFLoader();
gltfLoader.load(
  MODEL_PATH,
  gltf => {
    loadingEl.style.display = 'none';

    const model = gltf.scene;

    // Centre and normalise: scale so the longest dimension is 2 units
    const box = new THREE.Box3().setFromObject(model);
    const ctr = new THREE.Vector3();
    box.getCenter(ctr);
    const sz  = new THREE.Vector3();
    box.getSize(sz);
    const s   = 2 / Math.max(sz.x, sz.y, sz.z);

    model.scale.setScalar(s);
    model.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);

    // Translucent light-grey material; depthWrite:false lets arteries show through
    model.traverse(child => {
      if (!child.isMesh) return;
      child.material = new THREE.MeshPhongMaterial({
        color:      0xd4cdc8,
        transparent: true,
        opacity:     0.28,
        side:        THREE.DoubleSide,
        depthWrite:  false,
        shininess:   15,
      });
      child.renderOrder = 0;
    });

    scene.add(model);
    buildAllArteries();
  },
  xhr => {
    if (xhr.total)
      loadingEl.textContent = `Loading… ${Math.round(xhr.loaded / xhr.total * 100)}%`;
  },
  err => {
    console.error('GLB load error:', err);
    loadingEl.innerHTML =
      'Model unavailable locally — arteries shown.<br>' +
      '<span style="font-size:11px;color:#555">GLB loads correctly on GitHub Pages (HTTP).</span>';
    buildAllArteries();
  }
);

// ── Raycasting ─────────────────────────────────────────────────────────────
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
  if (dx * dx + dy * dy > 36) return;

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

  // Length slider — bounds and default from VESSEL_DATA
  const cfg      = lengthSliderConfig(def.id);
  slLength.min   = cfg.min;
  slLength.max   = cfg.max;
  slLength.step  = 0.1;
  slLength.value = def.params.length;

  // Diameter slider
  slDiameter.min   = 0.005;
  slDiameter.max   = 0.100;
  slDiameter.step  = 0.001;
  slDiameter.value = def.params.diameter;

  // Z-position slider
  slZPos.min   = -0.5;
  slZPos.max   =  0.5;
  slZPos.step  =  0.01;
  slZPos.value = def.params.zPos;

  syncRangeTags(def);
  syncLabels(def);
  panel.classList.add('open');
}

function hidePanel() { panel.classList.remove('open'); }

// Set the −X / +X tags that flank each slider.
function syncRangeTags(def) {
  // Length: ± comes from VESSEL_DATA range column
  const lenP  = vp(def.id, 1);
  const lenR  = lenP && lenP.range ? lenP.range : 0;
  document.getElementById('sl-length-lo').textContent  = `−${lenR.toFixed(1)} mm`;
  document.getElementById('sl-length-hi').textContent  = `+${lenR.toFixed(1)} mm`;

  // Diameter: delta from current value to each end of its fixed slider range
  const d    = def.params.diameter;
  document.getElementById('sl-diameter-lo').textContent = `−${(d - 0.005).toFixed(3)}`;
  document.getElementById('sl-diameter-hi').textContent = `+${(0.100 - d).toFixed(3)}`;

  // Z Position: fixed symmetric range
  document.getElementById('sl-zpos-lo').textContent = '−0.50';
  document.getElementById('sl-zpos-hi').textContent = '+0.50';
}

// Display current slider values as plain absolute numbers — no percentages.
function syncLabels(def) {
  const p = def.params;
  valDiam.textContent = p.diameter.toFixed(3);
  valLen.textContent  = parseFloat(p.length).toFixed(1) + ' mm';
  valZ.textContent    = (p.zPos >= 0 ? '+' : '') + p.zPos.toFixed(2);
}

function onSlider() {
  if (!selectedId) return;
  const def = ARTERY_DEFS.find(d => d.id === selectedId);
  def.params.diameter = +slDiameter.value;
  def.params.length   = +slLength.value;  // mm; converted to 0–1 fraction in buildArtery
  def.params.zPos     = +slZPos.value;
  syncRangeTags(def);
  syncLabels(def);
  buildArtery(def);
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

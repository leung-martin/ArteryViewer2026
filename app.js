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

// ── Anatomical Scale ────────────────────────────────────────────────────────
// After normalisation the head's longest axis (height ≈ 230 mm) = 2 scene units.
const MM = 2 / 230; // scene units per millimetre

// Approximate landmark positions on the normalised head.
// These are best-effort estimates; tune trueValue in VESSEL_DATA to shmoo.
const ANCHOR = {
  intercanthal_y: 0.25,  // y of the intercanthal / inner-eye line
  nose_z:         0.37,  // z of the nose-bridge skin surface
};

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
      zPos:     0,
      id1: vp('dorsal', 1).displayedValue,  // length: 7.4 mm
      id4: vp('dorsal', 4).displayedValue,  // right to midline: 3.2 mm
      id5: vp('dorsal', 5).displayedValue,  // left to midline: 3.1 mm
      id6: vp('dorsal', 6).displayedValue,  // to canthal line: 7.2 mm
      id7: vp('dorsal', 7).displayedValue,  // bridge V-dip: 8.5 mm
    },
    // 5-curve M/W shape confirmed from reference image.
    // ①② Upper arms: inner canthal area → bridge (fixed, always shown).
    // ③   Bridge: V-dip, depth = ID7 (8.5 mm).
    // ④⑤  Lower arms: inward-inflecting from bridge, length slider-driven.
    getBranches(params) {
      const rx  = (params.id4 ?? vp('dorsal', 4).displayedValue) * MM;
      const lx  = (params.id5 ?? vp('dorsal', 5).displayedValue) * MM;
      const dy  = (params.id6 ?? vp('dorsal', 6).displayedValue) * MM;
      const bh  = (params.id7 ?? vp('dorsal', 7).displayedValue) * MM;
      const oz  = params.zPos;

      const by  = ANCHOR.intercanthal_y - dy;   // bridge y ≈ 0.187
      const bz  = ANCHOR.nose_z + oz;

      // ③ Bridge V-dip control point:
      //    Q-Bézier midpoint y = 0.5*by + 0.5*ctrl = by − bh  →  ctrl = by − 2*bh
      const bridgeCtrlY = by - 2 * bh;

      // ①② Upper arm origin: inner canthal area (~13 mm lateral, at intercanthal y)
      //    z is pulled forward so tips sit on the face surface near the inner eye corner
      const cthX = 0.115;
      const cthY = ANCHOR.intercanthal_y;
      const cthZ = ANCHOR.nose_z - 0.03 + oz;  // close to nose bridge z, inner-eye level

      // Control point: smooth inward sweep toward bridge
      const ucX = (cthX + rx)  * 0.52;
      const ucY = (cthY + by)  * 0.52;
      const ucZ = ANCHOR.nose_z + 0.01 + oz;

      // ④⑤ Lower arm: inward-inflecting (2D-confirmed ratios mid=37.5%, end=75% of bridge x)
      const armMm     = params.id1 ?? params.length ?? vp('dorsal', 1).displayedValue;
      const armFrac   = mmToFraction('dorsal', armMm);
      const armLen    = armMm * MM;
      const lMidX     = rx * 0.375;
      const lEndX     = rx * 0.75;
      const lMidY     = by - armLen * 0.54;
      const lEndY     = by - armLen;
      const lMidZ     = ANCHOR.nose_z + 0.05 + oz;
      const lEndZ     = ANCHOR.nose_z + 0.08 + oz;

      return [
        // ① Left upper arm: inner canthal → bridge left end
        { pts: [[-cthX, cthY, cthZ], [-ucX, ucY, ucZ], [-lx, by, bz]],
          fraction: 1.0 },
        // ② Right upper arm: mirror
        { pts: [[ cthX, cthY, cthZ], [ ucX, ucY, ucZ], [ rx, by, bz]],
          fraction: 1.0 },
        // ③ Bridge: V-dip, depth driven by ID7 (8.5 mm)
        { pts: [[-lx, by, bz], [0, bridgeCtrlY, bz], [rx, by, bz]],
          fraction: 1.0 },
        // ④ Left lower arm: inward-inflecting, grows from bridge downward
        { pts: [[-lx, by, bz], [-lMidX, lMidY, lMidZ], [-lEndX, lEndY, lEndZ]],
          fraction: armFrac, growFrom: 'start' },
        // ⑤ Right lower arm: mirror
        { pts: [[ rx, by, bz], [ lMidX, lMidY, lMidZ], [ lEndX, lEndY, lEndZ]],
          fraction: armFrac, growFrom: 'start' },
      ];
    },
  },
  {
    id:   'lateral',
    name: 'Lateral Nasal Artery',
    params: {
      diameter: 0.022,
      zPos:     0,
      id1: vp('lateral', 1).displayedValue,  // length: 10.6 mm
      id2: vp('lateral', 2).displayedValue,  // distance to oral commissure: 10.0 mm
      id3: vp('lateral', 3).displayedValue,  // width overall: 1.23 mm
      id4: vp('lateral', 4).displayedValue,  // width right: 1.55 mm
      id5: vp('lateral', 5).displayedValue,  // width left: 1.43 mm
      id6: vp('lateral', 6).displayedValue,  // starting point from alar base: 1.15 mm
    },
    branches: [
      // Right alar crease — wraps along nose-cheek groove at nostril level
      [[ 0.035, -0.080, 0.458], [ 0.060, -0.098, 0.452], [ 0.085, -0.115, 0.440]],
      // Left alar crease — mirror
      [[-0.035, -0.080, 0.458], [-0.060, -0.098, 0.452], [-0.085, -0.115, 0.440]],
    ],
  },
  {
    id:   'labial',
    name: 'Superior Labial Artery',
    params: {
      diameter: 0.025,
      zPos:     0,
      id1: vp('labial', 1).displayedValue,  // length: 21.0 mm
      id4: vp('labial', 4).displayedValue,  // width at midline: 1.1 mm
      id5: vp('labial', 5).displayedValue,  // width at labial commissure: 1.65 mm
      id6: vp('labial', 6).displayedValue,  // width tapering: 1.36 mm
      id7: vp('labial', 7).displayedValue,  // depth at cheilion: 5.3 mm
      id8: vp('labial', 8).displayedValue,  // depth at cupid's bow peak: 3.8 mm
      id9: vp('labial', 9).displayedValue,  // depth at cupid's bow midline: 3.3 mm
    },
    branches: [
      // Upper-lip vermilion border — Cupid's bow, pushed forward onto lip surface
      [[-0.155, -0.295, 0.400], [-0.078, -0.262, 0.428], [0, -0.272, 0.435], [0.078, -0.262, 0.428], [0.155, -0.295, 0.400]],
    ],
  },

  // ── Angular Vein ─────────────────────────────────────────────────────────
  // Runs from inner canthal angle down the lateral nose wall to the alar groove.
  // The angular vein is the terminal segment of the facial vein at the medial eye corner.
  {
    id:    'angular',
    name:  'Angular Vein',
    type:  'vein',
    color: 0x3366cc,
    params: { diameter: 0.015, zPos: 0, id1: 25 },
    branches: [
      // Right: medial canthus → nose sidewall mid → alar groove
      [[ 0.100,  0.225, 0.365], [ 0.068,  0.075, 0.435], [ 0.058, -0.090, 0.455]],
      // Left: mirror
      [[-0.100,  0.225, 0.365], [-0.068,  0.075, 0.435], [-0.058, -0.090, 0.455]],
    ],
  },

  // ── Facial Vein ───────────────────────────────────────────────────────────
  // Descends from the angular vein origin, following the nasolabial fold toward
  // the oral commissure, then sweeps posteriorly to the mandibular border.
  {
    id:    'facial',
    name:  'Facial Vein',
    type:  'vein',
    color: 0x2244aa,
    params: { diameter: 0.019, zPos: 0, id1: 70 },
    branches: [
      // Right: canthal origin → nasolabial fold → oral commissure → mandible
      [[ 0.105,  0.210, 0.360], [ 0.135,  0.030, 0.430], [ 0.162, -0.195, 0.415], [ 0.178, -0.365, 0.335], [ 0.168, -0.490, 0.195]],
      // Left: mirror
      [[-0.105,  0.210, 0.360], [-0.135,  0.030, 0.430], [-0.162, -0.195, 0.415], [-0.178, -0.365, 0.335], [-0.168, -0.490, 0.195]],
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

// Builds a tube showing `fraction` of `curve`.
// growFrom='center' (default): grows symmetrically from midpoint (for arcs).
// growFrom='start': grows from t=0 downward (for arms anchored at bridge).
function buildTubeGeo(curve, diameter, fraction, growFrom = 'center') {
  const SEG = 64;
  let tA, tB;
  if (growFrom === 'start') {
    tA = 0;
    tB = Math.min(1, fraction);
  } else {
    tA = Math.max(0, 0.5 - fraction / 2);
    tB = Math.min(1, 0.5 + fraction / 2);
  }
  const pts = [];
  for (let i = 0; i <= SEG; i++) {
    pts.push(curve.getPoint(tA + (tB - tA) * (i / SEG)));
  }
  const sub = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(sub, SEG, diameter / 2, 8, false);
}

function makeMat(selected, baseColor = 0x8b0000) {
  return new THREE.MeshPhongMaterial({
    color:     selected ? 0x00cc55 : baseColor,
    shininess: selected ? 90 : 50,
    specular:  selected ? 0x88ffbb : 0x110000,
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
  const selected = selectedId === def.id;
  const group    = new THREE.Group();

  const baseColor = def.color ?? 0x8b0000;

  if (def.getBranches) {
    // ── Dynamic artery: getBranches returns [{pts, fraction?}] ──────────────
    def.getBranches(def.params).forEach(({ pts, fraction, growFrom }) => {
      const curve = makeCurve(pts, 0);
      const geo   = buildTubeGeo(curve, diameter, fraction, growFrom);
      const mesh  = new THREE.Mesh(geo, makeMat(selected, baseColor));
      mesh.renderOrder = 1;
      group.add(mesh);
      meshToId.set(mesh, def.id);
    });
  } else {
    // ── Static artery: branches is a plain array of point arrays ────────────
    const lengthMm = def.params.id1 ?? length;
    const fraction = mmToFraction(def.id, lengthMm);
    def.branches.forEach(rawPts => {
      const curve = makeCurve(rawPts, zPos);
      const geo   = buildTubeGeo(curve, diameter, fraction);
      const mesh  = new THREE.Mesh(geo, makeMat(selected, baseColor));
      mesh.renderOrder = 1;
      group.add(mesh);
      meshToId.set(mesh, def.id);
    });
  }

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
    drawRefLines();
    buildAllArteries();
    selectArtery('dorsal');
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
    drawRefLines();
    buildAllArteries();
    selectArtery('dorsal');
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
  const def = ARTERY_DEFS.find(d => d.id === id);
  const mat = makeMat(selected, def?.color ?? 0x8b0000);
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
const panel           = document.getElementById('panel');
const panelTitle      = document.getElementById('panel-title');
const sliderContainer = document.getElementById('slider-container');

// Truncate long label text to fit the slider row
function trunc(str, n = 25) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

// Build HTML for one slider row (used for both VESSEL_DATA params and internal controls)
function makeSliderRow(key, label, value, min, max, step, unit) {
  const lo     = (value - min);
  const hi     = (max  - value);
  const isMm   = unit === 'mm';
  const isZPos = key === 'zPos';
  const dispVal = isMm   ? `${(+value).toFixed(1)} mm`
                : isZPos ? `${value >= 0 ? '+' : ''}${(+value).toFixed(2)}`
                :           `${(+value).toFixed(3)}`;
  const loStr  = isMm   ? `−${lo.toFixed(1)} mm` : `−${Math.abs(lo).toFixed(isZPos ? 2 : 3)}`;
  const hiStr  = isMm   ? `+${hi.toFixed(1)} mm` : `+${Math.abs(hi).toFixed(isZPos ? 2 : 3)}`;

  return `<div class="slider-row">
    <div class="slider-label">
      <span title="${label}">${trunc(label)}</span>
      <span class="slider-val" id="val-${key}">${dispVal}</span>
    </div>
    <div class="slider-track">
      <span class="range-tag lo">${loStr}</span>
      <input type="range" id="sl-${key}"
             data-key="${key}" data-unit="${unit}"
             min="${min}" max="${max}" step="${step}" value="${value}"/>
      <span class="range-tag hi">${hiStr}</span>
    </div>
  </div>`;
}

function showPanel(def) {
  panelTitle.textContent = def.name;
  const rows = [];

  // ── Modifiable VESSEL_DATA params (in ID order) ──
  VESSEL_DATA
    .filter(d => d.vessel === def.id && d.modifiable && d.displayedValue != null && d.range != null)
    .sort((a, b) => a.id - b.id)
    .forEach(p => {
      const key = `id${p.id}`;
      const val = def.params[key] ?? p.displayedValue;
      rows.push(makeSliderRow(
        key, p.desc, val,
        Math.max(0, p.displayedValue - p.range),
        p.displayedValue + p.range,
        0.1, 'mm'
      ));
    });

  // ── Tube diameter (visual/internal, always shown) ──
  const d = def.params.diameter;
  rows.push(makeSliderRow('diameter', 'Tube diameter (visual)', d, 0.005, 0.100, 0.001, ''));

  // ── Z-depth offset (shmoo, always shown) ──
  rows.push(makeSliderRow('zPos', 'Z offset (depth)', def.params.zPos, -0.5, 0.5, 0.01, 'zPos'));

  sliderContainer.innerHTML = rows.join('');

  // Bind change handler to every generated slider
  sliderContainer.querySelectorAll('input[type=range]').forEach(sl => {
    sl.addEventListener('input', () => onSlider(def, sl.dataset.key, sl.dataset.unit));
  });

  panel.classList.add('open');
}

function hidePanel() { panel.classList.remove('open'); }

function onSlider(def, key, unit) {
  const sl  = document.getElementById(`sl-${key}`);
  if (!sl) return;
  const val = +sl.value;

  // Update inline display value
  const span = document.getElementById(`val-${key}`);
  if (span) {
    span.textContent = unit === 'mm'  ? `${val.toFixed(1)} mm`
                     : key === 'zPos' ? `${val >= 0 ? '+' : ''}${val.toFixed(2)}`
                     :                   val.toFixed(3);
  }

  // Persist into params
  def.params[key] = val;

  buildArtery(def);
}

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

document.getElementById('btn-toggle-grid').addEventListener('click', () => {
  gridGroup.visible = !gridGroup.visible;
  document.getElementById('btn-toggle-grid').textContent =
    gridGroup.visible ? 'Hide Grid' : 'Show Grid';
  menu.classList.remove('open');
});

document.getElementById('btn-toggle-refs').addEventListener('click', () => {
  refLineGroup.visible = !refLineGroup.visible;
  document.getElementById('btn-toggle-refs').textContent =
    refLineGroup.visible ? 'Hide Ref Lines' : 'Show Ref Lines';
  menu.classList.remove('open');
});

document.getElementById('btn-toggle-veins').addEventListener('click', () => {
  const veinIds = ARTERY_DEFS.filter(d => d.type === 'vein').map(d => d.id);
  const anyVisible = veinIds.some(id => arteryGroups[id]?.visible !== false);
  veinIds.forEach(id => {
    if (arteryGroups[id]) arteryGroups[id].visible = !anyVisible;
  });
  document.getElementById('btn-toggle-veins').textContent =
    anyVisible ? 'Show Veins' : 'Hide Veins';
  menu.classList.remove('open');
});

document.getElementById('btn-about').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('open');
  menu.classList.remove('open');
});

document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('open');
});

// ── 3D Grid ────────────────────────────────────────────────────────────────
// Front-facing XY grid centred on the face. Each cell = 0.1 scene units ≈ 11.5 mm.
// A second horizontal XZ grid sits at chin level for depth orientation.
const gridGroup = new THREE.Group();
gridGroup.visible = false;
scene.add(gridGroup);

(function buildGrid() {
  // Front grid: XY plane at z=0.55 (just ahead of nose tip)
  const frontGrid = new THREE.GridHelper(2.4, 24, 0x4455aa, 0x2a3366);
  frontGrid.rotation.x = Math.PI / 2;
  frontGrid.position.z = 0.55;
  gridGroup.add(frontGrid);

  // Floor grid: XZ plane at y=-0.55 (below chin) for depth context
  const floorGrid = new THREE.GridHelper(2.4, 24, 0x4455aa, 0x2a3366);
  floorGrid.position.y = -0.55;
  gridGroup.add(floorGrid);

  // Axes (X=red, Y=green, Z=blue), length 0.5 each
  const axes = new THREE.AxesHelper(0.5);
  axes.position.set(0, 0, 0);
  gridGroup.add(axes);
})();

// ── Reference Lines ────────────────────────────────────────────────────────
// Dashed landmark overlays drawn in front of the face (z=0.54) to identify
// key horizontal planes and the facial midline.
const refLineGroup = new THREE.Group();
refLineGroup.renderOrder = 2;
scene.add(refLineGroup);

const REF_Z = 0.54;  // just in front of nose tip

const REF_LINES = [
  // Intercanthal line (inner-eye level)
  { pts: [[-0.28, 0.25, REF_Z], [0.28, 0.25, REF_Z]], color: 0x6699ff, label: 'intercanthal' },
  // Alar base line
  { pts: [[-0.22, -0.095, REF_Z], [0.22, -0.095, REF_Z]], color: 0x66bbff, label: 'alar base' },
  // Vermilion border line
  { pts: [[-0.24, -0.278, REF_Z], [0.24, -0.278, REF_Z]], color: 0x66bbff, label: 'vermilion' },
  // Facial midline
  { pts: [[0, 0.52, REF_Z], [0, -0.54, REF_Z]], color: 0x8899ff, label: 'midline' },
];

function drawRefLines() {
  refLineGroup.clear();
  REF_LINES.forEach(({ pts, color }) => {
    const geo = new THREE.BufferGeometry().setFromPoints(
      pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    );
    const mat  = new THREE.LineDashedMaterial({ color, dashSize: 0.025, gapSize: 0.015, opacity: 0.65, transparent: true });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    refLineGroup.add(line);
  });
}

// ── Render Loop ────────────────────────────────────────────────────────────
(function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
})();

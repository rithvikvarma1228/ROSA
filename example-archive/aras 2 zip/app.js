/* ═══════════════════════════════════════════════════════
   KneeAI — Application Logic & Advanced 3D Knee Viewer
   ═══════════════════════════════════════════════════════ */

// ── Loading sequence ──────────────────────────────────
(function initLoading() {
  const stages   = document.querySelectorAll('.loading-stage');
  const loadTime = 3500;
  const delay    = loadTime / stages.length;
  stages.forEach((stage, i) => {
    setTimeout(() => {
      stages.forEach(s => s.classList.remove('active'));
      stage.classList.add('active');
    }, i * delay);
  });
  setTimeout(() => {
    const loadScreen = document.getElementById('loading-screen');
    const app        = document.getElementById('app');
    loadScreen.style.opacity    = '0';
    loadScreen.style.transition = 'opacity 0.7s ease';
    setTimeout(() => {
      loadScreen.style.display = 'none';
      app.classList.remove('hidden');
      initApp();
    }, 700);
  }, loadTime + 400);
})();

// ── Global state ──────────────────────────────────────
const state = {
  wireframe: false, xray: false, exploded: false,
  autoRotate: false, crossSection: false, annotations: true,
  transparency: 0, currentSlice: 24,
  contrast: 100, opacity: 100, zoom: 100,
  selectedBone: null, activeAnnotation: null,
  boneVisibility: { femur:true, tibia:true, fibula:true, patella:true, tendons:true, cartilage:true, meniscus:true, ligaments:true }
};

// ── Theme definitions ─────────────────────────────────
const THEMES = {
  light: {
    sceneBg:     0xD8E8F4,   // clinical light blue-grey
    fogColor:    0xD8E8F4,
    fogDensity:  0.018,
    ambientTop:  0x8BB8D8,
    ambientBot:  0xD8C8B8,
    ambientInt:  0.7,
    rimColor:    0x4488BB,
    rimInt:      0.4,
  },
  dark: {
    sceneBg:     0x0A1520,
    fogColor:    0x0A1520,
    fogDensity:  0.025,
    ambientTop:  0x2A3A50,
    ambientBot:  0x100808,
    ambientInt:  0.6,
    rimColor:    0x0EA5A4,
    rimInt:      0.7,
  }
};

/* ═══════════════════════════════════════════════════════
   BONE DATA — metadata for each anatomical structure
═══════════════════════════════════════════════════════ */
const BONE_DATA = {
  femur: {
    name:'Femur', sub:'Distal — Left Knee', icon:'🦴',
    surface:'142.8 cm²', volume:'386.4 cm³', vertices:'38,416', faces:'76,832',
    confidence:99.2, disease:'Healthy', severity:'None', diseased:false,
    clinical:'Cortical margins intact. Medial and lateral femoral condyles well-formed with preserved intercondylar fossa and trochlear groove. No osteophytes or subchondral sclerosis.',
    explodeDir: new THREE.Vector3(0, 2.8, 0)
  },
  tibia: {
    name:'Tibia', sub:'Proximal — Left Knee', icon:'🦴',
    surface:'118.3 cm²', volume:'312.7 cm³', vertices:'29,880', faces:'59,760',
    confidence:98.7, disease:'Healthy', severity:'None', diseased:false,
    clinical:'Proximal tibial plateau intact with well-defined medial and lateral condylar facets. Intercondylar eminence (tibial spine) preserved. Anterior tibial tuberosity normal.',
    explodeDir: new THREE.Vector3(0, -2.5, 0)
  },
  fibula: {
    name:'Fibula', sub:'Lateral Head & Shaft — Left Knee', icon:'🦴',
    surface:'54.2 cm²', volume:'82.4 cm³', vertices:'14,320', faces:'28,640',
    confidence:98.1, disease:'Healthy', severity:'None', diseased:false,
    clinical:'Fibular head (caput fibulae) and styloid apex well-demarcated. Proximal tibiofibular joint shows normal articulation and spacing. LCL and biceps femoris insertion sites intact.',
    explodeDir: new THREE.Vector3(2.2, -2.0, -0.6)
  },
  patella: {
    name:'Patella', sub:'Anterior Sesamoid — Left Knee', icon:'🦴',
    surface:'22.1 cm²', volume:'14.8 cm³', vertices:'8,640', faces:'17,280',
    confidence:97.4, disease:'Healthy', severity:'None', diseased:false,
    clinical:'Patellar bone morphology preserved. Vertical median ridge divides medial and lateral posterior articular facets properly. No patellofemoral subluxation or tracking abnormality.',
    explodeDir: new THREE.Vector3(0, 0, 3.5)
  },
  tendons: {
    name:'Tendons (Quad & Patellar)', sub:'Extensor Mechanism', icon:'🎗️',
    surface:'28.6 cm²', volume:'11.2 cm³', vertices:'9,400', faces:'18,800',
    confidence:96.8, disease:'Intact', severity:'None', diseased:false,
    clinical:'Quadriceps tendon and patellar ligament (patellar tendon) demonstrate uniform low signal intensity. Distal attachment into tibial tuberosity is continuous and intact.',
    explodeDir: new THREE.Vector3(0, 0.4, 2.8)
  },
  cartilage: {
    name:'Articular Cartilage', sub:'Medial Compartment', icon:'💠',
    surface:'38.4 cm²', volume:'8.6 cm³', vertices:'18,200', faces:'36,400',
    confidence:94.1, disease:'Cartilage Thinning', severity:'Grade II', diseased:true,
    clinical:'Focal thinning of medial femoral condyle cartilage. Measured thickness 2.1 mm (vs. expected 3.0 mm). Semi-transparent visual overlay highlights the osteoarthritic zone.',
    explodeDir: new THREE.Vector3(0.8, 0.2, 0.5)
  },
  meniscus: {
    name:'Medial Meniscus', sub:'Body-Posterior Horn Junction', icon:'⚠️',
    surface:'12.7 cm²', volume:'3.2 cm³', vertices:'6,800', faces:'13,600',
    confidence:87.3, disease:'Meniscus Tear — Grade III', severity:'Grade III', diseased:true,
    clinical:'Complete radial tear of the medial meniscus at the body-posterior horn junction. Peripheral red-zone rim intact. Increased fluid signal on T2. Arthroscopic evaluation recommended.',
    explodeDir: new THREE.Vector3(-1.5, 0, 0.8)
  },
  ligaments: {
    name:'Ligaments (ACL/PCL/LCL/MCL)', sub:'Cruciate & Collateral', icon:'🔗',
    surface:'12.4 cm²', volume:'5.8 cm³', vertices:'7,600', faces:'15,200',
    confidence:99.1, disease:'Intact', severity:'None', diseased:false,
    clinical:'Anterior (ACL) and posterior (PCL) cruciate ligaments, medial collateral ligament (MCL), and lateral collateral ligament (LCL to fibular head) are taut and continuous.',
    explodeDir: new THREE.Vector3(0, 0, -2.5)
  }
};

/* ═══════════════════════════════════════════════════════
   ANNOTATIONS — 3D interactive educational pins
   (Matching Sketchfab-style pins 1, 2, 3, 4, 9, 10, 11)
═══════════════════════════════════════════════════════ */
const ANNOTATIONS = [
  { id: 1, name: 'Patellar Tendon (Ligamentum Patellae)', bone: 'tendons', icon: '🎗️', pos: new THREE.Vector3(0.0, -0.42, 1.42), cam: { theta: 0.12, phi: 1.25, radius: 8.5 }, desc: 'Thick fibrous band continuing from patellar apex down into the tibial tuberosity.' },
  { id: 2, name: 'Quadriceps Tendon', bone: 'tendons', icon: '🎗️', pos: new THREE.Vector3(0.06, 1.82, 0.96), cam: { theta: 0.18, phi: 1.10, radius: 8.8 }, desc: 'Primary extensor tendon inserting into the superior border (base) of the patella.' },
  { id: 3, name: 'Tibial Tuberosity', bone: 'tibia', icon: '🦴', pos: new THREE.Vector3(0.0, -0.92, 1.08), cam: { theta: 0.22, phi: 1.30, radius: 8.2 }, desc: 'Prominent anterior bony tubercle anchoring the distal patellar ligament.' },
  { id: 4, name: 'Medial Meniscus & Cartilage', bone: 'meniscus', icon: '⚠️', pos: new THREE.Vector3(-0.76, 0.06, 0.58), cam: { theta: -0.65, phi: 1.18, radius: 7.4 }, desc: 'C-shaped medial fibrocartilage cushion. Demonstrates Grade III radial tear.' },
  { id: 9, name: 'Lateral Meniscus', bone: 'meniscus', icon: '💠', pos: new THREE.Vector3(0.76, 0.06, 0.52), cam: { theta: 0.82, phi: 1.18, radius: 7.4 }, desc: 'Circular lateral fibrocartilage shock absorber resting atop the lateral tibial facet.' },
  { id: 10, name: 'Lateral Collateral Ligament & Fibula Head', bone: 'fibula', icon: '🦴', pos: new THREE.Vector3(1.18, -0.22, -0.28), cam: { theta: 1.38, phi: 1.22, radius: 8.0 }, desc: 'LCL running from lateral femoral epicondyle down to the fibular head (caput fibulae).' },
  { id: 11, name: 'Anterior Cruciate Ligament (ACL)', bone: 'ligaments', icon: '🔗', pos: new THREE.Vector3(0.02, 0.26, 0.12), cam: { theta: 0.05, phi: 1.12, radius: 7.2 }, desc: 'Cruciate ligament preventing anterior translation of the tibia on the femur.' }
];


/* ═══════════════════════════════════════════════════════
   THREE.JS GLOBALS
═══════════════════════════════════════════════════════ */
let scene, camera, renderer;
let bones = {};
let boneGroup;
let autoRotateActive = false;
let raycaster, mouse;
let selectedMesh = null;
let diseasePhase  = 0;

// Spherical camera control
let spherical = { theta: 0.4, phi: 1.1, radius: 11 };

/* ═══════════════════════════════════════════════════════
   PROCEDURAL PBR BONE TEXTURE
   Creates a canvas texture that mimics cortical bone surface
═══════════════════════════════════════════════════════ */
function makeBoneTexture(w = 512, h = 512, tint = [245, 235, 210]) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  // ── Layer 1: Warm ivory base with subtle radial variation ──
  const baseGrad = ctx.createRadialGradient(w*0.5, h*0.4, 0, w*0.5, h*0.5, w*0.65);
  baseGrad.addColorStop(0,   `rgb(${tint[0]},${tint[1]},${tint[2]})`);
  baseGrad.addColorStop(0.6, `rgb(${tint[0]-8},${tint[1]-10},${tint[2]-18})`);
  baseGrad.addColorStop(1,   `rgb(${tint[0]-18},${tint[1]-22},${tint[2]-35})`);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // ── Layer 2: Trabecular variation patches (spongy bone areas) ──
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const rw = Math.random() * 60 + 20, rh = Math.random() * 40 + 15;
    const alpha = Math.random() * 0.06 + 0.02;
    const warm  = Math.random() > 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = warm
      ? `rgba(210,180,130,${alpha})`
      : `rgba(120,90,50,${alpha})`;
    ctx.fill();
  }

  // ── Layer 3: Haversian canals — concentric osteon rings ──
  for (let i = 0; i < 55; i++) {
    const cx = Math.random() * w, cy = Math.random() * h;
    const rings = Math.floor(Math.random() * 3) + 2;
    for (let r = rings; r >= 1; r--) {
      const rad   = r * (Math.random() * 4 + 2.5);
      const alpha = (0.12 - r * 0.015) * (Math.random() * 0.5 + 0.75);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(90,60,25,${alpha})`;
      ctx.lineWidth   = 0.6;
      ctx.stroke();
    }
    // Haversian canal centre dot
    ctx.beginPath();
    ctx.arc(cx, cy, Math.random() * 1.2 + 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(60,38,15,${Math.random() * 0.25 + 0.1})`;
    ctx.fill();
  }

  // ── Layer 4: Fine periosteal striations (bone fiber direction) ──
  for (let i = 0; i < 22; i++) {
    const x0  = Math.random() * w;
    const wob = (Math.random() - 0.5) * 18;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.bezierCurveTo(x0 + wob * 0.3, h * 0.25, x0 - wob * 0.3, h * 0.75, x0 + wob, h);
    ctx.strokeStyle = `rgba(100,70,28,${Math.random() * 0.05 + 0.015})`;
    ctx.lineWidth   = Math.random() * 1.2 + 0.3;
    ctx.stroke();
  }

  // ── Layer 5: Micro-pore scatter ──
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const r = Math.random() * 0.9 + 0.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,52,18,${Math.random() * 0.12 + 0.02})`;
    ctx.fill();
  }

  // ── Layer 6: Bright specular highlight streak (cortical gloss) ──
  const specGrad = ctx.createLinearGradient(w * 0.25, 0, w * 0.55, h);
  specGrad.addColorStop(0,   'rgba(255,252,245,0.18)');
  specGrad.addColorStop(0.2, 'rgba(255,248,235,0.09)');
  specGrad.addColorStop(0.5, 'rgba(255,245,220,0.03)');
  specGrad.addColorStop(1,   'rgba(0,0,0,0.07)');
  ctx.fillStyle = specGrad;
  ctx.fillRect(0, 0, w, h);

  return new THREE.CanvasTexture(canvas);
}

// Bump/normal-like texture for surface relief
function makeBoneBumpTexture(w = 256, h = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#aaa';
  ctx.fillRect(0, 0, w, h);

  // Osteon ring bumps
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * w, cy = Math.random() * h;
    const r  = Math.random() * 12 + 5;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0,   'rgba(220,220,220,0.8)');
    grd.addColorStop(0.6, 'rgba(140,140,140,0.4)');
    grd.addColorStop(1,   'rgba(80,80,80,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  // Fine noise
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const v = Math.floor(Math.random() * 70 + 110);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return new THREE.CanvasTexture(canvas);
}


/* ═══════════════════════════════════════════════════════
   ANATOMICAL KNEE GEOMETRIES — HIGH-FIDELITY SCULPTED
═══════════════════════════════════════════════════════ */

/* ── 1. DISTAL FEMUR ── */
function buildFemurGeometry() {
  // Femoral shaft profile (with natural anterior bow and distal metaphysis flare)
  const shaftPoints = [
    new THREE.Vector2(0.38, 3.2),
    new THREE.Vector2(0.39, 2.7),
    new THREE.Vector2(0.40, 2.2),
    new THREE.Vector2(0.42, 1.7),
    new THREE.Vector2(0.46, 1.3),
    new THREE.Vector2(0.54, 0.9),
    new THREE.Vector2(0.68, 0.5),
    new THREE.Vector2(0.82, 0.1),
    new THREE.Vector2(0.92, -0.25),
    new THREE.Vector2(0.85, -0.55),
    new THREE.Vector2(0.65, -0.75),
    new THREE.Vector2(0.35, -0.85)
  ];
  const shaftGeo = new THREE.LatheGeometry(shaftPoints, 32);
  // Slight anterior curve to the shaft
  const pos = shaftGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.5) {
      const curve = Math.sin((y - 0.5) / 2.7 * Math.PI) * 0.12;
      pos.setZ(i, pos.getZ(i) + curve);
    }
  }
  shaftGeo.computeVertexNormals();

  // Medial Condyle (larger, extends further backwards and slightly lower)
  const medCondyle = new THREE.SphereGeometry(0.58, 24, 20);
  medCondyle.scale(0.82, 0.95, 1.35);
  medCondyle.rotateX(0.12);
  medCondyle.translate(-0.48, -0.92, -0.15);

  // Lateral Condyle (flatter, slightly broader)
  const latCondyle = new THREE.SphereGeometry(0.54, 24, 20);
  latCondyle.scale(0.88, 0.90, 1.25);
  latCondyle.rotateX(0.08);
  latCondyle.translate(0.48, -0.88, -0.12);

  // Anterior Trochlear Groove (Patellar surface saddle between condyles)
  const trochlea = new THREE.CylinderGeometry(0.32, 0.42, 0.85, 20, 4, true, -Math.PI*0.35, Math.PI*0.7);
  trochlea.rotateZ(Math.PI / 2);
  trochlea.rotateX(0.35);
  trochlea.scale(1.2, 0.6, 0.9);
  trochlea.translate(0, -0.52, 0.48);

  // Medial Epicondyle prominence
  const medEpicondyle = new THREE.SphereGeometry(0.24, 12, 10);
  medEpicondyle.scale(0.7, 1.1, 0.9);
  medEpicondyle.translate(-0.88, -0.45, 0.0);

  // Lateral Epicondyle prominence
  const latEpicondyle = new THREE.SphereGeometry(0.22, 12, 10);
  latEpicondyle.scale(0.7, 1.1, 0.9);
  latEpicondyle.translate(0.86, -0.45, 0.0);

  return mergeBufferGeometries([shaftGeo, medCondyle, latCondyle, trochlea, medEpicondyle, latEpicondyle]);
}

/* ── 2. PROXIMAL TIBIA ── */
function buildTibiaGeometry() {
  // Tibial shaft (triangular cross-section tapering down with anterior crest)
  const shaftPoints = [
    new THREE.Vector2(0.92,  0.85),
    new THREE.Vector2(0.88,  0.65),
    new THREE.Vector2(0.72,  0.25),
    new THREE.Vector2(0.55, -0.20),
    new THREE.Vector2(0.44, -0.70),
    new THREE.Vector2(0.38, -1.30),
    new THREE.Vector2(0.34, -2.00),
    new THREE.Vector2(0.32, -2.80),
    new THREE.Vector2(0.30, -3.40)
  ];
  const shaftGeo = new THREE.LatheGeometry(shaftPoints, 30);
  // Add prominent anterior crest (shin ridge)
  const pos = shaftGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (z > 0 && y < 0.2 && y > -2.8) {
      const ridge = (1.0 - Math.abs(pos.getX(i)) / 0.4) * 0.14 * (1.0 - (y + 2.8) / 3.0);
      if (ridge > 0) pos.setZ(i, z + ridge);
    }
  }
  shaftGeo.computeVertexNormals();

  // Medial Tibial Condyle (oval concave plateau facet)
  const medPlateau = new THREE.CylinderGeometry(0.56, 0.52, 0.35, 24);
  medPlateau.scale(0.9, 1.0, 1.15);
  medPlateau.translate(-0.46, 0.88, -0.05);

  // Lateral Tibial Condyle (circular plateau facet)
  const latPlateau = new THREE.CylinderGeometry(0.52, 0.48, 0.35, 24);
  latPlateau.scale(1.0, 1.0, 1.05);
  latPlateau.translate(0.46, 0.88, -0.05);

  // Intercondylar Eminence (central tibial spines between plateaus)
  const spineMed = new THREE.ConeGeometry(0.12, 0.38, 12);
  spineMed.translate(-0.10, 1.15, -0.05);
  const spineLat = new THREE.ConeGeometry(0.11, 0.34, 12);
  spineLat.translate(0.08, 1.13, -0.05);

  // Anterior Tibial Tuberosity (teardrop prominence for patellar tendon insertion)
  const tuberosity = new THREE.SphereGeometry(0.28, 16, 12);
  tuberosity.scale(1.1, 1.6, 0.9);
  tuberosity.translate(0.0, 0.05, 0.65);

  // Posterolateral Fibular Articular Facet on lateral tibial condyle
  const fibFacet = new THREE.SphereGeometry(0.18, 12, 10);
  fibFacet.scale(0.8, 1.0, 1.2);
  fibFacet.translate(0.82, 0.65, -0.32);

  return mergeBufferGeometries([shaftGeo, medPlateau, latPlateau, spineMed, spineLat, tuberosity, fibFacet]);
}

/* ── 3. FIBULA (Head, Neck & Shaft) ── */
function buildFibulaGeometry() {
  // Fibular Head (Caput Fibulae) — irregular rounded block
  const head = new THREE.SphereGeometry(0.26, 16, 14);
  head.scale(0.95, 1.2, 1.1);
  head.translate(0.96, 0.68, -0.30);

  // Styloid Process (Apex capitis fibulae — pointing upward for LCL attachment)
  const styloid = new THREE.ConeGeometry(0.09, 0.28, 10);
  styloid.translate(0.98, 0.90, -0.32);

  // Fibular Neck & Slender 4-sided Shaft
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.96,  0.60, -0.30),
    new THREE.Vector3(0.94,  0.10, -0.28),
    new THREE.Vector3(0.92, -0.80, -0.25),
    new THREE.Vector3(0.90, -1.80, -0.22),
    new THREE.Vector3(0.88, -2.80, -0.20),
    new THREE.Vector3(0.86, -3.40, -0.18)
  ]);
  const shaft = new THREE.TubeGeometry(shaftCurve, 32, 0.11, 10, false);

  return mergeBufferGeometries([head, styloid, shaft]);
}

/* ── 4. PATELLA (Sesamoid Kneecap) ── */
function buildPatellaGeometry() {
  // Inverted rounded shield/sesamoid body
  const body = new THREE.SphereGeometry(0.55, 24, 20);
  body.scale(1.05, 1.25, 0.62);

  // Pointed inferior apex
  const apex = new THREE.ConeGeometry(0.28, 0.45, 16);
  apex.rotateX(Math.PI);
  apex.scale(1.1, 1.0, 0.6);
  apex.translate(0, -0.52, 0.02);

  // Posterior vertical ridge (separates medial & lateral facets)
  const ridge = new THREE.CylinderGeometry(0.06, 0.04, 0.8, 10);
  ridge.translate(0, 0.05, -0.22);

  return mergeBufferGeometries([body, apex, ridge]);
}

/* ── 5. QUADRICEPS & PATELLAR TENDONS ── */
function buildTendonGeometry() {
  // Patellar Tendon (Ligamentum Patellae) — heavy strap from patella apex down to tibial tuberosity
  const patTendonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.0,  0.05, 1.40),
    new THREE.Vector3( 0.0, -0.35, 1.30),
    new THREE.Vector3( 0.0, -0.75, 1.08),
    new THREE.Vector3( 0.0, -0.92, 0.72)
  ]);
  // Use a ribbon-like flat tube
  const patTendon = new THREE.TubeGeometry(patTendonCurve, 20, 0.16, 12, false);
  patTendon.scale(1.6, 1.0, 0.45); // Flatten into a broad strap

  // Quadriceps Tendon — broad tendon extending superiorly from patella base
  const quadTendonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.0, 0.65, 1.35),
    new THREE.Vector3( 0.0, 1.20, 1.18),
    new THREE.Vector3( 0.0, 1.85, 0.90),
    new THREE.Vector3( 0.0, 2.40, 0.68)
  ]);
  const quadTendon = new THREE.TubeGeometry(quadTendonCurve, 20, 0.18, 12, false);
  quadTendon.scale(1.8, 1.0, 0.38);

  return mergeBufferGeometries([patTendon, quadTendon]);
}

/* ── 6. ARTICULAR CARTILAGE ── */
function buildCartilageGeometry() {
  // Medial femoral condyle cartilage cap
  const femCartMed = new THREE.SphereGeometry(0.59, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
  femCartMed.scale(0.83, 0.96, 1.36);
  femCartMed.rotateX(0.12);
  femCartMed.translate(-0.48, -0.93, -0.15);

  // Lateral femoral condyle cartilage cap
  const femCartLat = new THREE.SphereGeometry(0.55, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
  femCartLat.scale(0.89, 0.91, 1.26);
  femCartLat.rotateX(0.08);
  femCartLat.translate(0.48, -0.89, -0.12);

  // Medial tibial plateau articular cartilage facet
  const tibCartMed = new THREE.CylinderGeometry(0.48, 0.46, 0.07, 24);
  tibCartMed.scale(0.9, 1.0, 1.15);
  tibCartMed.translate(-0.46, 0.06, -0.05);

  // Lateral tibial plateau articular cartilage facet
  const tibCartLat = new THREE.CylinderGeometry(0.44, 0.42, 0.07, 24);
  tibCartLat.scale(1.0, 1.0, 1.05);
  tibCartLat.translate(0.46, 0.06, -0.05);

  return mergeBufferGeometries([femCartMed, femCartLat, tibCartMed, tibCartLat]);
}

/* ── 7. MENISCI (Medial & Lateral Wedged C-Rings) ── */
function buildMeniscusGeometry() {
  // Medial Meniscus (larger semi-circular C-shape)
  const medCurve = new THREE.EllipseCurve(-0.46, -0.05, 0.44, 0.52, -Math.PI * 0.65, Math.PI * 0.65, false, 0);
  const medPoints = medCurve.getPoints(28);
  const medVecs = medPoints.map(p => new THREE.Vector3(p.x, 0.0, p.y));
  const medMen = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(medVecs), 28, 0.11, 10, false);
  medMen.scale(1.0, 0.65, 1.0); // Wedge profile

  // Lateral Meniscus (almost complete circular ring)
  const latCurve = new THREE.EllipseCurve(0.46, -0.05, 0.38, 0.42, -Math.PI * 0.85, Math.PI * 0.85, false, 0);
  const latPoints = latCurve.getPoints(28);
  const latVecs = latPoints.map(p => new THREE.Vector3(p.x, 0.0, p.y));
  const latMen = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(latVecs), 28, 0.10, 10, false);
  latMen.scale(1.0, 0.65, 1.0);

  return mergeBufferGeometries([medMen, latMen]);
}

/* ── 8. LIGAMENTS (ACL, PCL, MCL, LCL) ── */
function buildLigamentGeometry() {
  // ACL — anterior intercondylar tibia to medial side of lateral femoral condyle
  const aclCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.06, -0.15,  0.22),
    new THREE.Vector3( 0.08,  0.10,  0.02),
    new THREE.Vector3( 0.28,  0.42, -0.18)
  ]);
  const acl = new THREE.TubeGeometry(aclCurve, 16, 0.058, 8, false);

  // PCL — posterior intercondylar tibia to lateral side of medial femoral condyle
  const pclCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.04, -0.18, -0.24),
    new THREE.Vector3(-0.08,  0.12, -0.06),
    new THREE.Vector3(-0.24,  0.40,  0.12)
  ]);
  const pcl = new THREE.TubeGeometry(pclCurve, 16, 0.054, 8, false);

  // MCL (Medial Collateral Ligament) — broad flat medial band
  const mclCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.84,  0.80,  0.00),
    new THREE.Vector3(-0.88,  0.15,  0.04),
    new THREE.Vector3(-0.82, -0.75,  0.02)
  ]);
  const mcl = new THREE.TubeGeometry(mclCurve, 16, 0.052, 8, false);
  mcl.scale(0.5, 1.0, 1.4); // Flat band

  // LCL (Lateral Collateral Ligament) — lateral femoral epicondyle straight to FIBULAR HEAD!
  const lclCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.84,  0.78,  0.00),
    new THREE.Vector3( 0.90,  0.20, -0.12),
    new THREE.Vector3( 0.96, -0.32, -0.28) // Inserts into the fibular head
  ]);
  const lcl = new THREE.TubeGeometry(lclCurve, 16, 0.048, 8, false);

  return mergeBufferGeometries([acl, pcl, mcl, lcl]);
}

/* ═══════════════════════════════════════════════════════
   MERGE BUFFER GEOMETRIES (robust manual merger)
═══════════════════════════════════════════════════════ */
function mergeBufferGeometries(geos) {
  let totalVerts = 0, totalIdx = 0;
  geos.forEach(g => {
    totalVerts += g.attributes.position.count;
    if (g.index) totalIdx += g.index.count;
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals   = new Float32Array(totalVerts * 3);
  const uvs       = new Float32Array(totalVerts * 2);
  const indices   = totalIdx > 0 ? new Uint32Array(totalIdx) : null;

  let vOffset = 0, iOffset = 0, idxBase = 0;

  geos.forEach(g => {
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal ? g.attributes.normal.array : null;
    const uv  = g.attributes.uv     ? g.attributes.uv.array     : null;
    const cnt = g.attributes.position.count;

    positions.set(pos, vOffset * 3);
    if (nor) normals.set(nor, vOffset * 3);
    if (uv)  uvs.set(uv, vOffset * 2);

    if (indices && g.index) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) {
        indices[iOffset++] = src[i] + idxBase;
      }
    }
    idxBase += cnt;
    vOffset += cnt;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal',   new THREE.BufferAttribute(normals,   3));
  merged.setAttribute('uv',       new THREE.BufferAttribute(uvs,       2));
  if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();
  return merged;
}


/* ═══════════════════════════════════════════════════════
   INIT THREE.JS VIEWER
═══════════════════════════════════════════════════════ */
function initThreeViewer() {
  const canvas = document.getElementById('knee-canvas');
  const wrap   = document.getElementById('viewer-canvas-wrap');

  // ── Scene ──
  scene = new THREE.Scene();
  const savedTheme = localStorage.getItem('kneeai-theme') || 'light';
  const initialThemeConfig = THEMES[savedTheme] || THEMES.light;
  scene.background = new THREE.Color(initialThemeConfig.sceneBg);
  scene.fog = new THREE.FogExp2(initialThemeConfig.fogColor, initialThemeConfig.fogDensity);

  // ── Camera ──
  camera = new THREE.PerspectiveCamera(38, wrap.clientWidth / wrap.clientHeight, 0.05, 200);
  updateCamera();

  // ── Renderer ──
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  renderer.shadowMap.enabled   = true;
  renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.65;
  renderer.physicallyCorrectLights = true;

  // ── Lighting ──
  setupLighting();

  // ── Environment ──
  buildEnvironment();

  // ── Build knee model ──
  boneGroup = new THREE.Group();
  scene.add(boneGroup);
  buildAdvancedKnee();

  // ── Interaction ──
  raycaster = new THREE.Raycaster();
  mouse     = new THREE.Vector2();
  setupMouseControls(canvas);

  // ── Animate ──
  (function animLoop() {
    requestAnimationFrame(animLoop);
    animateDiseased();
    if (autoRotateActive) {
      spherical.theta += 0.007;
      updateCamera();
    }
    updateAnnotationPins();
    renderer.render(scene, camera);
  })();

  // ── Resize ──
  window.addEventListener('resize', () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

function updateCamera() {
  const { theta, phi, radius } = spherical;
  camera.position.set(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi) + 0.5,
    radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(0, 0.5, 0);
}

/* ═══════════════════════════════════════════════════════
   LIGHTING SETUP
═══════════════════════════════════════════════════════ */
function setupLighting() {
  // PRIMARY KEY — surgical overhead lamp, strong warm white
  const key = new THREE.SpotLight(0xFFFBF0, 6.5, 35, Math.PI / 4.5, 0.28, 1.2);
  key.position.set(3, 10, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far  = 35;
  key.shadow.bias = -0.0002;
  scene.add(key);
  scene.add(key.target);

  // SECONDARY KEY — second overhead spot from left, slightly cooler
  const key2 = new THREE.SpotLight(0xF0F8FF, 4.0, 30, Math.PI / 5, 0.40, 1.2);
  key2.position.set(-4, 8, 3);
  scene.add(key2);
  scene.add(key2.target);

  // FRONT FILL — face-on warm ivory fill so bones pop forward
  const front = new THREE.DirectionalLight(0xFFF8EC, 2.2);
  front.position.set(0, 2, 12);
  scene.add(front);

  // FILL LIGHT — cool blue from left (medical room ambient)
  const fill = new THREE.DirectionalLight(0xC8E0F8, 1.4);
  fill.position.set(-7, 4, -3);
  scene.add(fill);

  // RIM LIGHT — teal edge glow from behind-right
  const rim = new THREE.DirectionalLight(0x0EA5A4, 1.1);
  rim.position.set(-3, -1, 6);
  scene.add(rim);

  // BACK LIGHT — subtle purple separation from behind
  const back = new THREE.DirectionalLight(0x8090D8, 0.55);
  back.position.set(0, -4, -10);
  scene.add(back);

  // HEMISPHERE — warm sky + warm ground (key for ivory bone tones)
  const amb = new THREE.HemisphereLight(0xEEE8D8, 0x302010, 1.2);
  scene.add(amb);

  // UNDER-GLOW — soft teal bounce from floor
  const under = new THREE.PointLight(0x20B0A8, 0.7, 12);
  under.position.set(0, -3.5, 0);
  scene.add(under);

  // CLOSE FRONT POINT — warm fill right at bone level
  const close = new THREE.PointLight(0xFFEED8, 1.8, 8);
  close.position.set(0.5, 0.5, 5);
  scene.add(close);
}


/* ═══════════════════════════════════════════════════════
   ENVIRONMENT — operating table + particles
═══════════════════════════════════════════════════════ */
function buildEnvironment() {
  // Reflective floor — stored globally so theme can update its color
  const floorGeo = new THREE.CircleGeometry(8, 48);
  window._floorMat = new THREE.MeshStandardMaterial({
    color:     0x0D2030,
    roughness: 0.12,
    metalness: 0.65,
    transparent: true, opacity: 0.55
  });
  const floor = new THREE.Mesh(floorGeo, window._floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4;
  floor.receiveShadow = true;
  scene.add(floor);

  // Floating particles
  const particleGeo = new THREE.BufferGeometry();
  const particleCount = 120;
  const pPos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const r = 3 + Math.random() * 5;
    const a = Math.random() * Math.PI * 2;
    pPos[i * 3 + 0] = Math.cos(a) * r;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    pPos[i * 3 + 2] = Math.sin(a) * r;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0x0EA5A4, size: 0.04, transparent: true, opacity: 0.5 });
  scene.add(new THREE.Points(particleGeo, particleMat));
}

/* ═══════════════════════════════════════════════════════
   BUILD ADVANCED KNEE
═══════════════════════════════════════════════════════ */
function buildAdvancedKnee() {
  // Warm ivory bone textures — distinct natural osseous tints
  const boneTex   = makeBoneTexture(512, 512, [248, 237, 212]);  // femur — warm osseous cream
  const boneTexT  = makeBoneTexture(512, 512, [242, 228, 200]);  // tibia & fibula — slightly cooler
  const boneTexP  = makeBoneTexture(512, 512, [252, 242, 220]);  // patella — lightest
  const bumpTex   = makeBoneBumpTexture(256, 256);               // osteon relief bump map

  // Shared bone material factory — MeshPhysicalMaterial with clearcoat cortical shine
  function makeBoneMat(map, color) {
    return new THREE.MeshPhysicalMaterial({
      map,
      bumpMap:            bumpTex,
      bumpScale:          0.032,
      color,
      emissive:           new THREE.Color(0x3A2808),
      emissiveIntensity:  0.08,
      roughness:          0.42,
      metalness:          0.0,
      clearcoat:          0.45,
      clearcoatRoughness: 0.45,
      reflectivity:       0.18,
      envMapIntensity:    0.5,
      side: THREE.FrontSide,
    });
  }

  // ── 1. FEMUR ──
  const femurGeo = buildFemurGeometry();
  const femurMat = makeBoneMat(boneTex, 0xF0E0C0);
  const femur = new THREE.Mesh(femurGeo, femurMat);
  femur.position.set(0, 1.45, 0);
  femur.castShadow = true; femur.receiveShadow = true;
  femur.userData = { bone: 'femur', origPos: femur.position.clone() };
  boneGroup.add(femur);
  bones.femur = femur;

  // ── 2. TIBIA ──
  const tibiaGeo = buildTibiaGeometry();
  const tibiaMat = makeBoneMat(boneTexT, 0xE8D4AC);
  const tibia = new THREE.Mesh(tibiaGeo, tibiaMat);
  tibia.position.set(0, -1.45, -0.05);
  tibia.castShadow = true; tibia.receiveShadow = true;
  tibia.userData = { bone: 'tibia', origPos: tibia.position.clone() };
  boneGroup.add(tibia);
  bones.tibia = tibia;

  // ── 3. FIBULA (Lateral Head & Shaft) ──
  const fibGeo = buildFibulaGeometry();
  const fibMat = makeBoneMat(boneTexT, 0xE6D0A8);
  const fibula = new THREE.Mesh(fibGeo, fibMat);
  fibula.position.set(0, -1.45, -0.05);
  fibula.castShadow = true; fibula.receiveShadow = true;
  fibula.userData = { bone: 'fibula', origPos: fibula.position.clone() };
  boneGroup.add(fibula);
  bones.fibula = fibula;

  // ── 4. PATELLA ──
  const patGeo = buildPatellaGeometry();
  const patMat = makeBoneMat(boneTexP, 0xF5E8C8);
  patMat.clearcoat = 0.48;
  patMat.clearcoatRoughness = 0.38;
  const patella = new THREE.Mesh(patGeo, patMat);
  patella.position.set(0, 0.32, 1.35);
  patella.castShadow = true; patella.receiveShadow = true;
  patella.userData = { bone: 'patella', origPos: patella.position.clone() };
  boneGroup.add(patella);
  bones.patella = patella;

  // ── 5. TENDONS (Quadriceps & Patellar Tendon Straps) ──
  const tendonGeo = buildTendonGeometry();
  const tendonMat = new THREE.MeshPhysicalMaterial({
    color:              0xF2ECE2,
    roughness:          0.50,
    metalness:          0.0,
    clearcoat:          0.30,
    clearcoatRoughness: 0.50,
    emissive:           new THREE.Color(0x201810),
    emissiveIntensity:  0.06,
    side:               THREE.DoubleSide,
  });
  const tendons = new THREE.Mesh(tendonGeo, tendonMat);
  tendons.position.set(0, 0, 0);
  tendons.castShadow = true; tendons.receiveShadow = true;
  tendons.userData = { bone: 'tendons', origPos: tendons.position.clone() };
  boneGroup.add(tendons);
  bones.tendons = tendons;

  // ── 6. ARTICULAR CARTILAGE ──
  const cartGeo = buildCartilageGeometry();
  const cartMat = new THREE.MeshPhysicalMaterial({
    color:        0xC2E2F8,
    roughness:    0.15,
    metalness:    0.0,
    transmission: 0.45,
    thickness:    0.25,
    transparent:  true,
    opacity:      0.78,
    ior:          1.38,
    emissive:     new THREE.Color(0x003060),
    emissiveIntensity: 0.25,
    side:         THREE.DoubleSide,
  });
  const cartilage = new THREE.Mesh(cartGeo, cartMat);
  cartilage.position.set(0, 0.42, 0.0);
  cartilage.castShadow = false; cartilage.receiveShadow = true;
  cartilage.userData = { bone: 'cartilage', origPos: cartilage.position.clone() };
  boneGroup.add(cartilage);
  bones.cartilage = cartilage;

  // ── 7. MENISCI (Medial & Lateral Wedges) ──
  const menGeo = buildMeniscusGeometry();
  const menMat = new THREE.MeshStandardMaterial({
    color:     0xCC3333,
    roughness: 0.65,
    metalness: 0.0,
    emissive:  new THREE.Color(0x750000),
    emissiveIntensity: 0.45,
    side:      THREE.DoubleSide,
  });
  const meniscus = new THREE.Mesh(menGeo, menMat);
  meniscus.position.set(0, 0.45, 0.0);
  meniscus.castShadow = true; meniscus.receiveShadow = true;
  meniscus.userData = { bone: 'meniscus', origPos: meniscus.position.clone() };
  boneGroup.add(meniscus);
  bones.meniscus = meniscus;

  // Disease glow light for meniscus
  const diseaseLight = new THREE.PointLight(0xFF2200, 0.6, 3);
  diseaseLight.position.set(-0.46, 0.5, 0.5);
  meniscus.add(diseaseLight);
  meniscus.userData.diseaseLight = diseaseLight;

  // Cartilage damage aura
  const cartLight = new THREE.PointLight(0xFF6600, 0.35, 2.5);
  cartLight.position.set(0, 0.5, 0.5);
  cartilage.add(cartLight);
  cartilage.userData.diseaseLight = cartLight;

  // ── 8. LIGAMENTS (ACL, PCL, MCL, LCL) ──
  const ligGeo = buildLigamentGeometry();
  const ligMat = new THREE.MeshStandardMaterial({
    color:       0xD4B88E,
    roughness:   0.68,
    metalness:   0.0,
    transparent: true,
    opacity:     0.92,
  });
  const ligaments = new THREE.Mesh(ligGeo, ligMat);
  ligaments.position.set(0, 0.42, 0);
  ligaments.castShadow = true;
  ligaments.userData = { bone: 'ligaments', origPos: ligaments.position.clone() };
  boneGroup.add(ligaments);
  bones.ligaments = ligaments;

  // Store explode targets
  Object.entries(bones).forEach(([key, mesh]) => {
    if (BONE_DATA[key]) {
      mesh.userData.explodeTarget = BONE_DATA[key].explodeDir.clone();
    }
  });

  // Initialize interactive 3D annotations
  initAnnotations();
}

/* ═══════════════════════════════════════════════════════
   3D ANNOTATIONS ENGINE (Sketchfab-Style Pins & Selector)
═══════════════════════════════════════════════════════ */
const pinElements = [];
function initAnnotations() {
  const container = document.getElementById('annotation-pins-container');
  if (!container) return;
  container.innerHTML = '';
  pinElements.length = 0;

  ANNOTATIONS.forEach(anno => {
    const pin = document.createElement('div');
    pin.className = 'anno-pin';
    pin.dataset.id = anno.id;
    pin.innerHTML = `
      <div class="anno-pin-ring"></div>
      <div class="anno-pin-badge">${anno.id}</div>
      <div class="anno-tooltip">${anno.name}</div>
    `;
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      selectAnnotation(anno.id);
    });
    container.appendChild(pin);
    pinElements.push({ el: pin, data: anno });
  });

  // Bottom annotation bar events
  const prevBtn   = document.getElementById('anno-prev');
  const nextBtn   = document.getElementById('anno-next');
  const dispBtn   = document.getElementById('anno-display');
  const toggleBtn = document.getElementById('tb-annotations');

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateAnnotation(-1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateAnnotation(1);
    });
  }
  if (dispBtn) {
    dispBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateAnnotation(1);
    });
  }
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      state.annotations = !state.annotations;
      this.classList.toggle('active', state.annotations);
      container.classList.toggle('hidden', !state.annotations);
      const bar = document.getElementById('annotation-bar');
      if (bar) bar.style.display = state.annotations ? 'flex' : 'none';
      showToast(state.annotations ? '🏷️ Annotations enabled' : 'Annotations hidden', 'info');
    });
  }
}

function updateAnnotationPins() {
  if (!state.annotations || !camera || !boneGroup) return;
  const wrap = document.getElementById('viewer-canvas-wrap');
  if (!wrap) return;

  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  const wp = new THREE.Vector3();

  pinElements.forEach(({ el, data }) => {
    wp.copy(data.pos);
    wp.applyMatrix4(boneGroup.matrixWorld);

    // Project 3D position to Normalized Device Coordinates (NDC)
    const p = wp.clone().project(camera);

    // Check if behind camera or out of bounds
    if (p.z > 1.0 || p.x < -1.1 || p.x > 1.1 || p.y < -1.1 || p.y > 1.1) {
      el.style.display = 'none';
      return;
    }

    el.style.display = 'flex';
    const x = (p.x * 0.5 + 0.5) * w;
    const y = (-(p.y * 0.5) + 0.5) * h;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
  });
}

let targetCamera = null;
function selectAnnotation(id) {
  const anno = ANNOTATIONS.find(a => a.id === id);
  if (!anno) return;

  state.activeAnnotation = id;

  // Update pin active styling
  pinElements.forEach(({ el, data }) => {
    el.classList.toggle('active', data.id === id);
  });

  // Update bottom annotation bar
  const titleText = document.getElementById('anno-title-text');
  const badgeIcon = document.getElementById('anno-badge-icon');
  if (titleText) titleText.textContent = `${anno.id}. ${anno.name}`;
  if (badgeIcon) badgeIcon.textContent = anno.icon;

  // Smooth camera orbit to optimal view
  if (anno.cam) {
    targetCamera = { ...anno.cam };
    animateCameraTo(targetCamera.theta, targetCamera.phi, targetCamera.radius);
  }

  // Highlight structure and open diagnostic card
  selectBone(anno.bone);
}

function navigateAnnotation(direction) {
  let currentIndex = ANNOTATIONS.findIndex(a => a.id === state.activeAnnotation);
  if (currentIndex === -1) currentIndex = direction > 0 ? -1 : 0;
  let nextIndex = (currentIndex + direction + ANNOTATIONS.length) % ANNOTATIONS.length;
  selectAnnotation(ANNOTATIONS[nextIndex].id);
}

function animateCameraTo(targetTheta, targetPhi, targetRadius) {
  const startTheta  = spherical.theta;
  const startPhi    = spherical.phi;
  const startRadius = spherical.radius;
  const startTime   = performance.now();
  const duration    = 800; // ms

  // Normalize theta difference for shortest rotation
  let dTheta = targetTheta - (startTheta % (Math.PI * 2));
  while (dTheta > Math.PI)  dTheta -= Math.PI * 2;
  while (dTheta < -Math.PI) dTheta += Math.PI * 2;

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
    spherical.theta  = startTheta + dTheta * ease;
    spherical.phi    = startPhi + (targetPhi - startPhi) * ease;
    spherical.radius = startRadius + (targetRadius - startRadius) * ease;
    updateCamera();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}


/* ═══════════════════════════════════════════════════════
   ANIMATED DISEASE PULSE
═══════════════════════════════════════════════════════ */
function animateDiseased() {
  diseasePhase += 0.03;
  const pulse  = 0.35 + Math.sin(diseasePhase) * 0.25;
  const pulse2 = 0.2  + Math.sin(diseasePhase * 1.3 + 1) * 0.15;

  if (bones.meniscus?.material) {
    bones.meniscus.material.emissiveIntensity = state.boneVisibility.meniscus ? pulse : 0;
    if (bones.meniscus.userData.diseaseLight)
      bones.meniscus.userData.diseaseLight.intensity = state.boneVisibility.meniscus ? pulse * 0.8 : 0;
  }
  if (bones.cartilage?.material) {
    bones.cartilage.material.emissiveIntensity = state.boneVisibility.cartilage ? pulse2 : 0;
    if (bones.cartilage.userData.diseaseLight)
      bones.cartilage.userData.diseaseLight.intensity = state.boneVisibility.cartilage ? pulse2 * 0.5 : 0;
  }
}

/* ═══════════════════════════════════════════════════════
   MOUSE CONTROLS — rotate, zoom, click
═══════════════════════════════════════════════════════ */
function setupMouseControls(canvas) {
  let isDragging = false, prevX = 0, prevY = 0, moved = false;

  canvas.addEventListener('mousedown', e => {
    isDragging = true; moved = false;
    prevX = e.clientX; prevY = e.clientY;
  });

  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - prevX, dy = e.clientY - prevY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    spherical.theta -= dx * 0.007;
    spherical.phi    = Math.max(0.15, Math.min(Math.PI - 0.15, spherical.phi + dy * 0.006));
    prevX = e.clientX; prevY = e.clientY;
    updateCamera();
  });

  canvas.addEventListener('mouseup', e => {
    if (!moved) handleBoneClick(e);
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => { isDragging = false; });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    spherical.radius = Math.max(3.5, Math.min(22, spherical.radius + e.deltaY * 0.018));
    updateCamera();
  }, { passive: false });

  // Touch support
  let lastTouchDist = null;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else {
      isDragging = true; moved = false;
      prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
    }
  });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist) {
        spherical.radius = Math.max(3.5, Math.min(22, spherical.radius - (dist - lastTouchDist) * 0.02));
        updateCamera();
      }
      lastTouchDist = dist;
    } else if (isDragging) {
      const dx = e.touches[0].clientX - prevX, dy = e.touches[0].clientY - prevY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      spherical.theta -= dx * 0.007;
      spherical.phi    = Math.max(0.15, Math.min(Math.PI - 0.15, spherical.phi + dy * 0.006));
      prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
      updateCamera();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => { isDragging = false; lastTouchDist = null; });
}

/* ═══════════════════════════════════════════════════════
   BONE CLICK → DETECT + HIGHLIGHT
═══════════════════════════════════════════════════════ */
function handleBoneClick(e) {
  const canvas = document.getElementById('knee-canvas');
  const rect   = canvas.getBoundingClientRect();
  mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top)  / rect.height)  * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(Object.values(bones), true);

  if (hits.length > 0) {
    let mesh = hits[0].object;
    // Walk up to find the bone mesh
    while (mesh.parent && !mesh.userData.bone) mesh = mesh.parent;
    if (mesh.userData.bone) {
      selectBone(mesh.userData.bone);
      return;
    }
  }
  deselectBone();
}

function selectBone(key) {
  // Reset previous
  if (selectedMesh) resetBoneHighlight(selectedMesh);

  selectedMesh = bones[key];
  state.selectedBone = key;

  // Highlight with teal emissive overlay
  applyHighlight(selectedMesh, key);
  showBonePopup(key);

  const hint = document.getElementById('viewer-hint');
  if (hint) hint.style.opacity = '0';
}

function applyHighlight(mesh, key) {
  if (!mesh || !mesh.material) return;
  mesh.material.emissive = new THREE.Color(0x00BFC4);
  mesh.material.emissiveIntensity = 0.5;
  // Outline ring
  addSelectionRing(mesh, key);
}

function resetBoneHighlight(mesh) {
  if (!mesh || !mesh.material) return;
  const key  = mesh.userData.bone;
  const data = BONE_DATA[key];
  if (key === 'meniscus') {
    mesh.material.emissive = new THREE.Color(0x6A0000);
  } else if (key === 'cartilage') {
    mesh.material.emissive = new THREE.Color(0x003060);
  } else if (key === 'ligaments') {
    mesh.material.emissive = new THREE.Color(0x000000);
    mesh.material.emissiveIntensity = 0;
  } else {
    mesh.material.emissive = new THREE.Color(0x000000);
    mesh.material.emissiveIntensity = 0;
  }
  removeSelectionRing(mesh);
}

const selectionRings = {};
function addSelectionRing(mesh, key) {
  removeSelectionRing(mesh);
  const ringGeo = new THREE.TorusGeometry(0.95, 0.02, 8, 60);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x0EA5A4, transparent: true, opacity: 0.85 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  ring.position.copy(mesh.getWorldPosition(new THREE.Vector3()));
  selectionRings[key] = ring;

  // Pulse opacity
  (function pulse() {
    if (!selectionRings[key]) return;
    requestAnimationFrame(pulse);
    ring.material.opacity = 0.5 + Math.sin(Date.now() * 0.004) * 0.35;
    ring.rotation.z += 0.01;
  })();
}

function removeSelectionRing(mesh) {
  const key = mesh?.userData?.bone;
  if (key && selectionRings[key]) {
    scene.remove(selectionRings[key]);
    delete selectionRings[key];
  }
}

function deselectBone() {
  if (selectedMesh) {
    resetBoneHighlight(selectedMesh);
    selectedMesh = null;
    state.selectedBone = null;
  }
  closeBonePopup();
  const hint = document.getElementById('viewer-hint');
  if (hint) hint.style.opacity = '1';
}

/* ═══════════════════════════════════════════════════════
   BONE POPUP
═══════════════════════════════════════════════════════ */
function showBonePopup(key) {
  const data  = BONE_DATA[key];
  const popup = document.getElementById('bone-popup');
  const chip  = document.getElementById('ps-disease-chip');
  const sev   = document.getElementById('ps-severity');

  document.getElementById('popup-bone-icon').textContent  = data.icon;
  document.getElementById('popup-bone-name').textContent  = data.name;
  document.getElementById('popup-bone-sub').textContent   = data.sub;
  document.getElementById('ps-surface').textContent       = data.surface;
  document.getElementById('ps-volume').textContent        = data.volume;
  document.getElementById('ps-vertices').textContent      = data.vertices;
  document.getElementById('ps-faces').textContent         = data.faces;
  document.getElementById('ps-confidence').style.width   = data.confidence + '%';
  document.getElementById('ps-conf-val').textContent      = data.confidence + '%';
  document.getElementById('ps-disease-text').textContent  = data.disease;
  document.getElementById('ps-severity').textContent      = data.severity;
  document.getElementById('ps-clinical').textContent      = data.clinical;

  chip.className = 'disease-status-chip ' + (data.diseased ? 'diseased' : 'healthy');
  chip.querySelector('.ds-icon').textContent = data.diseased ? '⚠' : '✓';
  sev.style.background = data.diseased ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)';
  sev.style.color      = data.diseased ? '#EF4444' : '#10B981';

  popup.classList.remove('hidden');
  document.getElementById('overlay-bg').classList.remove('hidden');
}

function closeBonePopup() {
  document.getElementById('bone-popup').classList.add('hidden');
  document.getElementById('overlay-bg').classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════
   GLB LOADER — drop a real knee.glb into the folder and
   call loadGLBModel('knee.glb') to swap the model
═══════════════════════════════════════════════════════ */
function loadGLBModel(url) {
  if (typeof THREE.GLTFLoader === 'undefined') {
    console.warn('GLTFLoader not loaded — using procedural model');
    return;
  }

  const loader = new THREE.GLTFLoader();
  showLoadingOverlay('Loading 3D Model…');

  loader.load(url, (gltf) => {
    // Remove old procedural group
    scene.remove(boneGroup);
    Object.keys(bones).forEach(k => delete bones[k]);

    const model = gltf.scene;
    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Try to match mesh names to known bones
        const nameLower = child.name.toLowerCase();
        const matched = Object.keys(BONE_DATA).find(k => nameLower.includes(k));
        if (matched) {
          child.userData.bone = matched;
          bones[matched] = child;
        }
        // Apply PBR upgrade
        if (child.material) {
          child.material.roughness   = 0.55;
          child.material.metalness   = 0.03;
          child.material.envMapIntensity = 0.4;
        }
      }
    });

    // Auto-scale & center
    const box    = new THREE.Box3().setFromObject(model);
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale  = 8 / maxDim;
    model.scale.setScalar(scale);
    model.position.sub(center.multiplyScalar(scale));

    scene.add(model);
    boneGroup = model;
    hideLoadingOverlay();
    showToast('✅ Real GLB model loaded successfully!', 'success');
  },
  xhr => {
    const pct = (xhr.loaded / xhr.total * 100).toFixed(0);
    updateLoadingOverlay(`Loading 3D Model… ${pct}%`);
  },
  err => {
    hideLoadingOverlay();
    showToast('⚠ Failed to load GLB — using procedural model', 'warn');
    console.error(err);
  });
}

function showLoadingOverlay(msg) {
  let el = document.getElementById('glb-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'glb-loading';
    el.style.cssText = `
      position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      background:rgba(10,21,32,0.85);backdrop-filter:blur(8px);z-index:50;
      font-size:14px;color:rgba(255,255,255,0.85);font-weight:600;letter-spacing:0.5px;
      border-radius:inherit;
    `;
    document.getElementById('viewer-canvas-wrap').appendChild(el);
  }
  el.textContent = msg;
}
function updateLoadingOverlay(msg) {
  const el = document.getElementById('glb-loading');
  if (el) el.textContent = msg;
}
function hideLoadingOverlay() {
  const el = document.getElementById('glb-loading');
  if (el) el.remove();
}

/* ═══════════════════════════════════════════════════════
   DRAG-AND-DROP GLB onto the viewer
═══════════════════════════════════════════════════════ */
function initDragDropGLB() {
  const wrap = document.getElementById('viewer-canvas-wrap');

  wrap.addEventListener('dragover', e => {
    e.preventDefault();
    wrap.style.outline = '2px dashed #0EA5A4';
  });
  wrap.addEventListener('dragleave', () => {
    wrap.style.outline = '';
  });
  wrap.addEventListener('drop', e => {
    e.preventDefault();
    wrap.style.outline = '';
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'glb' || ext === 'gltf') {
      const url = URL.createObjectURL(file);
      loadGLBModel(url);
    } else {
      showToast('⚠ Please drop a .glb or .gltf file', 'warn');
    }
  });
}

/* ═══════════════════════════════════════════════════════
   TOOLBAR CONTROLS
═══════════════════════════════════════════════════════ */
function initToolbar() {
  // Wireframe
  document.getElementById('tb-wireframe').addEventListener('click', function() {
    state.wireframe = !state.wireframe;
    this.classList.toggle('active', state.wireframe);
    Object.values(bones).forEach(b => { if (b.material) b.material.wireframe = state.wireframe; });
  });

  // X-Ray
  document.getElementById('tb-xray').addEventListener('click', function() {
    state.xray = !state.xray;
    this.classList.toggle('active', state.xray);
    const sliderVal = (parseFloat(document.getElementById('transparency-slider')?.value) || 0) / 100;
    Object.entries(bones).forEach(([k, b]) => {
      if (!b.material) return;
      const isCart = k === 'cartilage';
      b.material.transparent = state.xray || sliderVal > 0 || isCart;
      if (state.xray) {
        b.material.opacity = isCart ? 0.25 : 0.22;
      } else {
        b.material.opacity = isCart
          ? Math.max(0.08, 0.72 - sliderVal * 0.64)
          : Math.max(0.04, 1 - sliderVal * 0.96);
      }
    });
    const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const p = THEMES[curTheme] || THEMES.light;
    if (state.xray) {
      scene.background = new THREE.Color(0x00040A);
      if (scene.fog) {
        scene.fog.color.setHex(0x00040A);
        scene.fog.density = 0.025;
      }
    } else {
      scene.background = new THREE.Color(p.sceneBg);
      if (scene.fog) {
        scene.fog.color.setHex(p.fogColor);
        scene.fog.density = p.fogDensity;
      }
    }
  });

  // Exploded view
  document.getElementById('tb-explode').addEventListener('click', function() {
    state.exploded = !state.exploded;
    this.classList.toggle('active', state.exploded);
    animateExplode(state.exploded);
  });

  // Cross section
  document.getElementById('tb-section').addEventListener('click', function() {
    state.crossSection = !state.crossSection;
    this.classList.toggle('active', state.crossSection);
    if (state.crossSection) {
      renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
      renderer.localClippingEnabled = true;
    } else {
      renderer.clippingPlanes = [];
      renderer.localClippingEnabled = false;
    }
  });

  // Auto rotate
  document.getElementById('tb-autorotate').addEventListener('click', function() {
    autoRotateActive = !autoRotateActive;
    this.classList.toggle('active', autoRotateActive);
  });

  // Reset camera
  document.getElementById('tb-reset').addEventListener('click', () => {
    spherical.theta = 0.4; spherical.phi = 1.1; spherical.radius = 11;
    updateCamera();
    deselectBone();
  });

  // Fullscreen
  document.getElementById('tb-fullscreen').addEventListener('click', () => {
    const wrap = document.getElementById('viewer-canvas-wrap');
    if (!document.fullscreenElement) {
      wrap.requestFullscreen && wrap.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  });

  // Transparency slider
  document.getElementById('transparency-slider').addEventListener('input', function() {
    const val = this.value / 100;
    Object.entries(bones).forEach(([k, b]) => {
      if (!b.material) return;
      const isCart = k === 'cartilage';
      b.material.transparent = val > 0 || isCart;
      b.material.opacity     = isCart
        ? Math.max(0.08, 0.72 - val * 0.64)
        : Math.max(0.04, 1 - val * 0.96);
    });
  });
}

/* ═══════════════════════════════════════════════════════
   EXPLODE ANIMATION
═══════════════════════════════════════════════════════ */
function animateExplode(exploded) {
  const duration = 700;
  const start    = performance.now();
  const snapshots = {};
  Object.entries(bones).forEach(([k, b]) => { snapshots[k] = b.position.clone(); });

  function step(now) {
    const raw = (now - start) / duration;
    const t   = Math.min(raw, 1);
    const e   = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;

    Object.entries(bones).forEach(([k, b]) => {
      const from = snapshots[k];
      const orig = b.userData.origPos;
      const to   = exploded
        ? orig.clone().add(BONE_DATA[k].explodeDir)
        : orig;
      b.position.lerpVectors(from, to, e);
    });

    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ═══════════════════════════════════════════════════════
   STRUCTURE TOGGLES
═══════════════════════════════════════════════════════ */
function initStructureToggles() {
  document.querySelectorAll('.toggle-switch input').forEach(input => {
    input.addEventListener('change', function() {
      const key = this.dataset.bone;
      if (!key) return;
      state.boneVisibility[key] = this.checked;
      if (bones[key]) bones[key].visible = this.checked;
    });
  });

  document.querySelectorAll('.structure-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.toggle-switch')) return;
      const key = item.dataset.bone;
      if (key && bones[key]) selectBone(key);
    });
  });

  document.getElementById('toggle-all-structures').addEventListener('click', function() {
    const allOn = Object.values(state.boneVisibility).every(v => v);
    const nv = !allOn;
    this.textContent = nv ? 'Hide All' : 'Show All';
    Object.keys(state.boneVisibility).forEach(key => {
      state.boneVisibility[key] = nv;
      if (bones[key]) bones[key].visible = nv;
    });
    document.querySelectorAll('.toggle-switch input').forEach(input => {
      input.checked = nv;
    });
  });
}

/* ═══════════════════════════════════════════════════════
   ANIMATED METRIC CIRCLES
═══════════════════════════════════════════════════════ */
function animateCircles() {
  const C = 2 * Math.PI * 32;
  document.querySelectorAll('.metric-circle').forEach(circle => {
    const pct  = parseFloat(circle.dataset.pct);
    const fill = circle.querySelector('.circle-fill');
    setTimeout(() => {
      fill.style.strokeDasharray  = C;
      fill.style.strokeDashoffset = C * (1 - pct / 100);
    }, 500);
  });
}

/* ═══════════════════════════════════════════════════════
   MRI SLICE VIEWER
═══════════════════════════════════════════════════════ */
function initMRIViewer() {
  const canvas = document.getElementById('mri-canvas');
  const ctx    = canvas.getContext('2d');

  // Thumbnails
  const thumbsEl = document.getElementById('mri-thumbnails');
  for (let i = 1; i <= 12; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'mri-thumb' + (i === 6 ? ' active' : '');
    const c = document.createElement('canvas');
    c.width = 52; c.height = 70;
    drawMRISlice(c.getContext('2d'), 52, 70, i * 4, 1, 1);
    wrap.appendChild(c);
    wrap.addEventListener('click', () => {
      document.querySelectorAll('.mri-thumb').forEach(t => t.classList.remove('active'));
      wrap.classList.add('active');
      state.currentSlice = i * 4;
      document.getElementById('slice-slider').value = state.currentSlice;
      document.getElementById('slice-num').textContent = state.currentSlice;
      drawMRISlice(ctx, canvas.width, canvas.height, state.currentSlice, state.contrast/100, state.opacity/100);
    });
    thumbsEl.appendChild(wrap);
  }

  drawMRISlice(ctx, canvas.width, canvas.height, 24, 1, 1);

  document.getElementById('slice-slider').addEventListener('input', function() {
    state.currentSlice = +this.value;
    document.getElementById('slice-num').textContent = this.value;
    drawMRISlice(ctx, canvas.width, canvas.height, state.currentSlice, state.contrast/100, state.opacity/100);
  });
  document.getElementById('mri-prev').addEventListener('click', () => {
    const sl = document.getElementById('slice-slider');
    sl.value = Math.max(1, +sl.value - 1);
    sl.dispatchEvent(new Event('input'));
  });
  document.getElementById('mri-next').addEventListener('click', () => {
    const sl = document.getElementById('slice-slider');
    sl.value = Math.min(48, +sl.value + 1);
    sl.dispatchEvent(new Event('input'));
  });
  document.getElementById('contrast-slider').addEventListener('input', function() {
    state.contrast = +this.value;
    drawMRISlice(ctx, canvas.width, canvas.height, state.currentSlice, state.contrast/100, state.opacity/100);
  });
  document.getElementById('opacity-slider').addEventListener('input', function() {
    state.opacity = +this.value;
    drawMRISlice(ctx, canvas.width, canvas.height, state.currentSlice, state.contrast/100, state.opacity/100);
  });
  document.getElementById('zoom-slider').addEventListener('input', function() {
    canvas.style.transform = `scale(${+this.value / 100})`;
    canvas.style.transformOrigin = 'center';
  });
  document.querySelectorAll('.plane-tab').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.plane-tab').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const seed = this.id === 'plane-axial' ? 0 : this.id === 'plane-coronal' ? 90 : 180;
      drawMRISlice(ctx, canvas.width, canvas.height, state.currentSlice, state.contrast/100, state.opacity/100, seed);
    });
  });
}

function drawMRISlice(ctx, w, h, sliceNum, contrast=1, opacity=1, rotateSeed=0) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#060E16';
  ctx.fillRect(0, 0, w, h);
  const cx = w/2, cy = h/2;
  const phase = (sliceNum/48)*Math.PI*2 + rotateSeed*0.017;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = `contrast(${contrast*120}%) brightness(${75+contrast*30}%)`;

  const R = Math.min(w,h)*0.37;

  // Outer soft tissue
  const grad = ctx.createRadialGradient(cx,cy-8,R*0.1,cx,cy-8,R);
  grad.addColorStop(0,   `rgba(155,140,120,0.75)`);
  grad.addColorStop(0.55,`rgba(95,80,65,0.55)`);
  grad.addColorStop(1,   `rgba(18,18,18,0.25)`);
  ctx.beginPath();
  ctx.ellipse(cx, cy, R*(1+0.06*Math.sin(phase)), R*0.88, 0, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Femur cross-section
  const fY = cy - R*0.32;
  const bGrad = ctx.createRadialGradient(cx-4,fY-4,1,cx,fY,R*0.34);
  bGrad.addColorStop(0,'rgba(255,248,233,0.96)');
  bGrad.addColorStop(0.35,'rgba(228,208,168,0.9)');
  bGrad.addColorStop(0.7, 'rgba(195,172,128,0.65)');
  bGrad.addColorStop(1,'rgba(140,118,75,0.3)');
  ctx.beginPath();
  ctx.ellipse(cx, fY, R*0.34, R*0.27, 0, 0, Math.PI*2);
  ctx.fillStyle = bGrad;
  ctx.fill();
  // Medullary canal
  ctx.beginPath();
  ctx.ellipse(cx,fY, R*0.11, R*0.085, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(22,10,3,0.75)'; ctx.fill();
  // Cortical ring
  ctx.beginPath();
  ctx.ellipse(cx,fY, R*0.34, R*0.27, 0, 0, Math.PI*2);
  ctx.strokeStyle='rgba(255,240,200,0.4)'; ctx.lineWidth=1.2; ctx.stroke();

  // Tibia
  const tY = cy + R*0.32;
  const tGrad = ctx.createRadialGradient(cx-3,tY-3,1,cx,tY,R*0.30);
  tGrad.addColorStop(0,'rgba(252,242,220,0.96)');
  tGrad.addColorStop(0.45,'rgba(210,188,145,0.88)');
  tGrad.addColorStop(1,'rgba(145,122,78,0.3)');
  ctx.beginPath();
  ctx.ellipse(cx, tY, R*0.30, R*0.23, 0, 0, Math.PI*2);
  ctx.fillStyle = tGrad; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx,tY, R*0.09, R*0.068, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(18,8,2,0.72)'; ctx.fill();

  // Cartilage layers
  const midY = (fY+tY)/2;
  ctx.beginPath();
  ctx.ellipse(cx,midY-3, R*0.32, R*0.055, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(140,210,255,0.5)'; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx,midY+3.5, R*0.29, R*0.048, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(120,190,245,0.4)'; ctx.fill();

  // Meniscus (diseased region)
  const menVisible = sliceNum>16 && sliceNum<38;
  if (menVisible) {
    const alpha = Math.sin((sliceNum-16)/22*Math.PI);
    // Medial
    ctx.beginPath();
    ctx.ellipse(cx-R*0.22, midY, R*0.09, R*0.055, -0.3, 0, Math.PI*2);
    ctx.fillStyle=`rgba(239,68,68,${0.62*alpha})`; ctx.fill();
    // Lateral (normal)
    ctx.beginPath();
    ctx.ellipse(cx+R*0.22, midY, R*0.07, R*0.048, 0.3, 0, Math.PI*2);
    ctx.fillStyle=`rgba(200,170,130,${0.45*alpha})`; ctx.fill();
    // Tear artifact line
    ctx.beginPath();
    ctx.moveTo(cx-R*0.17, midY-2);
    ctx.lineTo(cx-R*0.27, midY+5);
    ctx.strokeStyle=`rgba(255,90,40,${0.85*alpha})`;
    ctx.lineWidth=1.5; ctx.stroke();
  }

  // Patella
  ctx.beginPath();
  ctx.ellipse(cx, cy-R*0.6, R*0.145, R*0.11, 0, 0, Math.PI*2);
  const pGrad = ctx.createRadialGradient(cx,cy-R*0.6,0,cx,cy-R*0.6,R*0.145);
  pGrad.addColorStop(0,'rgba(248,234,205,0.92)');
  pGrad.addColorStop(1,'rgba(175,148,100,0.35)');
  ctx.fillStyle=pGrad; ctx.fill();

  ctx.restore();

  // Crosshair guide
  ctx.strokeStyle='rgba(14,165,164,0.25)';
  ctx.lineWidth=0.5; ctx.setLineDash([2,5]);
  ctx.beginPath();
  ctx.moveTo(cx,6); ctx.lineTo(cx,h-6);
  ctx.moveTo(6,cy); ctx.lineTo(w-6,cy);
  ctx.stroke(); ctx.setLineDash([]);

  // Measurement annotation
  ctx.fillStyle='rgba(14,165,164,0.75)';
  ctx.font='9px JetBrains Mono,monospace';
  ctx.fillText(`${(38.2+Math.sin(phase)*1.4).toFixed(1)}mm`, cx+4, cy-6);
  ctx.fillText(`S${sliceNum}/${48}`, 6, 14);
}

/* ═══════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════ */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('sidebar-collapse').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

/* ═══════════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════════ */
function initNotifications() {
  const btn   = document.getElementById('notif-btn');
  const panel = document.getElementById('notif-panel');
  const bg    = document.getElementById('overlay-bg');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) bg.classList.remove('hidden');
    else bg.classList.add('hidden');
  });
  bg.addEventListener('click', () => {
    panel.classList.add('hidden');
    bg.classList.add('hidden');
    closeBonePopup();
  });
  document.querySelector('.notif-clear').addEventListener('click', () => {
    document.querySelectorAll('.notif-item').forEach(i => {
      i.style.transition = 'opacity 0.3s';
      i.style.opacity = '0';
      setTimeout(() => i.remove(), 300);
    });
  });
}

/* ═══════════════════════════════════════════════════════
   COMPARISON BUTTONS
═══════════════════════════════════════════════════════ */
function initComparison() {
  document.querySelectorAll('.cmp-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.id === 'cmp-measure') return;
      document.querySelectorAll('.cmp-btn:not(#cmp-measure)').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      if (this.id === 'cmp-healthy') {
        // Shift all to healthy beige
        Object.values(bones).forEach(b => {
          if (!b.material) return;
          b.material.color?.setHex(0xE2CCA8);
          if (b.material.emissive) b.material.emissive.set(0x000000);
          b.material.emissiveIntensity = 0;
        });
        showToast('🟢 Showing: Healthy Reference', 'success');
      } else if (this.id === 'cmp-pre') {
        Object.values(bones).forEach(b => {
          if (!b.material) return;
          b.material.color?.setHex(0xC8A878);
          if (b.material.emissive) b.material.emissive.set(0x050208);
          b.material.emissiveIntensity = 0.08;
        });
        showToast('🔵 Showing: Pre-Surgery Scan', 'info');
      } else {
        // Restore
        bones.meniscus?.material?.color?.setHex(0xBB3333);
        bones.cartilage?.material?.color?.setHex(0xAADDFF);
        bones.femur?.material?.color?.setHex(0xE2CCA8);
        bones.tibia?.material?.color?.setHex(0xD8BFA0);
        bones.patella?.material?.color?.setHex(0xEDD8B5);
        bones.ligaments?.material?.color?.setHex(0xC8A878);
        showToast('📊 Showing: Current Scan', 'info');
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════
   BUTTONS
═══════════════════════════════════════════════════════ */
function initButtons() {
  document.getElementById('btn-upload').addEventListener('click', () => {
    showToast('📁 Drop a .glb file onto the 3D viewer to load a real knee model!', 'info');
  });
  document.getElementById('btn-report').addEventListener('click', () => {
    showToast('📄 Generating PDF report for Patient #KN-2024-0847…', 'info');
    setTimeout(() => showToast('✅ Report generated and ready to download!', 'success'), 2200);
  });
  document.getElementById('popup-close').addEventListener('click', deselectBone);
}

/* ═══════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════ */
function showToast(msg, type='info') {
  const colors = { success:'#10B981', warn:'#F59E0B', info:'#0EA5A4', error:'#EF4444' };
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
    background:${colors[type]||colors.info};
    color:white;padding:11px 22px;border-radius:30px;
    font-size:13px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,0.22);
    z-index:9000;white-space:nowrap;
    animation:fadeInUp 0.3s cubic-bezier(0.4,0,0.2,1);
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

/* ═══════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════════════════════════ */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    switch(e.key.toLowerCase()) {
      case 'escape': deselectBone(); break;
      case 'r':  document.getElementById('tb-autorotate').click(); break;
      case 'w':  document.getElementById('tb-wireframe').click(); break;
      case 'x':  document.getElementById('tb-xray').click(); break;
      case 'e':  document.getElementById('tb-explode').click(); break;
      case ' ':  document.getElementById('tb-reset').click(); e.preventDefault(); break;
    }
  });
}

/* ═══════════════════════════════════════════════════════
   MAIN INIT
═══════════════════════════════════════════════════════ */
function initApp() {
  initThreeViewer();
  initDragDropGLB();
  initToolbar();
  initStructureToggles();
  animateCircles();
  initMRIViewer();
  initSidebar();
  initNotifications();
  initComparison();
  initButtons();
  initKeyboard();
  initReconstructionModal();
  // Defer theme init so Three.js scene is ready
  setTimeout(initThemeToggle, 200);
  // Welcome toast after short delay
  setTimeout(() => showToast('🦴 Advanced knee model loaded — click any bone to inspect!', 'success'), 800);
}

/* ═══════════════════════════════════════════════════════
   RECONSTRUCTION MODAL CONTROLLER
═══════════════════════════════════════════════════════ */
function initReconstructionModal() {
  const modal    = document.getElementById('recon-modal');
  const closeBtn = document.getElementById('recon-close');
  let selectedRes = 72;
  let dicomFiles  = null;

  const STAGE_IDS = ['ps-volume','ps-segment','ps-marching','ps-mesh','ps-viewer'];

  // Open via Upload Scan buttons
  document.getElementById('btn-upload').addEventListener('click', openReconModal);
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.textContent.toLowerCase().includes('upload')) {
      item.addEventListener('click', e => { e.preventDefault(); openReconModal(); });
    }
  });

  function openReconModal() {
    modal.classList.remove('hidden');
    resetProgress();
    showPanel('demo');
  }

  closeBtn.addEventListener('click', closeReconModal);
  modal.querySelector('.recon-modal-backdrop').addEventListener('click', closeReconModal);
  function closeReconModal() { modal.classList.add('hidden'); }

  // Tab switching
  document.querySelectorAll('.recon-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.recon-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      showPanel(this.dataset.tab);
    });
  });
  function showPanel(name) {
    document.getElementById('rpanel-demo').classList.toggle('hidden', name !== 'demo');
    document.getElementById('rpanel-dicom').classList.toggle('hidden', name !== 'dicom');
  }

  // Resolution buttons
  document.querySelectorAll('.res-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      selectedRes = parseInt(this.dataset.res, 10);
    });
  });

  // Demo start
  document.getElementById('btn-start-demo').addEventListener('click', () => {
    window._reconResOverride = selectedRes;
    startReconstruction('demo');
  });

  // DICOM dropzone
  const dropzone  = document.getElementById('recon-dropzone');
  const fileInput = document.getElementById('dicom-file-input');
  const fileList  = document.getElementById('dicom-file-list');
  const startDicom= document.getElementById('btn-start-dicom');

  document.getElementById('dropzone-browse').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => handleDICOMFiles(e.target.files));
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); handleDICOMFiles(e.dataTransfer.files); });

  function handleDICOMFiles(files) {
    const dcm = Array.from(files).filter(f => /\.dcm?$/i.test(f.name) || /\.dicom$/i.test(f.name));
    if (!dcm.length) { showToast('⚠ No .dcm files found', 'warn'); return; }
    dicomFiles = dcm;
    fileList.innerHTML = '';
    dcm.slice(0,8).forEach(f => {
      const d = document.createElement('div');
      d.className = 'dicom-file-item';
      d.innerHTML = `<span class="dicom-file-icon">📄</span><span>${f.name}</span><span style="margin-left:auto;opacity:0.4">${(f.size/1024).toFixed(0)} KB</span>`;
      fileList.appendChild(d);
    });
    if (dcm.length > 8) {
      const m = document.createElement('div');
      m.className = 'dicom-file-item';
      m.style.justifyContent = 'center';
      m.innerHTML = `<span style="color:#0EA5A4">+${dcm.length-8} more files</span>`;
      fileList.appendChild(m);
    }
    startDicom.classList.remove('hidden');
    showToast(`✅ ${dcm.length} DICOM slices loaded`, 'success');
  }
  startDicom.addEventListener('click', () => { if (dicomFiles) startReconstruction(dicomFiles); });

  // Run reconstruction pipeline
  function startReconstruction(source) {
    document.getElementById('rpanel-demo').classList.add('hidden');
    document.getElementById('rpanel-dicom').classList.add('hidden');
    document.getElementById('recon-progress-panel').classList.remove('hidden');

    const boneGroupRef = { current: boneGroup, bones };

    runReconstruction(
      source, scene, boneGroupRef,
      // onProgress
      (msg, pct) => {
        document.getElementById('progress-msg').textContent = msg;
        document.getElementById('progress-pct').textContent = Math.round(pct) + '%';
        document.getElementById('overall-fill').style.width  = pct + '%';
        const thresholds = [5, 30, 55, 80, 95];
        STAGE_IDS.forEach((id, i) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.classList.remove('active','done');
          if (pct >= thresholds[i]) {
            (i < STAGE_IDS.length-1 && pct >= thresholds[i+1])
              ? el.classList.add('done')
              : el.classList.add('active');
          }
        });
      },
      // onDone
      (group, newBones, errMsg) => {
        if (errMsg) { showToast('❌ Reconstruction failed: ' + errMsg, 'warn'); closeReconModal(); return; }
        STAGE_IDS.forEach(id => {
          const el = document.getElementById(id);
          if (el) { el.classList.remove('active'); el.classList.add('done'); }
        });
        document.getElementById('overall-fill').style.width  = '100%';
        document.getElementById('progress-pct').textContent  = '100%';
        document.getElementById('progress-msg').textContent  = '✅ Reconstruction complete!';
        if (group) { boneGroup = group; Object.assign(bones, newBones||{}); }
        setTimeout(() => {
          closeReconModal();
          showToast('🧬 Patient-specific 3D reconstruction complete!', 'success');
          setTimeout(() => showToast('Click any structure to inspect the reconstructed anatomy', 'info'), 2000);
        }, 1200);
      }
    );
  }

  function resetProgress() {
    document.getElementById('recon-progress-panel').classList.add('hidden');
    document.getElementById('rpanel-demo').classList.remove('hidden');
    document.getElementById('overall-fill').style.width  = '0%';
    document.getElementById('progress-pct').textContent  = '0%';
    document.getElementById('progress-msg').textContent  = 'Initializing…';
    STAGE_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active','done');
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeReconModal();
  });
}

/* ═══════════════════════════════════════════════════════
   THEME TOGGLE — Light ↔ Dark Mode
   Persists in localStorage. Updates Three.js scene too.
═══════════════════════════════════════════════════════ */
function initThemeToggle() {
  const btn  = document.getElementById('theme-toggle');
  const html = document.documentElement;

  // Stored lights so we can update them
  let _hemisLight = null;
  let _rimLight   = null;

  // Hook into scene after viewer loads
  function hookSceneLights() {
    if (!scene) return;
    scene.traverse(obj => {
      if (obj.isHemisphereLight) _hemisLight = obj;
      if (obj.isDirectionalLight && obj.position.x < -2 && obj.position.z > 0) _rimLight = obj;
    });
  }

  function applyTheme(isDark) {
    const t = isDark ? 'dark' : 'light';
    html.setAttribute('data-theme', t);
    localStorage.setItem('kneeai-theme', t);

    // Update Three.js scene
    if (scene) {
      const p = THEMES[t];
      if (state.xray) {
        scene.background = new THREE.Color(0x00040A);
        if (scene.fog) {
          scene.fog.color.setHex(0x00040A);
          scene.fog.density = 0.025;
        }
      } else {
        scene.background = new THREE.Color(p.sceneBg);
        if (scene.fog) {
          scene.fog.color.setHex(p.fogColor);
          scene.fog.density = p.fogDensity;
        }
      }

      // Floor disc color
      if (window._floorMat) {
        if (isDark) {
          window._floorMat.color.setHex(0x0D2030);
          window._floorMat.metalness  = 0.65;
          window._floorMat.roughness  = 0.12;
          window._floorMat.opacity    = 0.55;
        } else {
          window._floorMat.color.setHex(0xC8D8E8); // clinical light grey-blue
          window._floorMat.metalness  = 0.25;
          window._floorMat.roughness  = 0.40;
          window._floorMat.opacity    = 0.45;
        }
        window._floorMat.needsUpdate = true;
      }

      // Tone mapping — brighter in dark mode, natural in light
      if (renderer) {
        renderer.toneMappingExposure = isDark ? 1.65 : 1.35;
      }

      if (!_hemisLight || !_rimLight) hookSceneLights();
      if (_hemisLight) {
        _hemisLight.color.setHex(p.ambientTop);
        _hemisLight.groundColor.setHex(p.ambientBot);
        _hemisLight.intensity = p.ambientInt;
      }
      if (_rimLight) {
        _rimLight.color.setHex(p.rimColor);
        _rimLight.intensity = p.rimInt;
      }
    }
  }

  // Load saved preference (default = light)
  const saved = localStorage.getItem('kneeai-theme') || 'light';
  applyTheme(saved === 'dark');

  // Toggle on click
  btn.addEventListener('click', () => {
    const isDark = html.getAttribute('data-theme') !== 'dark';
    applyTheme(isDark);
    showToast(isDark ? '🌙 Dark mode — surgical theatre' : '☀️ Light mode — clinical daylight', 'info');
  });

  // Keyboard shortcut D = toggle dark mode
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key.toLowerCase() === 'd') btn.click();
  });
}


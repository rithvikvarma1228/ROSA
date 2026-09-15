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
   HIGH-FIDELITY PROCEDURAL BONE TEXTURES & BUMP SHADERS
═══════════════════════════════════════════════════════ */
function makeRealisticBoneTexture(w = 1024, h = 1024, baseTone = [244, 236, 220], type = 'femur') {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Layer 1: Base osseous gradient with subtle organic calcium hue variations
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0,   `rgb(${baseTone[0]}, ${baseTone[1]}, ${baseTone[2]})`);
  bgGrad.addColorStop(0.35, `rgb(${baseTone[0]-6}, ${baseTone[1]-8}, ${baseTone[2]-14})`);
  bgGrad.addColorStop(0.70, `rgb(${baseTone[0]-14}, ${baseTone[1]-18}, ${baseTone[2]-26})`);
  bgGrad.addColorStop(1.0, `rgb(${baseTone[0]-24}, ${baseTone[1]-28}, ${baseTone[2]-38})`);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Layer 2: Trabecular mottling (natural organic subchondral variations)
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const rw = Math.random() * 90 + 30, rh = Math.random() * 50 + 20;
    const alpha = Math.random() * 0.05 + 0.015;
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = (i % 2 === 0) ? `rgba(185, 155, 115, ${alpha})` : `rgba(255, 252, 242, ${alpha * 1.3})`;
    ctx.fill();
  }

  // Layer 3: Longitudinal osteon / collagen fiber striations (along diaphysis axis)
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 140; i++) {
    const x0 = Math.random() * w;
    const alpha = Math.random() * 0.07 + 0.015;
    ctx.strokeStyle = `rgba(115, 88, 52, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    const wave = (Math.random() - 0.5) * 22;
    ctx.bezierCurveTo(x0 + wave, h * 0.33, x0 - wave, h * 0.66, x0 + wave * 0.5, h);
    ctx.stroke();
  }

  // Layer 4: Haversian systems & Volkmann canals (concentric micro-osteon rings)
  for (let i = 0; i < 90; i++) {
    const cx = Math.random() * w, cy = Math.random() * h;
    const numRings = Math.floor(Math.random() * 3) + 2;
    for (let r = numRings; r >= 1; r--) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * (Math.random() * 3.5 + 2), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(105, 78, 42, ${0.09 - r * 0.02})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    // Haversian canal center
    ctx.beginPath();
    ctx.arc(cx, cy, Math.random() * 1.0 + 0.3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(65, 42, 22, ${Math.random() * 0.3 + 0.1})`;
    ctx.fill();
  }

  // Layer 5: Dense micro-porosity (nutrient foramina & canalicular pits)
  for (let i = 0; i < 7000; i++) {
    const px = Math.random() * w, py = Math.random() * h;
    const pr = Math.random() * 0.85 + 0.2;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(85, 58, 28, ${Math.random() * 0.15 + 0.02})`;
    ctx.fill();
  }

  // Layer 6: Soft natural ambient depth shading
  const aoGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.15, w * 0.5, h * 0.5, w * 0.75);
  aoGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
  aoGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0)');
  aoGrad.addColorStop(1.0, 'rgba(75, 55, 25, 0.09)');
  ctx.fillStyle = aoGrad;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeRealisticBoneBumpTexture(w = 512, h = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Base neutral 50% gray
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);

  // Micro-noise & osteon relief
  for (let i = 0; i < 70; i++) {
    const cx = Math.random() * w, cy = Math.random() * h;
    const r = Math.random() * 11 + 4;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, 'rgba(210, 210, 210, 0.65)');
    grd.addColorStop(0.5, 'rgba(128, 128, 128, 0.2)');
    grd.addColorStop(1, 'rgba(50, 50, 50, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  // Directional micro-grain grooves
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x0 = Math.random() * w;
    const v = Math.random() > 0.5 ? 190 : 70;
    ctx.strokeStyle = `rgba(${v}, ${v}, ${v}, ${Math.random() * 0.16 + 0.05})`;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + (Math.random() - 0.5) * 12, h);
    ctx.stroke();
  }

  // Fine pixel noise
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const v = Math.floor(Math.random() * 65 + 95);
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/* ═══════════════════════════════════════════════════════
   MANIFOLD LOFTED GEOMETRY BUILDER
═══════════════════════════════════════════════════════ */
function createLoftedGeometry(numRings, numSegs, ringGenerator, closeTop = true, closeBottom = true) {
  const verts = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r <= numRings; r++) {
    const t = r / numRings;
    for (let s = 0; s <= numSegs; s++) {
      const u = s / numSegs;
      const angle = u * Math.PI * 2;
      const p = ringGenerator(t, u, angle);
      verts.push(p.x, p.y, p.z);
      uvs.push(u, t);
    }
  }

  const rowStride = numSegs + 1;
  for (let r = 0; r < numRings; r++) {
    for (let s = 0; s < numSegs; s++) {
      const a = r * rowStride + s;
      const b = (r + 1) * rowStride + s;
      const c = (r + 1) * rowStride + (s + 1);
      const d = r * rowStride + (s + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (closeTop) {
    const topCenterIdx = verts.length / 3;
    const centerP = ringGenerator(0, 0, 0);
    verts.push(centerP.x, centerP.y, centerP.z);
    uvs.push(0.5, 0.5);
    for (let s = 0; s < numSegs; s++) {
      indices.push(topCenterIdx, s, s + 1);
    }
  }

  if (closeBottom) {
    const botCenterIdx = verts.length / 3;
    const centerP = ringGenerator(1, 0, 0);
    verts.push(centerP.x, centerP.y, centerP.z);
    uvs.push(0.5, 0.5);
    const lastRowBase = numRings * rowStride;
    for (let s = 0; s < numSegs; s++) {
      indices.push(botCenterIdx, lastRowBase + s + 1, lastRowBase + s);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  geo.computeVertexNormals();
  return geo;
}

/* ═══════════════════════════════════════════════════════
   ANATOMICAL KNEE GEOMETRIES — TRUE-TO-LIFE SCULPTED
═══════════════════════════════════════════════════════ */

/* ── 1. DISTAL FEMUR ── */
function buildFemurGeometry() {
  function femurRing(t, u, angle) {
    // t: 0 (shaft top y=+3.2) -> 1 (distal condyles y=-1.15)
    const y = 3.2 - t * 4.35;
    const sinA = Math.sin(angle); // medial (-X) / lateral (+X)
    const cosA = Math.cos(angle); // anterior (+Z) / posterior (-Z)

    // Natural anterior shaft bow
    let bowZ = 0;
    if (t < 0.65) {
      bowZ = Math.sin(t / 0.65 * Math.PI) * 0.16;
    }

    let rx, rz, cx = 0, cz = bowZ;

    if (t < 0.55) {
      // Diaphysis (Shaft)
      const shaftProg = t / 0.55;
      rx = 0.38 + (1 - shaftProg) * 0.03;
      rz = 0.40 + (1 - shaftProg) * 0.04;
      // Linea aspera on posterior ridge
      if (cosA < -0.3) {
        const ridge = Math.exp(-Math.pow(angle - Math.PI, 2) / 0.25) * 0.08;
        cz -= ridge;
      }
    } else if (t < 0.72) {
      // Metaphysis (Flaring transition)
      const mProg = (t - 0.55) / 0.17;
      const ease = mProg * mProg * (3 - 2 * mProg);
      rx = 0.38 + ease * 0.48; // expands medially & laterally
      rz = 0.40 + ease * 0.38;
      // Popliteal surface posterior flattening
      if (cosA < -0.2) {
        const popHollow = Math.sin((angle - Math.PI * 0.5) / Math.PI * Math.PI) * 0.06 * ease;
        cz += popHollow;
      }
    } else {
      // Epiphysis (Condyles, Notch, Trochlea)
      const cProg = (t - 0.72) / 0.28;
      rx = 0.86 + cProg * 0.06;
      rz = 0.78 + cProg * 0.12;

      // Intercondylar notch (deep posterior U-groove)
      if (cosA < -0.1) {
        const notchFactor = Math.exp(-Math.pow(sinA, 2) / 0.08) * (0.35 + cProg * 0.42);
        cz += notchFactor;
      }

      // Anterior trochlear groove (patellar sulcus)
      if (cosA > 0.2) {
        const trochleaHollow = Math.exp(-Math.pow(sinA, 2) / 0.12) * 0.14 * (1 - cProg * 0.5);
        cz -= trochleaHollow;
        // Prominent lateral patellar ridge
        if (sinA > 0.15 && sinA < 0.65) {
          cz += 0.08 * (1 - cProg * 0.4);
        }
      }

      // Medial condyle projects further distally and posteriorly
      if (sinA < -0.2) {
        cz -= 0.08 * cProg;
      }
      // Epicondylar tubercles
      if (Math.abs(sinA) > 0.85 && t > 0.68 && t < 0.88) {
        const epiFactor = (1 - Math.abs((t - 0.78) / 0.10)) * 0.08;
        rx += epiFactor;
      }
    }

    // Micro cortical grain
    const grain = (Math.sin(angle * 12 + y * 8) * 0.003 + Math.cos(angle * 6 - y * 12) * 0.002);
    return { x: cx + (rx + grain) * sinA, y, z: cz + (rz + grain) * cosA };
  }

  return createLoftedGeometry(96, 80, femurRing);
}

/* ── 2. PROXIMAL TIBIA ── */
function buildTibiaGeometry() {
  function tibiaRing(t, u, angle) {
    // t: 0 (tibial plateau y=+1.15) -> 1 (mid-shaft y=-3.4)
    const y = 1.15 - t * 4.55;
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    let rx, rz, cx = 0, cz = 0;

    if (t < 0.15) {
      // Plateau & Spines
      const pProg = t / 0.15;
      rx = 0.88 - pProg * 0.08;
      rz = 0.72 - pProg * 0.06;
    } else if (t < 0.35) {
      // Metaphysis & Tibial Tuberosity
      const mProg = (t - 0.15) / 0.20;
      rx = 0.80 - mProg * 0.42;
      rz = 0.66 - mProg * 0.30;
      // Anterior Tibial Tuberosity
      if (cosA > 0.4 && t > 0.18 && t < 0.32) {
        const tubFactor = (1 - Math.abs((t - 0.25) / 0.07)) * Math.pow(cosA, 2) * 0.26;
        cz += tubFactor;
      }
    } else {
      // Diaphysis (Prismatic triangular shaft)
      const sProg = (t - 0.35) / 0.65;
      rx = 0.38 - sProg * 0.08;
      rz = 0.36 - sProg * 0.06;

      // Sharp anterior shin crest
      if (cosA > 0.2) {
        const crest = Math.pow(cosA, 3) * (0.16 - sProg * 0.04);
        cz += crest;
      }
      // Lateral muscular hollow
      if (sinA > 0.3 && cosA < 0.5 && cosA > -0.5) {
        rx -= Math.sin(angle) * 0.04;
      }
      // Flat medial surface
      if (sinA < -0.3) {
        rx += 0.02;
      }
    }

    const grain = (Math.sin(angle * 14 + y * 7) * 0.003 + Math.cos(angle * 8 - y * 10) * 0.002);
    return { x: cx + (rx + grain) * sinA, y, z: cz + (rz + grain) * cosA };
  }

  return createLoftedGeometry(96, 80, tibiaRing);
}

/* ── 3. FIBULA (Head, Neck & Shaft) ── */
function buildFibulaGeometry() {
  function fibulaRing(t, u, angle) {
    const y = 0.90 - t * 4.30;
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    let rx, rz, cx = 0.96, cz = -0.30;

    if (t < 0.10) {
      // Styloid apex & head
      const hProg = t / 0.10;
      rx = 0.16 + hProg * 0.10;
      rz = 0.14 + hProg * 0.12;
      if (cosA < -0.2 && sinA > 0.2) {
        cx += 0.04 * (1 - hProg);
        cz -= 0.04 * (1 - hProg);
      }
    } else if (t < 0.22) {
      // Head expansion & neck constriction
      const nProg = (t - 0.10) / 0.12;
      rx = 0.26 - nProg * 0.14;
      rz = 0.26 - nProg * 0.14;
    } else {
      // Slender 4-sided prismatic shaft
      const sProg = (t - 0.22) / 0.78;
      rx = 0.12 - sProg * 0.02;
      rz = 0.11 - sProg * 0.02;
      const fluting = Math.sin(angle * 4 + t * 2) * 0.015;
      rx += fluting;
      rz += fluting;
      cx -= sProg * 0.08;
      cz += sProg * 0.10;
    }

    const grain = (Math.sin(angle * 10 + y * 12) * 0.002);
    return { x: cx + (rx + grain) * sinA, y, z: cz + (rz + grain) * cosA };
  }

  return createLoftedGeometry(64, 40, fibulaRing);
}

/* ── 4. PATELLA (Sesamoid Kneecap) ── */
function buildPatellaGeometry() {
  const numR = 48, numS = 48;
  const verts = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r <= numR; r++) {
    const v = r / numR;
    const y = 0.65 - v * 1.20;
    const widthFactor = Math.sin(Math.pow(v, 0.65) * Math.PI) * (1 - v * 0.45);
    const rx = 0.52 * widthFactor + 0.04;

    for (let s = 0; s <= numS; s++) {
      const u = s / numS;
      const angle = u * Math.PI * 2;
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);

      const px = sinA * rx;
      let pz = 0;

      if (cosA >= 0) {
        // Anterior convex surface
        const antThick = 0.32 * widthFactor * Math.sqrt(Math.max(0, cosA));
        const groove = Math.sin(px * 16) * 0.004;
        pz = antThick + groove;
      } else {
        // Posterior articular surface
        const postThick = 0.28 * widthFactor * Math.sqrt(Math.max(0, -cosA));
        const ridgeDist = px - 0.04;
        const ridgeHollow = Math.abs(ridgeDist) * 0.15;
        pz = -(postThick - ridgeHollow);
      }

      const grain = (Math.sin(angle * 10 + y * 15) * 0.002);
      verts.push(px, y, pz + grain);
      uvs.push(u, v);
    }
  }

  const stride = numS + 1;
  for (let r = 0; r < numR; r++) {
    for (let s = 0; s < numS; s++) {
      const a = r * stride + s;
      const b = (r + 1) * stride + s;
      const c = (r + 1) * stride + (s + 1);
      const d = r * stride + (s + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  geo.computeVertexNormals();
  return geo;
}

/* ── 5. QUADRICEPS & PATELLAR TENDONS ── */
function buildTendonGeometry() {
  const patTendonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.0,  0.05, 1.40),
    new THREE.Vector3( 0.0, -0.35, 1.30),
    new THREE.Vector3( 0.0, -0.75, 1.08),
    new THREE.Vector3( 0.0, -0.92, 0.72)
  ]);
  const patTendon = new THREE.TubeGeometry(patTendonCurve, 24, 0.16, 12, false);
  patTendon.scale(1.6, 1.0, 0.45);

  const quadTendonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.0, 0.65, 1.35),
    new THREE.Vector3( 0.0, 1.20, 1.18),
    new THREE.Vector3( 0.0, 1.85, 0.90),
    new THREE.Vector3( 0.0, 2.40, 0.68)
  ]);
  const quadTendon = new THREE.TubeGeometry(quadTendonCurve, 24, 0.18, 12, false);
  quadTendon.scale(1.8, 1.0, 0.38);

  return mergeBufferGeometries([patTendon, quadTendon]);
}

/* ── 6. ARTICULAR CARTILAGE ── */
function buildCartilageGeometry() {
  const femCartMed = new THREE.SphereGeometry(0.58, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
  femCartMed.scale(0.83, 0.96, 1.36);
  femCartMed.rotateX(0.12);
  femCartMed.translate(-0.48, 0.52, -0.15);

  const femCartLat = new THREE.SphereGeometry(0.54, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
  femCartLat.scale(0.89, 0.91, 1.26);
  femCartLat.rotateX(0.08);
  femCartLat.translate(0.48, 0.56, -0.12);

  const tibCartMed = new THREE.CylinderGeometry(0.48, 0.46, 0.07, 24);
  tibCartMed.scale(0.9, 1.0, 1.15);
  tibCartMed.translate(-0.46, -0.32, -0.05);

  const tibCartLat = new THREE.CylinderGeometry(0.44, 0.42, 0.07, 24);
  tibCartLat.scale(1.0, 1.0, 1.05);
  tibCartLat.translate(0.46, -0.32, -0.05);

  return mergeBufferGeometries([femCartMed, femCartLat, tibCartMed, tibCartLat]);
}

/* ── 7. MENISCI ── */
function buildMeniscusGeometry() {
  const medCurve = new THREE.EllipseCurve(-0.46, -0.05, 0.44, 0.52, -Math.PI * 0.65, Math.PI * 0.65, false, 0);
  const medPoints = medCurve.getPoints(32);
  const medVecs = medPoints.map(p => new THREE.Vector3(p.x, 0.0, p.y));
  const medMen = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(medVecs), 32, 0.11, 12, false);
  medMen.scale(1.0, 0.65, 1.0);

  const latCurve = new THREE.EllipseCurve(0.46, -0.05, 0.38, 0.42, -Math.PI * 0.85, Math.PI * 0.85, false, 0);
  const latPoints = latCurve.getPoints(32);
  const latVecs = latPoints.map(p => new THREE.Vector3(p.x, 0.0, p.y));
  const latMen = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(latVecs), 32, 0.10, 12, false);
  latMen.scale(1.0, 0.65, 1.0);

  return mergeBufferGeometries([medMen, latMen]);
}

/* ── 8. LIGAMENTS (ACL, PCL, MCL, LCL) ── */
function buildLigamentGeometry() {
  const aclCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.06, -0.25,  0.22),
    new THREE.Vector3( 0.08,  0.05,  0.02),
    new THREE.Vector3( 0.28,  0.35, -0.18)
  ]);
  const acl = new THREE.TubeGeometry(aclCurve, 20, 0.062, 10, false);

  const pclCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.04, -0.28, -0.24),
    new THREE.Vector3(-0.08,  0.05, -0.06),
    new THREE.Vector3(-0.24,  0.35,  0.12)
  ]);
  const pcl = new THREE.TubeGeometry(pclCurve, 20, 0.058, 10, false);

  const mclCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.84,  0.75,  0.00),
    new THREE.Vector3(-0.88,  0.05,  0.04),
    new THREE.Vector3(-0.82, -0.85,  0.02)
  ]);
  const mcl = new THREE.TubeGeometry(mclCurve, 20, 0.055, 10, false);
  mcl.scale(0.5, 1.0, 1.4);

  const lclCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.84,  0.72,  0.00),
    new THREE.Vector3( 0.90,  0.10, -0.12),
    new THREE.Vector3( 0.96, -0.42, -0.28)
  ]);
  const lcl = new THREE.TubeGeometry(lclCurve, 20, 0.052, 10, false);

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
  // Realistic natural osseous textures
  const boneTex   = makeRealisticBoneTexture(1024, 1024, [245, 237, 218], 'femur');
  const boneTexT  = makeRealisticBoneTexture(1024, 1024, [240, 230, 208], 'tibia');
  const boneTexP  = makeRealisticBoneTexture(1024, 1024, [248, 240, 224], 'patella');
  const bumpTex   = makeRealisticBoneBumpTexture(512, 512);

  // Shared bone material factory — MeshStandardMaterial with high roughness and 100% opacity
  function makeBoneMat(map, colorHex) {
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap:            bumpTex,
      bumpScale:          0.045,
      color:              new THREE.Color(colorHex),
      roughness:          0.72,
      metalness:          0.0,
      emissive:           new THREE.Color(0x281C10),
      emissiveIntensity:  0.06,
      transparent:        false,
      opacity:            1.0,
      depthWrite:         true,
      depthTest:          true,
      side:               THREE.FrontSide,
    });
  }

  // ── 1. FEMUR ──
  const femurGeo = buildFemurGeometry();
  const femurMat = makeBoneMat(boneTex, 0xF2E2C6);
  const femur = new THREE.Mesh(femurGeo, femurMat);
  femur.position.set(0, 1.45, 0);
  femur.castShadow = true; femur.receiveShadow = true;
  femur.userData = { bone: 'femur', origPos: femur.position.clone() };
  boneGroup.add(femur);
  bones.femur = femur;

  // ── 2. TIBIA ──
  const tibiaGeo = buildTibiaGeometry();
  const tibiaMat = makeBoneMat(boneTexT, 0xECD8B6);
  const tibia = new THREE.Mesh(tibiaGeo, tibiaMat);
  tibia.position.set(0, -1.45, -0.05);
  tibia.castShadow = true; tibia.receiveShadow = true;
  tibia.userData = { bone: 'tibia', origPos: tibia.position.clone() };
  boneGroup.add(tibia);
  bones.tibia = tibia;

  // ── 3. FIBULA (Lateral Head & Shaft) ──
  const fibGeo = buildFibulaGeometry();
  const fibMat = makeBoneMat(boneTexT, 0xE6D2AE);
  const fibula = new THREE.Mesh(fibGeo, fibMat);
  fibula.position.set(0, -1.45, -0.05);
  fibula.castShadow = true; fibula.receiveShadow = true;
  fibula.userData = { bone: 'fibula', origPos: fibula.position.clone() };
  boneGroup.add(fibula);
  bones.fibula = fibula;

  // ── 4. PATELLA ──
  const patGeo = buildPatellaGeometry();
  const patMat = makeBoneMat(boneTexP, 0xF6E8CC);
  const patella = new THREE.Mesh(patGeo, patMat);
  patella.position.set(0, 0.35, 1.30);
  patella.castShadow = true; patella.receiveShadow = true;
  patella.userData = { bone: 'patella', origPos: patella.position.clone() };
  boneGroup.add(patella);
  bones.patella = patella;

  // ── 5. TENDONS (Quadriceps & Patellar Tendon Straps) ──
  const tendonGeo = buildTendonGeometry();
  const tendonMat = new THREE.MeshStandardMaterial({
    color:              0xF0ECE2,
    roughness:          0.52,
    metalness:          0.0,
    emissive:           new THREE.Color(0x201810),
    emissiveIntensity:  0.05,
    transparent:        false,
    opacity:            1.0,
    depthWrite:         true,
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
  const cartMat = new THREE.MeshStandardMaterial({
    color:        0x78C4E8,
    roughness:    0.35,
    metalness:    0.0,
    transparent:  true,
    opacity:      0.82,
    depthWrite:   true,
    depthTest:    true,
    emissive:     new THREE.Color(0x002244),
    emissiveIntensity: 0.20,
    side:         THREE.FrontSide,
  });
  const cartilage = new THREE.Mesh(cartGeo, cartMat);
  cartilage.position.set(0, 0, 0);
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
  meniscus.position.set(0, 0, 0);
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
    color:       0xD8BC90,
    roughness:   0.65,
    metalness:   0.0,
    transparent: false,
    opacity:     1.0,
    depthWrite:  true,
    side:        THREE.DoubleSide,
  });
  const ligaments = new THREE.Mesh(ligGeo, ligMat);
  ligaments.position.set(0, 0, 0);
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
  const key = mesh.userData.bone;
  if (key === 'meniscus') {
    mesh.material.emissive = new THREE.Color(0x750000);
    mesh.material.emissiveIntensity = 0.45;
  } else if (key === 'cartilage') {
    mesh.material.emissive = new THREE.Color(0x003060);
    mesh.material.emissiveIntensity = 0.25;
  } else if (key === 'tendons') {
    mesh.material.emissive = new THREE.Color(0x201810);
    mesh.material.emissiveIntensity = 0.06;
  } else if (key === 'ligaments') {
    mesh.material.emissive = new THREE.Color(0x000000);
    mesh.material.emissiveIntensity = 0;
  } else {
    mesh.material.emissive = new THREE.Color(0x3A2808);
    mesh.material.emissiveIntensity = 0.08;
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
      const isCart = (k === 'cartilage');
      if (state.xray) {
        b.material.transparent = true;
        b.material.opacity = isCart ? 0.35 : 0.28;
        b.material.depthWrite = false;
      } else {
        if (sliderVal === 0) {
          b.material.transparent = isCart;
          b.material.opacity     = isCart ? 0.82 : 1.0;
          b.material.depthWrite  = true;
        } else {
          b.material.transparent = true;
          b.material.opacity     = isCart
            ? Math.max(0.08, 0.82 - sliderVal * 0.74)
            : Math.max(0.04, 1.0 - sliderVal * 0.96);
          b.material.depthWrite  = (b.material.opacity > 0.5);
        }
      }
      b.material.needsUpdate = true;
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
    const val = parseFloat(this.value) / 100;
    Object.entries(bones).forEach(([k, b]) => {
      if (!b.material) return;
      const isCart = (k === 'cartilage');
      if (val === 0) {
        b.material.transparent = isCart;
        b.material.opacity     = isCart ? 0.82 : 1.0;
        b.material.depthWrite  = true;
      } else {
        b.material.transparent = true;
        b.material.opacity     = isCart
          ? Math.max(0.08, 0.82 - val * 0.74)
          : Math.max(0.04, 1.0 - val * 0.96);
        b.material.depthWrite  = (b.material.opacity > 0.5);
      }
      b.material.needsUpdate = true;
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


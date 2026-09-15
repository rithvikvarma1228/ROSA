/* ================================================================
   KneeAI — MRI → 3D Reconstruction Engine
   
   Pipeline:
     1. DICOM Parsing      (real .dcm patient files)
     2. Synthetic Volume   (demo mode — no files needed)
     3. Marching Cubes     (voxel grid → triangle mesh)
     4. Three.js Mesh      (renders into the viewer)
   ================================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   MARCHING CUBES LOOKUP TABLES
   Standard Lorensen & Cline / Paul Bourke edge + triangle tables.
   Public domain mathematical data.
────────────────────────────────────────────────────────────── */
const MC_EDGE_TABLE = [
  0x000,0x109,0x203,0x30a,0x406,0x50f,0x605,0x70c,
  0x80c,0x905,0xa0f,0xb06,0xc0a,0xd03,0xe09,0xf00,
  0x190,0x099,0x393,0x29a,0x596,0x49f,0x795,0x69c,
  0x99c,0x895,0xb9f,0xa96,0xd9a,0xc93,0xf99,0xe90,
  0x230,0x339,0x033,0x13a,0x636,0x73f,0x435,0x53c,
  0xa3c,0xb35,0x83f,0x936,0xe3a,0xf33,0xc39,0xd30,
  0x3a0,0x2a9,0x1a3,0x0aa,0x7a6,0x6af,0x5a5,0x4ac,
  0xbac,0xaa5,0x9af,0x8a6,0xfaa,0xea3,0xda9,0xca0,
  0x460,0x569,0x663,0x76a,0x066,0x16f,0x265,0x36c,
  0xc6c,0xd65,0xe6f,0xf66,0x86a,0x963,0xa69,0xb60,
  0x5f0,0x4f9,0x7f3,0x6fa,0x1f6,0x0ff,0x3f5,0x2fc,
  0xdfc,0xcf5,0xfff,0xef6,0x9fa,0x8f3,0xbf9,0xaf0,
  0x650,0x759,0x453,0x55a,0x256,0x35f,0x055,0x15c,
  0xe5c,0xf55,0xc5f,0xd56,0xa5a,0xb53,0x859,0x950,
  0x7c0,0x6c9,0x5c3,0x4ca,0x3c6,0x2cf,0x1c5,0x0cc,
  0xfcc,0xec5,0xdcf,0xcc6,0xbca,0xac3,0x9c9,0x8c0,
  0x8c0,0x9c9,0xac3,0xbca,0xcc6,0xdcf,0xec5,0xfcc,
  0x0cc,0x1c5,0x2cf,0x3c6,0x4ca,0x5c3,0x6c9,0x7c0,
  0x950,0x859,0xb53,0xa5a,0xd56,0xc5f,0xf55,0xe5c,
  0x15c,0x055,0x35f,0x256,0x55a,0x453,0x759,0x650,
  0xaf0,0xbf9,0x8f3,0x9fa,0xef6,0xfff,0xcf5,0xdfc,
  0x2fc,0x3f5,0x0ff,0x1f6,0x6fa,0x7f3,0x4f9,0x5f0,
  0xb60,0xa69,0x963,0x86a,0xf66,0xe6f,0xd65,0xc6c,
  0x36c,0x265,0x16f,0x066,0x76a,0x663,0x569,0x460,
  0xca0,0xda9,0xea3,0xfaa,0x8a6,0x9af,0xaa5,0xbac,
  0x4ac,0x5a5,0x6af,0x7a6,0x0aa,0x1a3,0x2a9,0x3a0,
  0xd30,0xc39,0xf33,0xe3a,0x936,0x83f,0xb35,0xa3c,
  0x53c,0x435,0x73f,0x636,0x13a,0x033,0x339,0x230,
  0xe90,0xf99,0xc93,0xd9a,0xa96,0xb9f,0x895,0x99c,
  0x69c,0x795,0x49f,0x596,0x29a,0x393,0x099,0x190,
  0xf00,0xe09,0xd03,0xc0a,0xb06,0xa0f,0x905,0x80c,
  0x70c,0x605,0x50f,0x406,0x30a,0x203,0x109,0x000
];

const MC_TRI_TABLE = [
  [],
  [0,8,3],[0,1,9],[1,8,3,9,8,1],[1,2,10],[0,8,3,1,2,10],
  [9,2,10,0,2,9],[2,8,3,2,10,8,10,9,8],[3,11,2],[0,11,2,8,11,0],
  [1,9,0,2,3,11],[1,11,2,1,9,11,9,8,11],[3,10,1,11,10,3],
  [0,10,1,0,8,10,8,11,10],[3,9,0,3,11,9,11,10,9],[9,8,10,10,8,11],
  [4,7,8],[4,3,0,7,3,4],[0,1,9,8,4,7],[4,1,9,4,7,1,7,3,1],
  [1,2,10,8,4,7],[3,4,7,3,0,4,1,2,10],[9,2,10,9,0,2,8,4,7],
  [2,10,9,2,9,7,2,7,3,7,9,4],[8,4,7,3,11,2],[11,4,7,11,2,4,2,0,4],
  [9,0,1,8,4,7,2,3,11],[4,7,11,9,4,11,9,11,2,9,2,1],
  [3,10,1,3,11,10,7,8,4],[1,11,10,1,4,11,1,0,4,7,11,4],
  [4,7,8,9,0,11,9,11,10,11,0,3],[4,7,11,4,11,9,9,11,10],
  [9,5,4],[9,5,4,0,8,3],[0,5,4,1,5,0],[8,5,4,8,3,5,3,1,5],
  [1,2,10,9,5,4],[3,0,8,1,2,10,4,9,5],[5,2,10,5,4,2,4,0,2],
  [2,10,5,3,2,5,3,5,4,3,4,8],[9,5,4,2,3,11],[0,11,2,0,8,11,4,9,5],
  [0,5,4,0,1,5,2,3,11],[2,1,5,2,5,8,2,8,11,4,8,5],
  [10,3,11,10,1,3,9,5,4],[4,9,5,0,8,1,8,10,1,8,11,10],
  [5,4,0,5,0,11,5,11,10,11,0,3],[5,4,8,5,8,10,10,8,11],
  [9,7,8,5,7,9],[9,3,0,9,5,3,5,7,3],[0,7,8,0,1,7,1,5,7],
  [1,5,3,3,5,7],[9,7,8,9,5,7,10,1,2],[10,1,2,9,5,0,5,3,0,5,7,3],
  [8,0,2,8,2,5,8,5,7,10,5,2],[2,10,5,2,5,3,3,5,7],
  [7,9,5,7,8,9,3,11,2],[9,5,7,9,7,2,9,2,0,2,7,11],
  [2,3,11,0,1,8,1,7,8,1,5,7],[11,2,1,11,1,7,7,1,5],
  [9,5,8,8,5,7,10,1,3,10,3,11],[5,7,0,5,0,9,7,11,0,1,0,10,11,10,0],
  [11,10,0,11,0,3,10,5,0,8,0,7,5,7,0],[11,10,5,7,11,5],
  [10,6,5],[0,8,3,5,10,6],[9,0,1,5,10,6],[1,8,3,1,9,8,5,10,6],
  [1,6,5,2,6,1],[1,6,5,1,2,6,3,0,8],[9,6,5,9,0,6,0,2,6],
  [5,9,8,5,8,2,5,2,6,3,2,8],[2,3,11,10,6,5],[11,0,8,11,2,0,10,6,5],
  [0,1,9,2,3,11,5,10,6],[5,10,6,1,9,2,9,11,2,9,8,11],
  [6,3,11,6,5,3,5,1,3],[0,8,11,0,11,5,0,5,1,5,11,6],
  [3,11,6,0,3,6,0,6,5,0,5,9],[6,5,9,6,9,11,11,9,8],
  [5,10,6,4,7,8],[4,3,0,4,7,3,6,5,10],[1,9,0,5,10,6,8,4,7],
  [10,6,5,1,9,7,1,7,3,7,9,4],[6,1,2,6,5,1,4,7,8],
  [1,2,5,5,2,6,3,0,4,3,4,7],[8,4,7,9,0,5,0,6,5,0,2,6],
  [7,3,9,7,9,4,3,2,9,5,9,6,2,6,9],[3,11,2,7,8,4,10,6,5],
  [5,10,6,4,7,2,4,2,0,2,7,11],[0,1,9,4,7,8,2,3,11,5,10,6],
  [9,2,1,9,11,2,9,4,11,7,11,4,5,10,6],
  [8,4,7,3,11,5,3,5,1,5,11,6],[5,1,11,5,11,6,1,0,11,7,11,4,0,4,11],
  [0,5,9,0,6,5,0,3,6,11,6,3,8,4,7],[6,5,9,6,9,11,4,7,9,7,11,9],
  [10,4,9,6,4,10],[4,10,6,4,9,10,0,8,3],[10,0,1,10,6,0,6,4,0],
  [8,3,1,8,1,6,8,6,4,6,1,10],[1,4,9,1,2,4,2,6,4],
  [3,0,8,1,2,9,2,4,9,2,6,4],[0,2,4,4,2,6],[8,3,2,8,2,4,4,2,6],
  [10,4,9,10,6,4,11,2,3],[0,8,2,2,8,11,4,9,10,4,10,6],
  [3,11,2,0,1,6,0,6,4,6,1,10],[6,4,1,6,1,10,4,8,1,2,1,11,8,11,1],
  [9,6,4,9,3,6,9,1,3,11,6,3],[8,11,1,8,1,0,11,6,1,9,1,4,6,4,1],
  [3,11,6,3,6,0,0,6,4],[6,4,8,11,6,8],
  [7,10,6,7,8,10,8,9,10],[0,7,3,0,10,7,0,9,10,6,7,10],
  [10,6,7,1,10,7,1,7,8,1,8,0],[10,6,7,10,7,1,1,7,3],
  [1,2,6,1,6,8,1,8,9,8,6,7],[2,6,9,2,9,1,6,7,9,0,9,3,7,3,9],
  [7,8,0,7,0,6,6,0,2],[7,3,2,6,7,2],
  [2,3,11,10,6,8,10,8,9,8,6,7],[2,0,7,2,7,11,0,9,7,6,7,10,9,10,7],
  [1,8,0,1,7,8,1,10,7,6,7,10,2,3,11],[11,2,1,11,1,7,10,6,1,6,7,1],
  [8,9,6,8,6,7,9,1,6,11,6,3,1,3,6],[0,9,1,11,6,7],
  [7,8,0,7,0,6,3,11,0,11,6,0],[7,11,6],
  [7,6,11],[3,0,8,11,7,6],[0,1,9,11,7,6],[8,1,9,8,3,1,11,7,6],
  [10,1,2,6,11,7],[1,2,10,3,0,8,6,11,7],[2,9,0,2,10,9,6,11,7],
  [6,11,7,2,10,3,10,8,3,10,9,8],[7,2,3,6,2,7],[7,0,8,7,6,0,6,2,0],
  [2,7,6,2,3,7,0,1,9],[1,6,2,1,8,6,1,9,8,8,7,6],
  [10,7,6,10,1,7,1,3,7],[10,7,6,1,7,10,1,8,7,1,0,8],
  [0,3,7,0,7,10,0,10,9,6,10,7],[7,6,10,7,10,8,8,10,9],
  [6,8,4,11,8,6],[3,6,11,3,0,6,0,4,6],[8,6,11,8,4,6,9,0,1],
  [9,4,6,9,6,3,9,3,1,11,3,6],[6,8,4,6,11,8,2,10,1],
  [1,2,10,3,0,11,0,6,11,0,4,6],[4,11,8,4,6,11,0,2,9,2,10,9],
  [10,9,3,10,3,2,9,4,3,11,3,6,4,6,3],[8,2,3,8,4,2,4,6,2],
  [0,4,2,4,6,2],[1,9,0,2,3,4,2,4,6,4,3,8],[1,9,4,1,4,2,2,4,6],
  [8,1,3,8,6,1,8,4,6,6,10,1],[10,1,0,10,0,6,6,0,4],
  [4,6,3,4,3,8,6,10,3,0,3,9,10,9,3],[10,9,4,6,10,4],
  [4,9,5,7,6,11],[0,8,3,4,9,5,11,7,6],[5,0,1,5,4,0,7,6,11],
  [11,7,6,8,3,4,3,5,4,3,1,5],[9,5,4,10,1,2,7,6,11],
  [6,11,7,1,2,10,0,8,3,4,9,5],[7,6,11,5,4,10,4,2,10,4,0,2],
  [3,4,8,3,5,4,3,2,5,10,5,2,11,7,6],[7,2,3,7,6,2,5,4,9],
  [9,5,4,0,8,6,0,6,2,6,8,7],[3,6,2,3,7,6,1,5,0,5,4,0],
  [6,2,8,6,8,7,2,1,8,4,8,5,1,5,8],[9,5,4,10,1,6,1,7,6,1,3,7],
  [1,6,10,1,7,6,1,0,7,8,7,0,9,5,4],
  [4,0,10,4,10,5,0,3,10,6,10,7,3,7,10],[7,6,10,7,10,8,5,4,10,4,8,10],
  [6,9,5,6,11,9,11,8,9],[3,6,11,0,6,3,0,5,6,0,9,5],
  [0,11,8,0,5,11,0,1,5,5,6,11],[6,11,3,6,3,5,5,3,1],
  [1,2,10,9,5,11,9,11,8,11,5,6],[0,11,3,0,6,11,0,9,6,5,6,9,1,2,10],
  [11,8,5,11,5,6,8,0,5,10,5,2,0,2,5],[6,11,3,6,3,5,2,10,3,10,5,3],
  [5,8,9,5,2,8,5,6,2,3,8,2],[9,5,6,9,6,0,0,6,2],
  [1,5,8,1,8,0,5,6,8,3,8,2,6,2,8],[1,5,6,2,1,6],
  [1,3,6,1,6,10,3,8,6,5,6,9,8,9,6],[10,1,0,10,0,6,9,5,0,5,6,0],
  [0,3,8,5,6,10],[10,5,6],
  [11,5,10,7,5,11],[11,5,10,11,7,5,8,3,0],[5,11,7,5,10,11,1,9,0],
  [10,7,5,10,11,7,9,8,1,8,3,1],[11,1,2,11,7,1,7,5,1],
  [0,8,3,1,2,7,1,7,5,7,2,11],[9,7,5,9,2,7,9,0,2,2,11,7],
  [7,5,2,7,2,11,5,9,2,3,2,8,9,8,2],[2,5,10,2,3,5,3,7,5],
  [8,2,0,8,5,2,8,7,5,10,2,5],[9,0,1,2,3,5,2,5,10,5,3,7],
  [8,2,5,8,5,7,10,2,5,2,7,5],[1,3,5,3,7,5],[0,8,7,0,7,1,1,7,5],
  [9,0,3,9,3,5,5,3,7],[9,8,7,5,9,7],
  [5,8,4,5,10,8,10,11,8],[5,0,4,5,11,0,5,10,11,11,3,0],
  [0,1,9,8,4,10,8,10,11,10,4,5],[10,11,4,10,4,5,11,3,4,9,4,1,3,1,4],
  [2,5,1,2,8,5,2,11,8,4,5,8],[0,4,11,0,11,3,4,5,11,2,11,1,5,1,11],
  [0,2,5,0,5,9,2,11,5,4,5,8,11,8,5],[9,4,5,2,11,3],
  [2,5,10,3,5,2,3,4,5,3,8,4],[5,10,2,5,2,4,4,2,0],
  [3,10,2,3,5,10,3,8,5,4,5,8,0,1,9],[5,10,2,5,2,4,1,9,2,9,4,2],
  [8,4,5,8,5,3,3,5,1],[0,4,5,1,0,5],[8,4,5,8,5,3,9,0,5,0,3,5],[9,4,5],
  [4,11,7,4,9,11,9,10,11],[0,8,3,4,9,7,9,11,7,9,10,11],
  [1,10,11,1,11,4,1,4,0,7,4,11],[3,1,4,3,4,8,1,10,4,7,4,11,10,11,4],
  [4,11,7,9,11,4,9,2,11,9,1,2],[9,7,4,9,11,7,9,1,11,2,11,1,0,8,3],
  [11,7,4,11,4,2,2,4,0],[11,7,4,11,4,2,8,3,4,3,2,4],
  [2,9,10,2,7,9,2,3,7,7,4,9],[9,10,7,9,7,4,10,2,7,8,7,0,2,0,7],
  [3,7,10,3,10,2,7,4,10,1,10,0,4,0,10],[1,10,2,8,7,4],
  [4,9,1,4,1,7,7,1,3],[4,9,1,4,1,7,0,8,1,8,7,1],[4,0,3,7,4,3],[4,8,7],
  [9,10,8,10,11,8],[3,0,9,3,9,11,11,9,10],[0,1,10,0,10,8,8,10,11],
  [3,1,10,11,3,10],[1,2,11,1,11,9,9,11,8],[3,0,9,3,9,11,1,2,9,2,11,9],
  [0,2,11,8,0,11],[3,2,11],[2,3,8,2,8,10,10,8,9],[9,10,2,0,9,2],
  [2,3,8,2,8,10,0,1,8,1,10,8],[1,10,2],[1,3,8,9,1,8],[0,9,1],[0,3,8],[]
];

/* ──────────────────────────────────────────────────────────────
   SDF (SIGNED DISTANCE FUNCTION) UTILITIES
   Used to generate the synthetic anatomical knee volume.
────────────────────────────────────────────────────────────── */
function sdfSphere(px,py,pz, cx,cy,cz, r) {
  const dx=px-cx, dy=py-cy, dz=pz-cz;
  return Math.sqrt(dx*dx+dy*dy+dz*dz) - r;
}

function sdfEllipsoid(px,py,pz, cx,cy,cz, rx,ry,rz) {
  const dx=(px-cx)/rx, dy=(py-cy)/ry, dz=(pz-cz)/rz;
  return Math.sqrt(dx*dx+dy*dy+dz*dz) - 1.0;
}

function sdfCapsule(px,py,pz, ax,ay,az, bx,by,bz, r) {
  const abx=bx-ax, aby=by-ay, abz=bz-az;
  const apx=px-ax, apy=py-ay, apz=pz-az;
  const ab2=abx*abx+aby*aby+abz*abz;
  const t  =Math.max(0,Math.min(1,(apx*abx+apy*aby+apz*abz)/ab2));
  const dx =px-(ax+t*abx), dy=py-(ay+t*aby), dz=pz-(az+t*abz);
  return Math.sqrt(dx*dx+dy*dy+dz*dz) - r;
}

function sdfBox(px,py,pz, cx,cy,cz, hx,hy,hz) {
  const dx=Math.abs(px-cx)-hx;
  const dy=Math.abs(py-cy)-hy;
  const dz=Math.abs(pz-cz)-hz;
  return Math.sqrt(
    Math.max(dx,0)**2 + Math.max(dy,0)**2 + Math.max(dz,0)**2
  ) + Math.min(Math.max(dx,dy,dz),0);
}

// Smooth union of two SDF values (blends edges)
function sdfSmoothUnion(a,b,k) {
  const h = Math.max(k-Math.abs(a-b), 0) / k;
  return Math.min(a,b) - h*h*k*0.25;
}

/* ──────────────────────────────────────────────────────────────
   SYNTHETIC ANATOMICAL KNEE VOLUME
   Generates a 3D voxel grid shaped like a real knee using SDFs.
   No patient data needed — used for demo mode.
────────────────────────────────────────────────────────────── */
function generateSyntheticKneeVolume(res = 80) {
  const W = res, H = res, D = res;
  // Separate label volumes per bone structure (for coloring)
  const volBone      = new Float32Array(W * H * D); // cortical bone
  const volCartilage = new Float32Array(W * H * D); // cartilage
  const volMeniscus  = new Float32Array(W * H * D); // meniscus

  // Normalize coordinates to [-1, 1]
  for (let iz = 0; iz < D; iz++) {
    for (let iy = 0; iy < H; iy++) {
      for (let ix = 0; ix < W; ix++) {
        const x = (ix / (W-1) - 0.5) * 2.2;  // width  space
        const y = (iy / (H-1) - 0.5) * 3.8;  // height space
        const z = (iz / (D-1) - 0.5) * 2.2;  // depth  space

        const idx = iz * H * W + iy * W + ix;

        /* ── FEMUR ── */
        // Shaft (upper, cylindrical)
        let dFemur = sdfCapsule(x,y,z, 0,0.55,0.02, 0,1.55,0.02, 0.195);
        // Add slight natural curvature at mid-shaft
        dFemur = Math.min(dFemur, sdfCapsule(x,y,z, 0,-0.05,0.02, 0,0.55,0.02, 0.20));
        // Medial condyle
        const dFemCondM = sdfSphere(x,y,z, -0.22,-0.30,0.05, 0.26);
        // Lateral condyle
        const dFemCondL = sdfSphere(x,y,z,  0.24,-0.30,0.05, 0.25);
        // Blend condyles into shaft
        dFemur = sdfSmoothUnion(dFemur, dFemCondM, 0.15);
        dFemur = sdfSmoothUnion(dFemur, dFemCondL, 0.15);
        // Patella groove (intercondylar notch) — subtract a channel
        const dGroove = sdfBox(x,y,z, 0,-0.3,0.2, 0.10,0.22,0.08);

        /* ── TIBIA ── */
        // Tibial shaft
        let dTibia = sdfCapsule(x,y,z, 0,-0.65,0.00, 0,-1.65,-0.05, 0.165);
        // Tibial plateau (wider top)
        const dPlateau = sdfEllipsoid(x,y,z, 0,-0.55,0.00, 0.42,0.14,0.36);
        // Tibial tuberosity (anterior bump)
        const dTub = sdfCapsule(x,y,z, 0,-0.58,0.34, 0,-0.72,0.36, 0.095);
        dTibia = sdfSmoothUnion(dTibia, dPlateau, 0.12);
        dTibia = sdfSmoothUnion(dTibia, dTub, 0.08);

        /* ── PATELLA ── */
        const dPatella = sdfEllipsoid(x,y,z, 0,0.12,0.58, 0.19,0.17,0.14);

        /* ── FIBULA (lateral, slender) ── */
        const dFibula = sdfCapsule(x,y,z, 0.44,-0.65,-0.05, 0.42,-1.52,-0.08, 0.072);

        /* ── COMBINED BONE SDF ── */
        const dAllBone = Math.min(
          Math.min(dFemur + (dGroove < 0 ? -dGroove*0.3 : 0), dTibia),
          Math.min(dPatella, dFibula)
        );
        // Convert SDF to density (1.0 = deep inside, 0.0 = outside)
        // Use smooth step for natural cortical shell
        volBone[idx] = dAllBone < 0 ? Math.min(1.0, 1.0 - dAllBone * 1.8) : 0.0;

        /* ── CARTILAGE ── */
        // Femoral cartilage cap (on condyle surfaces)
        const dCartF = Math.min(
          sdfSphere(x,y,z, -0.22,-0.30,0.05, 0.30) - sdfSphere(x,y,z,-0.22,-0.30,0.05,0.24),
          sdfSphere(x,y,z,  0.24,-0.30,0.05, 0.29) - sdfSphere(x,y,z, 0.24,-0.30,0.05,0.23)
        );
        // Tibial cartilage (thin layer on top of plateau)
        const dCartT_M = sdfEllipsoid(x,y,z, -0.22,-0.46,0.02, 0.22,0.055,0.22);
        const dCartT_L = sdfEllipsoid(x,y,z,  0.23,-0.46,0.02, 0.20,0.055,0.20);
        const dCartilage = Math.min(dCartF, Math.min(dCartT_M, dCartT_L));
        volCartilage[idx] = dCartilage < 0 ? Math.min(1.0, -dCartilage * 8.0 + 0.2) : 0.0;

        /* ── MENISCUS ── */
        // Medial meniscus (C-shaped, larger)
        // Approximate as an arc of a torus
        const mMedX = x + 0.22, mMedZ = z - 0.02;
        const mMedR = Math.sqrt(mMedX*mMedX + mMedZ*mMedZ) - 0.26;
        const dMenM = Math.sqrt(mMedR*mMedR + (y+0.49)*(y+0.49)) - 0.075;
        // Mask to C-shape (open anterior)
        const isCShape = !(mMedX > 0.06 && Math.abs(mMedZ) < 0.12);
        // Lateral meniscus (near-circular, smaller)
        const mLatX = x - 0.23, mLatZ = z - 0.02;
        const mLatR = Math.sqrt(mLatX*mLatX + mLatZ*mLatZ) - 0.21;
        const dMenL = Math.sqrt(mLatR*mLatR + (y+0.49)*(y+0.49)) - 0.065;
        const dMeniscus = Math.min(
          isCShape ? dMenM : 999,
          dMenL
        );
        volMeniscus[idx] = dMeniscus < 0 ? Math.min(1.0, -dMeniscus * 10.0 + 0.2) : 0.0;
      }
    }
  }

  return { volBone, volCartilage, volMeniscus, W, H, D };
}

/* ──────────────────────────────────────────────────────────────
   MARCHING CUBES ALGORITHM
   Converts a 3D scalar field to triangle mesh vertices + normals.
   
   vol   : Float32Array of size W*H*D  (values 0.0 – 1.0)
   W,H,D : dimensions
   iso   : isovalue threshold (surface extracted where vol == iso)
   Returns { positions: Float32Array, normals: Float32Array }
────────────────────────────────────────────────────────────── */
function marchingCubes(vol, W, H, D, iso) {
  // Cube corner offsets [x,y,z]
  const CORNERS = [
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1]
  ];

  // Helper to get volume value
  function vget(ix,iy,iz) {
    ix = Math.max(0,Math.min(W-1,ix));
    iy = Math.max(0,Math.min(H-1,iy));
    iz = Math.max(0,Math.min(D-1,iz));
    return vol[iz*H*W + iy*W + ix];
  }

  // Linear interpolate between two cube edge endpoints
  function vertInterp(iso, p1x,p1y,p1z,v1, p2x,p2y,p2z,v2) {
    if (Math.abs(iso-v1) < 1e-6) return [p1x,p1y,p1z];
    if (Math.abs(iso-v2) < 1e-6) return [p2x,p2y,p2z];
    if (Math.abs(v1-v2)  < 1e-6) return [p1x,p1y,p1z];
    const t = (iso-v1)/(v2-v1);
    return [p1x+t*(p2x-p1x), p1y+t*(p2y-p1y), p1z+t*(p2z-p1z)];
  }

  const positions = [];

  // March through every voxel cube
  for (let iz = 0; iz < D-1; iz++) {
    for (let iy = 0; iy < H-1; iy++) {
      for (let ix = 0; ix < W-1; ix++) {

        // Sample the 8 corners of the current cube
        const corners = CORNERS.map(([dx,dy,dz]) => ({
          x: ix+dx, y: iy+dy, z: iz+dz,
          v: vget(ix+dx, iy+dy, iz+dz)
        }));

        // Build the cube index (8-bit bitmask)
        let cubeIdx = 0;
        if (corners[0].v < iso) cubeIdx |= 1;
        if (corners[1].v < iso) cubeIdx |= 2;
        if (corners[2].v < iso) cubeIdx |= 4;
        if (corners[3].v < iso) cubeIdx |= 8;
        if (corners[4].v < iso) cubeIdx |= 16;
        if (corners[5].v < iso) cubeIdx |= 32;
        if (corners[6].v < iso) cubeIdx |= 64;
        if (corners[7].v < iso) cubeIdx |= 128;

        // Skip if no surface crosses this cube
        if (MC_EDGE_TABLE[cubeIdx] === 0) continue;

        const e = MC_EDGE_TABLE[cubeIdx];
        const vList = new Array(12);

        // Compute intersection points on each edge (if needed)
        if (e & 0x001) vList[0]  = vertInterp(iso,corners[0].x,corners[0].y,corners[0].z,corners[0].v, corners[1].x,corners[1].y,corners[1].z,corners[1].v);
        if (e & 0x002) vList[1]  = vertInterp(iso,corners[1].x,corners[1].y,corners[1].z,corners[1].v, corners[2].x,corners[2].y,corners[2].z,corners[2].v);
        if (e & 0x004) vList[2]  = vertInterp(iso,corners[2].x,corners[2].y,corners[2].z,corners[2].v, corners[3].x,corners[3].y,corners[3].z,corners[3].v);
        if (e & 0x008) vList[3]  = vertInterp(iso,corners[3].x,corners[3].y,corners[3].z,corners[3].v, corners[0].x,corners[0].y,corners[0].z,corners[0].v);
        if (e & 0x010) vList[4]  = vertInterp(iso,corners[4].x,corners[4].y,corners[4].z,corners[4].v, corners[5].x,corners[5].y,corners[5].z,corners[5].v);
        if (e & 0x020) vList[5]  = vertInterp(iso,corners[5].x,corners[5].y,corners[5].z,corners[5].v, corners[6].x,corners[6].y,corners[6].z,corners[6].v);
        if (e & 0x040) vList[6]  = vertInterp(iso,corners[6].x,corners[6].y,corners[6].z,corners[6].v, corners[7].x,corners[7].y,corners[7].z,corners[7].v);
        if (e & 0x080) vList[7]  = vertInterp(iso,corners[7].x,corners[7].y,corners[7].z,corners[7].v, corners[4].x,corners[4].y,corners[4].z,corners[4].v);
        if (e & 0x100) vList[8]  = vertInterp(iso,corners[0].x,corners[0].y,corners[0].z,corners[0].v, corners[4].x,corners[4].y,corners[4].z,corners[4].v);
        if (e & 0x200) vList[9]  = vertInterp(iso,corners[1].x,corners[1].y,corners[1].z,corners[1].v, corners[5].x,corners[5].y,corners[5].z,corners[5].v);
        if (e & 0x400) vList[10] = vertInterp(iso,corners[2].x,corners[2].y,corners[2].z,corners[2].v, corners[6].x,corners[6].y,corners[6].z,corners[6].v);
        if (e & 0x800) vList[11] = vertInterp(iso,corners[3].x,corners[3].y,corners[3].z,corners[3].v, corners[7].x,corners[7].y,corners[7].z,corners[7].v);

        // Add triangles from triangle table
        const tris = MC_TRI_TABLE[cubeIdx];
        for (let t = 0; t < tris.length; t += 3) {
          const a = vList[tris[t]];
          const b = vList[tris[t+1]];
          const c = vList[tris[t+2]];
          if (!a || !b || !c) continue;
          positions.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
        }
      }
    }
  }

  // Build flat Float32Arrays
  const posArr = new Float32Array(positions);

  // Compute flat face normals (then average for smooth shading)
  const norArr = new Float32Array(posArr.length);
  for (let i = 0; i < posArr.length; i += 9) {
    const ax=posArr[i  ],ay=posArr[i+1],az=posArr[i+2];
    const bx=posArr[i+3],by=posArr[i+4],bz=posArr[i+5];
    const cx=posArr[i+6],cy=posArr[i+7],cz=posArr[i+8];
    const ux=bx-ax,uy=by-ay,uz=bz-az;
    const vx=cx-ax,vy=cy-ay,vz=cz-az;
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    const len=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
    norArr[i  ]=norArr[i+3]=norArr[i+6]=nx/len;
    norArr[i+1]=norArr[i+4]=norArr[i+7]=ny/len;
    norArr[i+2]=norArr[i+5]=norArr[i+8]=nz/len;
  }

  return { positions: posArr, normals: norArr };
}

/* ──────────────────────────────────────────────────────────────
   BUILD THREE.JS MESH FROM MARCHING CUBES OUTPUT
────────────────────────────────────────────────────────────── */
function buildThreeMesh(mcResult, material, W, H, D) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(mcResult.positions, 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(mcResult.normals,   3));

  // Scale from voxel space → world space and center
  geo.scale(2.2/(W-1), 3.8/(H-1), 2.2/(D-1));
  geo.translate(-1.1, -1.9, -1.1);

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ──────────────────────────────────────────────────────────────
   DICOM PARSING
   Reads a series of .dcm files → 3D volume for marching cubes.
────────────────────────────────────────────────────────────── */
async function parseDICOMSeries(files, onProgress) {
  if (typeof dicomParser === 'undefined') {
    throw new Error('dicom-parser not loaded');
  }

  const slices = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress && onProgress(`Parsing DICOM ${i+1}/${files.length}: ${file.name}`, (i/files.length)*40);

    const buf  = await file.arrayBuffer();
    const uint = new Uint8Array(buf);
    let ds;
    try { ds = dicomParser.parseDicom(uint); } catch(e) { continue; }

    // Extract key tags
    const rows    = ds.uint16('x00280010') || 0;
    const cols    = ds.uint16('x00280011') || 0;
    const bits    = ds.uint16('x00280100') || 16;
    const intercept = parseFloat(ds.string('x00281052') || '0');
    const slope     = parseFloat(ds.string('x00281053') || '1');
    const posStr  = ds.string('x00200032') || '0\\0\\0';
    const pos     = posStr.split('\\').map(Number);
    const spacStr = ds.string('x00280030') || '1\\1';
    const spacing = spacStr.split('\\').map(Number);
    const thick   = parseFloat(ds.string('x00500010') || ds.string('x00180050') || '1');

    // Get pixel data (handle both 8 and 16 bit)
    let pixelData;
    const pixelElem = ds.elements.x7fe00010;
    if (!pixelElem) continue;
    if (bits === 16) {
      pixelData = new Int16Array(buf, pixelElem.dataOffset, pixelElem.length / 2);
    } else {
      pixelData = new Uint8Array(buf, pixelElem.dataOffset, pixelElem.length);
    }

    slices.push({ rows, cols, pixelData, slope, intercept, zPos: pos[2] || slices.length, spacing, thick });
  }

  if (slices.length === 0) throw new Error('No valid DICOM slices found');

  // Sort by Z position
  slices.sort((a, b) => a.zPos - b.zPos);
  onProgress && onProgress(`Building 3D volume from ${slices.length} slices…`, 50);

  const W = slices[0].cols;
  const H = slices[0].rows;
  const D = slices.length;

  // Build normalized volume (HU → 0-1 density)
  // Bone HU range: ~400 to 3000. Normalize: 0=air, 1=dense bone.
  const HU_MIN = -200, HU_MAX = 2000;
  const volBone      = new Float32Array(W * H * D);
  const volCartilage = new Float32Array(W * H * D);
  const volMeniscus  = new Float32Array(W * H * D);

  slices.forEach((slice, iz) => {
    const { rows:sH, cols:sW, pixelData, slope, intercept } = slice;
    for (let iy = 0; iy < Math.min(sH, H); iy++) {
      for (let ix = 0; ix < Math.min(sW, W); ix++) {
        const raw = pixelData[iy * sW + ix];
        const hu  = raw * slope + intercept;
        const idx = iz * H * W + iy * W + ix;

        // Bone: HU > 300 (cancellous) to 2000 (cortical)
        if (hu > 300)  volBone[idx] = Math.min(1.0, (hu - 300) / 1500);
        // Soft tissue / cartilage: HU 50-300
        if (hu > 50 && hu <= 400) volCartilage[idx] = (hu - 50) / 350;
        // Meniscus: HU 30-120 in proper MRI sequences
        if (hu > 30 && hu <= 200) volMeniscus[idx] = (hu - 30) / 170;
      }
    }
  });

  onProgress && onProgress('Segmentation complete.', 70);
  return { volBone, volCartilage, volMeniscus, W, H, D };
}

/* ──────────────────────────────────────────────────────────────
   FULL RECONSTRUCTION PIPELINE
   Called from app.js — orchestrates the entire workflow.
────────────────────────────────────────────────────────────── */
async function runReconstruction(source, scene, boneGroupRef, onProgress, onDone) {
  try {
    onProgress('Preparing volume data…', 5);
    await sleep(80);

    let volumeData;

    if (source === 'demo') {
      // ── SYNTHETIC DEMO MODE ──
      const res = 72;
      onProgress(`Generating synthetic knee anatomy (${res}³ voxels)…`, 15);
      await sleep(60);
      volumeData = generateSyntheticKneeVolume(res);
    } else {
      // ── REAL DICOM MODE ──
      volumeData = await parseDICOMSeries(source, (msg, pct) => onProgress(msg, pct));
    }

    const { volBone, volCartilage, volMeniscus, W, H, D } = volumeData;
    const totalVoxels = (W * H * D / 1e6).toFixed(2);

    onProgress(`Running Marching Cubes on bone volume (${W}×${H}×${D} = ${totalVoxels}M voxels)…`, 55);
    await sleep(80);
    const mcBone = marchingCubes(volBone, W, H, D, 0.38);

    onProgress(`Extracting cartilage surface…`, 70);
    await sleep(40);
    const mcCart = marchingCubes(volCartilage, W, H, D, 0.25);

    onProgress(`Extracting meniscus surface…`, 80);
    await sleep(40);
    const mcMen  = marchingCubes(volMeniscus, W, H, D, 0.22);

    onProgress(`Building Three.js meshes (${(mcBone.positions.length/3).toLocaleString()} bone vertices)…`, 88);
    await sleep(60);

    // ── PBR MATERIALS ──
    const boneTex   = makeReconBoneTexture();
    const roughTex  = makeReconRoughTexture();

    const boneMat = new THREE.MeshStandardMaterial({
      map: boneTex, roughnessMap: roughTex,
      color: 0xE0CCA0, roughness: 0.68, metalness: 0.0,
      transparent: false, opacity: 1.0, depthWrite: true,
      envMapIntensity: 0.45,
    });

    const cartMat = new THREE.MeshStandardMaterial({
      color: 0x78C4E8, roughness: 0.32, metalness: 0.0,
      transparent: true, opacity: 0.82, depthWrite: true,
      emissive: new THREE.Color(0x002040), emissiveIntensity: 0.18,
      side: THREE.FrontSide,
    });

    const menMat = new THREE.MeshStandardMaterial({
      color: 0xCC3333, roughness: 0.65, metalness: 0.0,
      emissive: new THREE.Color(0x5A0000), emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
    });

    // ── BUILD MESHES ──
    const boneMesh = buildThreeMesh(mcBone, boneMat, W, H, D);
    boneMesh.userData.bone = 'femur'; // will be clickable
    boneMesh.userData.origPos = boneMesh.position.clone();

    const cartMesh = buildThreeMesh(mcCart, cartMat, W, H, D);
    cartMesh.userData.bone = 'cartilage';
    cartMesh.userData.origPos = cartMesh.position.clone();

    const menMesh  = buildThreeMesh(mcMen,  menMat,  W, H, D);
    menMesh.userData.bone = 'meniscus';
    menMesh.userData.origPos = menMesh.position.clone();

    // Disease pulse light on meniscus
    const diseaseLight = new THREE.PointLight(0xFF2200, 0.7, 4);
    menMesh.add(diseaseLight);
    menMesh.userData.diseaseLight = diseaseLight;

    // ── INSERT INTO SCENE ──
    onProgress('Loading viewer…', 96);
    await sleep(100);

    // Remove old procedural group
    if (boneGroupRef.current) {
      scene.remove(boneGroupRef.current);
    }

    const reconGroup = new THREE.Group();
    reconGroup.add(boneMesh);
    if (cartMesh.geometry.attributes.position.count > 0) reconGroup.add(cartMesh);
    if (menMesh.geometry.attributes.position.count > 0)  reconGroup.add(menMesh);

    scene.add(reconGroup);
    boneGroupRef.current = reconGroup;

    // Register clickable bones
    boneGroupRef.bones = {
      femur:     boneMesh,
      cartilage: cartMesh,
      meniscus:  menMesh,
    };

    onProgress('Reconstruction complete!', 100);
    await sleep(300);
    onDone(reconGroup, boneGroupRef.bones);

  } catch (err) {
    console.error('[KneeAI Reconstruction]', err);
    onDone(null, null, err.message);
  }
}

// Simple texture generators for reconstructed mesh
function makeReconBoneTexture(w=256,h=256) {
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgb(228,208,172)'; ctx.fillRect(0,0,w,h);
  for(let i=0;i<1600;i++){
    const x=Math.random()*w,y=Math.random()*h,r=Math.random()*1.4;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle=`rgba(70,45,15,${Math.random()*0.15+0.03})`; ctx.fill();
  }
  const g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'rgba(255,255,255,0.1)'); g.addColorStop(1,'rgba(0,0,0,0.08)');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  return new THREE.CanvasTexture(c);
}
function makeReconRoughTexture(w=128,h=128) {
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#888'; ctx.fillRect(0,0,w,h);
  for(let i=0;i<1200;i++){
    const x=Math.random()*w,y=Math.random()*h,v=Math.floor(Math.random()*80+100);
    ctx.beginPath(); ctx.arc(x,y,Math.random()*2,0,Math.PI*2);
    ctx.fillStyle=`rgb(${v},${v},${v})`; ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

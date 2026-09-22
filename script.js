/* Demo data stays separate from the visualization and UI wiring. */
const DEMO_DATA = {
  caseId: 'KNEE-001',
  anatomy: {
    femur: { label: 'Femur', confidence: '96%', color: 0x80d2d0 },
    tibia: { label: 'Tibia', confidence: '94%', color: 0x76b9dc },
    patella: { label: 'Patella', confidence: '92%', color: 0xe6ae83 },
    
  }
};

const state = { selected: 'femur', visible: { femur: true, tibia: true, patella: true }, autoRotate: false, wireframe: false, opacity: 1 };
let scene, camera, renderer, controls, raycaster, pointer;
let modelRoot;
const boneGroups = {};
const originalMaterials = new Map();
const materialDefaults = new Map();
const SOURCE_BONE_COLORS = { femur: 0xe2cca8, tibia: 0xd8bfa0, patella: 0xedd8b5 };
function createMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .02 });
}

function mesh(geometry, material, parent) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  originalMaterials.set(object, material);
  registerMaterial(material);
  return object;
}

function registerMaterial(material) {
  if (!materialDefaults.has(material)) materialDefaults.set(material, { transparent: material.transparent, opacity: material.opacity, wireframe: material.wireframe });
}

function buildFemur() {
  const group = new THREE.Group();
  group.name = 'femur';
  const material = createMaterial(DEMO_DATA.anatomy.femur.color);
  const shaft = mesh(new THREE.CylinderGeometry(.92, .72, 3.8, 32), material, group);
  shaft.position.y = 2.35;
  shaft.rotation.z = -.08;
  const neck = mesh(new THREE.CylinderGeometry(.56, .68, 1.35, 28), material, group);
  neck.position.set(.38, 4.2, .02); neck.rotation.z = -.62;
  const head = mesh(new THREE.SphereGeometry(.72, 32, 20), material, group);
  head.position.set(1.02, 4.65, .02); head.scale.set(1.08, .96, .96);
  [-.48, .48].forEach((x) => {
    const condyle = mesh(new THREE.SphereGeometry(.78, 32, 22), material, group);
    condyle.position.set(x, .25, .04); condyle.scale.set(.92, .78, 1.15);
  });
  const bridge = mesh(new THREE.BoxGeometry(1.04, .7, 1.5), material, group);
  bridge.position.y = .56; bridge.scale.set(1, 1, .8);
  return group;
}

function buildTibia() {
  const group = new THREE.Group();
  group.name = 'tibia';
  const material = createMaterial(DEMO_DATA.anatomy.tibia.color);
  const shaft = mesh(new THREE.CylinderGeometry(.56, .72, 3.65, 32), material, group);
  shaft.position.y = -2.05;
  shaft.rotation.z = .04;
  const plateau = mesh(new THREE.CylinderGeometry(1.28, 1.05, .42, 32), material, group);
  plateau.position.y = -.1; plateau.scale.z = .78;
  [-.53, .53].forEach((x) => {
    const surface = mesh(new THREE.SphereGeometry(.5, 28, 16), material, group);
    surface.position.set(x, .18, 0); surface.scale.set(1.22, .38, .94);
  });
  const ankle = mesh(new THREE.SphereGeometry(.68, 28, 18), material, group);
  ankle.position.y = -3.9; ankle.scale.set(.82, .7, .8);
  return group;
}

function buildPatella() {
  const group = new THREE.Group();
  group.name = 'patella';
  const material = createMaterial(DEMO_DATA.anatomy.patella.color);
  const shell = mesh(new THREE.SphereGeometry(.7, 36, 24), material, group);
  shell.position.set(0, .38, 1.15); shell.scale.set(.92, 1.15, .48);
  const rim = mesh(new THREE.TorusGeometry(.51, .045, 10, 32), material, group);
  rim.position.set(0, .38, 1.55); rim.rotation.x = Math.PI / 2;
  return group;
}

function loadSuppliedModel() {
  const loader = new THREE.FBXLoader();
  loader.load('models/source/Knee%20Anatomy.fbx', (model) => {
    const sourceParts = {};
    model.traverse((object) => {
      if (object.isMesh) {
        sourceParts[object.name] = object;
        object.castShadow = true;
        object.receiveShadow = true;
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(registerMaterial);
      }
    });
    if (!sourceParts.Bone_Low || !sourceParts.Mash_Low || !sourceParts.Transparenty_Low) {
      setModelStatus('Model sections missing; showing demo anatomy.', 'warning');
      return;
    }

    ['femur', 'tibia', 'patella'].forEach((key) => {
      if (boneGroups[key]) scene.remove(boneGroups[key]);
    });
    model.name = 'supplied-knee-model';
    model.scale.setScalar(.58);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, .15 - center.y, -center.z);
    modelRoot = model;

    const sourceMap = { femur: 'Bone_Low', tibia: 'Mash_Low', patella: 'Transparenty_Low' };
    Object.entries(sourceMap).forEach(([key, sourceName]) => {
      const group = new THREE.Group();
      group.name = key;
      group.add(sourceParts[sourceName]);
      boneGroups[key] = group;
      model.add(group);
    });
    scene.add(model);
    applySourceBoneColors();
    applyMaterialSettings();
    setModelStatus('Supplied FBX loaded', 'success');
  }, undefined, () => {
    setModelStatus('Supplied FBX unavailable; showing demo anatomy.', 'warning');
  });
}

function applySourceBoneColors() {
  Object.entries(SOURCE_BONE_COLORS).forEach(([key, color]) => {
    boneGroups[key].traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        material.color.setHex(color);
        material.emissive?.setHex(0x000000);
        material.emissiveIntensity = 0;
      });
    });
  });
}

function setModelStatus(message, tone) {
  const status = document.getElementById('model-status');
  status.textContent = message;
  status.className = `model-status ${tone}`;
  document.getElementById('model-source').textContent = tone === 'success' ? 'Uploaded FBX' : 'Demo anatomy';
  if (tone === 'success') setTimeout(() => status.classList.add('quiet'), 2600);
}

function setupScene() {
  const container = document.getElementById('viewer');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(33, container.clientWidth / container.clientHeight, .1, 100);
  camera.position.set(9, 4.5, 12.3);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .07; controls.minDistance = 6; controls.maxDistance = 18;
  controls.target.set(0, .35, 0);
  raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd8d4, .72));
  const keyLight = new THREE.DirectionalLight(0xffffff, .48); keyLight.position.set(4, 7, 7); keyLight.castShadow = true; scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xe9f1ee, .28); rimLight.position.set(-5, 2, -5); scene.add(rimLight);

  boneGroups.femur = buildFemur(); boneGroups.femur.position.y = .15;
  boneGroups.tibia = buildTibia(); boneGroups.tibia.position.y = -.05;
  boneGroups.patella = buildPatella();
  Object.values(boneGroups).forEach((group) => scene.add(group));
  loadSuppliedModel();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.8, 64), new THREE.MeshBasicMaterial({ color: 0x18313a, transparent: true, opacity: .2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -4.65; scene.add(floor);

  renderer.domElement.addEventListener('pointermove', handlePointerMove);
  renderer.domElement.addEventListener('click', handleCanvasClick);
  window.addEventListener('resize', resizeScene);
  animate();
}

function boneFromObject(object) {
  let current = object;
  while (current && !boneGroups[current.name]) current = current.parent;
  return current ? current.name : null;
}

function highlightBone(key, hovered) {
  return boneGroups[key] && hovered;
}

function updateAnatomyLabels() {
  const labels = document.querySelectorAll('.anatomy-label');
  labels.forEach((label) => {
    const group = boneGroups[label.dataset.label];
    if (!group || !group.visible) {
      label.hidden = true;
      return;
    }
    const position = new THREE.Vector3();
    const bounds = new THREE.Box3().setFromObject(group);
    bounds.getCenter(position);
    position.project(camera);
    const visible = position.z > -1 && position.z < 1;
    label.hidden = !visible;
    label.style.left = `${(position.x * .5 + .5) * 100}%`;
    label.style.top = `${(-position.y * .5 + .5) * 100}%`;
    label.classList.toggle('selected', state.selected === label.dataset.label);
  });
}

function applyMaterialSettings() {
  Object.values(boneGroups).forEach((group) => group.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const defaults = materialDefaults.get(material);
      if (!defaults) return;
      material.wireframe = state.wireframe;
      material.opacity = state.opacity;
      material.transparent = state.opacity < 1 || defaults.transparent;
      material.needsUpdate = true;
    });
  }));
}

function toggleViewerMode(buttonId, property) {
  state[property] = !state[property];
  const button = document.getElementById(buttonId);
  button.classList.toggle('active', state[property]);
  button.setAttribute('aria-pressed', String(state[property]));
  if (property === 'autoRotate') controls.autoRotate = state.autoRotate;
  if (property === 'wireframe') applyMaterialSettings();
}

function saveSnapshot() {
  renderer.render(scene, camera);
  const link = document.createElement('a');
  link.download = `${DEMO_DATA.caseId}-3d-reconstruction.png`;
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();
}

function handlePointerMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(Object.values(boneGroups), true);
  Object.keys(boneGroups).forEach((key) => highlightBone(key, false));
  const hitKey = hits.length ? boneFromObject(hits[0].object) : null;
  if (hitKey && state.visible[hitKey]) { highlightBone(hitKey, true); renderer.domElement.title = DEMO_DATA.anatomy[hitKey].label; renderer.domElement.style.cursor = 'pointer'; } else renderer.domElement.style.cursor = 'grab';
}

function handleCanvasClick() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(Object.values(boneGroups), true);
  if (hits.length) { const key = boneFromObject(hits[0].object); if (key && state.visible[key]) selectBone(key); }
}

function selectBone(key) {
  state.selected = key;
  document.querySelectorAll('.bone-control').forEach((button) => button.classList.toggle('selected', button.dataset.bone === key));
  document.getElementById('selected-name').textContent = DEMO_DATA.anatomy[key].label;
  document.getElementById('selected-confidence').textContent = DEMO_DATA.anatomy[key].confidence;
  Object.keys(boneGroups).forEach((name) => highlightBone(name, false));
}

function setVisibility(key, visible) { state.visible[key] = visible; boneGroups[key].visible = visible; document.querySelector(`[data-bone="${key}"]`).classList.toggle('hidden', !visible); }
function resetView() { controls.target.set(0, .35, 0); camera.position.set(9, 4.5, 12.3); controls.update(); }
function bindControls() {
  document.querySelectorAll('.bone-control').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.bone; selectBone(key); setVisibility(key, !state.visible[key]); }));
  document.getElementById('reset-view').addEventListener('click', resetView);
  document.getElementById('show-all').addEventListener('click', () => Object.keys(boneGroups).forEach((key) => setVisibility(key, true)));
  document.getElementById('hide-all').addEventListener('click', () => Object.keys(boneGroups).forEach((key) => setVisibility(key, false)));
  document.getElementById('isolate-selected').addEventListener('click', () => Object.keys(boneGroups).forEach((key) => setVisibility(key, key === state.selected)));
  document.getElementById('auto-rotate').addEventListener('click', () => toggleViewerMode('auto-rotate', 'autoRotate'));
  document.getElementById('wireframe').addEventListener('click', () => toggleViewerMode('wireframe', 'wireframe'));
  document.getElementById('model-opacity').addEventListener('input', (event) => { state.opacity = Number(event.target.value) / 100; document.getElementById('opacity-value').textContent = `${event.target.value}%`; applyMaterialSettings(); });
  document.getElementById('snapshot').addEventListener('click', saveSnapshot);
}
function resizeScene() { const container = document.getElementById('viewer'); camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); }
function animate() { requestAnimationFrame(animate); controls.update(); updateAnatomyLabels(); renderer.render(scene, camera); }

function runLoadingSequence() {
  const messages = ['Loading patient analysis...', 'Segmentation complete', 'Generating 3D model...', '3D reconstruction complete'];
  const progress = document.getElementById('loader-progress'); const label = document.getElementById('loader-label'); const step = document.getElementById('loader-step');
  messages.forEach((message, index) => setTimeout(() => { label.textContent = message; step.textContent = `0${index + 1} / 04`; progress.style.width = `${(index + 1) * 25}%`; if (index === messages.length - 1) setTimeout(() => document.getElementById('loader').classList.add('done'), 650); }, index * 650));
}

setupScene(); bindControls(); runLoadingSequence();

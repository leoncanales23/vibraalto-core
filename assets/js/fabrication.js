import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { STLExporter } from 'https://unpkg.com/three@0.160.0/examples/jsm/exporters/STLExporter.js';
import * as BufferGeometryUtils from 'https://unpkg.com/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';
import { VRButton } from 'https://unpkg.com/three@0.160.0/examples/jsm/webxr/VRButton.js';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'https://unpkg.com/three-mesh-bvh@0.7.5/build/index.module.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const fileInput = document.getElementById('mesh-input');
const meshSummary = document.getElementById('mesh-summary');
const meshStatus = document.getElementById('mesh-status');
const exportBtn = document.getElementById('export-stl');
const profileSelect = document.getElementById('profile-select');
const profileDetails = document.getElementById('profile-details');
const materialsContainer = document.getElementById('materials');
const statFaces = document.getElementById('stat-faces');
const statBoundary = document.getElementById('stat-boundary');
const statNonManifold = document.getElementById('stat-nonmanifold');
const statVolume = document.getElementById('stat-volume');
const statThickness = document.getElementById('stat-thickness');
const statDims = document.getElementById('stat-dims');
const viewerContainer = document.getElementById('viewer');
const vrButtonSlot = document.getElementById('vr-button-slot');

const machineProfiles = [
  {
    id: 'bambu-x1c',
    name: 'Bambu X1C (AMS)',
    scale: 1,
    tolerance: '+0.15 mm holgura / -0.05 mm presión',
    nozzle: '0.4 mm',
    layerHeight: '0.16-0.20 mm',
    materials: 'PLA, PETG, ASA',
    notes: 'Enable flow calibration. Para encajes usa elephant foot compensation 0.2 mm.'
  },
  {
    id: 'bambu-p1p',
    name: 'Bambu P1P',
    scale: 1,
    tolerance: '+0.18 mm holgura',
    nozzle: '0.4 mm',
    layerHeight: '0.20 mm',
    materials: 'PLA, PETG',
    notes: 'Ventilar cámara para PETG. Velocidad moderada para evitar warping en piezas altas.'
  },
  {
    id: 'ender-3',
    name: 'Ender 3 (mod.)',
    scale: 1.001,
    tolerance: '+0.20 mm holgura',
    nozzle: '0.4 / 0.6 mm',
    layerHeight: '0.20-0.28 mm',
    materials: 'PLA, TPU',
    notes: 'Ajusta steps/mm XY con cubo de calibración. Ventilador 100% en PLA para puentes.'
  },
  {
    id: 'resin-8k',
    name: 'MSLA 8K Resina',
    scale: 0.998,
    tolerance: '+0.05 mm holgura',
    nozzle: 'Láser/UV',
    layerHeight: '0.05 mm',
    materials: 'Resina estándar / ABS-like',
    notes: 'Activar anti-aliasing 2px. Refuerza soportes en áreas >45°.'
  }
];

const materials = [
  {
    name: 'PLA',
    uses: 'Protoboard, gadgets, validación de forma',
    temp: '190-210°C',
    post: 'Lijado ligero, no requiere cámara cerrada',
    notes: 'Estable dimensionalmente; ideal para pruebas de tolerancia inicial.'
  },
  {
    name: 'PETG',
    uses: 'Piezas funcionales, soportes en exterior',
    temp: '230-250°C',
    post: 'Llama rápida para quitar hilos, acetona no funciona',
    notes: 'Añadir holgura extra (+0.05 mm). Mantener ventilación parcial.'
  },
  {
    name: 'TPU 95A',
    uses: 'Amortiguadores, wearables',
    temp: '215-230°C',
    post: 'Corte limpio, lijado fino',
    notes: 'Reducir retracción y velocidad. Preferir boquilla 0.6 mm.'
  },
  {
    name: 'Resina ABS-like',
    uses: 'Miniaturas robustas, piezas pequeñas precisas',
    temp: '50-60°C base',
    post: 'Lavado IPA + curado 5-10 min',
    notes: 'Considerar encogimiento. Usa soportes gruesos en voladizos largos.'
  }
];

let scene;
let camera;
let renderer;
let controls;
let currentMesh = null;
let currentGeometry = null;
let activeProfile = machineProfiles[0];

initViewer();
populateProfiles();
populateMaterials();
updateProfileDetails();

if (fileInput) {
  fileInput.addEventListener('change', onMeshSelected);
}

if (profileSelect) {
  profileSelect.addEventListener('change', (event) => {
    const nextProfile = machineProfiles.find(p => p.id === event.target.value);
    if (nextProfile) {
      activeProfile = nextProfile;
      updateProfileDetails();
    }
  });
}

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    if (currentGeometry) {
      exportCleanStl(currentGeometry, activeProfile);
    }
  });
}

async function onMeshSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setStatus(`Procesando ${file.name}...`);
  try {
    const geometry = await loadGeometryFromFile(file);
    const prepared = prepareGeometry(geometry);
    const mesh = buildMesh(prepared);
    setMesh(mesh, file.name);
    const analysis = analyzeGeometry(prepared);
    updateStats(analysis);
    updateSummary(analysis, file.name);
    exportBtn.disabled = false;
    meshStatus.classList.remove('warning');
    meshStatus.classList.add('success');
    setStatus('Malla lista para revisión.');
  } catch (error) {
    console.error(error);
    exportBtn.disabled = true;
    meshStatus.classList.remove('success');
    meshStatus.classList.add('warning');
    setStatus('Error al leer la malla. Verifica el formato.');
  }
}

function loadGeometryFromFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        if (extension === 'stl') {
          const loader = new STLLoader();
          const geometry = loader.parse(buffer);
          resolve(geometry);
        } else if (extension === 'obj') {
          const loader = new OBJLoader();
          const text = typeof buffer === 'string' ? buffer : new TextDecoder().decode(buffer);
          const obj = loader.parse(text);
          resolve(extractMergedGeometry(obj));
        } else if (extension === 'glb' || extension === 'gltf') {
          const loader = new GLTFLoader();
          const gltf = await loader.parseAsync(buffer, '');
          resolve(extractMergedGeometry(gltf.scene));
        } else {
          reject(new Error('Formato no soportado'));
        }
      } catch (err) {
        reject(err);
      }
    };
    if (extension === 'obj') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

function extractMergedGeometry(rootObject) {
  const geometries = [];
  rootObject.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const clone = child.geometry.clone();
      clone.applyMatrix4(child.matrixWorld);
      geometries.push(clone);
    }
  });
  if (!geometries.length) throw new Error('No se encontraron mallas en el archivo');
  return BufferGeometryUtils.mergeGeometries(geometries, true);
}

function prepareGeometry(geometry) {
  const merged = BufferGeometryUtils.mergeVertices(geometry, 1e-4);
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  merged.center();
  return merged;
}

function buildMesh(geometry) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x7c3aed,
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.geometry.computeBoundsTree();
  currentGeometry = geometry;
  return mesh;
}

function setMesh(mesh, name) {
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh.geometry.disposeBoundsTree?.();
    currentMesh.geometry.dispose();
  }
  currentMesh = mesh;
  scene.add(mesh);
  focusCamera(mesh.geometry.boundingSphere);
  mesh.name = name;
}

function analyzeGeometry(geometry) {
  const faces = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  const { boundaryEdges, nonManifoldEdges } = countEdges(geometry);
  const volumeMm3 = computeVolume(geometry);
  const dims = geometry.boundingBox;
  const thickness = estimateThickness(geometry);
  const thicknessMin = Number.isFinite(thickness.min) ? Number(thickness.min.toFixed(2)) : null;
  const thicknessMax = Number.isFinite(thickness.max) ? Number(thickness.max.toFixed(2)) : null;
  return {
    faces,
    boundaryEdges,
    nonManifoldEdges,
    volumeCm3: (volumeMm3 / 1000).toFixed(2),
    thicknessMin,
    thicknessMax,
    samples: thickness.samples,
    dims: dims ? {
      x: (dims.max.x - dims.min.x).toFixed(1),
      y: (dims.max.y - dims.min.y).toFixed(1),
      z: (dims.max.z - dims.min.z).toFixed(1)
    } : null
  };
}

function countEdges(geometry) {
  const geo = geometry.index ? geometry : BufferGeometryUtils.mergeVertices(geometry);
  if (!geo.index) {
    const indices = Array.from({ length: geo.attributes.position.count }, (_, i) => i);
    geo.setIndex(indices);
  }
  const edgeUse = new Map();
  const indexArray = geo.index.array;
  for (let i = 0; i < indexArray.length; i += 3) {
    addEdge(indexArray[i], indexArray[i + 1], edgeUse);
    addEdge(indexArray[i + 1], indexArray[i + 2], edgeUse);
    addEdge(indexArray[i + 2], indexArray[i], edgeUse);
  }
  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  edgeUse.forEach((count) => {
    if (count === 1) boundaryEdges += 1;
    if (count > 2) nonManifoldEdges += 1;
  });
  return { boundaryEdges, nonManifoldEdges };
}

function addEdge(a, b, map) {
  const key = a < b ? `${a}-${b}` : `${b}-${a}`;
  map.set(key, (map.get(key) || 0) + 1);
}

function computeVolume(geometry) {
  const position = geometry.getAttribute('position');
  const index = geometry.index ? geometry.index.array : null;
  let volume = 0;
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  if (index) {
    for (let i = 0; i < index.length; i += 3) {
      vA.fromBufferAttribute(position, index[i]);
      vB.fromBufferAttribute(position, index[i + 1]);
      vC.fromBufferAttribute(position, index[i + 2]);
      volume += vA.dot(vB.cross(vC));
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      vA.fromBufferAttribute(position, i);
      vB.fromBufferAttribute(position, i + 1);
      vC.fromBufferAttribute(position, i + 2);
      volume += vA.dot(vB.cross(vC));
    }
  }
  return Math.abs(volume / 6);
}

function estimateThickness(geometry) {
  if (!geometry.boundsTree) geometry.computeBoundsTree();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const mesh = new THREE.Mesh(geometry);
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;
  const dir = new THREE.Vector3();
  const origin = new THREE.Vector3();
  let min = Infinity;
  let max = 0;
  let samples = 0;
  const step = Math.max(1, Math.floor(position.count / 200));
  for (let i = 0; i < position.count; i += step) {
    origin.fromBufferAttribute(position, i);
    dir.fromBufferAttribute(normal, i).normalize();
    const forward = castRay(mesh, raycaster, origin, dir);
    const backward = castRay(mesh, raycaster, origin, dir.clone().multiplyScalar(-1));
    const total = (forward || 0) + (backward || 0);
    if (total > 0) {
      samples += 1;
      min = Math.min(min, total);
      max = Math.max(max, total);
    }
  }
  return {
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
    samples
  };
}

function castRay(mesh, raycaster, origin, direction) {
  raycaster.set(origin.clone().addScaledVector(direction, 0.001), direction);
  const hits = raycaster.intersectObject(mesh, false);
  const hit = hits.find(h => h.distance > 0.002);
  return hit?.distance || null;
}

function updateStats(analysis) {
  statFaces.textContent = analysis.faces.toLocaleString('es-CL');
  statBoundary.textContent = analysis.boundaryEdges;
  statNonManifold.textContent = analysis.nonManifoldEdges;
  statVolume.textContent = analysis.volumeCm3;
  statThickness.textContent = analysis.thicknessMin === null ? '—' : `${analysis.thicknessMin} (${analysis.samples || 'n'} muestras)`;
  statDims.textContent = analysis.dims ? `${analysis.dims.x} x ${analysis.dims.y} x ${analysis.dims.z}` : '—';
}

function updateSummary(analysis, name) {
  meshSummary.innerHTML = `
    <div class="summary-row"><span class="label">Archivo</span><span>${name}</span></div>
    <div class="summary-row"><span class="label">Caras</span><span>${analysis.faces.toLocaleString('es-CL')}</span></div>
    <div class="summary-row"><span class="label">Volumen</span><span>${analysis.volumeCm3} cm³</span></div>
    <div class="summary-row"><span class="label">Dimensiones</span><span>${analysis.dims ? `${analysis.dims.x}×${analysis.dims.y}×${analysis.dims.z} mm` : '—'}</span></div>
    <div class="summary-row"><span class="label">Espesor mínimo</span><span>${analysis.thicknessMin ?? '—'} mm</span></div>
    <div class="summary-row"><span class="label">Edge check</span><span>${analysis.boundaryEdges} abiertas · ${analysis.nonManifoldEdges} no manifold</span></div>
  `;
}

function setStatus(message) {
  if (meshStatus) {
    meshStatus.textContent = message;
  }
}

function exportCleanStl(geometry, profile) {
  const exporter = new STLExporter();
  const clone = geometry.clone();
  clone.computeBoundingBox();
  applyProfileTransform(clone, profile);
  const stlBuffer = exporter.parse(clone, { binary: true });
  const blob = new Blob([stlBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vibraalto-${profile.id}.stl`;
  link.click();
  URL.revokeObjectURL(url);
}

function applyProfileTransform(geometry, profile) {
  geometry.scale(profile.scale, profile.scale, profile.scale);
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const offsetY = bbox ? -bbox.min.y : 0;
  geometry.translate(0, offsetY, 0);
}

function populateProfiles() {
  if (!profileSelect) return;
  profileSelect.innerHTML = '';
  machineProfiles.forEach((profile) => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    profileSelect.appendChild(option);
  });
  profileSelect.value = activeProfile.id;
}

function updateProfileDetails() {
  if (!profileDetails || !activeProfile) return;
  profileDetails.innerHTML = `
    <div class="profile-card">
      <p class="label">Escala</p>
      <p class="value">${activeProfile.scale}x</p>
    </div>
    <div class="profile-card">
      <p class="label">Tolerancia</p>
      <p class="value">${activeProfile.tolerance}</p>
    </div>
    <div class="profile-card">
      <p class="label">Nozzle / layer</p>
      <p class="value">${activeProfile.nozzle} · ${activeProfile.layerHeight}</p>
    </div>
    <div class="profile-card">
      <p class="label">Materiales</p>
      <p class="value">${activeProfile.materials}</p>
    </div>
    <div class="profile-card wide">
      <p class="label">Notas</p>
      <p class="value">${activeProfile.notes}</p>
    </div>
  `;
}

function populateMaterials() {
  if (!materialsContainer) return;
  materialsContainer.innerHTML = '';
  materials.forEach((mat) => {
    const card = document.createElement('article');
    card.className = 'material-card';
    card.innerHTML = `
      <div class="material-head">
        <h3>${mat.name}</h3>
        <p class="pill">${mat.uses}</p>
      </div>
      <ul class="material-meta">
        <li><strong>Temp:</strong> ${mat.temp}</li>
        <li><strong>Post:</strong> ${mat.post}</li>
      </ul>
      <p class="muted">${mat.notes}</p>
    `;
    materialsContainer.appendChild(card);
  });
}

function initViewer() {
  if (!viewerContainer) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8fafc);
  camera = new THREE.PerspectiveCamera(60, viewerContainer.clientWidth / viewerContainer.clientHeight, 0.01, 50);
  camera.position.set(0.25, 0.2, 0.35);

  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(1, 1, 1);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
  rimLight.position.set(-0.8, 0.8, -0.5);
  scene.add(ambient, keyLight, rimLight);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  viewerContainer.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.05, 0);

  const grid = new THREE.GridHelper(0.4, 20, 0xcbd5e1, 0xe2e8f0);
  scene.add(grid);

  const vrButton = VRButton.createButton(renderer);
  if (vrButtonSlot) {
    vrButtonSlot.appendChild(vrButton);
  } else {
    document.body.appendChild(vrButton);
  }

  window.addEventListener('resize', onResize);
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

function focusCamera(boundingSphere) {
  if (!boundingSphere) return;
  const distance = boundingSphere.radius * 3.0;
  camera.position.set(distance, distance * 0.6, distance);
  controls.target.copy(boundingSphere.center);
  controls.update();
}

function onResize() {
  if (!viewerContainer || !renderer) return;
  const { clientWidth, clientHeight } = viewerContainer;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight);
}

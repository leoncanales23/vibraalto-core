import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import { ImprovedNoise } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/math/ImprovedNoise.js';

const canvas = document.getElementById('experience-canvas');
const hudState = document.getElementById('hud-state');
const hudCount = document.getElementById('hud-count');
const cliForm = document.getElementById('cli-form');
const cliInput = document.getElementById('cli-input');
const cliOutput = document.getElementById('cli-output');

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05030a);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 1.5, 4.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
keyLight.position.set(2, 3, 2);
scene.add(keyLight);

// Instancing
const instanceCount = 420;
const basePositions = [];
const dummy = new THREE.Object3D();
const noise = new ImprovedNoise();
const curlNoise = (p) => {
  const eps = 0.1;
  const n1 = noise.noise(p.y + eps, p.z, p.x) - noise.noise(p.y - eps, p.z, p.x);
  const n2 = noise.noise(p.y, p.z + eps, p.x) - noise.noise(p.y, p.z - eps, p.x);
  const n3 = noise.noise(p.y, p.z, p.x + eps) - noise.noise(p.y, p.z, p.x - eps);
  return new THREE.Vector3(n1, n2, n3).divideScalar(2 * eps);
};

const geometry = new THREE.IcosahedronGeometry(0.07, 0);
const material = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#a076f6'),
  roughness: 0.35,
  metalness: 0.25,
  emissive: new THREE.Color('#4534d4'),
  emissiveIntensity: 0.35,
});

const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);
instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(instancedMesh);

for (let i = 0; i < instanceCount; i++) {
  const r = Math.random() * 1.5 + 0.75;
  const theta = Math.random() * Math.PI * 2;
  const y = (Math.random() - 0.5) * 1.5;
  const x = Math.cos(theta) * r;
  const z = Math.sin(theta) * r;
  basePositions.push(new THREE.Vector3(x, y, z));
}

// Postprocessing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.7,
  0.6,
  0.0
);
bloomPass.threshold = 0.2;
composer.addPass(bloomPass);

const ChromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.0025 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      vec2 offset = vec2(strength, 0.0);
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};
const chromaPass = new ShaderPass(ChromaticShader);
composer.addPass(chromaPass);

// HUD values
if (hudCount) hudCount.textContent = instanceCount.toString();

// State & CLI
const state = {
  mode: 'idle',
  bloom: 0.7,
  chroma: 0.0025,
  warp: false,
};

const log = (message) => {
  if (!cliOutput) return;
  const line = document.createElement('div');
  line.textContent = message;
  cliOutput.appendChild(line);
  while (cliOutput.children.length > 14) {
    cliOutput.removeChild(cliOutput.firstChild);
  }
  cliOutput.scrollTop = cliOutput.scrollHeight;
};

const refreshHUD = () => {
  if (hudState) hudState.textContent = state.mode + (state.warp ? ' (warp)' : '');
  bloomPass.strength = state.bloom;
  chromaPass.uniforms.strength.value = state.chroma;
};

const commands = {
  help: () => {
    log('Comandos: help, state <idle|pulse|storm>, warp, bloom <0-2>, chroma <0-0.01>, clear');
  },
  clear: () => {
    if (cliOutput) cliOutput.textContent = '';
  },
  state: (arg) => {
    if (!arg) return log('state requiere modo');
    state.mode = arg;
    log(`Estado -> ${arg}`);
    refreshHUD();
  },
  bloom: (arg) => {
    const val = parseFloat(arg);
    if (isNaN(val)) return log('bloom requiere número');
    state.bloom = THREE.MathUtils.clamp(val, 0, 2.5);
    log(`Bloom -> ${state.bloom.toFixed(2)}`);
    refreshHUD();
  },
  chroma: (arg) => {
    const val = parseFloat(arg);
    if (isNaN(val)) return log('chroma requiere número');
    state.chroma = THREE.MathUtils.clamp(val, 0, 0.02);
    log(`Chromatic -> ${state.chroma.toFixed(4)}`);
    refreshHUD();
  },
  warp: () => {
    state.warp = !state.warp;
    log(`Warp ${state.warp ? 'activado' : 'desactivado'}`);
    refreshHUD();
  },
};

if (cliForm && cliInput) {
  cliForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const raw = cliInput.value.trim();
    if (!raw) return;
    cliInput.value = '';
    const [cmd, ...args] = raw.split(' ');
    const action = commands[cmd];
    if (action) {
      action(args.join(' '));
    } else {
      log(`Comando no reconocido: ${cmd}`);
    }
  });
  log('CLI listo: usa help para lista de comandos.');
}

// Animation
let start = performance.now();
const tmpVec = new THREE.Vector3();

const animate = () => {
  const elapsed = (performance.now() - start) * 0.001;
  const modeSpeed =
    state.mode === 'pulse' ? 0.7 : state.mode === 'storm' ? 1.4 : 0.35;
  const warpBoost = state.warp ? 1.7 : 1.0;
  const time = elapsed * modeSpeed * warpBoost;

  for (let i = 0; i < instanceCount; i++) {
    const base = basePositions[i];
    tmpVec.copy(base).multiplyScalar(0.6);
    tmpVec.addScalar(time * 0.35);
    const curl = curlNoise(tmpVec);
    const wobble = curl.multiplyScalar(0.8 + Math.sin(time + i) * 0.2);
    const pos = base.clone().addScaledVector(wobble, 0.5);
    dummy.position.copy(pos);
    dummy.rotation.set(
      Math.sin(time + i * 0.5) * 0.6,
      Math.cos(time * 0.6 + i) * 0.6,
      Math.sin(time * 0.4 + i * 0.3) * 0.6
    );
    const scalePulse = state.mode === 'pulse' ? 0.4 + Math.abs(Math.sin(time + i)) * 0.25 : 1;
    dummy.scale.setScalar(0.85 * scalePulse);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
  }
  instancedMesh.instanceMatrix.needsUpdate = true;

  composer.render();
  requestAnimationFrame(animate);
};

refreshHUD();
animate();

const onResize = () => {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
};
window.addEventListener('resize', onResize);

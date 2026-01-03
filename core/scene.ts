import {
  Color,
  ColorRepresentation,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface SceneContext {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  composer: EffectComposer;
  controls: OrbitControls;
  dispose: () => void;
}

export interface SceneOptions {
  background?: Color | string | number;
  cameraDistance?: number;
  fov?: number;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  enableTAA?: boolean;
}

const defaultOptions: Required<Pick<SceneOptions, 'cameraDistance' | 'fov' | 'bloomStrength' | 'bloomRadius' | 'bloomThreshold'>> = {
  cameraDistance: 7,
  fov: 50,
  bloomStrength: 0.65,
  bloomRadius: 0.25,
  bloomThreshold: 0.2,
};

function createRenderer(target: HTMLElement, enableTAA: boolean): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: enableTAA, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(target.clientWidth, target.clientHeight);
  renderer.setClearColor(new Color(0x000000), 0);
  renderer.outputColorSpace = SRGBColorSpace;
  target.appendChild(renderer.domElement);
  return renderer;
}

function createCamera(target: HTMLElement, fov: number, distance: number): PerspectiveCamera {
  const aspect = Math.max(1, target.clientWidth / Math.max(1, target.clientHeight));
  const camera = new PerspectiveCamera(fov, aspect, 0.01, 100);
  camera.position.set(0, distance * 0.35, distance);
  camera.lookAt(0, 0, 0);
  return camera;
}

function createComposer(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  options: Required<Pick<SceneOptions, 'bloomStrength' | 'bloomRadius' | 'bloomThreshold'>>,
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const resolution = new Vector2(window.innerWidth, window.innerHeight);
  const bloom = new UnrealBloomPass(
    resolution,
    options.bloomStrength,
    options.bloomRadius,
    options.bloomThreshold,
  );
  composer.addPass(bloom);
  return composer;
}

export function setupScene(container: HTMLElement, opts: SceneOptions = {}): SceneContext {
  const merged = { ...defaultOptions, ...opts };
  const scene = new Scene();

  if (merged.background !== undefined) {
    scene.background = new Color(merged.background as ColorRepresentation);
  }

  const renderer = createRenderer(container, Boolean(merged.enableTAA));
  const camera = createCamera(container, merged.fov, merged.cameraDistance);
  const composer = createComposer(renderer, scene, camera, {
    bloomStrength: merged.bloomStrength,
    bloomRadius: merged.bloomRadius,
    bloomThreshold: merged.bloomThreshold,
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.target.set(0, 0, 0);
  controls.update();

  const onResize = () => {
    const { clientWidth, clientHeight } = container;
    const aspect = Math.max(1, clientWidth / Math.max(1, clientHeight));
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
    composer.setSize(clientWidth, clientHeight);
  };

  window.addEventListener('resize', onResize);

  return {
    scene,
    camera,
    renderer,
    composer,
    controls,
    dispose: () => {
      window.removeEventListener('resize', onResize);
      controls.dispose();
      composer.passes.forEach((pass) => {
        if (typeof (pass as { dispose?: () => void }).dispose === 'function') {
          (pass as { dispose?: () => void }).dispose?.();
        }
      });
      renderer.dispose();
    },
  };
}

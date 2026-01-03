import {
  GLSL3,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';

export interface CurlNoiseConfig {
  frequency?: number;
  amplitude?: number;
  speed?: number;
  scale?: Vector3;
  offset?: Vector3;
}

export interface CurlNoiseUniforms {
  uTime: { value: number };
  uFrequency: { value: number };
  uAmplitude: { value: number };
  uCurlScale: { value: Vector3 };
  uOffset: { value: Vector3 };
}

const defaultConfig: Required<CurlNoiseConfig> = {
  frequency: 1.35,
  amplitude: 1.0,
  speed: 0.12,
  scale: new Vector3(1.0, 1.0, 0.25),
  offset: new Vector3(),
};

export function createCurlNoiseMaterial(config: CurlNoiseConfig = {}): RawShaderMaterial {
  const uniforms: CurlNoiseUniforms = {
    uTime: { value: 0 },
    uFrequency: { value: config.frequency ?? defaultConfig.frequency },
    uAmplitude: { value: config.amplitude ?? defaultConfig.amplitude },
    uCurlScale: { value: config.scale ?? defaultConfig.scale.clone() },
    uOffset: { value: config.offset ?? defaultConfig.offset.clone() },
  };

  const vertexShader = /* glsl */ `#version 300 es
    in vec3 position;
    in vec2 uv;
    out vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `#version 300 es
    precision highp float;

    out vec4 outColor;
    in vec2 vUv;

    uniform float uTime;
    uniform float uFrequency;
    uniform float uAmplitude;
    uniform vec3 uCurlScale;
    uniform vec3 uOffset;

    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
      return mod289(((x * 34.0) + 1.0) * x);
    }

    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      // First corner
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );

      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

      // Permutations
      i = mod289(i);
      vec4 p = permute( permute( permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

      // Gradients
      float n_ = 0.142857142857; // 1.0/7.0
      vec3  ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );

      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );

      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    vec3 curlNoise(vec3 p) {
      float e = 0.1;
      vec3 dx = vec3(e, 0.0, 0.0);
      vec3 dy = vec3(0.0, e, 0.0);
      vec3 dz = vec3(0.0, 0.0, e);

      float px = snoise(p + dy);
      float nx = snoise(p - dy);
      float py = snoise(p + dz);
      float ny = snoise(p - dz);
      float pz = snoise(p + dx);
      float nz = snoise(p - dx);

      float cx = py - ny - px + nx;
      float cy = pz - nz - py + ny;
      float cz = px - nx - pz + nz;
      return normalize(vec3(cx, cy, cz) / (2.0 * e) + 1e-6);
    }

    void main() {
      vec2 centeredUv = vUv * 2.0 - 1.0;
      vec3 warped = vec3(centeredUv * uCurlScale.xy, uTime * uCurlScale.z) + uOffset;
      vec3 curl = curlNoise(warped * uFrequency);
      outColor = vec4(curl * uAmplitude, 1.0);
    }
  `;

  return new RawShaderMaterial({
    glslVersion: GLSL3,
    uniforms,
    vertexShader,
    fragmentShader,
  });
}

export class CurlNoiseField {
  readonly target: WebGLRenderTarget;
  readonly material: RawShaderMaterial;
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  private readonly quad: Mesh<PlaneGeometry, RawShaderMaterial>;
  private readonly speed: number;

  constructor(size = 256, config: CurlNoiseConfig = {}) {
    this.material = createCurlNoiseMaterial(config);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.target = new WebGLRenderTarget(size, size, {
      depthBuffer: false,
      stencilBuffer: false,
      magFilter: LinearFilter,
      minFilter: LinearFilter,
    });

    this.speed = config.speed ?? defaultConfig.speed;
  }

  update(renderer: WebGLRenderer, elapsed: number): void {
    this.material.uniforms.uTime.value = elapsed * this.speed;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }

  setFrequency(value: number): void {
    this.material.uniforms.uFrequency.value = value;
  }

  setAmplitude(value: number): void {
    this.material.uniforms.uAmplitude.value = value;
  }

  setScale(value: Vector3): void {
    this.material.uniforms.uCurlScale.value.copy(value);
  }

  setOffset(value: Vector3): void {
    this.material.uniforms.uOffset.value.copy(value);
  }

  dispose(): void {
    this.quad.geometry.dispose();
    this.material.dispose();
    this.target.dispose();
  }
}

export const defaultCurlResolution = new Vector2(256, 256);

import {
  densityFrag,
  fullscreenQuadVert,
  ghostFrag,
  integrationFrag,
  particleFrag,
  particleVert,
  veilFrag,
  veilVert
} from './shaders';

type Vec3 = [number, number, number];
export type ParticleRenderMode = 'points' | 'veil' | 'ghost';

interface TextureTarget {
  framebuffer: WebGLFramebuffer;
  position: WebGLTexture;
  velocity: WebGLTexture;
}

interface DensityTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  resolution: [number, number];
}

export interface ParticleSystemOptions {
  textureSize?: [number, number];
  drag?: number;
  gravity?: Vec3;
  pointSize?: number;
  trail?: number;
  alphaScale?: number;
  densityResolution?: [number, number];
  frequency?: number;
  amplitude?: number;
}

const defaultOptions: Required<ParticleSystemOptions> = {
  textureSize: [128, 128],
  drag: 0.75,
  gravity: [0, -0.5, 0],
  pointSize: 2.5,
  trail: 0.08,
  alphaScale: 3.0,
  densityResolution: [512, 512],
  frequency: 1.5,
  amplitude: 2.0
};

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('No shader allocated');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${info ?? ''}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vert: string, frag: string) {
  const program = gl.createProgram();
  if (!program) throw new Error('No program allocated');
  const vs = createShader(gl, gl.VERTEX_SHADER, vert);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${info ?? ''}`);
  }
  return program;
}

function createDataTexture(gl: WebGL2RenderingContext, width: number, height: number, data?: Float32Array) {
  const texture = gl.createTexture();
  if (!texture) throw new Error('No texture allocated');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    width,
    height,
    0,
    gl.RGBA,
    gl.FLOAT,
    data ?? null
  );
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function makeStateTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  seedPositions: Float32Array,
  seedVelocities: Float32Array
): TextureTarget {
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) throw new Error('No framebuffer allocated');

  const position = createDataTexture(gl, width, height, seedPositions);
  const velocity = createDataTexture(gl, width, height, seedVelocities);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, position, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, velocity, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { framebuffer, position, velocity };
}

function makeDensityTarget(gl: WebGL2RenderingContext, width: number, height: number): DensityTarget {
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) throw new Error('No density framebuffer allocated');

  const texture = createDataTexture(gl, width, height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { framebuffer, texture, resolution: [width, height] };
}

function seedArrays(count: number, spread = 1.0) {
  const pos = new Float32Array(count * 4);
  const vel = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = Math.cbrt(r) * spread;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const idx = i * 4;
    pos[idx] = x;
    pos[idx + 1] = y;
    pos[idx + 2] = z;
    pos[idx + 3] = 1;

    vel[idx] = 0;
    vel[idx + 1] = 0;
    vel[idx + 2] = 0;
    vel[idx + 3] = 1;
  }
  return { pos, vel };
}

function bindTextures(gl: WebGL2RenderingContext, program: WebGLProgram, bindings: Record<string, WebGLTexture>) {
  let unit = 0;
  for (const [uniformName, texture] of Object.entries(bindings)) {
    const location = gl.getUniformLocation(program, uniformName);
    if (!location) continue;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
    unit++;
  }
}

export class ParticleFBOIntegrator {
  private gl: WebGL2RenderingContext;
  private options: Required<ParticleSystemOptions>;
  private textureSize: [number, number];
  private count: number;
  private readState: TextureTarget;
  private writeState: TextureTarget;
  private density: DensityTarget;

  private quadVao: WebGLVertexArrayObject;
  private pointVao: WebGLVertexArrayObject;

  private integrationProgram: WebGLProgram;
  private pointProgram: WebGLProgram;
  private veilProgram: WebGLProgram;
  private densityProgram: WebGLProgram;
  private ghostProgram: WebGLProgram;

  mode: ParticleRenderMode = 'points';

  constructor(gl: WebGL2RenderingContext, opts: ParticleSystemOptions = {}) {
    this.gl = gl;
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('EXT_color_buffer_float is required for GPU integration.');
    }
    this.options = { ...defaultOptions, ...opts };
    this.textureSize = this.options.textureSize;
    this.count = this.textureSize[0] * this.textureSize[1];

    const { pos, vel } = seedArrays(this.count, 0.65);
    this.readState = makeStateTarget(gl, this.textureSize[0], this.textureSize[1], pos, vel);
    this.writeState = makeStateTarget(gl, this.textureSize[0], this.textureSize[1], pos, vel);
    this.density = makeDensityTarget(gl, this.options.densityResolution[0], this.options.densityResolution[1]);

    this.integrationProgram = createProgram(gl, fullscreenQuadVert, integrationFrag);
    this.pointProgram = createProgram(gl, particleVert, particleFrag);
    this.veilProgram = createProgram(gl, veilVert, veilFrag);
    this.densityProgram = createProgram(gl, particleVert, densityFrag);
    this.ghostProgram = createProgram(gl, fullscreenQuadVert, ghostFrag);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('No VAO allocated');
    this.quadVao = vao;
    const pointVao = gl.createVertexArray();
    if (!pointVao) throw new Error('No point VAO allocated');
    this.pointVao = pointVao;
  }

  setMode(mode: ParticleRenderMode) {
    this.mode = mode;
  }

  step(deltaTime: number, time: number) {
    const gl = this.gl;
    gl.useProgram(this.integrationProgram);
    gl.bindVertexArray(this.quadVao);
    gl.viewport(0, 0, this.textureSize[0], this.textureSize[1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.writeState.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

    bindTextures(gl, this.integrationProgram, {
      uPosition: this.readState.position,
      uVelocity: this.readState.velocity
    });

    gl.uniform2f(gl.getUniformLocation(this.integrationProgram, 'uTextureSize'), this.textureSize[0], this.textureSize[1]);
    gl.uniform1f(gl.getUniformLocation(this.integrationProgram, 'uDelta'), deltaTime);
    gl.uniform1f(gl.getUniformLocation(this.integrationProgram, 'uDrag'), this.options.drag);
    gl.uniform1f(gl.getUniformLocation(this.integrationProgram, 'uTime'), time);
    gl.uniform1f(gl.getUniformLocation(this.integrationProgram, 'uFrequency'), this.options.frequency);
    gl.uniform1f(gl.getUniformLocation(this.integrationProgram, 'uAmplitude'), this.options.amplitude);
    gl.uniform3f(
      gl.getUniformLocation(this.integrationProgram, 'uGravity'),
      this.options.gravity[0],
      this.options.gravity[1],
      this.options.gravity[2]
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.swap();
  }

  render(viewProjection: Float32Array) {
    switch (this.mode) {
      case 'veil':
        this.renderVeil(viewProjection);
        break;
      case 'ghost':
        this.renderGhost(viewProjection);
        break;
      default:
        this.renderPoints(viewProjection);
    }
  }

  private renderPoints(viewProjection: Float32Array) {
    const gl = this.gl;
    gl.useProgram(this.pointProgram);
    gl.bindVertexArray(this.pointVao);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    bindTextures(gl, this.pointProgram, { uPosition: this.readState.position });

    gl.uniformMatrix4fv(gl.getUniformLocation(this.pointProgram, 'uViewProj'), false, viewProjection);
    gl.uniform2i(gl.getUniformLocation(this.pointProgram, 'uTextureSize'), this.textureSize[0], this.textureSize[1]);
    gl.uniform1f(gl.getUniformLocation(this.pointProgram, 'uPointSize'), this.options.pointSize);
    gl.uniform3f(gl.getUniformLocation(this.pointProgram, 'uColor'), 0.85, 0.78, 1.0);

    gl.drawArrays(gl.POINTS, 0, this.count);
  }

  private renderVeil(viewProjection: Float32Array) {
    const gl = this.gl;
    gl.useProgram(this.veilProgram);
    gl.bindVertexArray(this.pointVao);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    bindTextures(gl, this.veilProgram, {
      uPosition: this.readState.position,
      uVelocity: this.readState.velocity
    });

    gl.uniformMatrix4fv(gl.getUniformLocation(this.veilProgram, 'uViewProj'), false, viewProjection);
    gl.uniform2i(gl.getUniformLocation(this.veilProgram, 'uTextureSize'), this.textureSize[0], this.textureSize[1]);
    gl.uniform1f(gl.getUniformLocation(this.veilProgram, 'uTrail'), this.options.trail);
    gl.uniform3f(gl.getUniformLocation(this.veilProgram, 'uHeadColor'), 0.96, 0.82, 0.35);
    gl.uniform3f(gl.getUniformLocation(this.veilProgram, 'uTailColor'), 0.24, 0.05, 0.38);

    gl.drawArrays(gl.LINES, 0, this.count * 2);
  }

  private renderGhost(viewProjection: Float32Array) {
    const gl = this.gl;
    // Density accumulation pass.
    gl.useProgram(this.densityProgram);
    gl.bindVertexArray(this.pointVao);
    gl.viewport(0, 0, this.density.resolution[0], this.density.resolution[1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.density.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    bindTextures(gl, this.densityProgram, { uPosition: this.readState.position });
    gl.uniformMatrix4fv(gl.getUniformLocation(this.densityProgram, 'uViewProj'), false, viewProjection);
    gl.uniform2i(gl.getUniformLocation(this.densityProgram, 'uTextureSize'), this.textureSize[0], this.textureSize[1]);
    gl.uniform1f(gl.getUniformLocation(this.densityProgram, 'uPointSize'), this.options.pointSize * 1.35);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.disable(gl.BLEND);

    // Composite to screen.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.ghostProgram);
    gl.bindVertexArray(this.quadVao);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    bindTextures(gl, this.ghostProgram, { uDensity: this.density.texture });
    gl.uniform2f(
      gl.getUniformLocation(this.ghostProgram, 'uResolution'),
      this.density.resolution[0],
      this.density.resolution[1]
    );
    gl.uniform1f(gl.getUniformLocation(this.ghostProgram, 'uAlphaScale'), this.options.alphaScale);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
  }

  private swap() {
    const tmp = this.readState;
    this.readState = this.writeState;
    this.writeState = tmp;
  }
}

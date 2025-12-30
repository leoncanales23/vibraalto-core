export const fullscreenQuadVert = `#version 300 es
precision highp float;

const vec2 POSITIONS[6] = vec2[](
  vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
  vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0)
);

void main() {
  gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}`;

export const integrationFrag = `#version 300 es
precision highp float;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform vec2 uTextureSize;
uniform float uDelta;
uniform float uDrag;
uniform float uTime;
uniform float uFrequency;
uniform float uAmplitude;
uniform vec3 uGravity;

layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;

vec2 uvFromFragCoord() {
  return (gl_FragCoord.xy - 0.5) / uTextureSize;
}

vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}

vec3 curlNoise(vec3 p) {
  const float e = 0.25;
  vec3 x0 = hash3(p + vec3(e, 0.0, 0.0));
  vec3 x1 = hash3(p - vec3(e, 0.0, 0.0));
  vec3 y0 = hash3(p + vec3(0.0, e, 0.0));
  vec3 y1 = hash3(p - vec3(0.0, e, 0.0));
  vec3 z0 = hash3(p + vec3(0.0, 0.0, e));
  vec3 z1 = hash3(p - vec3(0.0, 0.0, e));

  float dZdY = (z0.y - z1.y) / (2.0 * e);
  float dYdZ = (y0.z - y1.z) / (2.0 * e);
  float dXdZ = (x0.z - x1.z) / (2.0 * e);
  float dZdX = (z0.x - z1.x) / (2.0 * e);
  float dYdX = (y0.x - y1.x) / (2.0 * e);
  float dXdY = (x0.y - x1.y) / (2.0 * e);

  return vec3(dZdY - dYdZ, dXdZ - dZdX, dYdX - dXdY);
}

void main() {
  vec2 uv = uvFromFragCoord();
  vec3 position = texture(uPosition, uv).xyz;
  vec3 velocity = texture(uVelocity, uv).xyz;

  vec3 curl = curlNoise(position * uFrequency + uTime * 0.25);
  velocity += curl * uAmplitude * uDelta;
  velocity += uGravity * uDelta;
  velocity *= exp(-uDrag * uDelta);

  position += velocity * uDelta;

  outPosition = vec4(position, 1.0);
  outVelocity = vec4(velocity, 1.0);
}`;

const COMMON_INDEX = `vec2 indexToUV(int idx, ivec2 size) {
  int x = idx - (idx / size.x) * size.x;
  int y = idx / size.x;
  return (vec2(float(x) + 0.5, float(y) + 0.5) / vec2(size));
}`;

export const particleVert = `#version 300 es
precision highp float;
${COMMON_INDEX}

uniform sampler2D uPosition;
uniform ivec2 uTextureSize;
uniform mat4 uViewProj;
uniform float uPointSize;

out float vDensity;

void main() {
  int idx = gl_VertexID;
  vec2 uv = indexToUV(idx, uTextureSize);
  vec3 pos = texture(uPosition, uv).xyz;
  gl_Position = uViewProj * vec4(pos, 1.0);
  gl_PointSize = uPointSize;
  vDensity = clamp(length(pos) * 0.01, 0.0, 1.0);
}`;

export const particleFrag = `#version 300 es
precision highp float;

in float vDensity;
uniform vec3 uColor;
out vec4 fragColor;

void main() {
  float falloff = smoothstep(1.0, 0.2, length(gl_PointCoord - 0.5) * 2.0);
  float alpha = mix(1.0, 0.35, vDensity) * falloff;
  fragColor = vec4(uColor, alpha);
}`;

export const veilVert = `#version 300 es
precision highp float;
${COMMON_INDEX}

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform ivec2 uTextureSize;
uniform mat4 uViewProj;
uniform float uTrail;

out float vSpeed;

void main() {
  int particle = gl_VertexID / 2;
  bool head = (gl_VertexID & 1) == 0;

  vec2 uv = indexToUV(particle, uTextureSize);
  vec3 pos = texture(uPosition, uv).xyz;
  vec3 vel = texture(uVelocity, uv).xyz;

  vec3 linePos = head ? pos : pos - vel * uTrail;
  vSpeed = length(vel);
  gl_Position = uViewProj * vec4(linePos, 1.0);
}`;

export const veilFrag = `#version 300 es
precision highp float;

in float vSpeed;
uniform vec3 uHeadColor;
uniform vec3 uTailColor;
out vec4 fragColor;

void main() {
  float t = clamp(vSpeed * 0.25, 0.0, 1.0);
  fragColor = vec4(mix(uTailColor, uHeadColor, t), 1.0);
}`;

export const densityFrag = `#version 300 es
precision highp float;

in float vDensity;
out vec4 fragColor;

void main() {
  float falloff = smoothstep(1.0, 0.05, length(gl_PointCoord - 0.5));
  fragColor = vec4(vec3(falloff * (1.0 - vDensity)), falloff);
}`;

export const ghostFrag = `#version 300 es
precision highp float;

uniform sampler2D uDensity;
uniform vec2 uResolution;
uniform float uAlphaScale;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float d = texture(uDensity, uv).a;
  float alpha = 1.0 - exp(-d * uAlphaScale);
  fragColor = vec4(vec3(d), alpha);
}`;

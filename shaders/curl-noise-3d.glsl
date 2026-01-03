#version 300 es
precision highp float;

// 3D curl-noise shader.
// Uniforms
//  - time: advances the underlying noise field
//  - frequency: spatial frequency multiplier
//  - amplitude: scales the resulting curl
// Optional: set `resolution` when running as a fullscreen pass.
uniform float time;
uniform float frequency;
uniform float amplitude;
uniform vec2 resolution;

out vec4 fragColor;

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
  {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0 + 3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (7*7).
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
  }

vec3 noiseField(vec3 p) {
  // Offset the coordinates so each channel samples a distinct field.
  return vec3(
    snoise(p),
    snoise(p + vec3(23.17, 4.03, 7.13)),
    snoise(p + vec3(11.8, 19.1, 3.07))
  );
}

vec3 curlNoise(vec3 p) {
  float e = 0.2;
  vec3 dx1 = noiseField(p + vec3(e, 0.0, 0.0));
  vec3 dx2 = noiseField(p - vec3(e, 0.0, 0.0));
  vec3 dy1 = noiseField(p + vec3(0.0, e, 0.0));
  vec3 dy2 = noiseField(p - vec3(0.0, e, 0.0));
  vec3 dz1 = noiseField(p + vec3(0.0, 0.0, e));
  vec3 dz2 = noiseField(p - vec3(0.0, 0.0, e));

  float dZdY = (dz1.y - dz2.y) / (2.0 * e);
  float dYdZ = (dy1.z - dy2.z) / (2.0 * e);
  float dXdZ = (dx1.z - dx2.z) / (2.0 * e);
  float dZdX = (dz1.x - dz2.x) / (2.0 * e);
  float dYdX = (dy1.x - dy2.x) / (2.0 * e);
  float dXdY = (dx1.y - dx2.y) / (2.0 * e);

  return vec3(dZdY - dYdZ, dXdZ - dZdX, dYdX - dXdY);
}

vec2 screenUV() {
  if (all(equal(resolution, vec2(0.0)))) {
    return vec2(0.0);
  }
  return gl_FragCoord.xy / resolution;
}

void main() {
  vec2 uv = screenUV();
  vec3 p = vec3(uv * frequency, time * 0.1);
  vec3 curl = curlNoise(p) * amplitude;

  // Encode the curl direction and strength.
  float strength = length(curl);
  fragColor = vec4(normalize(curl) * 0.5 + 0.5, strength);
}

export const vertex = /* glsl */`#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// Full watercolor-raindrop transition (desktop / high-power GPUs)
export const fragmentFull = /* glsl */`#version 300 es
precision highp float;

uniform sampler2D tFrom;
uniform sampler2D tTo;
uniform float uProgress;
uniform vec2 uDrop1;
uniform vec2 uDrop2;
uniform float uFromAspect;
uniform float uToAspect;
uniform float uScreenAspect;

in vec2 vUv;
out vec4 fragColor;

// ── Noise ────────────────────────────────────────────────────────
float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i),           hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.17 + vec2(1.3, 0.7);
    a *= 0.48;
  }
  return v;
}

// Curl noise (divergence-free 2D swirl)
vec2 curl2D(vec2 p) {
  const float E = 0.01;
  float dx = fbm(p + vec2(0.0, E)) - fbm(p - vec2(0.0, E));
  float dy = fbm(p + vec2(E, 0.0)) - fbm(p - vec2(E, 0.0));
  return vec2(dx, -dy) / (2.0 * E);
}

// ── Contain-mode UV (letterbox/pillarbox) ────────────────────────
vec2 containUV(vec2 uv, float imgAspect, float screenAspect) {
  float sa = screenAspect;
  float ia = imgAspect;
  vec2 result = uv;
  if (sa > ia) {
    float sx = ia / sa;
    result.x = (uv.x - 0.5) / sx + 0.5;
  } else {
    float sy = sa / ia;
    result.y = (uv.y - 0.5) / sy + 0.5;
  }
  return result;
}

bool inBounds(vec2 uv) {
  return uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
}

// ── Kuwahara filter (radius 2, 4 × 3×3 windows) ─────────────────
vec3 kuwahara(sampler2D tex, vec2 uv, float px) {
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  float n = 9.0;

  // Quadrant offsets: TL(-,-) TR(+,-) BL(-,+) BR(+,+)
  for (int x = 0; x <= 2; x++) {
    for (int y = 0; y <= 2; y++) {
      vec2 d = vec2(float(x), float(y)) * px;
      vec3 tl = texture(tex, uv + vec2(-d.x, -d.y)).rgb;
      vec3 tr = texture(tex, uv + vec2( d.x, -d.y)).rgb;
      vec3 bl = texture(tex, uv + vec2(-d.x,  d.y)).rgb;
      vec3 br = texture(tex, uv + vec2( d.x,  d.y)).rgb;
      m0 += tl; s0 += tl * tl;
      m1 += tr; s1 += tr * tr;
      m2 += bl; s2 += bl * bl;
      m3 += br; s3 += br * br;
    }
  }
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  float v0 = dot(s0/n - m0*m0, vec3(0.299, 0.587, 0.114));
  float v1 = dot(s1/n - m1*m1, vec3(0.299, 0.587, 0.114));
  float v2 = dot(s2/n - m2*m2, vec3(0.299, 0.587, 0.114));
  float v3 = dot(s3/n - m3*m3, vec3(0.299, 0.587, 0.114));

  vec3 result = m0;
  float minV = v0;
  if (v1 < minV) { minV = v1; result = m1; }
  if (v2 < minV) { minV = v2; result = m2; }
  if (v3 < minV) {             result = m3; }
  return result;
}

// ── Sobel edge detection ─────────────────────────────────────────
float sobel(sampler2D tex, vec2 uv, float px) {
  float d = px;
  vec3 tl = texture(tex, uv + vec2(-d, -d)).rgb;
  vec3 tc = texture(tex, uv + vec2( 0.0,-d)).rgb;
  vec3 tr = texture(tex, uv + vec2( d, -d)).rgb;
  vec3 ml = texture(tex, uv + vec2(-d, 0.0)).rgb;
  vec3 mr = texture(tex, uv + vec2( d, 0.0)).rgb;
  vec3 bl = texture(tex, uv + vec2(-d,  d)).rgb;
  vec3 bc = texture(tex, uv + vec2( 0.0, d)).rgb;
  vec3 br = texture(tex, uv + vec2( d,  d)).rgb;
  vec3 gx = (-tl - 2.0*ml - bl) + (tr + 2.0*mr + br);
  vec3 gy = (-tl - 2.0*tc - tr) + (bl + 2.0*bc + br);
  return clamp(length(gx + gy) * 0.35, 0.0, 1.0);
}

// ── Paper grain (multi-scale) ────────────────────────────────────
float grain(vec2 uv) {
  float g = vnoise(uv * 550.0) * 0.55
          + vnoise(uv * 180.0) * 0.30
          + vnoise(uv * 70.0)  * 0.15;
  return g * 0.055 - 0.027;
}

// ── Main ─────────────────────────────────────────────────────────
void main() {
  vec2 uv = vUv;
  float t = uProgress;
  const float PI = 3.14159265;

  // Timing envelopes
  float dropHit1    = smoothstep(0.0,  0.20, t);
  float phase1      = smoothstep(0.05, 0.50, t);    // A→watercolor
  float phase2      = smoothstep(0.55, 0.96, t);    // B watercolor→sharp
  float dropHit2    = smoothstep(0.52, 0.72, t);
  float swirlEnv    = sin(t * PI);                  // peaks at t=0.5

  // Aspect-correct screen UV for drops
  vec2 screenUV = uv * vec2(uScreenAspect, 1.0);
  vec2 d1 = screenUV - uDrop1 * vec2(uScreenAspect, 1.0);
  vec2 d2 = screenUV - uDrop2 * vec2(uScreenAspect, 1.0);
  float distD1 = length(d1);
  float distD2 = length(d2);

  // Ripple from drop 1
  float ripple1 = sin(distD1 * 28.0 - dropHit1 * 20.0)
                * exp(-distD1 * 9.0)
                * exp(-dropHit1 * 4.5)
                * (1.0 - phase1)
                * 0.013;
  vec2 rOff1 = normalize(d1 + 1e-5) * ripple1;

  // Ripple from drop 2
  float ripple2 = sin(distD2 * 28.0 - dropHit2 * 20.0)
                * exp(-distD2 * 9.0)
                * exp(-dropHit2 * 4.5)
                * phase2
                * 0.013;
  vec2 rOff2 = normalize(d2 + 1e-5) * ripple2;

  // Domain warp (curl noise swirl, peaks mid-transition)
  float warp = swirlEnv * 0.027;
  vec2 c = curl2D(uv * 2.8 + 0.5) * warp
         + curl2D(uv * 6.1 + vec2(2.3, 1.1)) * warp * 0.38;

  // Kuwahara radius ramps with swirlEnv
  float kR = swirlEnv * 0.0055;

  // ── Sample texture A ──
  vec2 uvA_tex = containUV(uv + rOff1 + c, uFromAspect, uScreenAspect);
  vec2 uvA_sharp = containUV(uv + rOff1, uFromAspect, uScreenAspect);
  vec3 sharpA = inBounds(uvA_sharp) ? texture(tFrom, uvA_sharp).rgb : vec3(0.0);
  vec3 paintA = (kR > 0.0005 && inBounds(uvA_tex))
                  ? kuwahara(tFrom, uvA_tex, kR)
                  : sharpA;
  float edgeA = sobel(tFrom, uvA_tex, 0.0028) * phase1 * 0.55;
  float grainV = grain(uv);
  vec3 wcA = mix(sharpA,
                 clamp(paintA * (0.88 - edgeA) + grainV, 0.0, 1.0),
                 phase1);

  // ── Sample texture B ──
  vec2 uvB_tex = containUV(uv + rOff2 + c, uToAspect, uScreenAspect);
  vec2 uvB_sharp = containUV(uv + rOff2, uToAspect, uScreenAspect);
  vec3 sharpB = inBounds(uvB_sharp) ? texture(tTo, uvB_sharp).rgb : vec3(0.0);
  vec3 paintB = (kR > 0.0005 && inBounds(uvB_tex))
                  ? kuwahara(tTo, uvB_tex, kR)
                  : sharpB;
  float edgeB = sobel(tTo, uvB_tex, 0.0028) * (1.0 - phase2) * 0.55;
  vec3 wcB = mix(clamp(paintB * (0.88 - edgeB) + grainV, 0.0, 1.0),
                 sharpB,
                 phase2);

  // ── Radial reveal mask from drop 2 ──
  float revealRadius = dropHit2 * 1.9;
  float softEdge = mix(0.25, 0.04, phase2);
  float mask = smoothstep(distD2, distD2 - softEdge, revealRadius);
  // Ensure full coverage as transition completes
  mask = max(mask, smoothstep(0.7, 1.0, t));
  mask = clamp(mask, 0.0, 1.0);

  vec3 col = mix(wcA, wcB, mask);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// Lightweight fallback for mobile / low-power GPUs
export const fragmentSimple = /* glsl */`#version 300 es
precision mediump float;

uniform sampler2D tFrom;
uniform sampler2D tTo;
uniform float uProgress;
uniform float uFromAspect;
uniform float uToAspect;
uniform float uScreenAspect;

in vec2 vUv;
out vec4 fragColor;

vec2 containUV(vec2 uv, float imgAspect, float screenAspect) {
  vec2 result = uv;
  if (screenAspect > imgAspect) {
    result.x = (uv.x - 0.5) / (imgAspect / screenAspect) + 0.5;
  } else {
    result.y = (uv.y - 0.5) / (screenAspect / imgAspect) + 0.5;
  }
  return result;
}
bool inBounds(vec2 uv) {
  return uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
}

void main() {
  vec2 uvA = containUV(vUv, uFromAspect, uScreenAspect);
  vec2 uvB = containUV(vUv, uToAspect, uScreenAspect);
  vec3 a = inBounds(uvA) ? texture(tFrom, uvA).rgb : vec3(0.0);
  vec3 b = inBounds(uvB) ? texture(tTo,   uvB).rgb : vec3(0.0);
  float t = uProgress;
  float smooth_t = t * t * (3.0 - 2.0 * t);
  fragColor = vec4(mix(a, b, smooth_t), 1.0);
}`;

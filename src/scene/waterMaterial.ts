import * as THREE from 'three'
import { NOISE_SIZE, noiseTex } from './worldFx'

/**
 * 툰 물 셰이더. 바다·연못·개울이 같은 셰이더를 쓰고 kind 로 결만 다르게 한다.
 *
 * - 정점마다 aDepth(물 밑 땅까지 깊이)를 미리 구워 둔다. 얕을수록 밝은 청록, 깊을수록 진한 파랑.
 * - 물가(얕은 곳)엔 밀려왔다 빠지는 하얀 거품 띠, 얕은 바닥엔 일렁이는 물결무늬(코스틱).
 * - 해 쪽으로 반짝이는 윤슬은 잡음 값을 문턱으로 잘라 셀 셰이딩처럼 또렷하게 찍는다.
 * - 비스듬히 볼수록 하늘색을 비춘다(프레넬). 하늘색·햇빛은 Sky 와 같은 값을 매 프레임 받는다.
 * - 개울은 uv.y(물길 따라 거리)로 흐르는 물살 줄무늬를 그린다.
 */

export type WaterKind = 'sea' | 'pond' | 'stream'

const KIND: Record<WaterKind, number> = { sea: 0, pond: 1, stream: 2 }
const RIPPLE_N = 10

/** 모든 물 재질이 같이 쓰는 값. Waters/Island 의 useFrame 에서 한 번만 갱신한다. */
export const waterUniforms = {
  uTime: { value: 0 },
  uSky: { value: new THREE.Color('#8fd3f4') },
  uSun: { value: new THREE.Color('#fff4e0') },
  uSunDir: { value: new THREE.Vector3(0.3, 1, 0.45).normalize() },
  /** 0(한낮)~1(한밤). 밤엔 물빛이 가라앉고 윤슬이 달빛처럼 은은해진다 */
  uNight: { value: 0 },
  /** 0~1: 비가 오면 물이 흐리고 윤슬이 줄어들며 빗방울 파문이 생긴다 */
  uRain: { value: 0 },
  /** 물결 높이 배율. 바람 날엔 높아지고 태풍엔 더 높다 */
  uSwell: { value: 1 },
  /** 0~1: 해 질 녘이면 윤슬이 주황빛을 띤다 */
  uSunset: { value: 0 },
  /** 파문 고리: (x, z, 시작 시각, 세기). 찌·입질·물 걷기에서 ripple() 로 채운다. */
  uRipples: { value: Array.from({ length: RIPPLE_N }, () => new THREE.Vector4(0, 0, -100, 0)) },
}

let rippleNext = 0

/** 물 위에 동그란 파문을 하나 퍼뜨린다. 슬롯이 다 차면 가장 오래된 것을 덮는다. */
export function ripple(x: number, z: number, strength = 1) {
  waterUniforms.uRipples.value[rippleNext].set(x, z, waterUniforms.uTime.value, strength)
  rippleNext = (rippleNext + 1) % RIPPLE_N
}

const vertex = /* glsl */ `
  attribute float aDepth;
  uniform float uTime;
  uniform float uSwell;
  uniform float uKind;
  varying float vDepth;
  varying vec3 vWorld;
  varying vec3 vNormal2;
  varying vec2 vUv;
  #include <fog_pars_vertex>

  void main() {
    vUv = uv;
    vDepth = aDepth;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = vec3(0.0, 1.0, 0.0);
    if (uKind < 0.5) {
      // 바다: 두 방향 물결. 기울기로 법선을 바로 구해 CPU 계산을 없앤다.
      float a = world.x * 0.35 + uTime * 1.2;
      float b = world.z * 0.3 + uTime * 0.9;
      float c = (world.x + world.z) * 0.6 + uTime * 1.7;
      // 아주 얕은 물가는 덜 출렁여야 거품 띠가 모래를 넘지 않는다.
      float amp = mix(0.35, 1.0, clamp(aDepth / 1.2, 0.0, 1.0)) * uSwell;
      world.y += (sin(a) * 0.05 + cos(b) * 0.05 + sin(c) * 0.015) * amp;
      n = normalize(vec3(-(cos(a) * 0.0175 + cos(c) * 0.009) * amp, 1.0, (sin(b) * 0.015 - cos(c) * 0.009) * amp));
    } else {
      // 연못·개울: 잔잔하게 살짝만 숨쉰다.
      world.y += sin(world.x * 1.3 + uTime * 1.5) * cos(world.z * 1.1 + uTime * 1.2) * 0.008;
    }
    vWorld = world.xyz;
    vNormal2 = n;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uKind;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform float uNight;
  uniform float uSunset;
  uniform float uRain;
  uniform float uDepthScale;
  uniform vec4 uRipples[${RIPPLE_N}];
  varying float vDepth;
  varying vec3 vWorld;
  varying vec3 vNormal2;
  varying vec2 vUv;
  #include <fog_pars_fragment>

  // 잡음은 땅과 같은 64×64 무작위 텍스처를 읽는다(셰이더에서 사인 해시를 매번 계산하지 않게).
  uniform sampler2D uNoiseTex;
  float hash(vec2 cell) { return texture2D(uNoiseTex, (cell + 0.5) / ${NOISE_SIZE}.0).r; }
  float noise(vec2 p) { return texture2D(uNoiseTex, (p + 0.5) / ${NOISE_SIZE}.0).r; }

  void main() {
    // 바다 판이 섬 밑(개울 바닥처럼 바다보다 낮게 파인 곳)으로 비치지 않게 한다.
    if (uKind < 0.5 && vDepth < -0.03) discard;
    float depth = max(vDepth, 0.0);
    float d = clamp(depth / uDepthScale, 0.0, 1.0);
    vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d));

    // 셀 셰이딩: 햇빛을 두 단계로만 나눈다.
    float ndl = dot(normalize(vNormal2), normalize(uSunDir));
    col *= ndl > 0.985 ? 1.06 : 0.97;

    // 프레넬: 멀리 비스듬히 보이는 물은 하늘을 비춘다.
    vec3 view = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(view, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
    col = mix(col, uSky, fres * 0.55);

    // 얕은 바닥 물결무늬(코스틱): 겹친 잡음의 골짜기를 밝게 긋는다.
    vec2 q = vWorld.xz * 0.9;
    float cn = abs(noise(q + vec2(uTime * 0.25, uTime * 0.18)) - noise(q * 1.3 - vec2(uTime * 0.2, -uTime * 0.12)));
    float caustic = (1.0 - smoothstep(0.0, 0.07, cn)) * (1.0 - smoothstep(0.15, 0.9, d)) * (1.0 - uNight * 0.7);
    col += caustic * 0.14;

    // 개울: 물길 따라 흘러가는 물살 줄무늬
    if (uKind > 1.5) {
      float flow = vUv.y * 1.4 - uTime * 1.3 + noise(vec2(vUv.x * 3.0, vUv.y * 0.8)) * 0.8;
      float streak = step(0.86, fract(flow)) * (1.0 - abs(vUv.x - 0.5) * 1.2);
      col = mix(col, vec3(1.0), streak * 0.35);
    }

    // 물가 거품: 바닷가는 밀려왔다 빠지는 띠 두 줄 + 모래에 닿는 하얀 테두리
    float foam = 0.0;
    if (uKind < 0.5) {
      float wobble = noise(vWorld.xz * 0.5 + uTime * 0.1) * 0.25;
      float band = fract(depth * 1.6 - uTime * 0.35 + wobble);
      foam = step(0.82, band) * (1.0 - smoothstep(0.2, 0.75, depth));
      foam = max(foam, 1.0 - smoothstep(0.04, 0.14 + sin(uTime * 1.3 + vWorld.x * 0.2) * 0.04, depth));
    } else {
      // 연못·개울: 둑에 닿는 가는 테두리만
      foam = (1.0 - smoothstep(0.0, 0.05, depth)) * 0.5;
    }
    col = mix(col, vec3(1.0), foam * (1.0 - uNight * 0.45));

    // 윤슬: 해가 비치는 쪽 물결 꼭대기에서 반짝. 셀처럼 또렷하게 문턱으로 자른다.
    vec3 h = normalize(normalize(uSunDir) + view);
    float spec = pow(max(dot(normalize(vNormal2 + vec3(noise(vWorld.xz * 2.5 + uTime * 0.6) - 0.5, 0.0, noise(vWorld.zx * 2.5 - uTime * 0.5) - 0.5) * 0.35), h), 0.0), 60.0);
    // 해가 낮게 걸린 노을엔 물비늘이 더 많이 반짝인다.
    float warmSun = clamp(uSun.r - uSun.b, 0.0, 1.0);
    float glint = step(mix(0.5, 0.22, warmSun), spec) * (1.0 - uRain * 0.8);
    col += uSun * glint * mix(0.6, 0.3, uNight);
    col += uSunset * glint * vec3(1.0, 0.55, 0.2) * 0.9;
    // 노을 해 빛 길: 해 쪽 물결 전체가 넓게 주황으로 번진다(위 윤슬은 점이고 이건 띠다)
    float path = pow(max(dot(normalize(vNormal2), h), 0.0), 10.0);
    col += uSunset * path * vec3(1.0, 0.6, 0.25) * 0.5 * (1.0 - uRain * 0.8);

    // 햇빛 색을 물에 입힌다: 낮엔 거의 그대로, 노을엔 주황빛 물비늘, 밤엔 푸르스름.
    col *= mix(vec3(1.0), uSun, 0.2);
    float warmth = clamp(uSun.r - uSun.b, 0.0, 1.0);
    col = mix(col, uSun * vec3(1.0, 0.82, 0.72), warmth * 0.42 * (0.6 + fres));

    // 파문: 퍼지는 고리 두 겹. 오래될수록 넓고 흐려진다.
    float ring = 0.0;
    for (int i = 0; i < ${RIPPLE_N}; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (age < 0.0 || age > 1.8) continue;
      float dist = length(vWorld.xz - r.xy);
      float fade = (1.0 - age / 1.8) * r.w;
      ring += (1.0 - smoothstep(0.0, 0.05, abs(dist - age * 0.75))) * fade;
      ring += (1.0 - smoothstep(0.0, 0.04, abs(dist - max(0.0, age - 0.3) * 0.75))) * fade * 0.6;
    }
    // 빗방울: 칸마다 제각각 시각에 작은 파문이 톡톡 생긴다.
    if (uRain > 0.0) {
      vec2 g = vWorld.xz * 1.4;
      vec2 cell = floor(g);
      vec2 local = fract(g) - 0.5 - (vec2(hash(cell), hash(cell + 3.1)) - 0.5) * 0.5;
      float t = fract(uTime * 0.9 + hash(cell + 7.7));
      ring += (1.0 - smoothstep(0.0, 0.045, abs(length(local) - t * 0.4))) * (1.0 - t) * uRain;
    }
    col = mix(col, vec3(1.0), clamp(ring, 0.0, 1.0) * 0.75);

    // 밤엔 물빛을 가라앉힌다.
    col *= mix(1.0, 0.55, uNight);

    float alpha = mix(0.62, 0.92, smoothstep(0.0, 0.9, d));
    alpha = max(alpha, max(foam, clamp(ring, 0.0, 1.0) * 0.8));
    // 개울은 양옆 가장자리를 흐려서 둑과 만나는 선이 톱니처럼 보이지 않게 한다.
    if (uKind > 1.5) alpha *= smoothstep(0.0, 0.14, min(vUv.x, 1.0 - vUv.x));
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }
`

const PALETTE: Record<WaterKind, { shallow: string; deep: string; scale: number }> = {
  sea: { shallow: '#6fe0da', deep: '#2f8fc4', scale: 2.4 },
  pond: { shallow: '#8fe3cf', deep: '#4fb3bd', scale: 0.9 },
  stream: { shallow: '#9be9e0', deep: '#5bbad0', scale: 1.1 },
}

export function makeWaterMaterial(kind: WaterKind): THREE.ShaderMaterial {
  const p = PALETTE[kind]
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      ...waterUniforms,
      uKind: { value: KIND[kind] },
      uShallow: { value: new THREE.Color(p.shallow) },
      uDeep: { value: new THREE.Color(p.deep) },
      uDepthScale: { value: p.scale },
      uNoiseTex: { value: noiseTex },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    fog: true,
    depthWrite: false,
    side: kind === 'stream' ? THREE.DoubleSide : THREE.FrontSide,
  })
}

/** 정점마다 물 깊이를 구워 둔다. surface 는 그 자리 수면 높이, ground 는 땅 높이 함수. */
export function bakeDepth(geo: THREE.BufferGeometry, surface: (x: number, z: number) => number, ground: (x: number, z: number) => number, offset = { x: 0, z: 0 }) {
  const pos = geo.attributes.position
  const depth = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offset.x
    const z = pos.getZ(i) + offset.z
    depth[i] = surface(x, z) - ground(x, z)
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1))
}

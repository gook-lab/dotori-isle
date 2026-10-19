import * as THREE from 'three'

/**
 * 기존 재질에 덧붙이는 셰이더 효과. 재질을 새로 짜지 않고 onBeforeCompile 로 몇 줄만 끼워 넣는다.
 *
 * - 구름 그림자: 땅 위로 큰 얼룩 그림자가 바람 방향으로 천천히 흘러간다. 맑은 날 낮에만 또렷하다.
 * - 바람: 풀 덤불 끝이 바람에 살랑인다. 비 오는 날은 더 세게 흔들린다.
 *
 * 값은 Sky 의 useFrame 에서 매 프레임 갱신한다.
 */
const FIELD = {
  uDirt: { value: new THREE.Color('#d9a877') },
  uSand: { value: new THREE.Color('#f6e4b0') },
  uWet: { value: new THREE.Color('#d9c48e') },
}

export const worldUniforms = {
  uTime: { value: 0 },
  /** 0~1: 밤 정도. 땅 셰이더가 밤에는 채도를 빼고 달빛 쪽으로 푸르게 물들인다 */
  uNight: { value: 0 },
  /** 0~1: 구름 그림자 진하기 */
  uCloud: { value: 0 },
  /** 0~1: 비 오는 날 땅이 젖어 조금 어둡고 진하다 */
  uRain: { value: 0 },
  /** 바람 세기 배율 */
  uWind: { value: 1 },
}

/**
 * 값 잡음을 셰이더에서 매번 계산하지 않고, 64×64 무작위 텍스처를 선형 보간으로 읽는다.
 * 땅은 화면 대부분을 덮어서 픽셀마다 잡음을 여러 번 부르면 무거워진다.
 */
export const NOISE_SIZE = 64
export const noiseTex = (() => {
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE)
  let seed = 1234567
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647
    data[i] = seed % 256
  }
  const tex = new THREE.DataTexture(data, NOISE_SIZE, NOISE_SIZE, THREE.RedFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
})()

const NOISE = /* glsl */ `
  uniform sampler2D uNoiseTex;
  // 격자 한 칸 = 텍스처 한 텍셀. 텍셀 가운데를 맞춰 읽어야 값 잡음과 같은 모양이 된다.
  float fxNoise(vec2 p) { return texture2D(uNoiseTex, (p + 0.5) / ${NOISE_SIZE}.0).r; }
`

/**
 * 땅 재질: 정점 색(잔디·흙·모래) 위에 픽셀 단위 결을 얹고, 구름 그림자를 드리운다.
 *
 * - 잔디: 큰 얼룩(밝고 어두운 잔디밭) + 작은 풀잎 점
 * - 모래: 바람 물결무늬, 바닷물에 닿는 곳은 젖어서 짙은 띠(파도 따라 들락날락)
 * - 절벽(기울어진 흙): 가로 지층 줄무늬
 * 판별은 높이와 기울기로 한다. 정점 색은 그대로 두고 밝기만 조금씩 바꿔 셀 셰이딩 느낌을 해치지 않는다.
 */
/**
 * 밤 톤: 채도를 빼고 달빛 쪽(푸른)으로 가라앉힌다. uNight 0(낮)~1(밤), mask 0~1 로 세기를 정한다.
 * 땅(field)은 전부 1, 식물(plant)은 붉은 기가 강한(꽃·열매·노란 잎) 픽셀만 빼고 받는다. 청록 잎은 밤 톤을 받는다.
 */
const NIGHT_TONE = /* glsl */ `
uniform float uNight;
vec3 nightTone(vec3 c, float mask) {
  float nl = dot(c, vec3(0.3, 0.59, 0.11));
  // 밝은 땅(눈·모래)은 밝기를 덜 잃고 달빛 푸른 빛을 받는다. 따뜻한 밝은 색(모래)은 색을 일부 남긴다.
  float keep = smoothstep(0.6, 0.9, nl);
  float warm = smoothstep(0.05, 0.25, c.r - c.b);
  vec3 moon = vec3(nl) * vec3(0.8, 0.9, 1.08);
  // 눈·밝은 모래는 달빛 아래서도 밝게 남는다(밤 조명이 어두워 알베도를 조금 더 올린다).
  // 채도가 있는 밝은 색(연두 풀·절벽 띠)은 올리지 않는다. 그러면 밤에 형광처럼 튄다.
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float white = keep * (1.0 - smoothstep(0.12, 0.3, sat));
  vec3 lit = c * vec3(0.86, 0.93, 1.06) * (1.0 + 1.4 * white);
  vec3 target = mix(moon, lit, keep);
  float amt = uNight * 0.55 * mask * (1.0 - keep * 0.45) * (1.0 - warm * 0.45);
  return mix(c, target, amt);
}
`

/**
 * 캐시 키를 이어 붙인다. 앞에 효과가 명시적으로 정한 키가 있으면 살리고 이 효과 이름을 뒤에 더한다.
 * three 기본 키(onBeforeCompile 함수 소스)는 이어 쓰지 않는다. 같은 효과 조합끼리만 프로그램을 공유하도록 이름을 명시적으로 쓴다.
 */
export function chainKey<T extends THREE.Material>(mat: T, tag: string): void {
  const own = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : undefined
  mat.customProgramCacheKey = () => `${own ? own.call(mat) : ''}|${tag}`
}

/** 식물 재질에 밤 톤을 더한다. 기존 onBeforeCompile(예: 플레이어 가림)을 이어서 쓴다. */
export function withNightTone<T extends THREE.Material>(mat: T, kind: 'plant' | 'field' = 'plant'): T {
  const prevCompile = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(mat, shader, renderer)
    shader.uniforms.uNight = worldUniforms.uNight
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NIGHT_TONE}`)
      .replace(
        '#include <color_fragment>',
        kind === 'plant'
          ? '#include <color_fragment>\n{ float gw = smoothstep(0.02, 0.12, diffuseColor.r - diffuseColor.b); diffuseColor.rgb = nightTone(diffuseColor.rgb, 1.0 - gw); }'
          : '#include <color_fragment>\n{ diffuseColor.rgb = nightTone(diffuseColor.rgb, 1.0); }',
      )
  }
  chainKey(mat, `night-${kind}`)
  return mat
}

export function withCloudShadows<T extends THREE.Material>(mat: T): T {
  const prevCompile = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(mat, shader, renderer)
    // 밤 톤이 먼저 붙은 재질이면 밤 함수와 밤 호출을 다시 넣지 않는다(같은 이름 함수가 두 번 나오면 셰이더가 깨진다)
    const nightOn = shader.fragmentShader.includes('vec3 nightTone(')
    shader.uniforms.uTime = worldUniforms.uTime
    shader.uniforms.uCloud = worldUniforms.uCloud
    shader.uniforms.uRain = worldUniforms.uRain
    shader.uniforms.uNight = worldUniforms.uNight
    shader.uniforms.uNoiseTex = { value: noiseTex }
    Object.assign(shader.uniforms, FIELD)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 aGrass;\nattribute float aKeep;\nvarying vec3 vGrass;\nvarying float vKeep;\nvarying vec2 vCloudPos;\nvarying float vFieldY;\nvarying float vFieldUp;',
      )
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvec4 fieldWorld = modelMatrix * vec4(transformed, 1.0);\nvCloudPos = fieldWorld.xz;\nvFieldY = fieldWorld.y;\nvFieldUp = normalize(mat3(modelMatrix) * objectNormal).y;\nvGrass = aGrass;\nvKeep = aKeep;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vGrass;\nvarying float vKeep;\nvarying vec2 vCloudPos;\nvarying float vFieldY;\nvarying float vFieldUp;\nuniform float uTime;\nuniform float uCloud;\nuniform float uRain;\nuniform vec3 uDirt;\n${nightOn ? '' : NIGHT_TONE}\nuniform vec3 uSand;\nuniform vec3 uWet;\n${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          vec2 p = vCloudPos;
          // 잔디·흙·모래를 정점 색 대신 그 픽셀 높이로 다시 고른다. 경계가 정점 격자를 따라 톱니지지 않고
          // 등고선처럼 매끈해진다. 가장자리는 잡음으로 살짝 흔들어 자연스럽게.
          float edgeJitter = (fxNoise(p * 1.3) - 0.5) * 0.04;
          vec3 field = mix(uSand, uDirt, smoothstep(0.47, 0.53, vFieldY + edgeJitter));
          field = mix(field, vGrass, smoothstep(0.8, 0.84, vFieldY + edgeJitter));
          field = mix(uWet * clamp(1.0 + vFieldY * 0.16, 0.6, 1.0), field, smoothstep(0.0, 0.04, vFieldY));
          diffuseColor.rgb = mix(field, diffuseColor.rgb, vKeep);
          // 비가 오면 땅이 젖어 조금 짙어진다(물웅덩이·모래가 같이 어두워진다)
          diffuseColor.rgb *= 1.0 - 0.12 * uRain;
          float slope = 1.0 - clamp(vFieldUp, 0.0, 1.0);
          float flat_ = 1.0 - smoothstep(0.12, 0.3, slope);
          // 잔디: 잔디 높이(0.85 이상)의 평평한 곳
          float grass = smoothstep(0.8, 0.84, vFieldY) * flat_;
          float patchy = fxNoise(p * 0.45) * 0.6 + fxNoise(p * 1.7) * 0.4;
          float blades = step(0.8, fxNoise(p * 7.0 + 3.0));
          float g = (0.94 + patchy * 0.1) * (1.0 + blades * 0.06);
          // 모래: 해안 쪽 낮은 평지
          float sand = (1.0 - smoothstep(0.42, 0.5, vFieldY)) * flat_ * step(-0.4, vFieldY);
          float ripples = sin(dot(p, vec2(0.55, 0.83)) * 4.5 + fxNoise(p * 0.8) * 4.0) * 0.5 + 0.5;
          float sd = 0.975 + step(0.72, ripples) * 0.04;
          // 젖은 모래: 물가에서 파도처럼 들락날락하는 짙은 띠
          float wetLine = 0.13 + sin(uTime * 1.3 + p.x * 0.2) * 0.03;
          float wet = 1.0 - smoothstep(wetLine - 0.04, wetLine, vFieldY);
          sd *= mix(1.0, 0.82, wet * sand);
          // 절벽: 기울어진 흙에 가로 지층
          float cliff = smoothstep(0.25, 0.45, slope);
          float strata = 0.93 + step(0.5, fract(vFieldY * 6.0 + fxNoise(p * 0.6) * 0.6)) * 0.08;
          float k = mix(1.0, g, grass);
          k = mix(k, sd, sand);
          k = mix(k, strata, cliff);
          diffuseColor.rgb *= k;
          // 밤: 짙은 풀색을 달빛 톤으로(식물 헬퍼와 같은 nightTone)
          ${nightOn ? '' : 'diffuseColor.rgb = nightTone(diffuseColor.rgb, 1.0);'}
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          // 큰 덩어리 + 잔물결 두 겹 잡음을 문턱으로 잘라 몽실한 구름 모양을 만든다.
          vec2 cp = vCloudPos * 0.065 + vec2(uTime * 0.03, uTime * 0.017);
          float n = fxNoise(cp) * 0.65 + fxNoise(cp * 2.3 + 4.1) * 0.35;
          float shade = smoothstep(0.42, 0.52, n) * uCloud;
          outgoingLight *= 1.0 - shade;
        }
        #include <opaque_fragment>`,
      )
  }
  chainKey(mat, 'field')
  return mat
}

/**
 * 인스턴스 풀 덤불을 바람에 흔든다. 높이(로컬 y)가 높을수록 많이 휘고,
 * 인스턴스 자리마다 위상이 달라 물결처럼 번져 나간다.
 */
export function withWind<T extends THREE.Material>(mat: T, base = -0.17, height = 0.34): T {
  const prevCompile = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(mat, shader, renderer)
    shader.uniforms.uTime = worldUniforms.uTime
    shader.uniforms.uWind = worldUniforms.uWind
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;').replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      {
        float h = clamp((transformed.y - (${base.toFixed(3)})) / ${height.toFixed(3)}, 0.0, 1.0);
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        // 바람이 한 방향(+x)으로 불고, 자리마다 늦게 도착한다.
        float gust = sin(uTime * 1.8 - ip.x * 0.18 - ip.y * 0.07) * 0.6 + sin(uTime * 3.1 + ip.y * 0.5) * 0.25;
        transformed.x += (gust + 0.35) * h * h * 0.12 * uWind;
        transformed.z += sin(uTime * 2.3 + ip.x * 0.4) * h * h * 0.04 * uWind;
      }`,
    )
  }
  chainKey(mat, `wind:${base}:${height}`)
  return mat
}

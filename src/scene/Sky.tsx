import { isIndoor } from '../game/indoor'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { currentHour, lightingAt, sunDirection, sunElevation, sunSkyDirection } from '../core/clock'
import { dayIndex } from '../core/economy'
import { fogActive } from '../core/fog'
import { seasonFor } from '../core/season'
import { weatherFor, weatherLighting } from '../core/weather'
import { windLevel } from '../core/wind'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { updateInteriorMood } from './interiorMood'
import { ripple, waterUniforms } from './waterMaterial'
import { worldUniforms } from './worldFx'
import { skyGlow } from './skyGlow'

const WHITE = new THREE.Color('#ffffff')
const INDOOR_BG = '#2b1f17'
// 달빛은 차갑고 옅은 파랑. 밤에만 환경광에 조금 섞는다.
const MOON = new THREE.Color('#b9c8ff')
const FIRE_NAVY = new THREE.Color('#070b22')
/** 해 질 녘·새벽 하늘 색 */
const PURPLE = new THREE.Color('#4b3f78')
const ORANGE = new THREE.Color('#ff9d5c')
const PINK = new THREE.Color('#ffb8c6')
const SUN_DAY = new THREE.Color('#fff1d0')
const SUN_EVENING = new THREE.Color('#ffb36b')
const SUN_DAWN = new THREE.Color('#ffd1a8')
/** 해 질 녘·새벽에 반구광(위쪽 환경광)이 물드는 분홍보라 */
const TWILIGHT_HEMI = new THREE.Color('#d9a0c8')
/** 태풍 하늘의 회청색 */
const STORM_SKY = [0.16, 0.2, 0.28]
const STORM_FOG = new THREE.Color(STORM_SKY[0], STORM_SKY[1], STORM_SKY[2])
/** 하늘 돔 반지름. 카메라 먼 면(300)보다 안쪽이어야 한다. */
const DOME_R = 220
/** 달이 하늘에 걸리는 자리와 그 자리에서의 가로·세로 축 */
// 달은 해 반대편(남쪽, +z)에 낮게 걸린다. 높이 약 17°: 올려다보는 카메라(위쪽 약 23°) 안에 든다.
const MOON_DIR = new THREE.Vector3(-0.45, 0.3, 0.84).normalize()
const MOON_U = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), MOON_DIR).normalize()
const MOON_V = new THREE.Vector3().crossVectors(MOON_DIR, MOON_U).normalize()

/** 하늘 돔: 천정에서 지평선으로 가는 색 그라데이션, 해 주변 빛과 해 원반, 밤의 달과 은하수 띠 */
const DOME_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const DOME_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform float uSunGlow;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonU;
  uniform vec3 uMoonV;
  uniform float uMoonPhase;
  uniform float uMoonAmt;
  uniform float uTwi;
  uniform vec3 uGlowColor;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    // 지평선 쪽은 옅게, 천정 쪽은 진하게
    vec3 col = d.y < 0.0 ? uHorizon : mix(uHorizon, uZenith, pow(clamp(d.y, 0.0, 1.0), 0.55));
    // 해 주변 빛: 해 쪽이 번진다
    float sd = max(dot(d, uSunDir), 0.0);
    col += uSunColor * uSunGlow * (pow(sd, 6.0) * 0.3 + pow(sd, 60.0) * 0.5);
    // 해 질 녘·새벽: 지평선 띠가 위로 번져 주황(새벽엔 분홍)이 또렷하게 보인다
    float low = exp(-d.y * d.y * 40.0);
    col += uGlowColor * uTwi * low * 0.5;
    // 해 원반
    col = mix(col, uSunColor * 1.15, uSunGlow * smoothstep(0.9988, 0.9994, sd));
    // 은하수 띠: 밤에만, 옅은 먼지 결
    // 은하수 띠는 남쪽(+z) 높이 약 17° 를 지나 머리 위로 넘는 큰 원이다(법선이 띠의 극). 올려다보는 카메라에 걸린다.
    vec3 bn = vec3(1.0, 0.0, 0.0);
    float band = exp(-pow(dot(d, bn), 2.0) * 22.0);
    float dust = 0.75 + 0.25 * sin(d.x * 23.0 + d.z * 9.0) * sin(d.y * 19.0 - d.x * 5.0);
    col += vec3(0.7, 0.8, 1.0) * band * dust * uNight * 0.22 * step(0.0, d.y);
    // 달: 위상은 밝은 부분을 가리는 그림자 원을 옆으로 밀어서 만든다
    vec3 off = d - uMoonDir;
    vec2 l = vec2(dot(off, uMoonU), dot(off, uMoonV));
    float R = 0.035;
    float disc = 1.0 - smoothstep(R * 0.92, R, length(l));
    float shadow = 1.0 - smoothstep(R * 0.92, R, length(l - vec2(2.0 * R * uMoonPhase, 0.0)));
    float halo = exp(-dot(l, l) / (R * R * 12.0)) * 0.25;
    col += vec3(0.95, 0.95, 0.88) * disc * (1.0 - shadow) * uMoonAmt;
    col += vec3(0.8, 0.85, 1.0) * halo * uMoonAmt;
    gl_FragColor = vec4(col, 1.0);
  }
`

/** 하늘색·햇빛·안개를 현재 시각에 맞추고, 그림자 카메라가 플레이어를 따라가게 한다. */
/** 그림자 지도 한 칸의 월드 크기(그림자 카메라 폭 44 / 2048). */
const SHADOW_TEXEL = 44 / 2048
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _c = new THREE.Vector3()
/**
 * 해를 플레이어 쪽으로 겨누되, 그림자 카메라 중심을 빛 기준 평면에서 그림자 지도 한 칸 단위로 맞춘다.
 * 플레이어가 움직일 때마다 그림자 가장자리가 반 칸씩 흔들리며 톱니처럼 깨져 보이던 것을 막는다.
 */
function aimSun(light: THREE.DirectionalLight, p: { x: number; y: number; z: number }, dx: number, dy: number, dz: number, dist: number) {
  _fwd.set(-dx, -dy, -dz).normalize()
  _up.set(0, 1, 0)
  if (Math.abs(_fwd.y) > 0.99) _up.set(0, 0, 1)
  _right.crossVectors(_up, _fwd).normalize()
  _up.crossVectors(_fwd, _right).normalize()
  _c.set(p.x, p.y, p.z)
  const r = Math.round(_c.dot(_right) / SHADOW_TEXEL) * SHADOW_TEXEL
  const u = Math.round(_c.dot(_up) / SHADOW_TEXEL) * SHADOW_TEXEL
  const f = _c.dot(_fwd)
  _c.copy(_right).multiplyScalar(r).addScaledVector(_up, u).addScaledVector(_fwd, f)
  light.target.position.copy(_c)
  light.position.set(_c.x - _fwd.x * dist, _c.y - _fwd.y * dist, _c.z - _fwd.z * dist)
}

export function Sky() {
  const { scene } = useThree()
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const stars = useRef<THREE.Points>(null)
  const dome = useRef<THREE.Mesh>(null)
  const domeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DOME_VERT,
        fragmentShader: DOME_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3(1, 0.3, 0) },
          uSunGlow: { value: 0 },
          uSunColor: { value: new THREE.Color() },
          uNight: { value: 0 },
          uMoonDir: { value: MOON_DIR },
          uMoonU: { value: MOON_U },
          uMoonV: { value: MOON_V },
          uMoonPhase: { value: 0.5 },
          uMoonAmt: { value: 0 },
          uTwi: { value: 0 },
          uGlowColor: { value: new THREE.Color() },
        },
      }),
    [],
  )
  const scratch = useMemo(() => ({ zen: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color() }), [])
  const starGeo = useMemo(() => {
    // 플레이어 위 큰 반구에 흩뿌린 별
    const pts: number[] = []
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * Math.PI * 2
      const h = 0.15 + Math.random() * 0.85
      const r = 110
      pts.push(Math.cos(a) * Math.sqrt(1 - h * h) * r, h * r * 0.6 + 8, Math.sin(a) * Math.sqrt(1 - h * h) * r)
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  }, [])

  useEffect(() => {
    scene.background = new THREE.Color()
    scene.fog = new THREE.Fog(0xffffff, 55, 130)
    if (sun.current) scene.add(sun.current.target)
  }, [scene])

  useFrame(({ clock }) => {
    const st = useGame.getState()
    const w = weatherFor(st.day)
    // 바람 날은 나무·풀이 두 배로, 태풍은 더 세고 물결도 높다(겹침 효과라 날씨 표와 따로 본다)
    const gale = windLevel(st.day)
    const l = weatherLighting(lightingAt(currentHour()), w)
    // 태풍 하늘은 짙은 회청색으로 가라앉는다
    if (gale === 'typhoon') l.sky = l.sky.map((c, i) => c * 0.3 + STORM_SKY[i] * 0.7) as typeof l.sky
    // 해 질 녘과 새벽: 해 높이로 정한다(0 에서 가장 진하다)
    const h = currentHour()
    const el = sunElevation(h)
    const twi = Math.max(0, 1 - Math.abs(el) / 0.55)
    const morning = h < 12
    skyGlow.twilight = twi
    // 물 셰이더도 같은 하늘·햇빛을 비춘다.
    waterUniforms.uTime.value = clock.elapsedTime
    waterUniforms.uSky.value.setRGB(...l.sky)
    waterUniforms.uSun.value.setRGB(...l.sun)
    waterUniforms.uSunDir.value.set(...sunDirection(h)).normalize()
    waterUniforms.uSunset.value = twi
    // 밤 정도는 날씨와 상관없이 시각으로만 정한다(비 오는 낮이 밤처럼 어두워지지 않게).
    waterUniforms.uNight.value = Math.max(0, Math.min(1, (1.1 - lightingAt(h).sunIntensity) / 0.75))
    waterUniforms.uRain.value = w === 'rain' ? 1 : 0
    // 구름 그림자는 맑은 낮에 또렷하고, 흐리거나 비 오면 하늘 전체가 덮여 옅어지며 밤엔 없다.
    const day = 1 - waterUniforms.uNight.value
    worldUniforms.uTime.value = clock.elapsedTime
    worldUniforms.uNight.value = waterUniforms.uNight.value
    worldUniforms.uCloud.value = (w === 'sunny' ? 0.22 : w === 'cloudy' ? 0.28 : 0.1) * day
    worldUniforms.uRain.value = waterUniforms.uRain.value
    worldUniforms.uWind.value = (w === 'rain' ? 1.9 : w === 'cloudy' ? 1.3 : w === 'snow' ? 0.6 : 1) * (gale === 'typhoon' ? 2.8 : gale === 'breeze' ? 2 : 1)
    waterUniforms.uSwell.value = gale === 'typhoon' ? 2.4 : gale === 'breeze' ? 1.3 : 1
    for (const r of runtime.ripples) ripple(r.x, r.z, r.s)
    runtime.ripples.length = 0
    // 집 안: 바깥은 어둡게 가리고, 위에서 내리쬐는 따뜻한 실내등으로 비춘다.
    if (isIndoor(st)) {
      if (stars.current) stars.current.visible = false
      if (dome.current) dome.current.visible = false
      skyGlow.twilight = 0
      ;(scene.background as THREE.Color).set(INDOOR_BG)
      const fog = scene.fog as THREE.Fog | null
      if (fog) {
        fog.color.set(INDOOR_BG)
        // 실내 카메라가 세로 화면에서 멀리 빠져도 방 자체가 안개에 바래지 않게 거리를 넉넉히 둔다
        fog.near = 28
        fog.far = 60
      }
      const p = runtime.player
      // 집·주민 집은 저녁과 밤에 어둡게 가라앉는다(등불 수에 따라 다르다). 다른 실내는 그대로다.
      const mood = updateInteriorMood()
      if (sun.current) {
        sun.current.color.set('#ffe9c8')
        sun.current.intensity = 1.1 * (mood?.sunScale ?? 1)
        aimSun(sun.current, p, 3 / 15.56, 14 / 15.56, 6 / 15.56, 15.56)
      }
      if (hemi.current) {
        hemi.current.color.set('#fff1dc')
        hemi.current.intensity = 1.05 * (mood?.hemiScale ?? 1)
      }
      return
    }
    // 하늘 돔 색: 천정은 하늘색, 지평선은 조금 희게. 해 질 녘엔 천정이 보라, 지평선이 주황(새벽엔 분홍)으로 물든다.
    const zen = scratch.zen.setRGB(...l.sky)
    const hor = scratch.hor.setRGB(...l.sky)
    if (gale !== 'typhoon') hor.lerp(WHITE, 0.35)
    if (twi > 0) {
      zen.lerp(PURPLE, twi * 0.55)
      hor.lerp(morning ? PINK : ORANGE, twi * 0.85)
    }
    const u = domeMat.uniforms
    u.uZenith.value.copy(zen)
    u.uHorizon.value.copy(hor)
    u.uSunDir.value.set(...sunSkyDirection(h))
    // 해가 지평선 근처에 있을 때 해 주변이 가장 밝다. 낮에도 아주 옅게 번진다.
    u.uSunGlow.value = el > -0.12 ? 0.15 + 0.85 * twi : 0
    u.uSunColor.value.copy(SUN_DAY).lerp(morning ? SUN_DAWN : SUN_EVENING, twi)
    u.uTwi.value = twi
    u.uGlowColor.value.copy(morning ? PINK : ORANGE)
    u.uNight.value = waterUniforms.uNight.value
    u.uMoonAmt.value = waterUniforms.uNight.value
    const phase = ((dayIndex(st.day) ?? 0) % 29.53) / 29.53
    u.uMoonPhase.value = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase)
    if (dome.current) {
      dome.current.visible = true
      dome.current.position.set(runtime.player.x, 0, runtime.player.z)
    }
    ;(scene.background as THREE.Color).copy(hor)
    const fog = scene.fog as THREE.Fog | null
    if (fog) {
      fog.color.copy(hor)
      // 비·눈 오는 날은 멀리가 뿌옇게 가린다.
      fog.near = w === 'rain' ? 22 : w === 'snow' ? 30 : 55
      fog.far = w === 'rain' ? 75 : w === 'snow' ? 95 : 130
      // 해 질 녘·새벽: 안개가 가까이 와서 화면 위쪽 먼 바다가 지평선 색(주황·분홍)으로 물든다
      if (twi > 0) {
        fog.color.lerp(morning ? PINK : ORANGE, twi * 0.35)
        fog.near = Math.min(fog.near, 34)
        fog.far = Math.min(fog.far, 100)
      }
      // 태풍 날은 회청색 안개가 가까이 깔린다
      if (gale === 'typhoon') {
        fog.color.lerp(STORM_FOG, 0.5)
        fog.near = 20
      }
      // 안개 낀 아침: 가까이 당겨 먼 바다와 섬 끝을 흐리게 하고, 색을 조금 희게 섞는다.
      if (fogActive(st.day, seasonFor(st.day), w, h)) {
        fog.color.lerp(WHITE, 0.35)
        fog.near = 10
        fog.far = 44
      }
    }
    // 밤 정도: 해가 낮을수록 1. 별과 달빛이 같은 값을 쓴다.
    const night = Math.max(0, Math.min(1, (0.6 - l.sunIntensity) / 0.2))
    const p = runtime.player
    if (sun.current) {
      sun.current.color.setRGB(...l.sun)
      // 태풍 날은 구름에 가려 햇빛이 약하다
      sun.current.intensity = l.sunIntensity * (gale === 'typhoon' ? 0.45 : 1)
      // 해가 하늘을 가로질러 움직여서 그림자 방향과 길이가 시간 따라 바뀐다.
      const [dx, dy, dz] = sunDirection(h)
      aimSun(sun.current, p, dx, dy, dz, 20)
    }
    if (stars.current) {
      // 해가 지면 별이 서서히 뜬다.
      stars.current.visible = night > 0
      ;(stars.current.material as THREE.PointsMaterial).opacity = night * (w === 'sunny' ? 1 : 0.35)
      stars.current.position.set(p.x, 0, p.z)
    }
    if (hemi.current) {
      // 하늘빛을 위쪽 환경광에 섞어야 밤에 풀밭이 푸르스름하게 가라앉는다.
      // 밤엔 달빛을 얇게 더해 나무·바위 윤곽이 어둠에 묻히지 않게 한다. 낮에는 값이 그대로다.
      // 밤에는 달빛 쪽(푸른)으로 많이 섞어 풀의 초록이 가라앉고 푸른 달빛 느낌이 나게 한다
      hemi.current.color.setRGB(...l.sky).lerp(WHITE, 0.5).lerp(MOON, night * 0.6).lerp(TWILIGHT_HEMI, twi * 0.6)
      // 태풍 날은 환경광도 절반으로 내려 화면 전체가 어둡게 가라앉는다
      hemi.current.intensity = (l.ambient + night * 0.1) * (gale === 'typhoon' ? 0.5 : 1)
    }
    // 하늘을 올려다보는 유성우 밤에도 같은 남색으로 가라앉혀 별똥별이 돋보이게 한다
    const kc = runtime.skyCam * 0.6
    if (kc > 0) {
      ;(scene.background as THREE.Color).lerp(FIRE_NAVY, kc)
      const fogNow = scene.fog as THREE.Fog | null
      if (fogNow) fogNow.color.lerp(FIRE_NAVY, kc)
    }
    // 불꽃 구경 중에는 하늘과 빛을 짙은 남색으로 가라앉혀 불꽃이 돋보이게 한다
    const fc = runtime.fireCam
    if (fc > 0) {
      ;(scene.background as THREE.Color).lerp(FIRE_NAVY, fc * 0.8)
      const fogNow = scene.fog as THREE.Fog | null
      if (fogNow) fogNow.color.lerp(FIRE_NAVY, fc * 0.8)
      if (hemi.current) {
        hemi.current.color.lerp(FIRE_NAVY, fc * 0.4)
        hemi.current.intensity *= 1 - 0.3 * fc
      }
      if (sun.current) sun.current.intensity *= 1 - 0.35 * fc
    }
  })

  return (
    <>
      {/* 하늘 돔은 가장 먼저 그리고 깊이를 쓰지 않는다. 나머지 물건은 그 위에 그려진다. */}
      <mesh ref={dome} material={domeMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[DOME_R, 32, 16]} />
      </mesh>
      <points ref={stars} geometry={starGeo} visible={false}>
        <pointsMaterial color="#fff6d8" size={0.9} sizeAttenuation transparent opacity={0} fog={false} depthWrite={false} />
      </points>
      <hemisphereLight ref={hemi} args={['#ffffff', '#6f8f5a', 0.8]} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-far={60}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-radius={2.5}
      />
    </>
  )
}

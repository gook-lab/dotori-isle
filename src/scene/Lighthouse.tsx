import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { currentHour, isNight } from '../core/clock'
import { fogDay } from '../core/fog'
import { heightAt } from '../core/island'
import { BEAM_LENGTH, beamStrength, lampAngle, lighthouseSpot } from '../core/lighthouse'
import { seasonFor } from '../core/season'
import { weatherFor } from '../core/weather'
import { useGame } from '../game/store'
import { type Batch, Merge, shape, useMerged, useOwnMaterials, xf } from './batching'
import { useOcclusionFade } from './occlusion'

/** 등불 중심 높이(받침 기준) */
const LAMP_Y = 5
/** 빛줄기 한 가닥: 등불에서 바다 쪽으로 뻗는 열린 원뿔. 가까울수록 진하고 멀수록 옅다. */
const BEAM_VERT = `
varying vec3 vN;
varying vec3 vW;
varying float vAlong;
void main() {
  vAlong = position.x / ${BEAM_LENGTH.toFixed(1)};
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const BEAM_FRAG = `
uniform float uStrength;
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vW;
varying float vAlong;
void main() {
  float along = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.6);
  vec3 view = normalize(cameraPosition - vW);
  float edge = pow(abs(dot(normalize(vN), view)), 1.2);
  float dist = length(cameraPosition - vW);
  float far = clamp(1.0 - (dist - 40.0) / 120.0, 0.25, 1.0);
  float k = 0.3 * uStrength * along * edge * far;
  gl_FragColor = vec4(uColor, k);
}`

const BOULDERS: [number, number, number][] = [
  [-1.1, 0.5, 0.9],
  [0.9, -0.7, 0.8],
  [0.2, 1.2, 0.7],
  [-0.4, -1.1, 0.6],
]

/** 받침 돌과 줄무늬 탑 몸체, 난간, 지붕. 바위 곶 위에 한 덩어리로 굳힌다. */
function buildTower(b: Batch) {
  // 받침 돌 주변 바위들
  for (const [x, z, s] of BOULDERS)
    b.add(shape(THREE.DodecahedronGeometry, s, 0), xf([x, s * 0.2, z], [x * 0.7, z * 0.9, 0.4], 1), '#9a9489', { outline: 0.06 })
  b.add(shape(THREE.CylinderGeometry, 0.9, 1.0, 0.6, 14), xf([0, 0.3, 0]), '#8a8175', { outline: 0.06 })
  // 탑은 아래가 넓고 위로 좁아진다. 흰색과 빨간색 띠 다섯 개.
  const rAt = (y: number) => 0.74 + (0.5 - 0.74) * (y / 4)
  for (let k = 0; k < 5; k++) {
    const y0 = k * 0.8
    b.add(shape(THREE.CylinderGeometry, rAt(y0 + 0.8), rAt(y0), 0.8, 14), xf([0, 0.6 + y0 + 0.4, 0]), k % 2 ? '#c8553d' : '#fbf7ef', { outline: 0.06 })
  }
  // 난간과 등실 받침, 지붕
  b.add(shape(THREE.CylinderGeometry, 0.6, 0.6, 0.12, 14), xf([0, 4.66, 0]), '#6e7785', { outline: 0.06 })
  b.add(shape(THREE.CylinderGeometry, 0.42, 0.42, 0.14, 12), xf([0, 4.73, 0]), '#3f4a57', { outline: 0.06 })
  b.add(shape(THREE.ConeGeometry, 0.5, 0.5, 12), xf([0, 5.35 + 0.25, 0]), '#c8553d', { outline: 0.06 })
  b.add(shape(THREE.SphereGeometry, 0.08, 8, 6), xf([0, 5.9, 0]), '#ffd166', { outline: 0.1 })
}

/** 빛줄기 재질. 두 가닥이 같은 재질을 쓰고, 세기만 uniform 으로 바꾼다. */
function makeBeamMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    uniforms: { uStrength: { value: 0 }, uColor: { value: new THREE.Color('#fff1b8') } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

/**
 * 북쪽 곶 등대. 낮엔 등불과 빛줄기가 꺼지고, 밤 19~5시에는 등불이 돌며 빛줄기가 바다를 지난다.
 * 안개 낀 날 밤엔 빛줄기가 더 또렷하다(core/lighthouse.ts 의 beamStrength).
 */
export function Lighthouse() {
  const day = useGame((s) => s.day)
  const spot = useMemo(() => lighthouseSpot(), [])
  const base = heightAt(spot.x, spot.z)
  // 안개 낀 날 여부는 날짜로 정해지니 날이 바뀔 때만 다시 계산한다.
  const foggy = useMemo(() => fogDay(day, seasonFor(day), weatherFor(day)), [day])
  const body = useMerged(buildTower, [])
  const mats = useOwnMaterials()
  const ref = useRef<THREE.Group>(null)
  // 탑 뒤로 돌아가면 탑이 반투명해져 플레이어가 보인다. 중심은 고정 좌표다.
  useOcclusionFade(ref, [spot.x, base + 3, spot.z], 2.4, 0.18)
  const lamp = useRef<THREE.Group>(null)
  const beamMat = useMemo(() => makeBeamMaterial(), [])
  const beamGeo = useMemo(() => {
    // 열린 원뿔: 좁은 쪽이 등불, 넓은 쪽이 바다 끝. 축을 +x 로 눕히고 길이만큼 앞으로 민다.
    const g = new THREE.CylinderGeometry(9, 0.25, BEAM_LENGTH, 28, 1, true)
    g.rotateZ(-Math.PI / 2)
    g.translate(BEAM_LENGTH / 2, 0, 0)
    return g
  }, [])
  useEffect(() => () => {
    beamMat.dispose()
    beamGeo.dispose()
  }, [beamMat, beamGeo])

  useFrame(({ clock }) => {
    const h = currentHour()
    const night = isNight(h)
    if (lamp.current) {
      lamp.current.visible = night
      if (night) lamp.current.rotation.y = lampAngle(clock.elapsedTime)
    }
    beamMat.uniforms.uStrength.value = beamStrength(h, foggy)
  })

  return (
    <group ref={ref} position={[spot.x, base, spot.z]}>
      <Merge g={body} lit={mats.lit} basic={mats.basic} />
      {/* 등실 유리 */}
      <mesh position={[0, LAMP_Y, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.7, 12]} />
        <meshBasicMaterial color="#bfe4ee" transparent opacity={0.7} />
      </mesh>
      <group ref={lamp} position={[0, LAMP_Y, 0]}>
        <mesh>
          <sphereGeometry args={[0.3, 10, 8]} />
          <meshBasicMaterial color="#fff3c4" />
        </mesh>
        <mesh geometry={beamGeo} material={beamMat} />
        <mesh geometry={beamGeo} material={beamMat} rotation={[0, Math.PI, 0]} />
      </group>
    </group>
  )
}

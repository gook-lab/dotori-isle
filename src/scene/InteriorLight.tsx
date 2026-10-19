import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LAMP_LIGHT_MAX, nearness, wallShade } from '../core/interiorLight'
import { useGame } from '../game/store'
import { interiorMood } from './interiorMood'

const WINDOW_DAY = new THREE.Color('#a9dcf2')
const STAR_POS = new Float32Array([-0.36, 0.22, 0.02, 0.22, 0.3, 0.02, 0.08, -0.14, 0.02, -0.12, 0.12, 0.02, 0.38, -0.2, 0.02, -0.44, -0.26, 0.02])

/**
 * 실내 창 한 장. 낮엔 하늘빛, 저녁과 밤엔 남색에 별이 뜬다(interiorMood 를 따른다).
 * 별은 점 하나짜리 그리기 호출이고 밤이 아니면 보이지 않아 그리기 수가 늘지 않는다.
 */
export function MoodWindow({ position, size }: { position: [number, number, number]; size: [number, number] }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const stars = useRef<THREE.Points>(null)
  const target = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const m = interiorMood.current
    target.set(m ? m.windowColor : WINDOW_DAY)
    mat.current?.color.lerp(target, 0.2)
    if (stars.current) stars.current.visible = !!m?.stars
  })
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(STAR_POS, 3))
    return g
  }, [])
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={size} />
        <meshBasicMaterial ref={mat} color={WINDOW_DAY} />
      </mesh>
      <points ref={stars} geometry={geo} visible={false} position={[0, 0, 0.005]}>
        <pointsMaterial color="#fff6c8" size={0.05} sizeAttenuation={false} />
      </points>
    </group>
  )
}

/**
 * 천장 전구. 낮 세기는 day, 밤 세기는 night 를 따르고, 저녁과 밤에는 interiorMood 로 낮춘다.
 * dim 이 true 면 색도 따뜻한 쪽으로 옮긴다(warmDim).
 */
export function MoodBulb({ position, day, night, distance = 14, decay = 1.4, color = '#ffe2b0', warmDim = false }: { position: [number, number, number]; day: number; night: number; distance?: number; decay?: number; color?: string; warmDim?: boolean }) {
  const light = useRef<THREE.PointLight>(null)
  const base = useMemo(() => new THREE.Color(color), [color])
  const warm = useMemo(() => new THREE.Color('#ffc98a'), [])
  useFrame(() => {
    const l = light.current
    if (!l) return
    const m = interiorMood.current
    const isNight = useGame.getState().night
    l.intensity = (isNight ? night : day) * (m?.bulbScale ?? 1)
    l.color.copy(base)
    if (m?.dim && warmDim) l.color.lerp(warm, 0.8)
  })
  return <pointLight ref={light} position={position} color={color} intensity={day} distance={distance} decay={decay} />
}

/** 방 안에서 켜 둔 등의 자리(방 가운데 기준 x, z) */
export interface LampSpot {
  x: number
  z: number
}

/**
 * 벽 한 장. 저녁·밤엔 벽 색을 어둡게 곱하고(wallShade), 등이 있으면 등 가까운 쪽만 조금 밝게 한다.
 * size 는 박스 크기(벽 두께 포함), position 은 벽 가운데다. lamps 는 방 가운데 기준 자리다.
 */
export function ShadeWall({ position, size, color, lamps }: { position: [number, number, number]; size: [number, number, number]; color: string; lamps: readonly LampSpot[] }) {
  const mat = useRef<THREE.MeshToonMaterial>(null)
  const base = useMemo(() => new THREE.Color(color), [color])
  const latest = useRef(lamps)
  latest.current = lamps
  useFrame(() => {
    const m = mat.current
    if (!m) return
    const mood = interiorMood.current
    const list = latest.current
    // 벽 상자 안에서 등과 가장 가까운 점까지의 거리로 가까움을 잰다
    let near = 0
    const [px, , pz] = position
    const x0 = px - size[0] / 2, x1 = px + size[0] / 2, z0 = pz - size[2] / 2, z1 = pz + size[2] / 2
    for (const l of list) {
      const dx = Math.max(x0 - l.x, 0, l.x - x1)
      const dz = Math.max(z0 - l.z, 0, l.z - z1)
      near = Math.max(near, nearness(Math.hypot(dx, dz)))
    }
    const f = wallShade(!!mood?.dim, list.length > 0, near)
    m.color.copy(base).multiplyScalar(f)
  })
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshToonMaterial ref={mat} color={color} />
    </mesh>
  )
}

/**
 * 방의 켜진 등 빛. 점광원은 항상 LAMP_LIGHT_MAX 개를 만들어 두고, 쓰지 않는 것은 세기 0으로 둔다.
 * 등을 켜고 끌 때 점광원 개수가 바뀌지 않으므로 셰이더를 다시 만들지 않는다.
 */
export function LampPool({ spots, y, intensity, distance, decay = 1.5, color = '#ffc66e' }: { spots: readonly LampSpot[]; y: number; intensity: number; distance: number; decay?: number; color?: string }) {
  const lights = useRef<(THREE.PointLight | null)[]>([])
  const latest = useRef(spots)
  latest.current = spots
  useFrame(() => {
    const list = latest.current
    for (let i = 0; i < LAMP_LIGHT_MAX; i++) {
      const l = lights.current[i]
      if (!l) continue
      const s = list[i]
      if (s) {
        l.position.set(s.x, y, s.z)
        l.intensity = intensity
      } else {
        l.intensity = 0
      }
    }
  })
  return (
    <>
      {Array.from({ length: LAMP_LIGHT_MAX }, (_, i) => (
        <pointLight key={i} ref={(el) => { lights.current[i] = el }} color={color} intensity={0} distance={distance} decay={decay} />
      ))}
    </>
  )
}

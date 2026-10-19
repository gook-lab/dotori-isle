import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { fishPosition, getLayout, type FishSpawn } from '../core/daily'
import { FISH_TABLE } from '../core/items'
import { now, runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { waterLevelAt } from '../core/island'
import { nightLevel } from './glow'

const SHADOW = Object.fromEntries(FISH_TABLE.map((f) => [f.id, f.shadow ?? 3]))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
// 밤엔 검은 물 위에서 그림자가 묻히므로 옅은 청록으로 바꿔 윤곽을 띄운다.
const INK_DAY = new THREE.Color('#173543')
const INK_NIGHT = new THREE.Color('#5fb4d4')
const _ink = new THREE.Color()

/**
 * 바다 속 물고기 그림자. 평소엔 제자리를 맴돌고, 찌가 근처에 떨어지면 찌 쪽으로 헤엄쳐 와
 * 톡톡 건드리다 문다. 놓치면 휙 달아난다. 크기로 어떤 물고기인지 짐작할 수 있다.
 */
function Shadow({ fish, night }: { fish: FishSpawn; night: boolean }) {
  const root = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const tailMat = useRef<THREE.MeshBasicMaterial>(null)
  const size = 0.45 + SHADOW[night ? fish.night : fish.day] * 0.2

  useFrame(({ clock }) => {
    const g = root.current
    if (!g) return
    const t = clock.elapsedTime
    const home = fishPosition(fish, now())
    let { x, z, facing } = home
    let opacity = 0.42
    let wiggle = 6
    const f = runtime.fishing
    if (f.phase !== 'idle' && f.lure?.id === fish.id) {
      const { fx, fz, approach } = f.lure
      const toBob = Math.atan2(f.x - fx, f.z - fz)
      // 찌 바로 앞에서 멈추도록 찌 중심이 아닌 몸길이만큼 앞에서 선다.
      const stopX = f.x - Math.sin(toBob) * size * 0.9
      const stopZ = f.z - Math.cos(toBob) * size * 0.9
      if (f.phase === 'cast') {
        x = fx
        z = fz
        facing = toBob
      } else if (f.phase === 'wait') {
        const k = Math.min(1, f.t / approach)
        const ease = 1 - (1 - k) ** 2
        // 똑바로 오지 않고 살짝 S 자로 머뭇거리며 온다.
        const side = Math.sin(k * Math.PI * 2) * 0.5 * (1 - k)
        x = lerp(fx, stopX, ease) + Math.cos(toBob) * side
        z = lerp(fz, stopZ, ease) - Math.sin(toBob) * side
        facing = toBob
        // 다 오고 나면 톡톡: 앞뒤로 콕콕 찌른다.
        if (k >= 1) {
          const peck = Math.max(0, Math.sin((f.t - approach) * 7)) * 0.18
          x += Math.sin(toBob) * peck
          z += Math.cos(toBob) * peck
        }
        wiggle = k < 1 ? 14 : 9
      } else if (f.phase === 'bite') {
        x = f.x - Math.sin(toBob) * size * 0.4
        z = f.z - Math.cos(toBob) * size * 0.4
        facing = toBob
        wiggle = 30
      } else if (f.phase === 'reel') {
        if (f.result === 'caught') opacity = 0
        else {
          // 놀라서 왔던 길 반대로 쏜살같이 달아난다. 처음에 세게 튀고 점점 느려지며 흐려진다.
          const k = Math.min(1, f.t / 0.6)
          const e = 1 - (1 - k) ** 3
          x = stopX - Math.sin(toBob) * e * 5
          z = stopZ - Math.cos(toBob) * e * 5
          facing = toBob + Math.PI
          opacity = 0.42 * (1 - k * k)
          wiggle = 30
        }
      }
    }
    // 물은 반투명이어도 깊이를 써서 아래는 가려진다. 물결 꼭대기 바로 위에 얹는다.
    // 연못·개울은 잔잔해서 수면에 바짝 붙인다.
    const w = waterLevelAt(x, z)
    g.position.set(x, w === null || w === 0 ? 0.12 : w + 0.03, z)
    g.rotation.y = facing
    if (tail.current) tail.current.rotation.y = Math.sin(t * wiggle + fish.seed) * 0.45
    const night = nightLevel()
    const ink = _ink.copy(INK_DAY).lerp(INK_NIGHT, night)
    const alpha = opacity * (1 + night * 0.3)
    if (mat.current) {
      mat.current.color.copy(ink)
      mat.current.opacity = alpha
    }
    if (tailMat.current) {
      tailMat.current.color.copy(ink)
      tailMat.current.opacity = alpha
    }
  })

  return (
    <group ref={root} scale={size}>
      <mesh rotation-x={-Math.PI / 2} scale={[0.42, 1, 1]}>
        <circleGeometry args={[0.5, 18]} />
        <meshBasicMaterial ref={mat} color="#173543" transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <group ref={tail} position={[0, 0, -0.45]}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, -0.12]} scale={[0.7, 0.55, 1]}>
          <circleGeometry args={[0.22, 3]} />
          <meshBasicMaterial ref={tailMat} color="#173543" transparent opacity={0.42} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

export function FishShadows() {
  const day = useGame((s) => s.day)
  const caught = useGame((s) => s.caught)
  const night = useGame((s) => s.night)
  return (
    <>
      {getLayout(day)
        .fish.filter((f) => !caught.includes(f.id))
        .map((f) => (
          <Shadow key={f.id} fish={f} night={night} />
        ))}
    </>
  )
}

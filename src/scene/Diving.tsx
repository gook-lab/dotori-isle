import { useMemo, useRef } from 'react'
import type * as THREE from 'three'
import { bubbleSpots, SURFACE_Y } from '../core/diving'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { useOutdoorFrame } from './outdoorFrame'

/** 바다 위 거품 자국. 날짜로 자리가 정해지고, 오늘 잡은 자리는 사라진다. 수영 중이 아닐 때도 보인다. */
export function Diving() {
  const day = useGame((s) => s.day)
  const spots = useMemo(() => bubbleSpots(day), [day])
  const rings = useRef<(THREE.Mesh | null)[]>([])
  useOutdoorFrame(({ clock }) => {
    const t = clock.elapsedTime
    spots.forEach((b, i) => {
      const m = rings.current[i]
      if (!m) return
      const done = runtime.dived.day === day && runtime.dived.keys.includes(`${b.x},${b.z}`)
      m.visible = !done
      // 거품이 천천히 번지며 가라앉았다 다시 피어난다
      const k = (t * 0.6 + i * 0.37) % 1
      m.scale.setScalar(0.6 + k * 0.9)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k)
    })
  })
  return (
    <group>
      {spots.map((b, i) => (
        <mesh key={`${b.x},${b.z}`} ref={(m) => (rings.current[i] = m)} rotation-x={-Math.PI / 2} position={[b.x, SURFACE_Y + 0.04, b.z]}>
          <ringGeometry args={[0.35, 0.5, 24]} />
          <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

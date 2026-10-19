import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { runtime } from '../game/runtime'

const POOL = 12
const LIFE = 0.55

/** 걸을 때 발밑에서 퐁퐁 피어오르는 흙먼지. 메시를 미리 만들어 돌려 쓴다. */
export function Dust() {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const ages = useRef<number[]>(Array(POOL).fill(LIFE))
  const next = useRef(0)
  const timer = useRef(0)

  useFrame((_, delta) => {
    const p = runtime.player
    timer.current -= delta
    if (p.moving && timer.current <= 0) {
      timer.current = p.running ? 0.09 : 0.22
      const i = next.current
      next.current = (i + 1) % POOL
      ages.current[i] = 0
      const m = refs.current[i]
      if (m) {
        const back = -0.25
        m.position.set(p.x + Math.sin(p.facing) * back + (Math.random() - 0.5) * 0.2, p.y + 0.08, p.z + Math.cos(p.facing) * back)
      }
    }
    for (let i = 0; i < POOL; i++) {
      const m = refs.current[i]
      if (!m) continue
      const age = (ages.current[i] += delta)
      const k = Math.min(1, age / LIFE)
      m.visible = k < 1
      m.scale.setScalar(0.1 + k * 0.25)
      m.position.y += delta * 0.4
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k)
    }
  })

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#fff6e0" transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

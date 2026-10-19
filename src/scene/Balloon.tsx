import { useRef } from 'react'
import * as THREE from 'three'
import { currentHour } from '../core/clock'
import { balloonPosition, balloonProgress } from '../core/wind'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { Part } from './toon'
import { useOutdoorFrame } from './outdoorFrame'

/** 바람 날 섬 위를 지나가는 풍선 선물. 아래에 서서 잠자리채로 잡는다(findAction 의 balloon-catch). */
export function Balloon() {
  const ref = useRef<THREE.Group>(null)
  useOutdoorFrame(() => {
    const g = ref.current
    if (!g) return
    const s = useGame.getState()
    const t = balloonProgress(s.day, currentHour())
    const show = t !== null && runtime.balloonCaught !== s.day
    g.visible = show
    if (show) {
      const b = balloonPosition(t)
      g.position.set(b.x, b.y, b.z)
    }
  })
  return (
    <group ref={ref} visible={false} scale={0.8}>
      <Part color="#ff8a65" position={[0, 1.4, 0]} scale={[1, 1.2, 1]} outline={0.05}>
        <sphereGeometry args={[0.9, 16, 12]} />
      </Part>
      <Part color="#8d6e63" position={[0, -0.2, 0]} outline={0.05}>
        <boxGeometry args={[0.6, 0.4, 0.6]} />
      </Part>
      {/* 매달린 선물 상자 */}
      <Part color="#ffd54f" position={[0, -1.0, 0]} outline={0.06}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
      </Part>
    </group>
  )
}

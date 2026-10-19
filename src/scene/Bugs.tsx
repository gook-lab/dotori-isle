import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { currentHour } from '../core/clock'
import { bugPosition, getLayout, type BugSpawn } from '../core/daily'
import { BUG_TABLE, TIDE_TABLE } from '../core/items'
import { fireflyOn, replacedByFireflies } from '../core/fireflies'
import { seasonFor } from '../core/season'
import { weatherFor } from '../core/weather'
import { now } from '../game/runtime'
import { useGame } from '../game/store'
import { Snail } from './ItemModel'

const SPECIES = Object.fromEntries([...BUG_TABLE, ...TIDE_TABLE].map((b) => [b.id, b]))

function Bug({ bug, night }: { bug: BugSpawn; night: boolean }) {
  const root = useRef<THREE.Group>(null)
  // 날개는 몸통 쪽 모서리를 축으로 접혀야 해서 피벗 그룹을 따로 둔다.
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const species = SPECIES[night ? bug.night : bug.day]

  useFrame(() => {
    const t = now()
    const [x, y, z] = bugPosition(bug, t, night)
    const [nx, , nz] = bugPosition(bug, t + 0.1, night)
    root.current?.position.set(x, y, z)
    root.current?.rotation.set(0, Math.atan2(nx - x, nz - z), 0)
    const flap = Math.sin(t * 18 + bug.seed) * 0.9
    if (left.current) left.current.rotation.z = flap
    if (right.current) right.current.rotation.z = -flap
  })

  if (species.crawl) {
    return (
      <group ref={root} scale={1.5}>
        <Snail />
      </group>
    )
  }
  if (species.glow) {
    return (
      <group ref={root}>
        <mesh>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshBasicMaterial color={species.color} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.35, 10, 8]} />
          <meshBasicMaterial color={species.color} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      </group>
    )
  }
  return (
    <group ref={root}>
      <mesh>
        <boxGeometry args={[0.06, 0.06, 0.22]} />
        <meshStandardMaterial color="#3a2b1f" />
      </mesh>
      <group ref={left}>
        <mesh position={[0.16, 0, 0]}>
          <boxGeometry args={[0.32, 0.01, 0.26]} />
          <meshStandardMaterial color={species.color} />
        </mesh>
      </group>
      <group ref={right}>
        <mesh position={[-0.16, 0, 0]}>
          <boxGeometry args={[0.32, 0.01, 0.26]} />
          <meshStandardMaterial color={species.color} />
        </mesh>
      </group>
    </group>
  )
}

export function Bugs() {
  const day = useGame((s) => s.day)
  const caught = useGame((s) => s.caught)
  const night = useGame((s) => s.night)
  // 여름 저녁엔 떠도는 반딧불이(Fireflies.tsx)가 구슬 반딧불이를 대신한다
  const glowOn = fireflyOn(seasonFor(day), currentHour(), weatherFor(day))
  return (
    <>
      {getLayout(day)
        .bugs.filter((b) => !caught.includes(b.id) && !replacedByFireflies(night ? b.night : b.day, glowOn))
        .map((b) => (
          <Bug key={b.id} bug={b} night={night} />
        ))}
    </>
  )
}

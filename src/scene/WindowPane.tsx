import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { nightLevel } from './glow'
import { gradient } from './toon'

/** 낮의 창 빛(하늘색)과 밤의 창 빛(따뜻한 등불색) */
const DAY = new THREE.Color('#2a5a70')
const NIGHT = new THREE.Color('#ffb860')

/**
 * 집 창문 한 장. 낮에는 하늘빛으로 비치고, 밤이 되면 안에서 등불이 새어 나오듯 따뜻하게 빛난다.
 * children 에 창 모양 지오메트리(boxGeometry 등)를 넣는다. 밤의 세기는 섬 전체 밤 값(nightLevel)을 그대로 따른다.
 */
export function WindowPane({ position, children }: { position: [number, number, number]; children: ReactNode }) {
  const mat = useRef<THREE.MeshToonMaterial>(null)
  useFrame(() => {
    const m = mat.current
    if (!m) return
    const n = nightLevel()
    m.emissive.copy(DAY).lerp(NIGHT, n)
    m.emissiveIntensity = 1 + n * 0.8
  })
  return (
    <mesh position={position}>
      {children}
      <meshToonMaterial ref={mat} color="#9ad0ec" gradientMap={gradient} emissive={DAY} />
    </mesh>
  )
}

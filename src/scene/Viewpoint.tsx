import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { VIEWPOINT } from '../core/viewpoint'
import { Merge, shape, useMerged, xf } from './batching'

const WOOD = '#b8844f'
const TOP = '#d9a56b'

/** 절벽 위 전망 벤치: 나무 의자가 바다 쪽을 본다. 등받이는 섬 가운데 쪽에 있다. */
export function Viewpoint() {
  const { x, z, rot } = VIEWPOINT
  const y = heightAt(x, z)
  const legs: [number, number, number][] = [
    [-0.5, 0.25, -0.15],
    [0.5, 0.25, -0.15],
    [-0.5, 0.25, 0.15],
    [0.5, 0.25, 0.15],
  ]
  // 다리와 등받이는 그림자만 드리운다. 앉는 판은 그림자를 받으므로 따로 둔다.
  const frame = useMerged((b) => {
    for (const p of legs) b.add(shape(THREE.BoxGeometry, 0.1, 0.5, 0.1), xf(p), WOOD, { cast: true })
    b.add(shape(THREE.BoxGeometry, 1.2, 0.5, 0.08), xf([0, 0.9, -0.2], [-0.12, 0, 0]), TOP, { cast: true })
  }, [])
  // 묶음은 정점 색을 쓰되 원래 메시와 같은 기본 토온(그라데이션 없음)으로 그린다
  const lit = useMemo(() => new THREE.MeshToonMaterial({ vertexColors: true }), [])
  useEffect(() => () => lit.dispose(), [lit])
  return (
    <group position={[x, y, z]} rotation-y={rot}>
      <Merge g={frame} lit={lit} />
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.08, 0.42]} />
        <meshToonMaterial color={TOP} />
      </mesh>
    </group>
  )
}

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { BRIDGE_DECK } from '../core/waters'
import { INFRA_BOARD } from '../core/infra'
import { runtime } from '../game/runtime'
import { Merge, shape, useMerged, xf } from './batching'

const WOOD = '#b8844f'
const PAPER = '#fff8e6'

/** 섬 정비 안내판: 나무 기둥 위에 종이 판을 단 간판 */
export function InfraBoard() {
  const { x, z } = INFRA_BOARD
  const y = heightAt(x, z)
  // 기둥과 종이 판은 그림자를 드리우고, 위의 띠는 그림자 없이 한 덩어리로 굳힌다
  const board = useMerged((b) => {
    b.add(shape(THREE.BoxGeometry, 0.1, 1.1, 0.1), xf([-0.35, 0.55, 0]), WOOD, { cast: true })
    b.add(shape(THREE.BoxGeometry, 0.1, 1.1, 0.1), xf([0.35, 0.55, 0]), WOOD, { cast: true })
    b.add(shape(THREE.BoxGeometry, 1.1, 0.6, 0.08), xf([0, 1.05, 0]), PAPER, { cast: true })
    b.add(shape(THREE.BoxGeometry, 0.7, 0.08, 0.02), xf([0, 1.2, 0.05]), '#8a5a3b', { cast: false })
  }, [])
  return (
    <group position={[x, y, z]}>
      <Merge g={board} />
    </group>
  )
}

/**
 * 자리 고르기 중 가장 가까운 맡길 자리에 빨간 표시를 띄운다.
 * 다리는 개울 위 널빤지, 계단은 절벽 가장자리의 디딤돌 한 줄로 보인다.
 */
export function InfraGhost() {
  const bridge = useRef<THREE.Group>(null)
  const stair = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const t = runtime.infraTarget
    const on = !!runtime.infraMode && !!t
    if (bridge.current) bridge.current.visible = on && t?.kind === 'bridge'
    if (stair.current) stair.current.visible = on && t?.kind === 'stair'
    if (mat.current) mat.current.opacity = 0.5 + Math.sin(clock.elapsedTime * 4) * 0.15
    if (!t) return
    if (t.kind === 'bridge' && bridge.current) {
      bridge.current.position.set(t.x, BRIDGE_DECK + 0.05, t.z)
      bridge.current.rotation.y = t.rot
    }
    if (t.kind === 'stair' && stair.current) {
      stair.current.position.set(t.x, heightAt(t.x, t.z) + 0.05, t.z)
      // 디딤돌은 절벽 바깥쪽 방향(각도 ang)으로 놓는다
      stair.current.rotation.y = Math.atan2(Math.cos(t.ang), Math.sin(t.ang))
    }
  })
  return (
    <>
      <group ref={bridge} visible={false}>
        <mesh>
          <boxGeometry args={[1.5, 0.14, 4]} />
          <meshBasicMaterial ref={mat} color="#e46a52" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>
      <group ref={stair} visible={false}>
        {[0.2, 0.9, 1.6].map((o, i) => (
          <mesh key={i} position={[0, 0.1, o - 0.9]}>
            <boxGeometry args={[0.7, 0.12, 0.4]} />
            <meshBasicMaterial color="#e46a52" transparent opacity={0.6} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </>
  )
}

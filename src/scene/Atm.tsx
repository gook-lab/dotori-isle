import * as THREE from 'three'
import { Part, Toon } from './toon'

/** 도토리 ATM 기계. 도토리 상점 안 오른쪽 벽에 선다. 화면 쪽(+z)이 보는 방향이고, rot 으로 돌려 벽을 따라 세운다. 화면과 도토리 코인 슬롯이 밝게 보인다. */
export function Atm({ x, y, z, rot = 0 }: { x: number; y: number; z: number; rot?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      {/* 받침과 몸통 */}
      <Part color="#8fb5a8" position={[0, 0.15, 0]} outline={0.03}>
        <boxGeometry args={[0.9, 0.3, 0.7]} />
      </Part>
      <Part color="#7fb7c9" position={[0, 0.85, 0]} outline={0.04}>
        <boxGeometry args={[0.8, 1.1, 0.6]} />
      </Part>
      {/* 지붕 판: 크림색 간판에 도토리 */}
      <Part color="#fdf6e3" position={[0, 1.5, 0]} outline={0.04}>
        <boxGeometry args={[0.9, 0.3, 0.66]} />
      </Part>
      <mesh position={[0, 1.5, 0.335]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 14]} />
        <meshBasicMaterial color="#c07f45" />
      </mesh>
      <mesh position={[0, 1.5, 0.35]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <Toon color="#c07f45" />
      </mesh>
      {/* 화면 */}
      <mesh position={[0, 1.0, 0.305]}>
        <boxGeometry args={[0.5, 0.36, 0.02]} />
        <Toon color="#9ad0ec" emissive="#2a5a70" />
      </mesh>
      {/* 돈 넣는 슬롯과 받는 구멍 */}
      <mesh position={[0, 0.66, 0.312]}>
        <boxGeometry args={[0.36, 0.05, 0.02]} />
        <meshBasicMaterial color="#2c3440" />
      </mesh>
      <mesh position={[0, 0.5, 0.312]}>
        <boxGeometry args={[0.3, 0.08, 0.02]} />
        <meshBasicMaterial color="#2c3440" />
      </mesh>
      {/* 작은 도토리 표시등 */}
      <mesh position={[0.3, 0.82, 0.312]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial color={new THREE.Color('#ffd166')} />
      </mesh>
    </group>
  )
}

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BUG_TABLE, ITEMS, TIDE_TABLE } from '../core/items'
import { Part, Toon } from './toon'

/**
 * 바닥에 떨어진 물건, 손으로 날아오는 물건, 머리 위로 들어 올린 물건이 함께 쓰는 모델.
 * 원점이 물건 중심이고 크기는 대략 지름 0.4 안팎이다.
 */

const FISH_COLOR: Record<string, [string, string]> = {
  'horse-mackerel': ['#9fb4c4', '#e8eef2'],
  mackerel: ['#5b7fa6', '#d8e4ee'],
  'sea-bass': ['#7d8a96', '#e2e6ea'],
  pufferfish: ['#e8c36a', '#fff3cf'],
  'red-snapper': ['#f07a6a', '#ffd6cc'],
  hairtail: ['#d9e2ea', '#ffffff'],
  flounder: ['#a88a64', '#f4ead8'],
  yellowtail: ['#6f8fb0', '#f2e6a0'],
  killifish: ['#c9c2a0', '#f4f0de'],
  'crucian-carp': ['#a09060', '#e8dcb0'],
  carp: ['#d98a3d', '#f6d9a8'],
  catfish: ['#5a5348', '#c9bfa8'],
  dace: ['#9fb0b8', '#f0f4f2'],
  sweetfish: ['#a8b88a', '#f2efd8'],
  'cherry-trout': ['#7d8a8f', '#f2c9c9'],
}

/** 달팽이: 나선 껍데기와 말랑한 몸. 비 오는 날 땅 위를 기어 다닌다. */
export function Snail() {
  return (
    <group>
      <Part color="#c9d9a8" position={[0, 0.04, 0.02]} scale={[0.55, 0.35, 1.5]} outline={0.08}>
        <sphereGeometry args={[0.14, 12, 10]} />
      </Part>
      <Part color="#d9a066" position={[0, 0.16, -0.04]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, 0.75]} outline={0.07}>
        <sphereGeometry args={[0.14, 14, 12]} />
      </Part>
      <mesh position={[0, 0.16, -0.04]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.08, 0.025, 6, 16]} />
        <Toon color="#a8744a" />
      </mesh>
      {[-0.04, 0.04].map((x) => (
        <group key={x} position={[x, 0.1, 0.2]} rotation={[-0.4, 0, x * 4]}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.12, 4]} />
            <Toon color="#c9d9a8" />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.018, 6, 6]} />
            <meshBasicMaterial color="#2b2018" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Fish({ id }: { id: string }) {
  const tail = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (tail.current) tail.current.rotation.y = Math.sin(clock.elapsedTime * 14) * 0.5
  })
  if (id === 'squid') {
    return (
      <group rotation={[Math.PI / 2, 0, 0]}>
        <Part color="#f2b8c6" scale={[0.8, 1.4, 0.8]} outline={0.08}>
          <sphereGeometry args={[0.15, 14, 10]} />
        </Part>
        {[-0.08, -0.03, 0.03, 0.08].map((x) => (
          <Part key={x} color="#f2b8c6" position={[x, -0.27, 0]} outline={0.12}>
            <capsuleGeometry args={[0.02, 0.14, 3, 6]} />
          </Part>
        ))}
      </group>
    )
  }
  const [body, belly] = FISH_COLOR[id] ?? ['#9fb4c4', '#ffffff']
  const puffy = id === 'pufferfish'
  if (id === 'hairtail') {
    // 갈치: 은빛으로 길쭉한 리본 같은 몸
    return (
      <group>
        <Part color={body} scale={[3.2, 0.55, 0.25]} outline={0.05}>
          <sphereGeometry args={[0.13, 16, 10]} />
        </Part>
        <mesh position={[0.32, 0.03, 0.035]}>
          <sphereGeometry args={[0.022, 8, 6]} />
          <meshBasicMaterial color="#2b2018" />
        </mesh>
        <group ref={tail} position={[-0.4, 0, 0]}>
          <Part color={body} position={[-0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.1}>
            <cylinderGeometry args={[0.004, 0.02, 0.18, 5]} />
          </Part>
        </group>
      </group>
    )
  }
  return (
    <group>
      <Part color={body} scale={puffy ? [1, 0.95, 0.95] : [1.5, 0.75, 0.5]} outline={0.06}>
        <sphereGeometry args={[0.16, 16, 12]} />
      </Part>
      <mesh position={[0.02, -0.04, 0]} scale={puffy ? [0.9, 0.7, 0.92] : [1.35, 0.5, 0.45]}>
        <sphereGeometry args={[0.16, 14, 10]} />
        <Toon color={belly} />
      </mesh>
      <group ref={tail} position={[puffy ? -0.15 : -0.22, 0, 0]}>
        <Part color={body} position={[-0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]} outline={0.1}>
          <coneGeometry args={[0.1, 0.15, 6]} />
        </Part>
      </group>
      <mesh position={[puffy ? 0.1 : 0.15, 0.04, 0.07]}>
        <sphereGeometry args={[0.025, 8, 6]} />
        <meshBasicMaterial color="#2b2018" />
      </mesh>
    </group>
  )
}

function Bug({ id }: { id: string }) {
  const wings = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!wings.current) return
    const f = Math.sin(clock.elapsedTime * 16) * 0.7
    wings.current.children[0].rotation.z = f
    wings.current.children[1].rotation.z = -f
  })
  const sp = BUG_TABLE.find((b) => b.id === id) ?? TIDE_TABLE.find((b) => b.id === id)
  const color = sp?.color ?? '#ffffff'
  if (id === 'rhino-beetle' || id === 'ladybug') {
    return (
      <group>
        <Part color={color} scale={[0.9, 0.55, 1.2]} outline={0.08}>
          <sphereGeometry args={[0.15, 14, 10]} />
        </Part>
        {id === 'rhino-beetle' && (
          <Part color={color} position={[0, 0.07, 0.2]} rotation={[-0.6, 0, 0]} outline={0.12}>
            <coneGeometry args={[0.03, 0.18, 6]} />
          </Part>
        )}
        {id === 'ladybug' &&
          [
            [0.06, 0.04],
            [-0.06, -0.03],
            [0.05, -0.08],
            [-0.05, 0.07],
          ].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.08, z]} scale={[1, 0.4, 1]}>
              <sphereGeometry args={[0.025, 8, 6]} />
              <meshBasicMaterial color="#2b2018" />
            </mesh>
          ))}
      </group>
    )
  }
  return (
    <group>
      <Part color={id === 'honeybee' ? '#f0a020' : '#3a2b1f'} scale={[0.5, 0.5, 1.2]} outline={0.1}>
        <sphereGeometry args={[0.08, 10, 8]} />
      </Part>
      <group ref={wings}>
        <group>
          <mesh position={[0.13, 0, 0]}>
            <boxGeometry args={[0.24, 0.01, 0.2]} />
            <Toon color={id === 'honeybee' ? '#e8f4ff' : color} emissive={sp?.glow ? color : undefined} />
          </mesh>
        </group>
        <group>
          <mesh position={[-0.13, 0, 0]}>
            <boxGeometry args={[0.24, 0.01, 0.2]} />
            <Toon color={id === 'honeybee' ? '#e8f4ff' : color} emissive={sp?.glow ? color : undefined} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export function ItemModel({ id }: { id: string }) {
  const kind = ITEMS[id]?.kind
  if (kind === 'fish') return <Fish id={id} />
  if (id === 'snail') return <Snail />
  if (kind === 'bug') return <Bug id={id} />
  if (kind === 'seafood') return <Seafood id={id} />

  switch (id) {
    case 'story-photo-frame':
      // 첫날 사진 액자: 나무 테두리에 하늘색 사진
      return (
        <group>
          <Part color="#c99a5b" outline={0.06} position={[0, 0.3, 0]}>
            <boxGeometry args={[0.46, 0.4, 0.06]} />
          </Part>
          <Part color="#bfe3f2" outline={0} position={[0, 0.3, 0.035]}>
            <boxGeometry args={[0.34, 0.28, 0.02]} />
          </Part>
        </group>
      )
    case 'story-wreath':
      // 이웃 환영 화환: 초록 고리에 꽃 점
      return (
        <group>
          <Part color="#6fae6a" outline={0.05} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.24, 0.07, 8, 16]} />
          </Part>
          <Part color="#ff8fa3" outline={0} position={[0.17, 0.46, 0.05]}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </Part>
          <Part color="#ffd166" outline={0} position={[-0.14, 0.14, 0.05]}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </Part>
        </group>
      )
    case 'pumpkin-lantern':
      // 호박 등불: 주황 둥근 몸통에 꼭지와 눈코입 구멍
      return (
        <group>
          <Part color="#f08a2a" outline={0.05} position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.3, 14, 10]} />
          </Part>
          <Part color="#6b8e3d" outline={0.03} position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.1, 6]} />
          </Part>
          <Part color="#2a1d12" outline={0} position={[-0.1, 0.26, 0.26]}>
            <boxGeometry args={[0.08, 0.08, 0.02]} />
          </Part>
          <Part color="#2a1d12" outline={0} position={[0.1, 0.26, 0.26]}>
            <boxGeometry args={[0.08, 0.08, 0.02]} />
          </Part>
          <Part color="#ffd166" outline={0} position={[0, 0.16, 0.27]}>
            <boxGeometry args={[0.16, 0.06, 0.02]} />
          </Part>
        </group>
      )
    case 'harvest-basket':
      // 수확 바구니: 짚을 엮은 바구니에 옥수수 낟알과 밤송이
      return (
        <group>
          <Part color="#c9a050" outline={0.05} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.3, 0.22, 0.24, 12]} />
          </Part>
          <Part color="#e0b84a" outline={0} position={[-0.08, 0.3, 0.04]}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </Part>
          <Part color="#8a5a2b" outline={0} position={[0.1, 0.3, -0.02]}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </Part>
        </group>
      )
    case 'acorn-garland':
      // 도토리 화환: 둥근 고리에 도토리 여러 개
      return (
        <group>
          <Part color="#8a6a3a" outline={0.04} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.24, 0.05, 8, 16]} />
          </Part>
          <Part color="#b07d3a" outline={0} position={[0.24, 0.3, 0.05]}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </Part>
          <Part color="#b07d3a" outline={0} position={[-0.24, 0.3, 0.05]}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </Part>
          <Part color="#c8963f" outline={0} position={[0, 0.06, 0.05]}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </Part>
        </group>
      )
    case 'candy-basket':
      // 사탕 바구니: 나무 바구니 속에 색색의 사탕 몇 개
      return (
        <group>
          <Part color="#c8925a" outline={0.05} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.28, 0.2, 0.24, 12]} />
          </Part>
          <Part color="#ff8fa3" outline={0} position={[-0.1, 0.3, 0.05]}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </Part>
          <Part color="#ffd166" outline={0} position={[0.08, 0.32, -0.04]}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </Part>
          <Part color="#8fd3c7" outline={0} position={[0.0, 0.36, 0.1]}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </Part>
        </group>
      )
    case 'story-cake':
      // 집들이 케이크 모형: 접시 위 두 층과 초 하나
      return (
        <group>
          <Part color="#f3e3b5" outline={0.06} position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.06, 14]} />
          </Part>
          <Part color="#f6c7d4" outline={0.06} position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.14, 14]} />
          </Part>
          <Part color="#fff6e6" outline={0.04} position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.1, 14]} />
          </Part>
          <Part color="#ff6b6b" outline={0} position={[0, 0.41, 0]}>
            <sphereGeometry args={[0.04, 6, 4]} />
          </Part>
        </group>
      )
    case 'story-garden':
      // 꽃 정원 미니어처: 흙 받침에 꽃 세 송이
      return (
        <group>
          <Part color="#8d6e4f" outline={0.06} position={[0, 0.06, 0]}>
            <boxGeometry args={[0.5, 0.12, 0.4]} />
          </Part>
          <Part color="#ff8fa3" outline={0.04} position={[-0.14, 0.22, 0]}>
            <sphereGeometry args={[0.09, 8, 6]} />
          </Part>
          <Part color="#ffd166" outline={0.04} position={[0.12, 0.2, 0.06]}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </Part>
          <Part color="#c77dff" outline={0.04} position={[0.02, 0.26, -0.1]}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </Part>
        </group>
      )
    case 'story-trophy':
      // 별점 트로피: 금색 컵과 받침
      return (
        <group>
          <Part color="#e8b64a" outline={0.06} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.1, 0.12, 0.1, 10]} />
          </Part>
          <Part color="#e8b64a" outline={0.06} position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </Part>
          <Part color="#7d5a40" outline={0.04} position={[0, 0.02, 0]}>
            <boxGeometry args={[0.3, 0.06, 0.3]} />
          </Part>
        </group>
      )
    case 'parcel':
      // 표류 소포: 나무 상자에 띠를 두른 모양
      return (
        <group>
          <Part color="#c99a5b" outline={0.08} position={[0, 0.1, 0]}>
            <boxGeometry args={[0.36, 0.22, 0.3]} />
          </Part>
          <Part color="#f3e3b5" outline={0} position={[0, 0.22, 0]}>
            <boxGeometry args={[0.38, 0.03, 0.08]} />
          </Part>
        </group>
      )
    case 'peach':
      return (
        <group>
          <Part color="#ffa38a" outline={0.08}>
            <sphereGeometry args={[0.19, 16, 12]} />
          </Part>
          <Part color="#6cc26a" position={[0.06, 0.19, 0]} rotation={[0, 0, -0.8]} scale={[1, 0.35, 0.6]} outline={0.12}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </Part>
        </group>
      )
    case 'orange':
      return (
        <group>
          <Part color="#ffa233" outline={0.08}>
            <sphereGeometry args={[0.2, 16, 12]} />
          </Part>
          <Part color="#4f9e4c" position={[0.05, 0.2, 0]} rotation={[0, 0, -0.6]} scale={[1, 0.35, 0.6]} outline={0.12}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </Part>
        </group>
      )
    case 'wood':
      // 나이테가 보이는 짧은 통나무
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <Part color="#a8744a" outline={0.06}>
            <cylinderGeometry args={[0.13, 0.13, 0.42, 10]} />
          </Part>
          {[0.211, -0.211].map((y) => (
            <group key={y} position={[0, y, 0]} rotation={[y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}>
              <mesh>
                <circleGeometry args={[0.125, 14]} />
                <Toon color="#f0cf9c" />
              </mesh>
              <mesh position={[0, 0, 0.001]}>
                <ringGeometry args={[0.055, 0.07, 14]} />
                <meshBasicMaterial color="#c99a6b" />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'stone':
      return (
        <Part color="#a7a9b4" scale={[1.1, 0.75, 0.95]} outline={0.07}>
          <dodecahedronGeometry args={[0.17, 0]} />
        </Part>
      )
    case 'iron':
      // 어두운 돌에 박힌 금속 결정
      return (
        <group>
          <Part color="#6e7380" scale={[1.05, 0.8, 0.95]} outline={0.07}>
            <dodecahedronGeometry args={[0.16, 0]} />
          </Part>
          {[
            [0.09, 0.08, 0.06],
            [-0.08, 0.06, 0.08],
            [0.02, 0.12, -0.07],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <octahedronGeometry args={[0.045, 0]} />
              <meshStandardMaterial color="#d6e1ee" metalness={0.8} roughness={0.25} />
            </mesh>
          ))}
        </group>
      )
    case 'gold':
      return <Gold />
    case 'fossil':
      // 암모나이트: 납작한 고리 몇 겹
      return (
        <group rotation={[Math.PI / 2.4, 0, 0]}>
          <Part color="#e8d9b8" scale={[1, 1, 0.45]} outline={0.06}>
            <sphereGeometry args={[0.2, 16, 12]} />
          </Part>
          {[0.15, 0.1, 0.05].map((r) => (
            <mesh key={r} position={[0.02, 0, 0.09]}>
              <torusGeometry args={[r, 0.012, 4, 20]} />
              <meshBasicMaterial color="#b8a27a" />
            </mesh>
          ))}
        </group>
      )
    case 'ammonite':
      // 소용돌이 껍데기: 점점 작아지는 고리
      return (
        <group rotation={[Math.PI / 2.4, 0, 0]}>
          {[0.2, 0.15, 0.1, 0.05].map((r, i) => (
            <mesh key={i} position={[0, 0, i * 0.02]}>
              <torusGeometry args={[r, 0.035, 5, 18]} />
              <Toon color={i % 2 ? '#e0b77a' : '#c99a5a'} />
            </mesh>
          ))}
        </group>
      )
    case 'trilobite':
      // 납작한 몸통과 가운데 마디, 양옆 다리 몇 개
      return (
        <group rotation={[Math.PI / 2.4, 0, 0]}>
          <Part color="#9aa3a8" scale={[1, 1, 0.35]} outline={0.05}>
            <sphereGeometry args={[0.2, 14, 10]} />
          </Part>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0, 0.06]}>
              <boxGeometry args={[0.02, 0.2, 0.02]} />
              <meshBasicMaterial color="#6f7a80" />
            </mesh>
          ))}
        </group>
      )
    case 'fern-fossil':
      // 잎맥이 뻗은 고사리 잎 자국
      return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <planeGeometry args={[0.5, 0.12]} />
            <Toon color="#cdbf9a" />
          </mesh>
          {[-0.18, -0.08, 0.02, 0.12].map((x) => (
            <mesh key={x} position={[x, 0, 0.002]} rotation={[0, 0, 0.6]}>
              <planeGeometry args={[0.16, 0.02]} />
              <meshBasicMaterial color="#8a7c5a" />
            </mesh>
          ))}
        </group>
      )
    case 'dino-footprint':
      // 세 발가락과 둥근 뒤꿈치 자국
      return (
        <group>
          <Part color="#b9a27e" position={[0, 0.03, 0]} scale={[1, 0.2, 1.2]} outline={0.04}>
            <sphereGeometry args={[0.16, 12, 8]} />
          </Part>
          {[-0.12, 0, 0.12].map((x) => (
            <Part key={x} color="#b9a27e" position={[x, 0.03, -0.2]} scale={[0.6, 0.2, 1]} outline={0.04}>
              <sphereGeometry args={[0.07, 8, 6]} />
            </Part>
          ))}
        </group>
      )
    case 'amber-bug':
      // 투명한 호박 덩이 안에 작은 벌레
      return (
        <group>
          <mesh>
            <sphereGeometry args={[0.2, 16, 12]} />
            <meshStandardMaterial color="#e89a2e" transparent opacity={0.75} roughness={0.2} />
          </mesh>
          <mesh position={[0.02, 0, 0.08]}>
            <boxGeometry args={[0.08, 0.04, 0.05]} />
            <meshBasicMaterial color="#3b2a20" />
          </mesh>
        </group>
      )
    case 'acorn-pouch':
      return (
        <group>
          <Part color="#d9b07a" position={[0, -0.02, 0]} scale={[1, 0.9, 1]} outline={0.07}>
            <sphereGeometry args={[0.18, 14, 12]} />
          </Part>
          <Part color="#d9b07a" position={[0, 0.17, 0]} outline={0.1}>
            <coneGeometry args={[0.09, 0.12, 8]} />
          </Part>
          <mesh position={[0, 0.12, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.07, 0.018, 6, 12]} />
            <Toon color="#c0392b" />
          </mesh>
          <Part color="#8a5a3b" position={[0, 0, 0.17]} scale={[1, 1, 0.5]} outline={0.1}>
            <sphereGeometry args={[0.06, 10, 8]} />
          </Part>
        </group>
      )
    case 'empty-can':
      return (
        <Part color="#c9ced6" rotation={[0, 0, Math.PI / 2]} outline={0.06}>
          <cylinderGeometry args={[0.1, 0.1, 0.26, 12]} />
        </Part>
      )
    case 'conch':
      return (
        <Part color="#fff2e2" rotation={[0, 0, Math.PI / 2.3]} outline={0.08}>
          <coneGeometry args={[0.14, 0.4, 10]} />
        </Part>
      )
    case 'scallop':
      return (
        <Part color="#f6c9a0" scale={[1, 0.4, 0.9]} outline={0.08}>
          <sphereGeometry args={[0.22, 12, 8]} />
        </Part>
      )
    case 'starfish':
      return (
        <group scale={[1, 0.35, 1]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Part key={i} color="#f28a4a" position={[Math.cos((i / 5) * Math.PI * 2) * 0.1, 0, Math.sin((i / 5) * Math.PI * 2) * 0.1]} rotation={[0, -(i / 5) * Math.PI * 2, Math.PI / 2]} outline={0.1}>
              <coneGeometry args={[0.06, 0.2, 6]} />
            </Part>
          ))}
        </group>
      )
    case 'rain-pebble':
      // 비 온 뒤 해변의 반짝이는 조약돌: 진주빛 하늘색 돌에 흰 윤기 한 점
      return (
        <group>
          <Part color="#d6eefb" scale={[1, 0.62, 0.86]} outline={0.08}>
            <dodecahedronGeometry args={[0.17, 0]} />
          </Part>
          <Part color="#ffffff" position={[0.05, 0.08, 0.04]} outline={0}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </Part>
        </group>
      )
    case 'coral':
      return (
        <group>
          {[
            [0, 0.08, 0, 0],
            [0.08, 0.04, 0, -0.6],
            [-0.07, 0.05, 0.03, 0.6],
          ].map(([x, y, z, r], i) => (
            <Part key={i} color="#ff8fa3" position={[x, y, z]} rotation={[0, 0, r]} outline={0.1}>
              <capsuleGeometry args={[0.035, 0.18, 3, 8]} />
            </Part>
          ))}
        </group>
      )
    case 'flower-seed':
      return (
        <Part color="#b8e0a0" scale={[0.8, 1, 0.4]} outline={0.08}>
          <boxGeometry args={[0.28, 0.32, 0.2]} />
        </Part>
      )
    case 'tourney-trophy':
      // 대회 트로피: 받침 위에 잔
      return (
        <group>
          <Part color="#c9a24a" position={[0, 0.08, 0]} outline={0.08}>
            <boxGeometry args={[0.34, 0.12, 0.34]} />
          </Part>
          <Part color="#ffd166" position={[0, 0.3, 0]} outline={0.08}>
            <cylinderGeometry args={[0.2, 0.08, 0.36, 12]} />
          </Part>
        </group>
      )
    case 'tourney-fish':
      // 물고기 모형: 납작한 몸통과 꼬리
      return (
        <group>
          <Part color="#7fb8e8" scale={[1.4, 0.8, 0.5]} outline={0.08}>
            <sphereGeometry args={[0.22, 12, 8]} />
          </Part>
          <Part color="#7fb8e8" position={[-0.3, 0, 0]} rotation={[0, 0, 0.3]} outline={0.06}>
            <boxGeometry args={[0.16, 0.16, 0.06]} />
          </Part>
        </group>
      )
    case 'photo-frame':
      // 사진 액자: 나무 테두리와 하얀 종이, 가운데 작은 하늘색 그림
      return (
        <group>
          <Part color="#c99a5b" position={[0, 0.4, 0]} outline={0.06}>
            <boxGeometry args={[0.5, 0.5, 0.05]} />
          </Part>
          <Part color="#fffaf0" position={[0, 0.4, 0.03]} outline={0}>
            <boxGeometry args={[0.38, 0.38, 0.02]} />
          </Part>
          <Part color="#6aa9e9" position={[0, 0.42, 0.045]} outline={0}>
            <boxGeometry args={[0.2, 0.2, 0.01]} />
          </Part>
        </group>
      )
    case 'house-plaque':
      // 우리 집 현판: 두 기둥 위에 얹힌 나무 판과 가운데 금색 방울
      return (
        <group>
          <Part color="#8c5a3c" position={[-0.22, 0.25, 0]} outline={0.06}>
            <boxGeometry args={[0.06, 0.5, 0.06]} />
          </Part>
          <Part color="#8c5a3c" position={[0.22, 0.25, 0]} outline={0.06}>
            <boxGeometry args={[0.06, 0.5, 0.06]} />
          </Part>
          <Part color="#c99a5b" position={[0, 0.6, 0]} outline={0.06}>
            <boxGeometry args={[0.6, 0.26, 0.06]} />
          </Part>
          <Part color="#f5d25a" position={[0, 0.6, 0.05]} outline={0.1}>
            <sphereGeometry args={[0.05, 8, 6]} />
          </Part>
        </group>
      )
    case 'tourney-flag':
      // 대회 깃발: 막대 끝에 펄럭이는 천
      return (
        <group>
          <Part color="#8c5a3c" position={[0, 0.5, 0]} outline={0.06}>
            <cylinderGeometry args={[0.03, 0.03, 1, 6]} />
          </Part>
          <Part color="#e2574c" position={[0.18, 0.82, 0]} outline={0.05}>
            <boxGeometry args={[0.36, 0.22, 0.02]} />
          </Part>
        </group>
      )
    default:
      return (
        <Part color="#e8d9b8" outline={0.08}>
          <boxGeometry args={[0.28, 0.28, 0.28]} />
        </Part>
      )
  }
}

/** 금광석은 빛을 받아 반짝인다. */
/** 잠수로 잡는 해산물(가리비·불가사리는 기존 모양을 쓴다). 기본 도형 1~3개를 붙여 만든다. */
function Seafood({ id }: { id: string }) {
  // 성게 가시: 구 표면에 고르게 흩어 놓은 원뿔들
  const spikes = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    return Array.from({ length: 16 }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / 16
      const r = Math.sqrt(1 - y * y)
      const a = i * 2.39996
      const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
      return { p: d.clone().multiplyScalar(0.13), q: new THREE.Quaternion().setFromUnitVectors(up, d) }
    })
  }, [])
  switch (id) {
    case 'octopus':
      // 분홍 머리에 다리 넷
      return (
        <group>
          <Part color="#f4a6c0" scale={[1, 1.15, 0.95]} outline={0.08}>
            <sphereGeometry args={[0.15, 16, 12]} />
          </Part>
          {[0, 1, 2, 3].map((i) => (
            <Part key={i} color="#f4a6c0" position={[(i - 1.5) * 0.08, -0.2, 0]} rotation={[0, 0, (i - 1.5) * -0.35]} outline={0.1}>
              <capsuleGeometry args={[0.024, 0.16, 3, 6]} />
            </Part>
          ))}
          {[-0.05, 0.05].map((x) => (
            <mesh key={x} position={[x, 0.02, 0.135]}>
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshBasicMaterial color="#2b2018" />
            </mesh>
          ))}
        </group>
      )
    case 'urchin':
      // 가시 구
      return (
        <group>
          <Part color="#4a2f5e" outline={0.06}>
            <sphereGeometry args={[0.13, 14, 10]} />
          </Part>
          {spikes.map(({ p, q }, i) => (
            <mesh key={i} position={p} quaternion={q}>
              <coneGeometry args={[0.018, 0.1, 4]} />
              <Toon color="#7b5aa0" />
            </mesh>
          ))}
        </group>
      )
    case 'abalone':
      // 전복: 납작한 껍데기 안쪽이 진주빛으로 비친다
      return (
        <group>
          <Part color="#5fb8a0" scale={[1.25, 0.45, 0.95]} outline={0.07}>
            <sphereGeometry args={[0.14, 16, 10]} />
          </Part>
          <mesh position={[0, 0.045, 0]} scale={[1, 0.3, 0.75]}>
            <sphereGeometry args={[0.12, 14, 8]} />
            <Toon color="#e6f7ff" />
          </mesh>
        </group>
      )
    case 'lobster':
      // 랍스터: 빨간 몸, 집게 두 개, 꼬리
      return (
        <group>
          <Part color="#e0583a" scale={[1.5, 0.7, 0.85]} outline={0.06}>
            <sphereGeometry args={[0.13, 14, 10]} />
          </Part>
          <Part color="#e0583a" position={[0.2, 0, 0]} outline={0.06}>
            <sphereGeometry args={[0.1, 12, 10]} />
          </Part>
          {[-1, 1].map((z) => (
            <Part key={z} color="#e0583a" position={[0.26, -0.02, z * 0.15]} rotation={[0, z * 0.5, 0]} scale={[1.4, 0.7, 0.9]} outline={0.07}>
              <sphereGeometry args={[0.065, 10, 8]} />
            </Part>
          ))}
          <Part color="#c2402a" position={[-0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.6]} outline={0.08}>
            <coneGeometry args={[0.1, 0.12, 6]} />
          </Part>
        </group>
      )
    case 'sea-cucumber':
      // 해삼: 어두운 긴 자루에 돌기 몇 개
      return (
        <group>
          <Part color="#5b4236" rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1]} outline={0.06}>
            <capsuleGeometry args={[0.07, 0.22, 4, 10]} />
          </Part>
          {[-0.08, 0, 0.08].map((x) => (
            <mesh key={x} position={[x, 0.07, 0]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <Toon color="#8a6a58" />
            </mesh>
          ))}
        </group>
      )
    default:
      return (
        <Part color="#f0e6d6" outline={0.08}>
          <sphereGeometry args={[0.13, 12, 10]} />
        </Part>
      )
  }
}

function Gold() {
  const glint = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!glint.current) return
    const t = clock.elapsedTime
    glint.current.scale.setScalar(Math.max(0, Math.sin(t * 3)) * 0.06)
    glint.current.rotation.z = t * 2
  })
  return (
    <group>
      <mesh scale={[1, 0.8, 0.9]} castShadow>
        <dodecahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color="#ffcf40" metalness={0.85} roughness={0.25} emissive="#5a3a00" />
      </mesh>
      <mesh ref={glint} position={[0.08, 0.12, 0.1]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

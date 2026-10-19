import { useMemo, type ComponentType } from 'react'
import * as THREE from 'three'
import { DISCOVERIES, type DiscoveryId } from '../core/discoveries'
import { heightAt } from '../core/island'
import { Part } from './toon'

/**
 * 발견거리의 눈에 보이는 물건. 자리 판정은 core/discoveries.ts 가 하고, 여기서는 그 자리에 놓을 모양만 그린다.
 * 섬의 다른 물건과 같은 셀 셰이딩과 테두리(Part)를 쓴다.
 */

const STONE = '#8a8078'
const STONE_LIGHT = '#b3aa9e'
const WOOD = '#7a5230'
const BARK = '#6b4a2f'
const RING = '#d9b07c'
const HOLE = '#1a120c'

/** 돌 테두리 우물: 둥근 돌벽, 나무 기둥과 빨간 지붕, 줄에 매달린 두레박 */
function Well() {
  // 돌벽 위에 돌 한 알씩: 테두리가 울퉁불퉁하게 보이게
  const bumps = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i * (Math.PI / 4))
  return (
    <>
      <Part color={STONE_LIGHT} position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.6, 0.66, 0.6, 14]} />
      </Part>
      {bumps.map((a) => (
        <Part key={a} color={STONE} position={[Math.cos(a) * 0.6, 0.62, Math.sin(a) * 0.6]} outline={0.05}>
          <sphereGeometry args={[0.13, 8, 6]} />
        </Part>
      ))}
      {/* 물: 우물 안쪽의 어두운 면 */}
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.46, 16]} />
        <meshBasicMaterial color="#2c4a52" />
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <Part key={x} color={WOOD} position={[x, 1.0, 0]}>
          <boxGeometry args={[0.12, 1.0, 0.12]} />
        </Part>
      ))}
      {/* 두레박 줄과 두레박 */}
      <Part color={WOOD} position={[0, 1.2, 0]} outline={0.1}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 5]} />
      </Part>
      <Part color="#b58a55" position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.16, 0.12, 0.2, 10]} />
      </Part>
      {/* 지붕: 네모 뿔 모양의 빨간 지붕 */}
      <Part color="#c8553d" position={[0, 1.62, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.92, 0.5, 4]} />
      </Part>
    </>
  )
}

/** 납작한 돌 무더기: 크기가 조금씩 다른 얇은 돌을 쌓고 옆에 잔돌을 흩었다 */
const PILE: [number, number, number, number, string][] = [
  [0, 0.05, 0, 0.34, '#9a9288'],
  [0.03, 0.14, -0.02, 0.28, '#8a8a80'],
  [-0.02, 0.22, 0.02, 0.22, '#a79f94'],
  [0.02, 0.29, 0, 0.16, '#7d8a8a'],
]
const SCATTER: [number, number, number][] = [
  [0.45, 0.03, 0.3],
  [-0.42, 0.03, -0.2],
  [0.2, 0.03, -0.5],
]

function Pebbles() {
  return (
    <>
      {PILE.map(([x, y, z, r, c], i) => (
        <Part key={i} color={c} position={[x, y, z]} outline={0.06}>
          <cylinderGeometry args={[r, r * 1.08, 0.09, 12]} />
        </Part>
      ))}
      {SCATTER.map(([x, y, z], i) => (
        <Part key={`s${i}`} color={STONE_LIGHT} position={[x, y, z]} scale={[1, 0.5, 0.8]} outline={0.06}>
          <sphereGeometry args={[0.1, 8, 6]} />
        </Part>
      ))}
    </>
  )
}

/** 야호 표지판: 나무 판에 '야호!' 글씨. 언덕 위에서 외친다는 단서다. */
function Echo() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')
    if (g) {
      g.fillStyle = '#d9b07c'
      g.fillRect(0, 0, 256, 128)
      g.strokeStyle = '#6b4a2f'
      g.lineWidth = 10
      g.strokeRect(6, 6, 244, 116)
      g.fillStyle = '#4a3320'
      g.font = 'bold 66px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('야호!', 128, 68)
    }
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <>
      {[-0.4, 0.4].map((x) => (
        <Part key={x} color={WOOD} position={[x, 0.5, 0]} outline={0.08}>
          <boxGeometry args={[0.1, 1.0, 0.1]} />
        </Part>
      ))}
      <Part color={BARK} position={[0, 1.15, 0]} outline={0.06}>
        <boxGeometry args={[1.2, 0.6, 0.08]} />
      </Part>
      {/* 글씨판: 테두리 위에 얹은 얇은 면. 글씨 그림이라 그림 재질을 쓴다. */}
      <mesh position={[0, 1.15, 0.05]}>
        <planeGeometry args={[1.0, 0.5]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </>
  )
}

function Rock() {
  return (
    <Part color={STONE} position={[0, 0.2, 0]} scale={[1, 0.6, 0.85]} outline={0.05}>
      <dodecahedronGeometry args={[0.5, 0]} />
    </Part>
  )
}

function Stump() {
  return (
    <>
      <Part color={WOOD} position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.42, 0.48, 0.5, 14]} />
      </Part>
      {/* 윗면의 나이테: 밝은 면 위에 옅은 고리 */}
      <mesh position={[0, 0.505, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 16]} />
        <meshBasicMaterial color={RING} />
      </mesh>
      <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.22, 20]} />
        <meshBasicMaterial color={WOOD} />
      </mesh>
    </>
  )
}

function HollowLog() {
  return (
    // 통나무는 남북으로 눕고, 구멍 쪽 끝이 기본 카메라(남쪽)를 향한다
    <group rotation={[0, -Math.PI / 2, 0]}>
      <Part color={BARK} position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.42, 1.8, 14]} />
      </Part>
      {/* 나무 구멍: 통나무 한쪽 끝의 어두운 원 */}
      <mesh position={[0.91, 0.4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.2, 14]} />
        <meshBasicMaterial color={HOLE} />
      </mesh>
    </group>
  )
}

const PARTS: Partial<Record<DiscoveryId, ComponentType>> = {
  pebble: Pebbles,
  echo: Echo,
  well: Well,
  rock: Rock,
  stump: Stump,
  hollow: HollowLog,
}

/** 발견거리 물건을 제자리에 놓는다. 바깥에서만 보이고, 실내에서는 Outdoors 가 숨긴다. */
export function Discoveries() {
  return (
    <>
      {DISCOVERIES.map((s) => {
        const Piece = PARTS[s.id]
        if (!Piece) return null
        return (
          <group key={s.id} position={[s.x, heightAt(s.x, s.z), s.z]}>
            <Piece />
          </group>
        )
      })}
    </>
  )
}

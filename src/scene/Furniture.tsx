import { useFrame } from '@react-three/fiber'
import { Fragment, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { fenceBlocker, fenceSides, isFence, type FenceSides } from '../core/fence'
import { decodeGarden, gardenTileBlocker, isGardenItem } from '../core/gardenTiles'
import { HOME_SITE } from '../core/home'
import type { HomeUse } from '../core/furnitureActions'
import { heightAt } from '../core/island'
import { OutdoorLampPool } from './OutdoorLamps'
import { GLOWING } from '../core/items'
import { currentHour } from '../core/clock'
import { placeBlocker, placementCell } from '../core/placement'
import { pathCellsOf } from '../core/paths'
import { variantById } from '../core/reform'
import { FX_TIME, now, runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { glowMaterial } from './glow'
import { ItemModel } from './ItemModel'
import { gradient, Part, TintContext, Toon } from './toon'

const LEGS: [number, number][] = [
  [-0.22, -0.22],
  [0.22, -0.22],
  [-0.22, 0.22],
  [0.22, 0.22],
]

/** 방 가구 가운데 쓰임에 맞춰 몸 전체가 흔들리는 것. 나무 상자는 뚜껑이 따로 열린다(Lid). */
const REACTIVE_USE: Record<string, HomeUse> = { flowerpot: 'pet', snowman: 'poke' }

/** 별 모양 조명의 별: 다섯 꼭짓점을 얇게 밀어 만든다 */
const STAR_GEO = (() => {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.09 : 0.24
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false })
})()

/** 별 조명 뒤의 노란 후광. 톤 매핑을 건너뛰어 흰색으로 날아가지 않는다. 한 번만 만든다. */
let starHaloMat: THREE.SpriteMaterial | null = null
function starHalo(): THREE.SpriteMaterial {
  if (!starHaloMat) {
    starHaloMat = new THREE.SpriteMaterial({
      map: glowMaterial('#ffcc4d').map,
      color: '#ffcc4d',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      opacity: 0.5,
    })
  }
  return starHaloMat
}

/**
 * 가구 모델. 원점이 바닥 중심이다. fxId 가 있는 방 가구는 쓰임 반응(reactFx)을 받는다.
 * 섬에 놓은 가구는 fxId 가 없어 지금과 똑같이 그린다.
 */
/** 울타리 칸: 가운데 기둥 하나, 이웃이 있는 방향으로만 가로대(또는 낮은 돌담)를 뻗는다. 옆 칸과 이어져 한 줄이 된다. */
const FENCE_SIDES = [
  { k: 'e', dx: 1, dz: 0, rail: [0.5, 0.08, 0.06], stone: [0.5, 0.28, 0.2] },
  { k: 'w', dx: -1, dz: 0, rail: [0.5, 0.08, 0.06], stone: [0.5, 0.28, 0.2] },
  { k: 'n', dx: 0, dz: 1, rail: [0.06, 0.08, 0.5], stone: [0.2, 0.28, 0.5] },
  { k: 's', dx: 0, dz: -1, rail: [0.06, 0.08, 0.5], stone: [0.2, 0.28, 0.5] },
] as const
const FENCE_LOOK: Record<string, { post: string; rail: string }> = {
  fence: { post: '#c98b55', rail: '#d9a06a' },
  'fence-white': { post: '#f4efe6', rail: '#ffffff' },
}
const STONE = '#b9b2a6'
const NO_SIDES: FenceSides = { n: false, e: false, s: false, w: false }

function FenceCell({ kind, sides = NO_SIDES }: { kind: string; sides?: FenceSides }) {
  if (kind === 'fence-stone') {
    return (
      <>
        <Part color={STONE} position={[0, 0.14, 0]} outline={0.03}>
          <boxGeometry args={[0.36, 0.28, 0.36]} />
        </Part>
        {FENCE_SIDES.filter((d) => sides[d.k]).map((d) => (
          <Part key={d.k} color={STONE} position={[d.dx * 0.25, 0.14, d.dz * 0.25]} outline={0.03}>
            <boxGeometry args={d.stone} />
          </Part>
        ))}
      </>
    )
  }
  const look = FENCE_LOOK[kind] ?? FENCE_LOOK.fence
  return (
    <>
      <Part color={look.post} position={[0, 0.31, 0]} outline={0.02}>
        <boxGeometry args={[0.1, 0.62, 0.1]} />
      </Part>
      {FENCE_SIDES.filter((d) => sides[d.k]).map((d) => (
        <Fragment key={d.k}>
          <Part color={look.rail} position={[d.dx * 0.25, 0.22, d.dz * 0.25]} outline={0.02} cast={false}>
            <boxGeometry args={d.rail} />
          </Part>
          <Part color={look.rail} position={[d.dx * 0.25, 0.42, d.dz * 0.25]} outline={0.02} cast={false}>
            <boxGeometry args={d.rail} />
          </Part>
        </Fragment>
      ))}
    </>
  )
}

export function FurnitureModel({ itemId, night, off = false, fxId, variant, sides }: { itemId: string; night: boolean; off?: boolean; fxId?: string; variant?: string; sides?: FenceSides }) {
  const shape = <Shape itemId={itemId} night={night} off={off} fxId={fxId} sides={sides} />
  const use = REACTIVE_USE[itemId]
  const body = !fxId || !use ? shape : <Reactive fxId={fxId} use={use}>{shape}</Reactive>
  // 리폼한 가구는 색 변형을 몸 전체에 씌운다. 기본 가구는 감싸지 않아 지금과 똑같이 그린다.
  const tint = variantById(variant)
  return tint ? <TintContext.Provider value={tint}>{body}</TintContext.Provider> : body
}

/** 쓰임 반응 동안 가구가 흔들린다. 쓰다듬으면 살랑, 건드리면 뒤뚱이고, 시간이 지나면 가라앉는다. */
function Reactive({ fxId, use, children }: { fxId: string; use: HomeUse; children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const grp = g.current
    if (!grp) return
    const fx = runtime.reactFx
    const k = fx && fx.id === fxId && fx.use === use ? now() - fx.t0 : -1
    if (k < 0 || k > FX_TIME) {
      grp.rotation.set(0, 0, 0)
      return
    }
    const amp = Math.exp(-k * 2.6)
    grp.rotation.z = use === 'poke' ? Math.sin(k * 20) * 0.2 * amp : Math.sin(k * 8) * 0.07 * amp
  })
  return <group ref={g}>{children}</group>
}

/** 나무 상자 뚜껑. 뒤쪽 모서리를 축으로 열린다. 원점은 그 모서리다. 열린 뒤 1.8초쯤 있다가 닫힌다. */
function Lid({ fxId, children }: { fxId?: string; children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const grp = g.current
    if (!grp) return
    const fx = runtime.reactFx
    const k = fxId && fx && fx.id === fxId && fx.use === 'open' ? now() - fx.t0 : -1
    const open = k < 0 ? 0 : k < 0.35 ? easeOut(k / 0.35) : k < 1.8 ? 1 : Math.max(0, 1 - (k - 1.8) / 0.4)
    grp.rotation.x = -1.9 * open
  })
  return (
    <group ref={g} position={[0, 0.48, -0.31]}>
      {children}
    </group>
  )
}

const easeOut = (k: number) => 1 - (1 - k) * (1 - k)

/** 별 모양 판의 윤곽. 다섯 꼭짓점과 안쪽 점을 번갈아 잇는다. 모든 별 기념품이 같이 쓴다. */
function starOutline(outer: number, inner: number): THREE.Shape {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = Math.PI / 2 + (i * Math.PI) / 5
    if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  shape.closePath()
  return shape
}
const STAR_SHAPE = starOutline(0.3, 0.13)
/** 종의 옆모습(회전체 단면): 꼭지에서 좁게 시작해 허리를 지나 아래 테두리가 넓게 벌어진다. y 는 아래가 0이다. */
const BELL_PROFILE = [
  new THREE.Vector2(0.27, 0),
  new THREE.Vector2(0.25, 0.1),
  new THREE.Vector2(0.19, 0.22),
  new THREE.Vector2(0.12, 0.32),
  new THREE.Vector2(0.07, 0.38),
  new THREE.Vector2(0.0, 0.4),
]
/** 벽시계: 나무 원판에 크림색 시계판, 가장자리 눈금과 도토리 모양 추. 시침과 분침은 게임 시간을 가리킨다. 원점은 벽 면 아래쪽이다. */
function WallClock() {
  const hour = useRef<THREE.Group>(null)
  const minute = useRef<THREE.Group>(null)
  useFrame(() => {
    const h = currentHour()
    if (hour.current) hour.current.rotation.z = -((h % 12) / 12) * Math.PI * 2
    if (minute.current) minute.current.rotation.z = -((h % 1) * Math.PI * 2)
  })
  const cy = 0.35
  return (
    <group>
      <Part color="#c99a5b" position={[0, cy, 0]} rotation={[Math.PI / 2, 0, 0]} outline={0.05}>
        <cylinderGeometry args={[0.28, 0.28, 0.06, 16]} />
      </Part>
      <Part color="#fffaf0" position={[0, cy, 0.031]} rotation={[Math.PI / 2, 0, 0]} outline={0}>
        <cylinderGeometry args={[0.24, 0.24, 0.01, 16]} />
      </Part>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <Part key={i} color="#8c5a3c" position={[Math.sin(a) * 0.2, cy + Math.cos(a) * 0.2, 0.04]} rotation={[0, 0, -a]} outline={0}>
            <boxGeometry args={[0.02, 0.05, 0.01]} />
          </Part>
        )
      })}
      <group ref={hour} position={[0, cy, 0.05]}>
        <Part color="#4a3426" position={[0, 0.06, 0]} outline={0}>
          <boxGeometry args={[0.04, 0.12, 0.02]} />
        </Part>
      </group>
      <group ref={minute} position={[0, cy, 0.06]}>
        <Part color="#4a3426" position={[0, 0.09, 0]} outline={0}>
          <boxGeometry args={[0.03, 0.18, 0.02]} />
        </Part>
      </group>
      <Part color="#d9534f" position={[0, cy, 0.075]} outline={0}>
        <sphereGeometry args={[0.025, 8, 6]} />
      </Part>
      {/* 추: 줄 끝에 달린 도토리 */}
      <Part color="#8c5a3c" position={[0, cy - 0.3, 0]} outline={0.03}>
        <boxGeometry args={[0.01, 0.12, 0.01]} />
      </Part>
      <Part color="#b07a3b" position={[0, cy - 0.38, 0]} outline={0.04}>
        <sphereGeometry args={[0.07, 12, 8]} />
      </Part>
      <Part color="#6b4a2b" position={[0, cy - 0.3, 0]} outline={0}>
        <cylinderGeometry args={[0.075, 0.075, 0.03, 12]} />
      </Part>
    </group>
  )
}

/** 작은 벽 선반: 나무 선반판과 받침대, 병 두 개. 원점은 벽 면 아래쪽이다. */
function WallShelf() {
  return (
    <group>
      <Part color="#c99a5b" position={[0, 0.3, 0]} outline={0.05}>
        <boxGeometry args={[0.7, 0.06, 0.24]} />
      </Part>
      {[-0.25, 0.25].map((x) => (
        <Part key={x} color="#8c5a3c" position={[x, 0.2, -0.06]} outline={0.03}>
          <boxGeometry args={[0.05, 0.14, 0.12]} />
        </Part>
      ))}
      <Part color="#b8d8c8" position={[-0.2, 0.42, 0]} outline={0.03}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
      </Part>
      <Part color="#8c5a3c" position={[-0.2, 0.52, 0]} outline={0}>
        <cylinderGeometry args={[0.075, 0.075, 0.03, 12]} />
      </Part>
      <Part color="#f2c7a0" position={[0.18, 0.4, 0]} outline={0.03}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
      </Part>
    </group>
  )
}

const STAR_EXTRUDE = { depth: 0.06, bevelEnabled: false }

function Shape({ itemId, night, off, fxId, sides }: { itemId: string; night: boolean; off: boolean; fxId?: string; sides?: FenceSides }) {
  switch (itemId) {
    // 대회 상품은 ItemModel 의 모양을 그대로 쓴다
    case 'tourney-trophy':
    case 'tourney-fish':
    case 'tourney-flag':
    case 'house-plaque':
    case 'photo-frame':
      return <ItemModel id={itemId} />
    case 'wall-clock':
      return <WallClock />
    case 'wall-shelf':
      return <WallShelf />
    case 'stove':
      // 벽돌 화덕: 몸통, 불구멍(주황 불빛), 솥을 얹은 철판, 굴뚝
      return (
        <>
          <Part color="#c77a5c" position={[0, 0.34, 0]}>
            <boxGeometry args={[0.7, 0.68, 0.55]} />
          </Part>
          <mesh position={[0, 0.25, 0.283]}>
            <boxGeometry args={[0.36, 0.2, 0.02]} />
            <meshBasicMaterial color="#ff9a3c" />
          </mesh>
          <Part color="#6e7079" position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.06, 16]} />
          </Part>
          <Part color="#4a4d55" position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.17, 0.14, 0.14, 14]} />
          </Part>
          <Part color="#55575e" position={[0.16, 1.1, -0.14]}>
            <cylinderGeometry args={[0.06, 0.07, 0.7, 10]} />
          </Part>
        </>
      )
    case 'flowerpot':
      // 테두리 있는 토분, 흙, 줄기와 잎, 꽃잎 다섯 장짜리 꽃 셋
      return (
        <>
          <Part color="#d9774a" position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.2, 0.15, 0.34, 14]} />
          </Part>
          <Part color="#c96a40" position={[0, 0.35, 0]} outline={0.05}>
            <cylinderGeometry args={[0.24, 0.23, 0.08, 14]} />
          </Part>
          <mesh position={[0, 0.39, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.2, 14]} />
            <Toon color="#6b4528" />
          </mesh>
          {[-0.12, 0, 0.12].map((x, i) => {
            const h = 0.62 + (i % 2) * 0.1
            const petal = ['#ff8fa3', '#ffe066', '#b8c0ff'][i]
            return (
              <group key={x} position={[x, 0, (i - 1) * 0.04]}>
                <mesh position={[0, (0.39 + h) / 2, 0]}>
                  <cylinderGeometry args={[0.012, 0.015, h - 0.39, 5]} />
                  <Toon color="#5fa35f" />
                </mesh>
                <Part color="#6cb35c" position={[0.05, 0.47 + i * 0.03, 0]} rotation={[0, 0, -0.8]} scale={[1, 0.4, 0.6]} outline={0.1}>
                  <sphereGeometry args={[0.06, 8, 6]} />
                </Part>
                <group position={[0, h, 0]} rotation-x={-0.3}>
                  {[0, 1, 2, 3, 4].map((k) => (
                    <Part key={k} color={petal} position={[Math.cos((k * Math.PI * 2) / 5) * 0.055, 0, Math.sin((k * Math.PI * 2) / 5) * 0.055]} scale={[1, 0.45, 1]} outline={0.1}>
                      <sphereGeometry args={[0.05, 8, 6]} />
                    </Part>
                  ))}
                  <Part color="#ffd166" position={[0, 0.02, 0]} outline={0.1}>
                    <sphereGeometry args={[0.035, 8, 6]} />
                  </Part>
                </group>
              </group>
            )
          })}
        </>
      )
    case 'wardrobe':
      // 옷장: 키 큰 몸체, 문 두 짝(가운데 틈), 손잡이 둘
      return (
        <>
          <Part color="#9c6e44" position={[0, 0.75, 0]} outline={0.04}>
            <boxGeometry args={[0.72, 1.5, 0.5]} />
          </Part>
          {[-0.18, 0.18].map((x) => (
            <Part key={x} color="#c99a68" position={[x, 0.75, 0.26]} outline={0.02}>
              <boxGeometry args={[0.32, 1.32, 0.03]} />
            </Part>
          ))}
          {[-0.04, 0.04].map((x) => (
            <mesh key={x} position={[x, 0.75, 0.29]}>
              <sphereGeometry args={[0.03, 8, 6]} />
              <Toon color="#f2d27a" />
            </mesh>
          ))}
        </>
      )
    case 'drawer':
      // 나무 상자 몸체에 서랍 두 칸과 손잡이
      return (
        <>
          <Part color="#b98a55" position={[0, 0.45, 0]} outline={0.04}>
            <boxGeometry args={[0.7, 0.8, 0.5]} />
          </Part>
          {[0.22, -0.02].map((y) => (
            <Part key={y} color="#d6a870" position={[0, 0.45 + y, 0.26]} outline={0.02}>
              <boxGeometry args={[0.6, 0.32, 0.03]} />
            </Part>
          ))}
          {[0.22, -0.02].map((y) => (
            <Part key={`k${y}`} color="#5a3b22" position={[0, 0.45 + y, 0.29]} outline={0.02}>
              <sphereGeometry args={[0.03, 8, 6]} />
            </Part>
          ))}
        </>
      )
    case 'chair':
      // 방석 깔린 앉는 판, 가로 살 등받이, 다리 사이 가로대
      return (
        <>
          <Part color="#c98b55" position={[0, 0.38, 0]}>
            <boxGeometry args={[0.56, 0.08, 0.56]} />
          </Part>
          <Part color="#ff8fa3" position={[0, 0.44, 0.02]} scale={[1, 0.3, 1]} outline={0.04}>
            <sphereGeometry args={[0.24, 14, 10]} />
          </Part>
          {[-0.22, 0.22].map((x) => (
            <Part key={x} color="#a8744a" position={[x, 0.68, -0.24]} outline={0.08}>
              <boxGeometry args={[0.06, 0.62, 0.06]} />
            </Part>
          ))}
          {[0.6, 0.78, 0.94].map((y) => (
            <Part key={y} color="#c98b55" position={[0, y, -0.24]} outline={0.06}>
              <boxGeometry args={[0.5, y > 0.9 ? 0.1 : 0.06, 0.05]} />
            </Part>
          ))}
          {LEGS.map(([x, z]) => (
            <Part key={`${x}${z}`} color="#a8744a" position={[x, 0.17, z]} outline={0.1}>
              <cylinderGeometry args={[0.035, 0.04, 0.34, 6]} />
            </Part>
          ))}
          {[-0.22, 0.22].map((x) => (
            <mesh key={x} position={[x, 0.12, 0]}>
              <boxGeometry args={[0.03, 0.03, 0.44]} />
              <Toon color="#8a5a3b" />
            </mesh>
          ))}
        </>
      )
    case 'table':
      // 두꺼운 상판 테두리, 체크 식탁보, 받침 다리 넷, 위에 찻잔
      return (
        <>
          <Part color="#c98b55" position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.5, 0.48, 0.08, 20]} />
          </Part>
          <Part color="#a8744a" position={[0, 0.55, 0]} outline={0.03}>
            <cylinderGeometry args={[0.46, 0.46, 0.04, 20]} />
          </Part>
          <mesh position={[0, 0.645, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.36, 20]} />
            <Toon color="#fdf6e3" />
          </mesh>
          {[-0.2, 0, 0.2].flatMap((a) => [
            <mesh key={`h${a}`} position={[0, 0.647, a]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.6, 0.06]} />
              <meshBasicMaterial color="#ffb3c1" />
            </mesh>,
            <mesh key={`v${a}`} position={[a, 0.648, 0]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.06, 0.6]} />
              <meshBasicMaterial color="#ffb3c1" />
            </mesh>,
          ])}
          <Part color="#a8744a" position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 0.52, 8]} />
          </Part>
          {[0, 1, 2, 3].map((k) => (
            <Part key={k} color="#8a5a3b" position={[Math.cos((k * Math.PI) / 2) * 0.17, 0.04, Math.sin((k * Math.PI) / 2) * 0.17]} rotation={[0, (-k * Math.PI) / 2, 0]} outline={0.08}>
              <boxGeometry args={[0.3, 0.07, 0.07]} />
            </Part>
          ))}
          <group position={[0.15, 0.65, -0.08]}>
            <Part color="#ffffff" position={[0, 0.06, 0]} outline={0.08}>
              <cylinderGeometry args={[0.07, 0.055, 0.12, 12]} />
            </Part>
            <mesh position={[0, 0.115, 0]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.062, 12]} />
              <Toon color="#a8744a" />
            </mesh>
            <mesh position={[0.08, 0.06, 0]} rotation-y={Math.PI / 2}>
              <torusGeometry args={[0.035, 0.012, 6, 12]} />
              <Toon color="#ffffff" />
            </mesh>
          </group>
        </>
      )
    case 'mailbox':
      // 받침대, 둥근 지붕 상자, 투입구, 옆 깃발
      return (
        <>
          <Part color="#a8744a" position={[0, 0.06, 0]} outline={0.06}>
            <boxGeometry args={[0.3, 0.12, 0.3]} />
          </Part>
          <Part color="#a8744a" position={[0, 0.42, 0]}>
            <boxGeometry args={[0.1, 0.72, 0.1]} />
          </Part>
          <Part color="#e2574c" position={[0, 0.88, 0]} outline={0.05}>
            <boxGeometry args={[0.34, 0.28, 0.46]} />
          </Part>
          <Part color="#e2574c" position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, 0]} outline={0.05}>
            <cylinderGeometry args={[0.17, 0.17, 0.46, 14, 1, false, -Math.PI / 2, Math.PI]} />
          </Part>
          <mesh position={[0, 0.92, 0.232]}>
            <boxGeometry args={[0.18, 0.035, 0.01]} />
            <meshBasicMaterial color="#3b2a20" />
          </mesh>
          <mesh position={[0, 0.84, 0.233]}>
            <circleGeometry args={[0.05, 10]} />
            <Toon color="#ffd166" />
          </mesh>
          <Part color="#4a5160" position={[0.2, 0.98, 0.05]} outline={0.1}>
            <boxGeometry args={[0.025, 0.26, 0.025]} />
          </Part>
          <Part color="#ffd166" position={[0.2, 1.06, 0.12]} outline={0.08}>
            <boxGeometry args={[0.02, 0.1, 0.14]} />
          </Part>
        </>
      )
    case 'lamp':
      // 통통한 버섯 줄기와 땡땡이 갓, 갓 밑 주름
      return (
        <>
          <Part color="#fff3e0" position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.09, 0.14, 0.6, 12]} />
          </Part>
          <Part color="#fff3e0" position={[0, 0.06, 0]} scale={[1, 0.4, 1]} outline={0.04}>
            <sphereGeometry args={[0.18, 12, 8]} />
          </Part>
          <mesh position={[0, 0.69, 0]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.35, 20]} />
            <Toon color="#ffe6cc" emissive={night ? '#ffd08a' : '#000000'} />
          </mesh>
          <mesh position={[0, 0.7, 0]} scale={[1, 0.65, 1]} castShadow>
            <sphereGeometry args={[0.36, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Toon color="#e2574c" emissive={night ? '#ff9c7e' : '#000000'} />
          </mesh>
          {[
            [0, 0.92, 0, 0.07],
            [0.2, 0.84, 0.12, 0.05],
            [-0.18, 0.83, 0.15, 0.055],
            [0.08, 0.8, -0.24, 0.05],
            [-0.22, 0.82, -0.12, 0.045],
            [0.27, 0.77, -0.08, 0.04],
          ].map(([x, y, z, r]) => (
            <mesh key={`${x}${z}`} position={[x, y, z]} scale={[1, 0.5, 1]}>
              <sphereGeometry args={[r, 8, 6]} />
              <Toon color="#ffffff" emissive={night ? '#553333' : '#000000'} />
            </mesh>
          ))}
        </>
      )
    case 'campfire':
      return <Campfire off={off} />
    case 'fence':
    case 'fence-white':
    case 'fence-stone':
      return <FenceCell kind={itemId} sides={sides} />
    case 'snowman':
      // 숯 눈과 단추, 당근 코, 목도리, 나뭇가지 팔, 양동이 모자
      return (
        <>
          <Part color="#ffffff" position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.3, 16, 12]} />
          </Part>
          <Part color="#ffffff" position={[0, 0.72, 0]}>
            <sphereGeometry args={[0.21, 16, 12]} />
          </Part>
          {[-0.07, 0.07].map((x) => (
            <mesh key={x} position={[x, 0.77, 0.19]}>
              <sphereGeometry args={[0.022, 6, 5]} />
              <meshBasicMaterial color="#3b2a20" />
            </mesh>
          ))}
          {[0.4, 0.28, 0.16].map((y) => (
            <mesh key={y} position={[0, y, Math.sqrt(0.3 ** 2 - (y - 0.3) ** 2) - 0.005]}>
              <sphereGeometry args={[0.025, 6, 5]} />
              <meshBasicMaterial color="#3b2a20" />
            </mesh>
          ))}
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, 0.69, 0.165]} scale={[1, 0.6, 0.4]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshBasicMaterial color="#ffb3c1" />
            </mesh>
          ))}
          <Part color="#f5a623" position={[0, 0.72, 0.25]} rotation={[Math.PI / 2, 0, 0]} outline={0.1}>
            <coneGeometry args={[0.035, 0.16, 6]} />
          </Part>
          <Part color="#e2574c" position={[0, 0.54, 0]} outline={0.06}>
            <torusGeometry args={[0.17, 0.045, 8, 16]} />
          </Part>
          <Part color="#e2574c" position={[0.1, 0.45, 0.17]} rotation={[0.2, 0, 0.15]} outline={0.08}>
            <boxGeometry args={[0.08, 0.18, 0.03]} />
          </Part>
          {[-1, 1].map((sd) => (
            <Part key={sd} color="#7a5233" position={[sd * 0.38, 0.5, 0]} rotation={[0, 0, sd * -0.6]} outline={0.12}>
              <cylinderGeometry args={[0.015, 0.02, 0.32, 5]} />
            </Part>
          ))}
          <Part color="#5b7fd6" position={[0.02, 0.96, 0]} rotation={[0, 0, -0.15]} outline={0.06}>
            <cylinderGeometry args={[0.1, 0.13, 0.14, 12]} />
          </Part>
        </>
      )
    case 'telescope':
      // 다리 셋, 고정 고리, 접안부와 대물렌즈 테, 금색 띠
      return (
        <>
          {[-0.5, 0.5, Math.PI].map((r) => (
            <Part key={r} color="#7a5233" position={[Math.sin(r) * 0.15, 0.3, Math.cos(r) * 0.15]} rotation={[Math.cos(r) * 0.3, 0, -Math.sin(r) * 0.3]} outline={0.1}>
              <cylinderGeometry args={[0.025, 0.035, 0.62, 6]} />
            </Part>
          ))}
          <Part color="#c99a2e" position={[0, 0.62, 0]} outline={0.08}>
            <cylinderGeometry args={[0.07, 0.07, 0.07, 10]} />
          </Part>
          <group position={[0, 0.75, 0.05]} rotation={[-0.9, 0, 0]}>
            <Part color="#5b7fd6">
              <cylinderGeometry args={[0.07, 0.1, 0.7, 14]} />
            </Part>
            <Part color="#c99a2e" position={[0, 0.36, 0]} outline={0.05}>
              <cylinderGeometry args={[0.075, 0.075, 0.06, 14]} />
            </Part>
            <Part color="#c99a2e" position={[0, -0.05, 0]} outline={0.05}>
              <cylinderGeometry args={[0.092, 0.092, 0.04, 14]} />
            </Part>
            <Part color="#3b4a6b" position={[0, -0.4, 0]} outline={0.06}>
              <cylinderGeometry args={[0.04, 0.05, 0.12, 10]} />
            </Part>
            <mesh position={[0, 0.395, 0]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.065, 14]} />
              <Toon color="#bfe3f5" emissive="#2a5a70" />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[0.08, 0.1 + k * 0.08, 0.05]}>
                <sphereGeometry args={[0.012, 5, 4]} />
                <meshBasicMaterial color="#ffe066" />
              </mesh>
            ))}
          </group>
        </>
      )
    case 'log-stool':
      // 나무껍질 결, 나이테, 옆에 돋은 새싹
      return (
        <>
          <Part color="#a8744a" position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.26, 0.3, 0.44, 14]} />
          </Part>
          {[0, 1, 2, 3, 4, 5, 6].map((k) => {
            const a = (k / 7) * Math.PI * 2
            return (
              <mesh key={k} position={[Math.cos(a) * 0.282, 0.22, Math.sin(a) * 0.282]} rotation={[0, -a, 0.08]}>
                <boxGeometry args={[0.015, 0.36, 0.03]} />
                <Toon color="#8a5a3b" />
              </mesh>
            )
          })}
          <mesh position={[0, 0.445, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.25, 18]} />
            <Toon color="#f0cf9c" />
          </mesh>
          {[0.2, 0.14, 0.08].map((r) => (
            <mesh key={r} position={[0, 0.447, 0]} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[r - 0.01, r, 20]} />
              <meshBasicMaterial color="#c99a6b" />
            </mesh>
          ))}
          <group position={[0.24, 0.32, 0.12]}>
            {[-1, 1].map((sd) => (
              <Part key={sd} color="#7ec46a" position={[sd * 0.04, 0.03, 0]} rotation={[0, 0, sd * -0.7]} scale={[1, 0.35, 0.6]} outline={0.1}>
                <sphereGeometry args={[0.05, 8, 6]} />
              </Part>
            ))}
          </group>
        </>
      )
    case 'wooden-box':
      // 판자 이음새, 모서리 보강대, 쇠못, 뚜껑 위에 도토리 하나. 뚜껑은 따로 열린다.
      return (
        <>
          <Part color="#d9a877" position={[0, 0.24, 0]}>
            <boxGeometry args={[0.62, 0.48, 0.62]} />
          </Part>
          {[0.12, 0.24, 0.36].map((y) =>
            [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
              <group key={`${y}${r}`} rotation-y={r}>
                <mesh position={[0, y, 0.311]}>
                  <boxGeometry args={[0.62, 0.012, 0.005]} />
                  <meshBasicMaterial color="#b8875a" />
                </mesh>
              </group>
            )),
          )}
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
            <group key={r} rotation-y={r}>
              {[-0.28, 0.28].map((x) => (
                <mesh key={x} position={[x, 0.24, 0.315]}>
                  <boxGeometry args={[0.07, 0.48, 0.02]} />
                  <Toon color="#a8744a" />
                </mesh>
              ))}
              <mesh position={[0, 0.24, 0.314]} rotation-z={Math.atan2(0.48, 0.5)}>
                <boxGeometry args={[0.72, 0.06, 0.018]} />
                <Toon color="#a8744a" />
              </mesh>
              {[-0.28, 0.28].flatMap((x) =>
                [0.05, 0.43].map((y) => (
                  <mesh key={`${x}${y}`} position={[x, y, 0.328]}>
                    <sphereGeometry args={[0.015, 6, 4]} />
                    <meshBasicMaterial color="#4a5160" />
                  </mesh>
                )),
              )}
            </group>
          ))}
          <Lid fxId={fxId}>
            <Part color="#c98b55" position={[0, 0.05, 0.31]} outline={0.04}>
              <boxGeometry args={[0.64, 0.1, 0.64]} />
            </Part>
            <group position={[0.12, 0.18, 0.23]}>
              <Part color="#c07f45" outline={0.1}>
                <sphereGeometry args={[0.06, 10, 8]} />
              </Part>
              <Part color="#6b4528" position={[0, 0.04, 0]} outline={0.1}>
                <sphereGeometry args={[0.066, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </Part>
            </group>
          </Lid>
        </>
      )
    case 'log-bench':
      // 반쪽 통나무 좌판, 나이테 단면, 그루터기 다리, 옹이
      return (
        <>
          <Part color="#a8744a" position={[0, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.15, 0.15, 1.3, 12]} />
          </Part>
          <mesh position={[0, 0.572, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[1.28, 0.16]} />
            <Toon color="#f0cf9c" />
          </mesh>
          {[-0.651, 0.651].map((x) => (
            <group key={x} position={[x, 0.42, 0]} rotation-y={x > 0 ? Math.PI / 2 : -Math.PI / 2}>
              <mesh>
                <circleGeometry args={[0.14, 14]} />
                <Toon color="#f0cf9c" />
              </mesh>
              {[0.1, 0.05].map((r) => (
                <mesh key={r} position={[0, 0, 0.002]}>
                  <ringGeometry args={[r - 0.008, r, 16]} />
                  <meshBasicMaterial color="#c99a6b" />
                </mesh>
              ))}
            </group>
          ))}
          {[-0.25, 0.3].map((x) => (
            <mesh key={x} position={[x, 0.42, 0.148]} scale={[1, 0.7, 0.3]}>
              <sphereGeometry args={[0.04, 8, 6]} />
              <Toon color="#7a4e30" />
            </mesh>
          ))}
          {[-0.5, 0.5].map((x) => (
            <Part key={x} color="#8a5a3b" position={[x, 0.15, 0]} outline={0.08}>
              <cylinderGeometry args={[0.11, 0.14, 0.3, 10]} />
            </Part>
          ))}
        </>
      )
    case 'stone-lantern':
      // 받침, 기둥, 창 뚫린 화사, 처마가 휜 지붕과 보주
      return (
        <>
          <Part color="#a7a9b4" position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.26, 0.3, 0.2, 8]} />
          </Part>
          <Part color="#b6b8c2" position={[0, 0.24, 0]} outline={0.05}>
            <cylinderGeometry args={[0.16, 0.2, 0.08, 8]} />
          </Part>
          <Part color="#b6b8c2" position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.25, 8]} />
          </Part>
          <Part color="#a7a9b4" position={[0, 0.54, 0]} outline={0.05}>
            <boxGeometry args={[0.36, 0.05, 0.36]} />
          </Part>
          <Part color="#c3c5ce" position={[0, 0.68, 0]} outline={0.04}>
            <boxGeometry args={[0.3, 0.24, 0.3]} />
          </Part>
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
            <group key={r} rotation-y={r}>
              <mesh position={[0, 0.68, 0.152]}>
                <boxGeometry args={[0.13, 0.13, 0.005]} />
                <Toon color={night ? '#ffe2a0' : '#5b5d68'} emissive={night ? '#ffb347' : '#000000'} />
              </mesh>
            </group>
          ))}
          <Part color="#9496a3" position={[0, 0.88, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.36, 0.22, 4]} />
          </Part>
          {[0, 1, 2, 3].map((k) => (
            <Part key={k} color="#9496a3" position={[Math.cos((k * Math.PI) / 2 + Math.PI / 4) * 0.33, 0.8, Math.sin((k * Math.PI) / 2 + Math.PI / 4) * 0.33]} outline={0.1}>
              <sphereGeometry args={[0.035, 6, 5]} />
            </Part>
          ))}
          <Part color="#9496a3" position={[0, 1.03, 0]} outline={0.08}>
            <sphereGeometry args={[0.06, 10, 8]} />
          </Part>
          <Part color="#7ec46a" position={[0.18, 0.22, 0.18]} scale={[1, 0.4, 1]} outline={0.06}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </Part>
        </>
      )
    case 'blossom-arch':
      // 나무 기둥 두 개 위에 꽃이 핀 횡목
      return (
        <>
          {[-0.34, 0.34].map((x) => (
            <Part key={x} color="#b07a52" position={[x, 0.45, 0]} outline={0.05}>
              <boxGeometry args={[0.08, 0.9, 0.08]} />
            </Part>
          ))}
          <Part color="#ff9fb5" position={[0, 0.92, 0]} outline={0.05}>
            <boxGeometry args={[0.8, 0.08, 0.1]} />
          </Part>
          {[-0.3, -0.15, 0, 0.15, 0.3].map((x, i) => (
            <Part key={x} color={i % 2 ? '#ffe066' : '#ffffff'} position={[x, 1.0, 0]} outline={0.04}>
              <sphereGeometry args={[0.07, 8, 6]} />
            </Part>
          ))}
        </>
      )
    case 'star-lamp':
      // 둥근 나무 받침 위에 세운 막대 끝의 금빛 별. 밤에는 은은한 노란 빛을 낸다.
      return (
        <>
          <Part color="#8c5a3c" position={[0, 0.04, 0]} outline={0.05}>
            <cylinderGeometry args={[0.18, 0.2, 0.08, 14]} />
          </Part>
          <Part color="#c9a55a" position={[0, 0.45, 0]} outline={0.05}>
            <cylinderGeometry args={[0.075, 0.09, 0.8, 8]} />
          </Part>
          {/* 별은 짙은 금색 기본 색으로 둔다. 툰 셰이딩의 밝은 칸에서도 노랗게 남도록 emissive 는 쓰지 않는다. */}
          <mesh position={[0, 0.9, 0.03]} geometry={STAR_GEO}>
            <meshToonMaterial color="#e8a317" gradientMap={gradient} />
          </mesh>
          {night && <sprite position={[0, 0.9, -0.05]} scale={1.3} material={starHalo()} />}
        </>
      )
    case 'basket':
      // 대나무 바구니: 둥근 몸통, 누운 테두리, 안에 열매 두 알
      return (
        <>
          <Part color="#c9a06a" position={[0, 0.2, 0]} outline={0.04}>
            <cylinderGeometry args={[0.28, 0.2, 0.36, 12]} />
          </Part>
          <mesh position={[0, 0.39, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.27, 0.03, 6, 16]} />
            <Toon color="#a8744a" />
          </mesh>
          <mesh position={[-0.08, 0.44, 0.02]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <Toon color="#ff8f6b" />
          </mesh>
          <mesh position={[0.09, 0.45, -0.03]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <Toon color="#ff8f6b" />
          </mesh>
        </>
      )
    case 'wind-chime':
      // 가로 막대에 관 세 개가 달린 풍경. 바람이 없어도 줄이 늘어져 있다.
      return (
        <>
          <mesh position={[0, 1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
            <Toon color="#8c5a3c" />
          </mesh>
          {[-0.2, 0, 0.2].map((x, i) => {
            const len = 0.3 + i * 0.08
            return (
              <mesh key={x} position={[x, 0.8 - len / 2, 0]}>
                <cylinderGeometry args={[0.035, 0.035, len, 6]} />
                <Toon color="#9ad0ec" />
              </mesh>
            )
          })}
        </>
      )
    case 'bonsai':
      // 낮은 화분 위에 둥근 나무 덩이
      return (
        <>
          <Part color="#b5653b" position={[0, 0.12, 0]} outline={0.04}>
            <cylinderGeometry args={[0.22, 0.16, 0.24, 12]} />
          </Part>
          <Part color="#4f7a5a" position={[0, 0.5, 0]} outline={0.04}>
            <sphereGeometry args={[0.3, 12, 10]} />
          </Part>
        </>
      )
    case 'lantern-hanging':
    case 'paper-lantern':
      // 긴 막대 끝의 둥근 종이 등불. 밤에는 안에서 빛이 난다. 등롱도 같은 모습으로 그린다.
      return (
        <>
          <Part color="#8c5a3c" position={[0, 0.4, 0]} outline={0.05}>
            <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
          </Part>
          <mesh position={[0, 0.92, 0]}>
            <sphereGeometry args={[0.2, 14, 10]} />
            <Toon color="#ffb3c1" emissive={night ? '#ff8fa3' : '#000000'} />
          </mesh>
        </>
      )
    case 'harvest-scarecrow':
      // 막대 기둥, 가로 팔, 짚 머리와 호박 모자
      return (
        <>
          <Part color="#8c5a3c" position={[0, 0.5, 0]} outline={0.05}>
            <boxGeometry args={[0.07, 1, 0.07]} />
          </Part>
          <Part color="#8c5a3c" position={[0, 0.78, 0]} outline={0.05}>
            <boxGeometry args={[0.7, 0.07, 0.07]} />
          </Part>
          <Part color="#f0a04b" position={[0, 0.5, 0]} outline={0.06}>
            <boxGeometry args={[0.36, 0.36, 0.22]} />
          </Part>
          <Part color="#e8c77a" position={[0, 1.02, 0]} outline={0.06}>
            <sphereGeometry args={[0.16, 12, 10]} />
          </Part>
          <Part color="#e8673e" position={[0, 1.13, 0]} outline={0.05}>
            <coneGeometry args={[0.2, 0.2, 8]} />
          </Part>
        </>
      )
    case 'ice-sculpture':
      // 얼음 받침 위에 쌓은 뾰족한 얼음 탑과 별 꼭대기
      return (
        <>
          <Part color="#dff1fa" position={[0, 0.08, 0]} outline={0.05}>
            <boxGeometry args={[0.6, 0.16, 0.6]} />
          </Part>
          <Part color="#bfe4f5" position={[0, 0.4, 0]} outline={0.05}>
            <coneGeometry args={[0.24, 0.5, 6]} />
          </Part>
          <Part color="#e6f6fc" position={[0, 0.78, 0]} outline={0.05}>
            <coneGeometry args={[0.16, 0.42, 6]} />
          </Part>
          <Part color="#ffffff" position={[0, 1.07, 0]} outline={0.04}>
            <octahedronGeometry args={[0.07]} />
          </Part>
        </>
      )
    case 'iron-lamp':
      // 장식 받침, 마디 있는 기둥, 팔걸이, 유리 등갓과 꼭대기 장식
      return (
        <>
          <Part color="#4a5160" position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.2, 0.25, 0.12, 12]} />
          </Part>
          <Part color="#4a5160" position={[0, 0.17, 0]} outline={0.05}>
            <cylinderGeometry args={[0.1, 0.16, 0.12, 12]} />
          </Part>
          <Part color="#4a5160" position={[0, 0.95, 0]} outline={0.08}>
            <cylinderGeometry args={[0.04, 0.06, 1.6, 8]} />
          </Part>
          {[0.6, 1.2].map((y) => (
            <Part key={y} color="#5a6274" position={[0, y, 0]} outline={0.06}>
              <torusGeometry args={[0.055, 0.02, 6, 12]} />
            </Part>
          ))}
          <Part color="#4a5160" position={[0, 1.76, 0]} outline={0.06}>
            <cylinderGeometry args={[0.12, 0.06, 0.06, 10]} />
          </Part>
          <mesh position={[0, 1.92, 0]}>
            <cylinderGeometry args={[0.16, 0.12, 0.28, 8]} />
            <Toon color={night ? '#fff3c4' : '#e8eef2'} emissive={night ? '#ffd27a' : '#000000'} transparent opacity={0.9} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * 0.145, 1.92, Math.sin((k * Math.PI) / 2) * 0.145]} rotation={[0, (-k * Math.PI) / 2, 0]}>
              <boxGeometry args={[0.02, 0.3, 0.02]} />
              <Toon color="#4a5160" />
            </mesh>
          ))}
          <Part color="#4a5160" position={[0, 2.12, 0]}>
            <coneGeometry args={[0.24, 0.16, 8]} />
          </Part>
          <Part color="#4a5160" position={[0, 2.24, 0]} outline={0.1}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </Part>
        </>
      )
    case 'gold-acorn':
      // 계단식 돌 받침과 금판, 껍질 비늘이 있는 황금 도토리
      return (
        <>
          <Part color="#a7a9b4" position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.44, 0.48, 0.16, 14]} />
          </Part>
          <Part color="#b6b8c2" position={[0, 0.22, 0]} outline={0.04}>
            <cylinderGeometry args={[0.36, 0.4, 0.14, 14]} />
          </Part>
          <mesh position={[0, 0.16, 0.465]} rotation-x={-0.08}>
            <boxGeometry args={[0.3, 0.09, 0.01]} />
            <meshStandardMaterial color="#ffcf40" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.65, 0]} scale={[1, 1.15, 1]} castShadow>
            <sphereGeometry args={[0.3, 20, 16]} />
            <meshStandardMaterial color="#ffcf40" metalness={0.85} roughness={0.25} emissive="#4a3000" />
          </mesh>
          <mesh position={[0, 0.9, 0]} castShadow>
            <sphereGeometry args={[0.33, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#c99a2e" metalness={0.8} roughness={0.35} />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => {
            const a = (k / 10) * Math.PI * 2
            const ring = k % 2
            const r = ring ? 0.27 : 0.31
            return (
              <mesh key={k} position={[Math.cos(a + ring * 0.3) * r, 0.96 + ring * 0.1, Math.sin(a + ring * 0.3) * r]} scale={[1, 0.5, 1]}>
                <sphereGeometry args={[0.06, 8, 6]} />
                <meshStandardMaterial color="#b0861f" metalness={0.8} roughness={0.4} />
              </mesh>
            )
          })}
          <mesh position={[0, 1.24, 0]} rotation-z={0.25}>
            <cylinderGeometry args={[0.03, 0.045, 0.14, 6]} />
            <meshStandardMaterial color="#c99a2e" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[-0.12, 0.7, 0.26]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshBasicMaterial color="#fff6c8" />
          </mesh>
        </>
      )
    case 'bookshelf':
      // 짙은 나무 책장. 앞이 트여 있어 세 칸에 꽂힌 색색의 책이 보인다
      return (
        <>
          <Part color="#9b6a3f" position={[0, 0.9, -0.16]} outline={0.05}>
            <boxGeometry args={[1.0, 1.8, 0.04]} />
          </Part>
          {[-0.48, 0.48].map((x) => (
            <Part key={x} color="#9b6a3f" position={[x, 0.9, 0]} outline={0.05}>
              <boxGeometry args={[0.04, 1.8, 0.36]} />
            </Part>
          ))}
          {[0.2, 0.7, 1.2, 1.7].map((y) => (
            <Part key={y} color="#7a4f2c" position={[0, y, -0.02]}>
              <boxGeometry args={[0.9, 0.05, 0.3]} />
            </Part>
          ))}
          {[0.2, 0.7, 1.2].map((y, row) =>
            [-0.38, -0.3, -0.22, -0.14, -0.06, 0.02, 0.1, 0.18, 0.26].map((x, i) => (
              <Part key={`${row}-${i}`} color={['#d9534f', '#5b8def', '#f0c24b', '#6fb46f', '#b07adb'][(row * 3 + i) % 5]} position={[x, y + 0.16 + (i % 3) * 0.01, 0.02]}>
                <boxGeometry args={[0.065, 0.28 + (i % 3) * 0.03, 0.22]} />
              </Part>
            )),
          )}
        </>
      )
    case 'reading-chair':
      // 푹신한 자주빛 안락의자. 둥근 팔걸이와 쿠션이 있다
      return (
        <>
          <Part color="#7d6a9e" position={[0, 0.3, 0]} outline={0.06}>
            <boxGeometry args={[0.7, 0.3, 0.66]} />
          </Part>
          <Part color="#7d6a9e" position={[0, 0.78, -0.3]} outline={0.08}>
            <boxGeometry args={[0.7, 0.8, 0.22]} />
          </Part>
          {[-0.4, 0.4].map((x) => (
            <Part key={x} color="#6a5888" position={[x, 0.5, 0.02]} outline={0.06}>
              <boxGeometry args={[0.12, 0.36, 0.62]} />
            </Part>
          ))}
          <Part color="#f2c6a0" position={[0, 0.46, 0.04]} scale={[1, 0.6, 1]}>
            <boxGeometry args={[0.5, 0.12, 0.5]} />
          </Part>
        </>
      )
    case 'floor-lamp':
      // 긴 기둥 위 크림색 갓. 밤에는 갓 안이 따뜻하게 빛난다
      return (
        <>
          <Part color="#5a4a3a" position={[0, 0.04, 0]} outline={0.05}>
            <cylinderGeometry args={[0.22, 0.25, 0.08, 14]} />
          </Part>
          <Part color="#5a4a3a" position={[0, 0.8, 0]} outline={0.04}>
            <cylinderGeometry args={[0.03, 0.03, 1.5, 8]} />
          </Part>
          <mesh position={[0, 1.62, 0]}>
            <cylinderGeometry args={[0.2, 0.3, 0.36, 16, 1, true]} />
            <Toon color="#fff3d6" emissive={night ? '#ffcf7a' : '#000000'} transparent opacity={0.95} />
          </mesh>
        </>
      )
    // 첫눈 날 눈사람 완성 기념품: 얼음 받침 위에 여섯 갈래 눈결정이 서 있는 이 게임만의 소품
    case 'first-snow-crystal':
      return (
        <group>
          <Part color="#9fb6c8" position={[0, 0.05, 0]} outline={0.05}>
            <cylinderGeometry args={[0.3, 0.34, 0.1, 12]} />
          </Part>
          <Part color="#dff1ff" position={[0, 0.5, 0]} outline={0.03}>
            <octahedronGeometry args={[0.2]} />
          </Part>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <group key={i} position={[0, 0.5, 0]} rotation={[0, 0, (i * Math.PI) / 3]}>
              <Part color="#bfe6ff" position={[0, 0.2, 0]} outline={0.02}>
                <boxGeometry args={[0.04, 0.4, 0.04]} />
              </Part>
            </group>
          ))}
        </group>
      )
    // 섬 꾸미기 위원회 별 등급 기념품: 별 모양 판(STAR_SHAPE)을 올린 이 게임만의 소품
    case 'star-sprout':
      // 나무 화분에서 줄기가 자라 끝에 노란 별이 달렸다
      return (
        <>
          <Part color="#b5673d" position={[0, 0.14, 0]} outline={0.05}>
            <cylinderGeometry args={[0.2, 0.15, 0.26, 14]} />
          </Part>
          <Part color="#6fbf6a" position={[0, 0.42, 0]} outline={0.03}>
            <cylinderGeometry args={[0.02, 0.03, 0.42, 6]} />
          </Part>
          <Part color="#ffd23f" position={[0, 0.72, 0]} scale={0.5} outline={0.03}>
            <extrudeGeometry args={[STAR_SHAPE, STAR_EXTRUDE]} />
          </Part>
        </>
      )
    case 'acorn-cushion':
      // 갈색 둥근 방석에 밝은 속감 무늬
      return (
        <>
          <Part color="#b07a4a" position={[0, 0.09, 0]} outline={0.05}>
            <cylinderGeometry args={[0.42, 0.46, 0.18, 20]} />
          </Part>
          <Part color="#d9a06a" position={[0, 0.19, 0]} outline={0}>
            <cylinderGeometry args={[0.26, 0.26, 0.03, 20]} />
          </Part>
        </>
      )
    case 'acorn-vase':
      // 도토리 모양 항아리. 둥근 배에 짧은 목과 갈색 입술
      return (
        <>
          <Part color="#c98a4b" position={[0, 0.3, 0]} outline={0.05}>
            <sphereGeometry args={[0.28, 14, 10]} />
          </Part>
          <Part color="#a86f38" position={[0, 0.6, 0]} outline={0.04}>
            <cylinderGeometry args={[0.14, 0.2, 0.14, 12]} />
          </Part>
          <Part color="#7a4f2c" position={[0, 0.69, 0]} outline={0.03}>
            <cylinderGeometry args={[0.17, 0.15, 0.04, 12]} />
          </Part>
        </>
      )
    case 'acorn-lantern':
      // 나무 기둥 위에 도토리 모양 등. 몸통은 호박빛, 갓은 도토리 깍지 색. 밤에 켜 두면 몸통이 빛난다(빛 자체는 방의 등불 빛이 낸다).
      return (
        <>
          <Part color="#8c5a3c" position={[0, 0.04, 0]} outline={0.05}>
            <cylinderGeometry args={[0.18, 0.2, 0.08, 14]} />
          </Part>
          <Part color="#8c5a3c" position={[0, 0.5, 0]} outline={0.05}>
            <cylinderGeometry args={[0.05, 0.06, 0.9, 8]} />
          </Part>
          <mesh position={[0, 1.15, 0]} scale={[1, 1.25, 1]}>
            <sphereGeometry args={[0.2, 12, 10]} />
            <Toon color="#f0b35a" emissive={night && !off ? '#ffb347' : '#000000'} />
          </mesh>
          <Part color="#6b4a2e" position={[0, 1.42, 0]} outline={0.03}>
            <cylinderGeometry args={[0.22, 0.12, 0.12, 14]} />
          </Part>
        </>
      )
    case 'star-cushion':
      // 분홍 방석 위에 노란 별 무늬
      return (
        <>
          <Part color="#f08fa0" position={[0, 0.1, 0]} outline={0.05}>
            <cylinderGeometry args={[0.42, 0.46, 0.18, 20]} />
          </Part>
          <Part color="#fff1a8" position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.7} outline={0}>
            <extrudeGeometry args={[STAR_SHAPE, STAR_EXTRUDE]} />
          </Part>
        </>
      )
    case 'star-bell':
      // 나무 틀에 매단 청동 종. 아래가 활짝 벌어진 종 모양이고, 그 밑에 별 모양 추가 달렸다
      return (
        <>
          <Part color="#8c5a3c" position={[0, 0.05, 0]} outline={0.05}>
            <boxGeometry args={[0.6, 0.1, 0.4]} />
          </Part>
          <Part color="#8c5a3c" position={[-0.26, 0.7, 0]} outline={0.03}>
            <cylinderGeometry args={[0.04, 0.04, 1.3, 8]} />
          </Part>
          <Part color="#8c5a3c" position={[0.26, 0.7, 0]} outline={0.03}>
            <cylinderGeometry args={[0.04, 0.04, 1.3, 8]} />
          </Part>
          <Part color="#8c5a3c" position={[0, 1.35, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.03}>
            <cylinderGeometry args={[0.04, 0.04, 0.62, 8]} />
          </Part>
          <Part color="#d9a441" position={[0, 1.33, 0]} outline={0.04}>
            <cylinderGeometry args={[0.03, 0.03, 0.12, 8]} />
          </Part>
          <Part color="#d9a441" position={[0, 0.9, 0]} outline={0.04}>
            <latheGeometry args={[BELL_PROFILE, 18]} />
          </Part>
          <Part color="#ffd23f" position={[0, 0.66, 0.02]} scale={0.3} outline={0.03}>
            <extrudeGeometry args={[STAR_SHAPE, STAR_EXTRUDE]} />
          </Part>
        </>
      )
    case 'star-stand':
      // 기둥 끝의 별 모양 갓. 켜 두면 밤에 노란 빛을 낸다
      return (
        <>
          <Part color="#6b4a2e" position={[0, 0.04, 0]} outline={0.05}>
            <cylinderGeometry args={[0.2, 0.22, 0.08, 14]} />
          </Part>
          <Part color="#c9a55a" position={[0, 0.6, 0]} outline={0.04}>
            <cylinderGeometry args={[0.05, 0.05, 1.1, 8]} />
          </Part>
          <mesh position={[0, 1.3, 0]} rotation={[0, 0, 0]} scale={0.9}>
            <extrudeGeometry args={[STAR_SHAPE, STAR_EXTRUDE]} />
            <Toon color="#ffe066" emissive={night && !off ? '#ffcf7a' : '#000000'} />
          </mesh>
        </>
      )
    case 'star-trophy':
      // 받침대 위 금빛 잔, 꼭대기에 별
      return (
        <>
          <Part color="#8c5a3c" position={[0, 0.06, 0]} outline={0.05}>
            <boxGeometry args={[0.5, 0.12, 0.5]} />
          </Part>
          <Part color="#e0b44a" position={[0, 0.37, 0]} outline={0.04}>
            <cylinderGeometry args={[0.05, 0.07, 0.5, 10]} />
          </Part>
          <Part color="#e0b44a" position={[0, 0.75, 0]} outline={0.05}>
            <cylinderGeometry args={[0.2, 0.12, 0.25, 16]} />
          </Part>
          <Part color="#fff1a8" position={[0, 1.02, 0]} scale={0.5} outline={0.03}>
            <extrudeGeometry args={[STAR_SHAPE, STAR_EXTRUDE]} />
          </Part>
        </>
      )
    case 'globe':
      return <Globe fxId={fxId} />
    case 'workbench':
      // 두꺼운 나무 상판과 서랍 달린 작업대. 위에 망치와 줄자가 놓여 있다
      return (
        <>
          <Part color="#b58b5a" position={[0, 0.9, 0]} outline={0.05}>
            <boxGeometry args={[1.4, 0.1, 0.7]} />
          </Part>
          <Part color="#8a6240" position={[0, 0.42, 0]}>
            <boxGeometry args={[1.2, 0.6, 0.6]} />
          </Part>
          {[0.5, 0.26].map((y) => (
            <Part key={y} color="#6e4c2e" position={[0, y, 0.31]}>
              <boxGeometry args={[1.0, 0.18, 0.03]} />
            </Part>
          ))}
          <Part color="#7a5a3a" position={[-0.4, 1.02, 0.1]}>
            <boxGeometry args={[0.04, 0.22, 0.04]} />
          </Part>
          <Part color="#6b7280" position={[-0.4, 1.14, 0.1]}>
            <boxGeometry args={[0.16, 0.06, 0.06]} />
          </Part>
          <Part color="#f2c230" position={[0.4, 0.98, 0.15]}>
            <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
          </Part>
        </>
      )
    case 'tool-rack':
      // 두 발로 선 나무 공구걸이. 망치·톱·드라이버가 걸려 있다(바닥에 놓인 가구라 발이 바닥에 닿는다)
      return (
        <>
          <Part color="#8a6a4a" position={[0, 0.55, 0]} outline={0.04}>
            <boxGeometry args={[1.0, 0.7, 0.06]} />
          </Part>
          <Part color="#6b4a2e" position={[-0.42, 0.12, 0]}>
            <boxGeometry args={[0.08, 0.24, 0.08]} />
          </Part>
          <Part color="#6b4a2e" position={[0.42, 0.12, 0]}>
            <boxGeometry args={[0.08, 0.24, 0.08]} />
          </Part>
          <Part color="#7a5a3a" position={[-0.3, 0.51, 0.07]}>
            <boxGeometry args={[0.04, 0.42, 0.04]} />
          </Part>
          <Part color="#6b7280" position={[-0.3, 0.75, 0.07]}>
            <boxGeometry args={[0.16, 0.07, 0.05]} />
          </Part>
          <Part color="#aeb4bd" position={[0, 0.55, 0.08]}>
            <boxGeometry args={[0.12, 0.56, 0.012]} />
          </Part>
          <Part color="#c98b55" position={[0, 0.83, 0.08]}>
            <boxGeometry args={[0.12, 0.12, 0.04]} />
          </Part>
          <Part color="#9aa3ae" position={[0.3, 0.55, 0.08]}>
            <boxGeometry args={[0.03, 0.36, 0.03]} />
          </Part>
          <Part color="#d9534f" position={[0.3, 0.75, 0.08]}>
            <cylinderGeometry args={[0.04, 0.04, 0.14, 8]} />
          </Part>
        </>
      )
    case 'storage-shelf':
      // 철제 선반 네 칸. 바구니와 나무 상자를 쌓아 두었다
      return (
        <>
          {[-0.45, 0.45].flatMap((x) => [-0.14, 0.14].map((z) => (
            <Part key={`${x}${z}`} color="#8e98a6" position={[x, 0.8, z]}>
              <boxGeometry args={[0.06, 1.6, 0.06]} />
            </Part>
          )))}
          {/* 칸 뒤판은 어둡게 깔아 밝은 판과 상자의 윤곽이 서로 잘 보이게 한다 */}
          <Part color="#6e5a46" position={[0, 0.8, -0.19]}>
            <boxGeometry args={[1.0, 1.6, 0.03]} />
          </Part>
          {[0.05, 0.5, 0.95, 1.4].map((y) => (
            <Part key={y} color="#c4ccd6" position={[0, y, 0]} outline={0.04}>
              <boxGeometry args={[1.0, 0.07, 0.4]} />
            </Part>
          ))}
          {[0.05, 0.5, 0.95].map((y, row) => (
            <Part key={y} color={['#c9a46a', '#a8824e', '#7fa36a'][row]} position={[row % 2 ? 0.2 : -0.22, y + 0.15, 0]}>
              <boxGeometry args={[0.36, 0.22, 0.3]} />
            </Part>
          ))}
          {/* 맨 위에는 작은 상자를 얹어 선반으로 읽히게 한다 */}
          <Part color="#d8b57a" position={[0.22, 1.56, 0]} outline={0.03}>
            <boxGeometry args={[0.26, 0.18, 0.26]} />
          </Part>
        </>
      )
    case 'boiler':
      // 둥근 쇠 몸통에 파이프와 압력계가 달린 보일러. 문 틈에서 불빛이 새어 나온다
      return (
        <>
          <Part color="#7a8290" position={[0, 0.55, 0]} outline={0.06}>
            <cylinderGeometry args={[0.36, 0.36, 1.0, 18]} />
          </Part>
          <Part color="#5f6773" position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.06, 18]} />
          </Part>
          <Part color="#4a515c" position={[0, 0.1, 0]}>
            <boxGeometry args={[0.8, 0.2, 0.7]} />
          </Part>
          <mesh position={[0, 0.5, 0.36]}>
            <boxGeometry args={[0.3, 0.34, 0.02]} />
            <Toon color={night ? '#ff9a4a' : '#2f3540'} emissive={night ? '#ff7a2a' : '#000000'} />
          </mesh>
          <mesh position={[0.12, 0.9, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.03, 12]} />
            <Toon color="#f5f5f5" />
          </mesh>
          <Part color="#9aa3ae" position={[0.5, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
          </Part>
        </>
      )
    default:
      return (
        <Part color="#cccccc" position={[0, 0.25, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
        </Part>
      )
  }
}

/** 지구본. 나무 받침대 위 구체가 적도 띠와 대륙 점과 함께 돈다. 쓰임 연출(spin)이 있으면 그 동안 빙글 돌고, 멈춘 자리에서 그대로 선다. */
function Globe({ fxId }: { fxId?: string }) {
  const spin = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    const fx = runtime.reactFx
    if (!spin.current || !fx || fx.id !== fxId || fx.use !== 'spin' || now() - fx.t0 > FX_TIME) return
    spin.current.rotation.y += delta * 5
  })
  return (
    <>
      <Part color="#8a5a34" position={[0, 0.05, 0]} outline={0.05}>
        <cylinderGeometry args={[0.24, 0.28, 0.1, 14]} />
      </Part>
      <Part color="#8a5a34" position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.4, 8]} />
      </Part>
      <group ref={spin} position={[0, 0.8, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.3, 20, 14]} />
          <Toon color="#4f8fc0" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.31, 0.015, 6, 28]} />
          <Toon color="#c99a2e" />
        </mesh>
        {([[0.12, 0.1, 0.22], [-0.16, 0.15, 0.18], [0.1, -0.1, -0.24], [-0.2, -0.06, -0.14]] as const).map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <Toon color="#7cb36a" />
          </mesh>
        ))}
      </group>
    </>
  )
}

/** 돌 둘레 안에 장작을 쌓은 모닥불. 불꽃 셋이 엇박으로 일렁이고 불씨가 떠오른다. */
function Campfire({ off }: { off: boolean }) {
  const flame = useRef<THREE.Group>(null)
  const sparks = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    flame.current?.children.forEach((c, i) => {
      c.scale.set(1 + Math.sin(t * 13 + i * 2) * 0.1, 1 + Math.sin(t * 9 + i * 1.7) * 0.18, 1 + Math.cos(t * 11 + i) * 0.1)
    })
    sparks.current?.children.forEach((c, i) => {
      const k = (t * 0.6 + i / 4) % 1
      c.position.set(Math.sin(k * 7 + i * 2) * 0.12, 0.3 + k * 0.8, Math.cos(k * 5 + i) * 0.12)
      c.scale.setScalar(1 - k)
    })
  })
  return (
    <>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
        const a = (k / 8) * Math.PI * 2
        return (
          <Part key={k} color={k % 2 ? '#a7a9b4' : '#b6b8c2'} position={[Math.cos(a) * 0.36, 0.06, Math.sin(a) * 0.36]} scale={[1, 0.7, 1]} outline={0.08}>
            <dodecahedronGeometry args={[0.09, 0]} />
          </Part>
        )
      })}
      <mesh position={[0, 0.015, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.3, 14]} />
        <Toon color="#4a3a30" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <Part key={i} color="#8a5a3b" position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, (i * Math.PI) / 3]} outline={0.08}>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
        </Part>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, (i * Math.PI) / 3]}>
          <cylinderGeometry args={[0.052, 0.052, 0.12, 6]} />
          <meshBasicMaterial color={off ? '#5a4a40' : '#ff7a3d'} />
        </mesh>
      ))}
      <group ref={flame} position={[0, 0.12, 0]} visible={!off}>
        <mesh position={[0, 0.18, 0]}>
          <coneGeometry args={[0.16, 0.42, 8]} />
          <meshBasicMaterial color="#ff8a3d" />
        </mesh>
        <mesh position={[0.06, 0.12, 0.04]}>
          <coneGeometry args={[0.09, 0.28, 8]} />
          <meshBasicMaterial color="#ff6b3d" />
        </mesh>
        <mesh position={[0, 0.14, 0.02]}>
          <coneGeometry args={[0.09, 0.26, 8]} />
          <meshBasicMaterial color="#ffe066" />
        </mesh>
      </group>
      <group ref={sparks} visible={!off}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.02, 5, 4]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
        ))}
      </group>
    </>
  )
}

export function PlacedFurniture() {
  const placed = useGame((s) => s.placed)
  const night = useGame((s) => s.night)
  return (
    <>
      {/* 바깥 등 빛은 고정 칸 풀이 맡는다. 가구 모델은 빛 없이 발광 재질만 낸다. */}
      <OutdoorLampPool placed={placed} />
      {placed.map((p) => (
        <group key={p.id} position={[p.x, heightAt(p.x, p.z), p.z]} rotation-y={(p.rot * Math.PI) / 2}>
          <FurnitureModel itemId={p.itemId} night={night && GLOWING.has(p.itemId) && !p.off} off={p.off} variant={p.variant} sides={isFence(p.itemId) ? fenceSides(placed, p.x, p.z) : undefined} />
        </group>
      ))}
    </>
  )
}

/** 배치 중일 때 앞 칸에 뜨는 미리보기와 칸 표시 */
export function PlacementGhost() {
  const placing = useGame((s) => s.placing)
  // 주머니에서 고른 가구의 리폼 색을 미리보기에도 보여 준다
  const placingVariant = useGame((s) => s.inventory.find((x) => x.id === s.placing)?.variant)
  const rot = useGame((s) => s.placingRot)
  const root = useRef<THREE.Group>(null)
  const tile = useRef<THREE.MeshBasicMaterial>(null)

  // 마지막 판정의 입력(칸·저장 조각)과 결과. 입력이 그대로면 매 프레임 길·정원 칸을 다시 풀지 않는다.
  const judged = useRef<{ x: number; z: number; placing: unknown; placed: unknown; tiles: unknown; paths: unknown; felled: unknown; day: unknown; holes: unknown } | null>(null)

  useFrame(({ clock }) => {
    if (!root.current) {
      judged.current = null
      return
    }
    const p = runtime.player
    const c = useGame.getState().placeCell ?? placementCell(p.x, p.z, p.facing)
    root.current.position.set(c.x, heightAt(c.x, c.z), c.z)
    const gs = useGame.getState()
    const last = judged.current
    const same =
      last !== null &&
      last.x === c.x &&
      last.z === c.z &&
      last.placing === gs.placing &&
      last.placed === gs.placed &&
      last.tiles === gs.gardenTiles &&
      last.paths === gs.infra.paths &&
      last.felled === gs.felled &&
      last.day === gs.day &&
      last.holes === gs.holes
    if (!same) {
      const live = { felled: gs.felled, day: gs.day, holes: gs.holes, paths: pathCellsOf(gs.infra.paths) }
      // 정원 바닥은 고리·평지 판정만 본다. 울타리와 가구는 각자의 판정을 함께 받는다.
      const ok = isGardenItem(gs.placing)
        ? gardenTileBlocker(c.x, c.z, HOME_SITE, gs.placed, decodeGarden(gs.gardenTiles), live) === null
        : placeBlocker(c.x, c.z, gs.placed, [], live) === null && fenceBlocker(gs.placing ?? '', c.x, c.z, HOME_SITE) === null
      judged.current = { x: c.x, z: c.z, placing: gs.placing, placed: gs.placed, tiles: gs.gardenTiles, paths: gs.infra.paths, felled: gs.felled, day: gs.day, holes: gs.holes }
      tile.current?.color.set(ok ? '#7ee081' : '#ff6b6b')
    }
    if (tile.current) tile.current.opacity = 0.45 + Math.sin(clock.elapsedTime * 6) * 0.15
  })

  if (!placing) return null
  return (
    <group ref={root}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <planeGeometry args={[0.95, 0.95]} />
        <meshBasicMaterial ref={tile} transparent depthWrite={false} />
      </mesh>
      <group rotation-y={(rot * Math.PI) / 2}>
        <FurnitureModel itemId={placing} night={false} variant={placingVariant} />
      </group>
    </group>
  )
}

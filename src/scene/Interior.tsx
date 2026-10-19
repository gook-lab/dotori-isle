import { useMemo } from 'react'
import * as THREE from 'three'
import { GLOWING } from '../core/items'
import { ROOM_D, ROOM_EXIT, ROOM_FLOOR, ROOM_FURNITURE, ROOM_W, roomCenter } from '../core/interior'
import { VILLAGERS, type Villager } from '../core/villagers'
import { useGame } from '../game/store'
import { FurnitureModel } from './Furniture'
import { Merge, mul, shape, useMerged, xf } from './batching'
import { Part } from './toon'
import { LampPool, MoodBulb, MoodWindow, ShadeWall, type LampSpot } from './InteriorLight'

const WALL_H = 2.8
/** 방 밖으로 보이는 바다를 덮는 실내 바닥색(Home.tsx 의 INDOOR_FLOOR 와 같다) */
const INDOOR_FLOOR = '#2b1f17'
const at = (id: string) => ROOM_FURNITURE.find((f) => f.id === id)!

/** 주민 색을 흰색 쪽으로 섞어 벽지 색을 만든다. */
const tint = (hex: string, k: number) => `#${new THREE.Color(hex).lerp(new THREE.Color('#fffaf0'), k).getHexString()}`

/**
 * 방의 고정된 장식 조각: 벽지 줄무늬, 앞쪽 걸레받이, 출구 매트. 한 묶음으로 굳혀 그리기 호출을 줄인다.
 * 줄무늬는 빛을 받지 않는 색 평면이다.
 */
function RoomTrim({ accent }: { accent: string }) {
  const g = useMerged(
    (b) => {
      const stripe = shape(THREE.PlaneGeometry, 0.12, 1.9)
      const sc = tint(accent, 0.35)
      for (let k = 0; k < 11; k++) b.add(stripe, xf([-ROOM_W / 2 + 0.5 + k * 0.9, 1.85, -ROOM_D / 2 + 0.065]), sc, { unlit: true, cast: false })
      const skirt = shape(THREE.BoxGeometry, ROOM_W / 2 - 0.8, 0.5, 0.12)
      for (const sd of [-1, 1]) b.add(skirt, xf([sd * (ROOM_W / 4 + 0.4), 0.25, ROOM_D / 2]), '#c98b55', { outline: 0 })
      b.add(shape(THREE.PlaneGeometry, 1.3, 0.7), xf([ROOM_EXIT.x, ROOM_FLOOR + 0.01, ROOM_EXIT.z], [-Math.PI / 2, 0, 0]), '#8a5a3b', { cast: false })
    },
    [accent],
  )
  return <Merge g={g} />
}

const BOOK_COLORS = ['#e2574c', '#5b7fd6', '#ffd166', '#6cb35c', '#b8c0ff', '#ff8fa3']

/**
 * 침대·옷장·책장: 움직이지 않는 가구라 한 묶음으로 굳힌다. 외곽선이 있는 부품은 묶음 외곽선으로 같이 그린다.
 * 침대는 머리 쪽이 방 뒤(-z)를 향하도록 돌려 놓는다.
 */
function RoomFurniture({ v }: { v: Villager }) {
  const bed = at('bed')
  const dresser = at('dresser')
  const shelf = at('shelf')
  const g = useMerged(
    (b) => {
      const bedM = xf([bed.x, 0, bed.z], [0, Math.PI / 2, 0])
      const box = (M: THREE.Matrix4, size: [number, number, number], pos: [number, number, number], color: string, outline = 0.03, rot?: [number, number, number]) =>
        b.add(shape(THREE.BoxGeometry, ...size), mul(M, xf(pos, rot)), color, { outline })
      // 침대
      box(bedM, [1.5, 0.3, 2.3], [0, 0.22, 0], '#a8744a')
      box(bedM, [1.6, 1, 0.14], [0, 0.6, -1.12], '#8a5a3b', 0.04)
      box(bedM, [1.38, 0.16, 2.15], [0, 0.44, 0], '#fffaf0')
      box(bedM, [1.44, 0.12, 1.45], [0, 0.54, 0.35], v.accent)
      for (const [x, z] of [[-0.4, 0.1], [0.3, 0.5], [-0.1, 0.85], [0.45, -0.1], [-0.45, 0.65]]) {
        b.add(shape(THREE.CircleGeometry, 0.07, 10), mul(bedM, xf([x, 0.605, z + 0.35], [-Math.PI / 2, 0, 0])), '#ffffff', { unlit: true, cast: false })
      }
      b.add(shape(THREE.SphereGeometry, 0.42, 14, 10), mul(bedM, xf([0, 0.6, -0.75], [0, 0, 0], [1, 0.45, 0.7])), '#ffffff', { outline: 0.05 })
      // 옷장
      const dM = xf([dresser.x, 0, dresser.z])
      box(dM, [1.3, 1.6, 0.8], [0, 0.8, 0], '#c98b55')
      for (const y of [0.35, 0.8, 1.25]) {
        box(dM, [1.14, 0.36, 0.02], [0, y, 0.405], '#d9a877', 0)
        b.add(shape(THREE.SphereGeometry, 0.045, 8, 6), mul(dM, xf([0, y, 0.43])), '#ffd166', { outline: 0 })
      }
      b.add(shape(THREE.CylinderGeometry, 0.1, 0.13, 0.32, 12), mul(dM, xf([0.35, 1.78, 0])), v.accent, { outline: 0.08 })
      b.add(shape(THREE.SphereGeometry, 0.11, 10, 8), mul(dM, xf([0.35, 2.02, 0])), '#ff8fa3', { outline: 0.1 })
      // 책장: 책 세 줄
      const sM = xf([shelf.x, 0, shelf.z])
      box(sM, [1.2, 2, 0.5], [0, 1, 0], '#a8744a')
      ;[0.45, 1.1, 1.7].forEach((y, row) => {
        box(sM, [1.08, 0.05, 0.3], [0, y - 0.22, 0.2], '#8a5a3b', 0)
        ;[-0.42, -0.28, -0.14, 0.02, 0.16, 0.34].forEach((x, i) => {
          box(sM, [0.11, 0.38 - ((i + row) % 3) * 0.05, 0.26], [x, y, 0.22], BOOK_COLORS[(i + row * 2) % BOOK_COLORS.length], 0, [0, 0, i === 3 + row ? 0.25 : 0])
        })
      })
    },
    [v.accent, bed.x, bed.z, dresser.x, dresser.z, shelf.x, shelf.z],
  )
  return <Merge g={g} />
}

/** 나무 바닥과 판자 줄 */
function Floor() {
  return (
    <group>
      <mesh position={[0, ROOM_FLOOR - 0.1, 0]} receiveShadow>
        <boxGeometry args={[ROOM_W, 0.2, ROOM_D]} />
        <meshToonMaterial color="#d9a877" />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => -ROOM_W / 2 + (i + 1) * (ROOM_W / 10)).map((x) => (
        <mesh key={x} position={[x, ROOM_FLOOR + 0.002, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.03, ROOM_D]} />
          <meshBasicMaterial color="#c08f5f" />
        </mesh>
      ))}
    </group>
  )
}

/** 뒤 벽의 창: 낮엔 하늘, 저녁과 밤엔 별 뜬 남색(MoodWindow 가 실내 밝기를 따른다) */
function Window({ x }: { x: number }) {
  return (
    <group position={[x, 1.7, -ROOM_D / 2 + 0.06]}>
      <Part color="#fffaf0" outline={0.03}>
        <boxGeometry args={[1.3, 1.1, 0.08]} />
      </Part>
      <MoodWindow position={[0, 0, 0.05]} size={[1.1, 0.9]} />
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} position={[0, 0, 0.07]} rotation-z={r}>
          <boxGeometry args={[r ? 0.9 : 1.1, 0.05, 0.01]} />
          <meshBasicMaterial color="#fffaf0" />
        </mesh>
      ))}
      {/* 커튼 */}
      {[-1, 1].map((sd) => (
        <Part key={sd} color="#ffb3c1" position={[sd * 0.68, -0.05, 0.1]} scale={[1, 1, 0.4]} outline={0.04}>
          <capsuleGeometry args={[0.12, 0.9, 4, 8]} />
        </Part>
      ))}
    </group>
  )
}

/**
 * 지금 들어가 있는 집의 방. 앞 벽(+z)은 카메라가 넘겨다볼 수 있게 낮은 걸레받이만 둔다(동물의숲 실내처럼).
 * 주민 색 벽지 위아래로 나무 판, 가운데 둥근 러그, 천장 등이 방을 데운다.
 */
export function Interior() {
  const inside = useGame((s) => s.inside)
  const night = useGame((s) => s.night)
  const roomLampsOff = useGame((s) => s.roomLampsOff)
  const i = VILLAGERS.findIndex((v) => v.id === inside)
  const v = VILLAGERS[i]
  const wall = useMemo(() => (v ? tint(v.accent, 0.55) : '#fffaf0'), [v])
  if (!v) return null
  const c = roomCenter(i)
  const gifts = ['gift0', 'gift1', 'gift2'].map((id, k) => ({ ...at(id), item: v.gifts[k] }))
  // 켜 둔 불빛 선물 자리. 빛은 LampPool 이 고정 개수로 만들고, 벽은 ShadeWall 이 이 자리를 본다.
  const lampSpots: LampSpot[] = gifts.filter((g, k) => GLOWING.has(g.item) && !roomLampsOff.includes(`${v.id}/gift${k}`)).map((g) => ({ x: g.x, z: g.z }))
  return (
    <group position={[c.x, 0, c.z]}>
      {/* 방 밖은 아래 바다(y -2.6)가 비쳐 파랗게 보인다. 그 자리를 실내 색 바닥으로 덮는다. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color={INDOOR_FLOOR} />
      </mesh>
      <Floor />
      {/* 뒤 벽과 양옆 벽: 벽지 + 아래 나무 판 */}
      {[
        { pos: [0, WALL_H / 2, -ROOM_D / 2] as const, size: [ROOM_W, WALL_H, 0.12] as const },
        { pos: [-ROOM_W / 2, WALL_H / 2, 0] as const, size: [0.12, WALL_H, ROOM_D] as const },
        { pos: [ROOM_W / 2, WALL_H / 2, 0] as const, size: [0.12, WALL_H, ROOM_D] as const },
      ].map((w, k) => (
        <group key={k}>
          <ShadeWall position={[...w.pos]} size={[...w.size]} color={wall} lamps={lampSpots} />
          <mesh position={[w.pos[0], 0.45, w.pos[2]]}>
            <boxGeometry args={[w.size[0] + 0.02, 0.9, w.size[2] + 0.02]} />
            <meshToonMaterial color="#c98b55" />
          </mesh>
        </group>
      ))}
      <RoomTrim accent={v.accent} />
      <Window x={-2.6} />
      <Window x={2.2} />
      {/* 둥근 러그 두 겹 */}
      <mesh position={[0.2, ROOM_FLOOR + 0.006, 0.3]} rotation-x={-Math.PI / 2} scale={[1.35, 1, 1]}>
        <circleGeometry args={[1.7, 32]} />
        <meshToonMaterial color={tint(v.accent, 0.2)} />
      </mesh>
      <mesh position={[0.2, ROOM_FLOOR + 0.008, 0.3]} rotation-x={-Math.PI / 2} scale={[1.35, 1, 1]}>
        <ringGeometry args={[1.35, 1.5, 32]} />
        <meshBasicMaterial color="#fffaf0" />
      </mesh>
      <RoomFurniture v={v} />
      <group position={[at('table').x, ROOM_FLOOR, at('table').z]} scale={1.3}>
        <FurnitureModel itemId="table" night={night} />
      </group>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[at('table').x + sd * 1.05, ROOM_FLOOR, at('table').z]} rotation-y={(sd * Math.PI) / 2}>
          <FurnitureModel itemId="log-stool" night={night} />
        </group>
      ))}
      <group position={[at('plant').x, ROOM_FLOOR, at('plant').z]} scale={1.5}>
        <FurnitureModel itemId="flowerpot" night={night} />
      </group>
      {gifts.map((g, k) => {
        // 불빛 선물은 켜고 끌 수 있다. 꺼 두면 빛을 내지 않고, 켜 두면 방을 따뜻하게 비춘다.
        const on = !roomLampsOff.includes(`${v.id}/gift${k}`)
        return (
          <group key={g.id}>
            <group position={[g.x, ROOM_FLOOR, g.z]} rotation-y={g.x < 0 ? Math.PI / 2 : -Math.PI / 2}>
              <FurnitureModel itemId={g.item} night={on} />
            </group>
          </group>
        )
      })}
      {/* 천장 등: 따뜻한 빛 */}
      <LampPool spots={lampSpots} y={ROOM_FLOOR + 1.1} intensity={6} distance={5} />
      <MoodBulb position={[0, WALL_H + 0.4, 0]} day={8} night={14} warmDim />
    </group>
  )
}

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { canPlaceInHome, hasAttic, hasCellar, hasSideRoom, homeBed, homeCells, homeChest, HOME_SITE, type HomeStage } from '../core/home'
import { heightAt } from '../core/island'
import { GLOWING } from '../core/items'
import { placementCell, tapCell } from '../core/placement'
import { isTouchDevice } from '../ui/device'
import { DEFAULT_PAINT, interiorWallColor, PAINT_SCAFFOLD_MS, paintColors, type PaintPart } from '../core/homePaint'
import { homeRibbonShown, nearHome } from '../core/homeWelcome'
import { ATTIC, CELLAR_ROOM, CELLAR_STAIR, exitOf, HOME_ROOM, HOME_ROOM_SIZES, MAIN_EAST_WALL_DOOR, MAIN_STAIR, ROOM_FLOOR, roomCenter, SIDE_ROOM, SIDE_WEST_WALL_DOOR, WALL_H, type RoomSize } from '../core/interior'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { useSeason } from './Island'
import { FurnitureModel } from './Furniture'
import { PhotoWall } from './PhotoWall'
import { isWallItem, wallPose, wallSpot } from '../core/wallHang'
import { pointerFloor, POINTER_SPOT } from '../core/homeWelcome'
import { HomeVisitor } from './HomeVisitor'
import { useOcclusionFade } from './occlusion'
import { WindowPane } from './WindowPane'
import { LampPool, MoodBulb, MoodWindow, ShadeWall, type LampSpot } from './InteriorLight'
import { Part, Toon } from './toon'
import { mul, Merge, shape, useMerged, xf } from './batching'
import { EaveDrips, useRainy, wetTone } from './EaveDrips'


/** 텐트 — 줄무늬 천 끝에 노란 꼭대기 공. 문 쪽(+z)에 갈라진 문 천. */
function Tent() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.5, 24]} />
        <Toon color="#c8b08a" />
      </mesh>
      {/* 피라미드 면 가운데가 +z(문 쪽)를 보도록 45도 돌린다 */}
      <Part color="#f2c14e" position={[0, 0.78, 0]} rotation={[0, Math.PI / 4, 0]} outline={0.05}>
        <coneGeometry args={[1.25, 1.5, 4]} />
      </Part>
      {/* 천 밑단: 크림색 띠 한 줄 */}
      <Part color="#fdf6e3" position={[0, 0.16, 0]} rotation={[0, Math.PI / 4, 0]} outline={0.03}>
        <coneGeometry args={[1.31, 0.26, 4]} />
      </Part>
      {/* 문 천: 면이 기울어 있어 아래쪽일수록 안으로 들어간다. 면 바깥으로 살짝 내밀어 보이게 한다. */}
      <Part color="#6b4528" position={[0, 0.38, 0.7]} outline={0.03}>
        <boxGeometry args={[0.5, 0.74, 0.04]} />
      </Part>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <Toon color="#ffd166" />
      </mesh>
    </group>
  )
}

/** 작은 집·큰 집·다락방 집. 벽 상자와 네모 뿔 지붕, 문과 창. 다락방 단계는 한 층을 더 올린 2층 몸체다. */
function House({ stage, paint }: { stage: HomeStage; paint: Record<PaintPart, string> }) {
  const size = stage === 1 ? { w: 2.6, d: 2.2, h: 1.7 } : { w: 3.3, d: 2.8, h: 2.1 }
  const { w, d } = size
  // 2층이면 아랫층과 윗층 높이를 나눈다. 지붕은 전체 높이 위에 얹는다.
  const h1 = hasAttic(stage) ? 1.35 : size.h
  const h2 = hasAttic(stage) ? 1.2 : 0
  const h = h1 + h2
  const roofR = Math.max(w, d) * 0.8
  const season = useSeason()
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[w + 0.2, 0.2, d + 0.2]} />
        <Toon color="#cfc6b8" />
      </mesh>
      <Part color={paint.wall} position={[0, 0.2 + h1 / 2, 0]} outline={0.03}>
        <boxGeometry args={[w, h1, d]} />
      </Part>
      {h2 > 0 && (
        <>
          {/* 윗층: 아랫층보다 살짝 좁혀 발코니가 앞으로 보이게 한다 */}
          <Part color={paint.wall} position={[0, 0.2 + h1 + h2 / 2, 0]} outline={0.03}>
            <boxGeometry args={[w - 0.1, h2, d - 0.1]} />
          </Part>
          {/* 작은 발코니: 바닥판과 난간 */}
          <Part color="#c98b55" position={[0, 0.2 + h1 + 0.05, d / 2 + 0.12]} outline={0.02}>
            <boxGeometry args={[w * 0.8, 0.1, 0.42]} />
          </Part>
          <mesh position={[0, 0.2 + h1 + 0.35, d / 2 + 0.3]}>
            <boxGeometry args={[w * 0.8, 0.5, 0.04]} />
            <Toon color="#c98b55" />
          </mesh>
          {/* 윗층 창 두 개 */}
          {[-1, 1].map((sx) => (
            <WindowPane key={sx} position={[sx * (w * 0.24), 0.2 + h1 + h2 * 0.55, d / 2 - 0.02]}><boxGeometry args={[0.5, 0.5, 0.04]} /></WindowPane>
          ))}
        </>
      )}
      <Part color={paint.roof} position={[0, 0.2 + h + 0.55, 0]} outline={0.04}>
        <coneGeometry args={[roofR, 1.1, 4]} />
      </Part>
      {/* 겨울엔 지붕 꼭대기에 눈 모자. 같은 꼭짓점의 짧은 뿔이라 지붕 경사에 딱 붙는다. */}
      {season === 'winter' && (
        <mesh position={[0, 0.2 + h + 0.55 - 0.18, 0]} scale={1.02}>
          <coneGeometry args={[(roofR * 0.36) / 1.1, 0.36, 4]} />
          <Toon color="#f7fbff" />
        </mesh>
      )}
      {/* 문 */}
      <Part color={paint.door} position={[0, 0.2 + 0.55, d / 2 + 0.03]} outline={0.02}>
        <boxGeometry args={[0.5, 1.1, 0.05]} />
      </Part>
      {/* 창: 문 옆 양쪽 */}
      {[-1, 1].map((sx) => (
        <WindowPane key={sx} position={[sx * (w * 0.3), 0.2 + h1 * 0.6, d / 2 + 0.02]}><boxGeometry args={[0.5, 0.5, 0.04]} /></WindowPane>
      ))}
      {stage >= 2 && (
        <Part color="#b9b2a6" position={[-w * 0.3, 0.2 + h + 0.8, -d * 0.2]} outline={0.04}>
          <boxGeometry args={[0.36, 0.9, 0.36]} />
        </Part>
      )}
      {/* 옆방 별채: 집 동쪽 벽에 붙은 작은 상자와 맞배 지붕 */}
      {hasSideRoom(stage) && <SideAnnex x={w / 2 + 0.55} paint={paint} />}
      {/* 지하창: 앞면 왼쪽 바닥 가까이 난 작은 창(지하실이 있다는 표시) */}
      {hasCellar(stage) && (
        <WindowPane position={[-w * 0.36, 0.42, d / 2 + 0.03]}>
          <boxGeometry args={[0.4, 0.26, 0.04]} />
        </WindowPane>
      )}
      {/* 다락 창: 다락방 단계에서 동남쪽(보이는 쪽) 지붕 면에 붙인 작은 집 */}
      {hasAttic(stage) && <RoofDormer w={w} d={d} h={h} wall={paint.wall} roof={paint.roof} />}
      {/* 지하 출입구: 뒷면(보이는 쪽)에 눕힌 덮개, 돌계단, 등불 */}
      {hasCellar(stage) && <CellarEntrance w={w} d={d} />}
    </group>
  )
}

/** 옆방 별채: 집 동쪽에 붙은 작은 상자와 그 위 맞배 지붕. 벽과 지붕 색은 집 색을 따른다. */
function SideAnnex({ x, paint }: { x: number; paint: Record<PaintPart, string> }) {
  const aw = 1.5
  const ad = 2.2
  const ah = 1.4
  return (
    <group position={[x, 0, 0.2]}>
      <Part color={paint.wall} position={[0, 0.2 + ah / 2, 0]} outline={0.03}>
        <boxGeometry args={[aw, ah, ad]} />
      </Part>
      {[-1, 1].map((sd) => (
        <Part key={sd} color={paint.roof} position={[sd * aw * 0.27, 0.2 + ah + 0.25, 0]} rotation={[0, 0, -sd * 0.55]} outline={0.03}>
          <boxGeometry args={[aw * 0.62, 0.14, ad + 0.2]} />
        </Part>
      ))}
      <WindowPane position={[0, 0.2 + ah * 0.55, ad / 2 + 0.02]}>
        <boxGeometry args={[0.5, 0.45, 0.04]} />
      </WindowPane>
    </group>
  )
}

/** 지하 출입구: 뒷면 왼쪽에 눕힌 나무 덮개, 돌계단 두 칸, 등불 하나. 한 묶음이라 드로우콜은 재질 수만큼만 는다. */
function CellarEntrance({ w, d }: { w: number; d: number }) {
  const g = useMerged((b) => {
    const box = (x: number, y: number, z: number) => shape(THREE.BoxGeometry, x, y, z)
    const sph = (...a: number[]) => shape(THREE.SphereGeometry, ...a)
    const back = -d / 2
    const cx = -w * 0.25
    // 덮개: 뒷벽 아래에서 바깥(-z)으로 내려가는 판
    b.add(box(1.2, 0.08, 1.1), xf([cx, 0.3, back - 0.55], [-0.5, 0, 0]), '#c98b55', { outline: 0.04 })
    b.add(box(1.0, 0.14, 0.3), xf([cx, 0.07, back - 1.25]), '#b9b2a6', { outline: 0.03 })
    b.add(box(1.0, 0.07, 0.3), xf([cx, 0.035, back - 1.55]), '#b9b2a6', { outline: 0.03 })
    // 등불: 나무 기둥 위에 빛나는 공(빛 받지 않는 재질)
    b.add(box(0.08, 0.9, 0.08), xf([cx + 0.8, 0.45, back - 1.2]), '#6b4528', { outline: 0.03 })
    b.add(sph(0.16, 10, 8), xf([cx + 0.8, 1.0, back - 1.2]), '#ffe9a8', { unlit: true })
  }, [w, d])
  return <Merge g={g} />
}

/**
 * 다락 창: 지붕의 보이는 면(동남쪽, 로컬 +x -z 대각선)에 붙인 작은 집과 유리.
 * 지붕 면 가운데 높이에 맞춰 놓고, 벽 색과 지붕 색을 따른다. 한 묶음이라 드로우콜은 늘지 않는다.
 */
function RoofDormer({ w, d, h, wall, roof }: { w: number; d: number; h: number; wall: string; roof: string }) {
  const g = useMerged((b) => {
    const roofR = Math.max(w, d) * 0.8
    const base = 0.2 + h
    // 지붕 면 가운데선 축에서 roofR·cos45 만큼 떨어져 있고 높이는 1.1 짜리 뿔을 따라 줄어든다. 40% 높이에 앉힌다.
    const dist = roofR * Math.SQRT1_2 * 0.6
    const a = (3 * Math.PI) / 4
    const at = xf([dist * Math.SQRT1_2, base + 0.5, -dist * Math.SQRT1_2], [0, a, 0])
    b.add(shape(THREE.BoxGeometry, 0.6, 0.5, 0.5), at, wall, { outline: 0.03 })
    b.add(shape(THREE.ConeGeometry, 0.5, 0.35, 4), mul(at, xf([0, 0.425, 0], [0, Math.PI / 4, 0])), roof, { outline: 0.03 })
    b.add(shape(THREE.BoxGeometry, 0.4, 0.3, 0.02), mul(at, xf([0, 0, 0.26])), '#9ad0ec', { unlit: true })
  }, [w, d, h, wall, roof])
  return <Merge g={g} />
}

/**
 * 짓는 중에는 옛 집을 비계로 둘러싸고 문 앞에 공사 판을 세운다. 모양은 상점 공사 비계와 같다:
 * 굵은 기둥, 두 층의 나무 발판, 앞면을 가리는 파란 천과 흰 줄무늬. 멀리서도 공사 중인 것이 보이게 한다.
 */
function HomeScaffold() {
  const pole = '#8a8f99'
  return (
    <group>
      {[-1.4, 1.4].map((x) =>
        [-1.4, 1.4].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.45, z]} castShadow>
            <boxGeometry args={[0.14, 2.9, 0.14]} />
            <Toon color={pole} />
          </mesh>
        )),
      )}
      {[0.8, 2.1].map((y) => (
        <group key={y}>
          <mesh position={[0, y, 1.4]}>
            <boxGeometry args={[2.94, 0.08, 0.08]} />
            <Toon color={pole} />
          </mesh>
          <mesh position={[1.4, y, 0]}>
            <boxGeometry args={[0.08, 0.08, 2.94]} />
            <Toon color={pole} />
          </mesh>
          {/* 발판: 앞쪽에 나무 판을 깐다 */}
          <mesh position={[0, y + 0.06, 1.6]}>
            <boxGeometry args={[2.9, 0.1, 0.4]} />
            <Toon color="#b07a45" />
          </mesh>
        </group>
      ))}
      {/* 천막: 상점 공사 비계와 같은 파란 천에 흰 줄무늬 두 줄 */}
      <group position={[0, 2.0, 1.52]}>
        <mesh>
          <boxGeometry args={[2.6, 0.9, 0.03]} />
          <Toon color="#4f8fd1" />
        </mesh>
        {[-0.3, 0.3].map((k) => (
          <mesh key={k} position={[0, k, 0.02]}>
            <boxGeometry args={[2.6, 0.08, 0.04]} />
            <Toon color="#ffffff" />
          </mesh>
        ))}
      </group>
      <mesh position={[-1.1, 0.9, 1.9]} rotation-y={-0.3}>
        <boxGeometry args={[0.9, 0.5, 0.06]} />
        <Toon color="#f2a541" />
      </mesh>
    </group>
  )
}

/** 집 상담 간판. 현관에서 옆으로 비껴 세운 나무 기둥과 판. 가까이 서면 E 로 상담한다. */
function HomeSign({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, heightAt(x, z), z]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <Toon color="#a8744a" />
      </mesh>
      <Part color="#fdf6e3" position={[0, 1.05, 0]} outline={0.04}>
        <boxGeometry args={[0.9, 0.5, 0.08]} />
      </Part>
      <mesh position={[0, 1.05, 0.05]}>
        <boxGeometry args={[0.6, 0.06, 0.01]} />
        <meshBasicMaterial color="#5fa35f" />
      </mesh>
    </group>
  )
}

/**
 * 집 가림 반지름(단계별). 텐트 원뿔 반지름은 약 1.5, 작은 집 지붕은 약 2.1, 큰 집·다락방 지붕은 약 2.6 이라
 * 그 위에 0.4 여유를 더했다. 몸체 가운데에서 카메라→플레이어 선분까지 거리가 이보다 가까우면 집이 비켜 준다.
 */
const HOME_FADE_R = [2.2, 2.5, 3.0, 3.0, 3.6, 3.6] as const

/** 플레이어 집의 바깥 모습. 단계와 공사 상태에 따라 텐트·집·비계를 고른다. */
export function HomeExterior() {
  const stage = useGame((s) => s.home.stage)
  const building = useGame((s) => s.home.order !== null)
  const paint = useGame((s) => s.homePaint ?? DEFAULT_PAINT)
  const paintAt = useGame((s) => s.homePaintAt)
  // 색을 고른 뒤 잠깐 비계를 두른다. 공사 시간은 PAINT_SCAFFOLD_MS 로 정한다.
  const [fixing, setFixing] = useState(false)
  useEffect(() => {
    if (!paintAt) return
    setFixing(true)
    const id = setTimeout(() => setFixing(false), PAINT_SCAFFOLD_MS)
    return () => clearTimeout(id)
  }, [paintAt])
  const ref = useRef<THREE.Group>(null)
  const site = HOME_SITE
  // 가림 판정 중심은 몸체 가운데쯤에 둔다. 반지름은 지붕 끝까지 덮어야 집 뒤에서 플레이어와 문이 보인다.
  const center = useMemo(() => (site ? ([site.x, heightAt(site.x, site.z) + 1.2, site.z] as const) : ([0, 0, 0] as const)), [site])
  // 집 뒤로 돌아가면 집이 반투명해져 플레이어가 보인다.
  useOcclusionFade(ref, center, HOME_FADE_R[stage], 0.18)
  if (!site) return null
  return (
    <>
      <group ref={ref} position={[site.x, heightAt(site.x, site.z), site.z]} rotation-y={site.rot}>
        {stage === 0 ? <Tent /> : <House stage={stage} paint={paintColors(stage, paint)} />}
        {(building || fixing) && <HomeScaffold />}
        <HomeNewFlag />
      </group>
      <HomeSign x={site.sign.x} z={site.sign.z} />
    </>
  )
}

/**
 * 새 집이 완성된 날, 플레이어가 집 근처(8칸)에 처음 오면 현관 앞에 축하 줄을 하루 동안 건다.
 * 현관 양옆 기둥 사이에 "축" 현수막과 삼각 깃발 줄(번팅)을 달아, 상점 재개장 리본과 같은 빨강·노랑을 쓴다.
 * 보이는지는 homeWelcome 의 판정을 따른다. 좌표는 집 몸체 기준(앞이 +z)이라 집과 함께 돈다.
 */
function HomeNewFlag() {
  const ref = useRef<THREE.Group>(null)
  const site = HOME_SITE
  const banner = useMemo(() => festivalTexture('축'), [])
  const rainy = useRainy()
  useFrame(() => {
    if (!ref.current || !site) return
    const p = runtime.player
    if (nearHome(p.x, p.z, site)) runtime.homeNearSeen = true
    const s = useGame.getState()
    ref.current.visible = homeRibbonShown(s.homeNew ?? null, s.day, runtime.homeNearSeen)
  })
  if (!site) return null
  // 번팅: 두 기둥 사이 줄에 삼각형 깃발 아홉 개. 빨강·노랑·크림을 번갈아 단다.
  const pennants = Array.from({ length: 9 }, (_, i) => -1.2 + i * 0.3)
  return (
    <group ref={ref} visible={false}>
      {[-1.4, 1.4].map((x) => (
        <group key={x} position={[x, 0, 2.1]}>
          <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 2.1, 8]} />
            <Toon color="#8a6a4a" />
          </mesh>
          <mesh position={[0, 2.12, 0]}>
            <sphereGeometry args={[0.08, 10, 8]} />
            <Toon color="#f2c14e" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.95, 2.1]}>
        <boxGeometry args={[2.8, 0.02, 0.02]} />
        <Toon color="#8a6a4a" />
      </mesh>
      {pennants.map((x, i) => (
        <mesh key={x} position={[x, 1.85 - Math.sin(((x + 1.4) / 2.8) * Math.PI) * 0.08, 2.1]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.12, 0.22, 3]} />
          <Toon color={wetTone(i % 3 === 0 ? '#d94b3b' : i % 3 === 1 ? '#f2c14e' : '#fff3dc', rainy)} />
        </mesh>
      ))}
      <mesh position={[0, 1.42, 2.12]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshBasicMaterial map={banner} />
      </mesh>
      {/* 비 오는 날엔 삼각 깃발 끝에서 빗방울이 떨어진다. 줄 높이(1.85)에서 땅까지. */}
      <EaveDrips points={pennants.map((x) => [x, 1.85, 2.1] as [number, number, number])} />
    </group>
  )
}

/** "축" 현수막 그림. 빨간 바탕에 노란 글자, 상점 리본과 같은 색이다. */
function festivalTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#d94b3b'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#f2c14e'
    g.font = 'bold 92px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 128, 70)
  }
  return new THREE.CanvasTexture(c)
}

/**
 * 방 바닥과 벽. 방 크기는 주어진 크기를 따른다. 다락이 있는 본채(tall)는 뒷벽을 천장까지 올린다.
 * door 는 옆문 자리의 문짝이다. 본채는 동쪽 벽(east), 옆방은 서쪽 벽(west)이다. 앞쪽은 늘 열려 있다.
 */
function RoomShell({
  wall,
  size,
  tall = false,
  door = null,
  floorColor = '#d9a877',
  windows = true,
  lamps = [],
}: {
  wall: string
  size: RoomSize
  tall?: boolean
  door?: 'east' | 'west' | null
  floorColor?: string
  windows?: boolean
  /** 켜 둔 등 자리. 벽 색을 밤에 맞춰 가라앉히는 데 쓴다 */
  lamps?: readonly LampSpot[]
}) {
  const { w, d } = size
  const exit = exitOf(size)
  const backH = tall ? ATTIC.ceilingBack : WALL_H
  const doorAt = door === 'east' ? MAIN_EAST_WALL_DOOR : door === 'west' ? SIDE_WEST_WALL_DOOR : null
  return (
    <group>
      <mesh position={[0, ROOM_FLOOR - 0.1, 0]} receiveShadow>
        <boxGeometry args={[w, 0.2, d]} />
        <meshToonMaterial color={floorColor} />
      </mesh>
      {doorAt && (
        <group>
          {/* 문틀과 문짝. 벽 안쪽에 붙여 두고 E 로 옆방이나 지하로 옮겨 간다. */}
          <mesh position={[doorAt.x - Math.sign(doorAt.x) * 0.06, ROOM_FLOOR + 0.8, doorAt.z]}>
            <boxGeometry args={[0.1, 1.6, 1.1]} />
            <meshToonMaterial color="#c98b55" />
          </mesh>
          <mesh position={[doorAt.x - Math.sign(doorAt.x) * 0.12, ROOM_FLOOR + 0.75, doorAt.z]}>
            <boxGeometry args={[0.08, 1.5, 0.9]} />
            <meshToonMaterial color="#8a5a3b" />
          </mesh>
          <mesh position={[doorAt.x - Math.sign(doorAt.x) * 0.18, ROOM_FLOOR + 0.8, doorAt.z + 0.34]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshToonMaterial color="#ffd166" />
          </mesh>
        </group>
      )}
      {[
        { pos: [0, backH / 2, -d / 2] as const, size: [w, backH, 0.12] as const },
        { pos: [-w / 2, WALL_H / 2, 0] as const, size: [0.12, WALL_H, d] as const },
        { pos: [w / 2, WALL_H / 2, 0] as const, size: [0.12, WALL_H, d] as const },
      ].map((wl, k) => (
        <ShadeWall key={k} position={[...wl.pos]} size={[...wl.size]} color={wall} lamps={lamps} />
      ))}
      {/* 앞쪽 걸레받이: 문 자리만 비운다 */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (w / 4 + 0.4), 0.25, d / 2]}>
          <boxGeometry args={[w / 2 - 0.8, 0.5, 0.12]} />
          <meshToonMaterial color="#c98b55" />
        </mesh>
      ))}
      <mesh position={[exit.x, ROOM_FLOOR + 0.01, exit.z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.3, 0.7]} />
        <meshToonMaterial color="#8a5a3b" />
      </mesh>
      {/* 뒤 벽 창(지하실에는 창이 없다) */}
      {windows && (
        <>
          <MoodWindow position={[-w * 0.26, 1.7, -d / 2 + 0.07]} size={[1.1, 0.9]} />
          <MoodWindow position={[w * 0.22, 1.7, -d / 2 + 0.07]} size={[1.1, 0.9]} />
        </>
      )}
    </group>
  )
}

/** 계단 입구: 바닥을 어둡게 파고 디딤판 몇 장을 놓는다. 본채 구석은 지하로, 지하실 구석은 위로 이어진다. */
function Stair({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, ROOM_FLOOR + 0.02, 0]}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial color="#1d140e" />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[0, ROOM_FLOOR + 0.03 - k * 0.04, 0.42 - k * 0.28]}>
          <boxGeometry args={[1.1, 0.06, 0.26]} />
          <meshToonMaterial color="#a8744a" />
        </mesh>
      ))}
    </group>
  )
}

/**
 * 다락 2층(다락방 단계). 바닥판, 앞 난간(사다리 자리는 비움), 뒷벽에서 앞 난간으로 기울어진 천장,
 * 방바닥에서 다락 끝까지 기댄 사다리. 다락 위에 있을 때만 바닥 높이가 올라간다.
 */
function Attic({ floor }: { floor: 0 | 1 }) {
  // 다락 위층은 방 천장 전구에서 멀어 어둡다. 위층 전용 빛을 얹는다(밤에는 더 밝게).
  const night = useGame((s) => s.night)
  const cx = (ATTIC.x0 + ATTIC.x1) / 2
  const cz = (ATTIC.z0 + ATTIC.z1) / 2
  const aw = ATTIC.x1 - ATTIC.x0
  const ad = ATTIC.z1 - ATTIC.z0
  const deckY = ROOM_FLOOR + ATTIC.floorY
  // 사다리: 방바닥 발끝에서 다락 난간 끝까지. 세로 막대를 기울여 두 끝을 잇는다.
  const footZ = ATTIC.ladderFootZ
  const lenY = deckY - ROOM_FLOOR
  const lenZ = ATTIC.z1 - footZ
  const ladderLen = Math.hypot(lenY, lenZ)
  const ladderTilt = Math.atan2(lenZ, lenY)
  const ladderMid = [ATTIC.ladderX, ROOM_FLOOR + lenY / 2, footZ + lenZ / 2] as const
  const rungs = Array.from({ length: Math.floor(ladderLen / 0.4) }, (_, k) => -ladderLen / 2 + 0.25 + k * 0.4)
  return (
    <group>
      {floor === 1 && <pointLight position={[cx, deckY + 1.6, cz]} color="#ffe2b0" intensity={night ? 7 : 5} distance={9} decay={1.3} />}
      {/* 본채에서 올려다볼 때는 다락 바닥이 방 위를 가리니 비쳐 보이게 한다. 다락에 올라가면 그대로 보인다. */}
      <mesh position={[cx, deckY - 0.07, cz]} receiveShadow>
        <boxGeometry args={[aw, 0.14, ad]} />
        <meshToonMaterial color="#c98b55" transparent={floor === 0} opacity={floor === 0 ? 0.2 : 1} depthWrite={floor !== 0} />
      </mesh>
      {(
        [
          [ATTIC.x0, ATTIC.ladderX - 0.45],
          [ATTIC.ladderX + 0.45, ATTIC.x1],
        ] as const
      ).map(([a, b], k) => (
        <mesh key={k} position={[(a + b) / 2, deckY + 0.45, ATTIC.z1]}>
          <boxGeometry args={[b - a, 0.08, 0.08]} />
          <meshToonMaterial color="#a8744a" />
        </mesh>
      ))}
      <group position={[ladderMid[0], ladderMid[1], ladderMid[2]]} rotation-x={ladderTilt}>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.07, ladderLen, 0.07]} />
            <meshToonMaterial color="#a8744a" />
          </mesh>
        ))}
        {rungs.map((y, k) => (
          <mesh key={k} position={[0, y, 0]}>
            <boxGeometry args={[0.5, 0.05, 0.05]} />
            <meshToonMaterial color="#a8744a" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** 고정 침대와 보관함(상자). 침대는 왼쪽 뒤, 보관함은 오른쪽 뒤다. 방 크기에 따라 자리가 벌어진다. */
function Fixed({ stage }: { stage: HomeStage }) {
  const bed = homeBed(stage)
  const chest = homeChest(stage)
  return (
    <group>
      <group position={[bed.x, 0, bed.z]}>
        <Part color="#a8744a" position={[0, 0.22, 0]} outline={0.03}>
          <boxGeometry args={[1.5, 0.3, 2.2]} />
        </Part>
        <Part color="#fffaf0" position={[0, 0.44, 0.05]} outline={0.03}>
          <boxGeometry args={[1.38, 0.16, 2.0]} />
        </Part>
        <Part color="#7fb7c9" position={[0, 0.54, 0.45]} outline={0.03}>
          <boxGeometry args={[1.44, 0.12, 1.2]} />
        </Part>
      </group>
      {/* 보관함: 상자 뚜껑과 도토리 자물쇠 */}
      <group position={[chest.x, 0, chest.z]}>
        <Part color="#c98b55" position={[0, 0.4, 0]} outline={0.04}>
          <boxGeometry args={[1.2, 0.8, 0.8]} />
        </Part>
        <Part color="#d9a877" position={[0, 0.86, 0]} outline={0.04}>
          <boxGeometry args={[1.22, 0.14, 0.82]} />
        </Part>
        <mesh position={[0, 0.5, 0.41]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <Toon color="#c07f45" />
        </mesh>
      </group>
    </group>
  )
}

/** 방에서 놓을 칸 미리보기. 바라보는 칸이 놓을 수 있으면 초록, 아니면 빨강이다. */
function RoomGhost() {
  const homePlacing = useGame((s) => s.homePlacing)
  const homePlacingVariant = useGame((s) => s.inventory.find((x) => x.id === s.homePlacing)?.variant)
  const rot = useGame((s) => s.homePlacingRot)
  const stage = useGame((s) => s.home.stage)
  const floor = useGame((s) => s.homeFloor)
  const root = useRef<THREE.Group>(null)
  const tapRef = useRef<THREE.Group>(null)
  // 손가락용 바닥 판: 이 층에서 놓을 수 있는 칸을 덮는다. 찍으면 그 칸이 미리보기가 된다(터치에서만)
  const touch = useMemo(() => isTouchDevice(), [])
  const reach = useMemo(() => {
    const cells = homeCells(stage, floor)
    if (cells.length === 0) return null
    const xs = cells.map((c) => c.x)
    const zs = cells.map((c) => c.z)
    const x0 = Math.min(...xs) - 0.5, x1 = Math.max(...xs) + 0.5
    const z0 = Math.min(...zs) - 0.5, z1 = Math.max(...zs) + 0.5
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 }
  }, [stage, floor])
  const tile = useRef<THREE.MeshBasicMaterial>(null)
  const flat = useRef<THREE.Group>(null)
  const frame = useRef<THREE.Group>(null)
  const wall = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  // 벽걸이 고스트: 벽 면에 반투명 칸과 테두리를 그린다(막히면 빨강)
  const wallFill = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false }), [])
  const wallEdge = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }), [])
  useFrame(({ clock }) => {
    if (!root.current) return
    const p = runtime.player
    const c = roomCenter(HOME_ROOM)
    const gs = useGame.getState()
    const floorY = ROOM_FLOOR + (gs.homeFloor === 1 ? ATTIC.floorY : 0)
    // 벽걸이: 벽을 보고 선 칸의 벽 면에 고스트를 세운다. 회전은 벽 방향으로 정해져 있다
    if (gs.homePlacing && isWallItem(gs.homePlacing)) {
      const spot = wallSpot(p.x - c.x, p.z - c.z, p.facing, gs.home.stage, gs.homeFloor, gs.homeFurniture)
      const w = wallPose(spot.x, spot.z, spot.dir, gs.home.stage, gs.homeFloor)
      const ok = !spot.why
      wallFill.color.set(ok ? '#7ee081' : '#ff6b6b')
      wallEdge.color.set(ok ? '#4fbf5a' : '#ff3b3b')
      root.current.position.set(w.x, floorY + w.y, w.z)
      root.current.rotation.y = w.rot
      if (inner.current) {
        inner.current.rotation.y = 0
        inner.current.scale.setScalar(w.scale)
      }
      if (flat.current) flat.current.visible = false
      if (wall.current) wall.current.visible = true
      return
    }
    root.current.rotation.y = 0
    if (inner.current) {
      inner.current.rotation.y = (useGame.getState().homePlacingRot * Math.PI) / 2
      inner.current.scale.setScalar(1)
    }
    if (flat.current) flat.current.visible = true
    if (wall.current) wall.current.visible = false
    // 찍은 칸이 있으면 그 칸을, 없으면 바라보는 칸을 쓴다
    const cell = gs.homePlaceCell ?? placementCell(p.x - c.x, p.z - c.z, p.facing)
    root.current.position.set(cell.x, floorY, cell.z)
    const ok = canPlaceInHome(cell.x, cell.z, gs.home.stage, gs.homeFurniture, gs.homeFloor)
    tile.current?.color.set(ok ? '#7ee081' : '#ff6b6b')
    // 못 놓는 칸은 더 진하게 빨갛게 깜빡이고, 테두리 네 변을 세워 바닥 색과 섞이지 않게 한다
    if (tile.current) tile.current.opacity = (ok ? 0.45 : 0.7) + Math.sin(clock.elapsedTime * 6) * 0.12
    if (frame.current) frame.current.visible = !ok
  })
  if (!homePlacing) return null
  return (
    <>
    {touch && reach && !isWallItem(homePlacing) && (
      <group ref={tapRef} position={[reach.cx, ROOM_FLOOR + (floor === 1 ? ATTIC.floorY : 0) + 0.04, reach.cz]}>
        <mesh
          rotation-x={-Math.PI / 2}
          onPointerDown={(e) => {
            e.stopPropagation()
            const parent = tapRef.current?.parent
            if (!parent) return
            // 방 가운데 기준 칸으로 바꾼다(미리보기와 놓기가 같은 칸 좌표를 쓴다)
            const lp = parent.worldToLocal(e.point.clone())
            useGame.getState().setHomePlaceCell(tapCell(lp.x, lp.z))
          }}
        >
          <planeGeometry args={[reach.w, reach.d]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    )}
    <group ref={root}>
      <group ref={flat}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <planeGeometry args={[0.95, 0.95]} />
          <meshBasicMaterial ref={tile} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
        <group ref={frame} position={[0, 0.07, 0]}>
          <mesh position={[0, 0, -0.46]}><boxGeometry args={[0.95, 0.02, 0.06]} /><meshBasicMaterial color="#ff3b3b" depthWrite={false} /></mesh>
          <mesh position={[0, 0, 0.46]}><boxGeometry args={[0.95, 0.02, 0.06]} /><meshBasicMaterial color="#ff3b3b" depthWrite={false} /></mesh>
          <mesh position={[-0.46, 0, 0]}><boxGeometry args={[0.06, 0.02, 0.95]} /><meshBasicMaterial color="#ff3b3b" depthWrite={false} /></mesh>
          <mesh position={[0.46, 0, 0]}><boxGeometry args={[0.06, 0.02, 0.95]} /><meshBasicMaterial color="#ff3b3b" depthWrite={false} /></mesh>
        </group>
      </group>
      <group ref={wall} visible={false}>
        <mesh position={[0, 0.5, 0]} material={wallFill}>
          <planeGeometry args={[0.9, 0.9]} />
        </mesh>
        <mesh position={[0, 0.95, 0.005]} material={wallEdge}><boxGeometry args={[0.9, 0.025, 0.01]} /></mesh>
        <mesh position={[0, 0.05, 0.005]} material={wallEdge}><boxGeometry args={[0.9, 0.025, 0.01]} /></mesh>
        <mesh position={[-0.45, 0.5, 0.005]} material={wallEdge}><boxGeometry args={[0.025, 0.9, 0.01]} /></mesh>
        <mesh position={[0.45, 0.5, 0.005]} material={wallEdge}><boxGeometry args={[0.025, 0.9, 0.01]} /></mesh>
      </group>
      <group ref={inner} rotation-y={(rot * Math.PI) / 2}>
        <FurnitureModel itemId={homePlacing} night={false} variant={homePlacingVariant} />
      </group>
    </group>
    </>
  )
}

/** 실내 배경색(Sky 의 INDOOR_BG 와 같다). 방 밖으로 보이는 바닥도 이 색으로 덮는다. */
const INDOOR_FLOOR = '#2b1f17'

/** 키 큰 방 가구. 카메라와 플레이어 사이에 서면 바깥 나무처럼 반투명해져 플레이어가 보인다. */
/**
 * 새 방을 가리키는 화살표. 완성된 날 본채에서 아직 안 가 본 새 방(사다리·옆문·계단) 위에 하나만 떠서 위아래로 흔든다.
 * 오브젝트는 한 개(mesh 한 개)라 그리기 호출이 하나 늘 뿐이다. 그 방에 처음 들어가면 꺼진다(homeNew.visited).
 */
function NewRoomSpark() {
  const homeNew = useGame((s) => s.homeNew)
  const day = useGame((s) => s.day)
  const stage = useGame((s) => s.home.stage)
  const floor = useGame((s) => s.homeFloor)
  const target = floor === 0 ? pointerFloor(homeNew ?? null, day, stage) : null
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m || !target) return
    m.position.y = ROOM_FLOOR + POINTER_SPOT[target].h + Math.sin(clock.elapsedTime * 3) * 0.06
  })
  if (!target) return null
  const spot = POINTER_SPOT[target]
  return (
    // 원뿔을 뒤집어 끝이 아래를 향하게 한다("여기로 가요")
    <mesh ref={ref} position={[spot.x, ROOM_FLOOR + spot.h, spot.z]} rotation-x={Math.PI}>
      <coneGeometry args={[0.28, 0.45, 12]} />
      <meshBasicMaterial color="#ffd166" toneMapped={false} />
    </mesh>
  )
}

const TALL_HOME_ITEMS = new Set(['bookshelf', 'storage-shelf', 'boiler'])

/** 키 큰 방 가구 한 개. world 는 이 가구의 월드 가운데(가리는지 재는 기준)다. */
function TallPiece({ x, y, z, rot, world, children }: { x: number; y: number; z: number; rot: number; world: readonly [number, number, number]; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useOcclusionFade(ref, world, 0.7)
  return (
    <group ref={ref} position={[x, y, z]} rotation-y={rot}>
      {children}
    </group>
  )
}

/** 플레이어 방. 들어가 있을 때만 그린다. 놓은 가구는 방 가운데 기준 칸에 선다. 다락은 층이 맞을 때만 보인다. */
export function HomeInterior() {
  const inHome = useGame((s) => s.inHome)
  const stage = useGame((s) => s.home.stage)
  const placed = useGame((s) => s.homeFurniture)
  const night = useGame((s) => s.night)
  const floor = useGame((s) => s.homeFloor)
  const interiorWall = useGame((s) => s.interiorWall)
  if (!inHome) return null
  const c = roomCenter(HOME_ROOM)
  // 본채(방바닥·다락)와 옆방·지하실은 따로 있는 방이라 지금 자리의 방만 그린다. 다락은 본채 위에 얹힌다.
  const main = floor < 2
  const here = placed.filter((p) => (p.floor ?? 0) === floor)
  const y = ROOM_FLOOR + (floor === 1 ? ATTIC.floorY : 0)
  // 실내 벽은 외관 칠과 따로 둔다. 벽지 칸(기본 크림)의 색을 그대로 쓴다. 값만 바뀌어 재컴파일은 없다.
  const wall = interiorWallColor(interiorWall)
  // 이 층에서 켜 둔 등 자리. 빛은 LampPool 이 고정 개수로 만들고, 벽은 RoomShell 이 이 자리를 본다.
  const lampSpots: LampSpot[] = here.filter((p) => GLOWING.has(p.itemId) && !p.off).map((p) => ({ x: p.x, z: p.z }))
  return (
    <group position={[c.x, 0, c.z]}>
      {/* 방 밖은 아래 바다(y -2.6)가 비쳐 파랗게 보인다. 그 자리를 실내 색 바닥으로 덮는다. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color={INDOOR_FLOOR} />
      </mesh>
      {main && <RoomShell wall={wall} size={HOME_ROOM_SIZES[stage]} tall={hasAttic(stage)} door={hasSideRoom(stage) ? 'east' : null} lamps={lampSpots} />}
      {floor === 2 && <RoomShell wall={SIDE_WALL} size={SIDE_ROOM} door="west" lamps={lampSpots} />}
      {floor === 3 && (
        <>
          <RoomShell wall={CELLAR_WALL} size={CELLAR_ROOM} floorColor={CELLAR_FLOOR} windows={false} lamps={lampSpots} />
          <CellarDetails size={CELLAR_ROOM} />
        </>
      )}
      {floor === 0 && <Fixed stage={stage} />}
      {floor === 0 && hasCellar(stage) && <Stair x={MAIN_STAIR.x} z={MAIN_STAIR.z} />}
      {floor === 3 && <Stair x={CELLAR_STAIR.x} z={CELLAR_STAIR.z} />}
      {hasAttic(stage) && (floor === 0 || floor === 1) && <Attic floor={floor} />}
      {main && <PhotoWall />}
      {main && <NewRoomSpark />}
      {main && <HomeVisitor />}
      {here.map((p) => {
        const model = <FurnitureModel itemId={p.itemId} night={night && GLOWING.has(p.itemId) && !p.off} off={p.off} fxId={p.id} variant={p.variant} />
        // 벽에 건 가구는 벽 면 안쪽에 걸리고 바닥 칸을 쓰지 않는다
        if (p.wall) {
          const w = wallPose(p.x, p.z, p.wall, stage, floor)
          return (
            <group key={p.id} position={[w.x, y + w.y, w.z]} rotation-y={w.rot}>
              <group scale={w.scale}>{model}</group>
            </group>
          )
        }
        if (TALL_HOME_ITEMS.has(p.itemId)) {
          return (
            <TallPiece key={p.id} x={p.x} y={y} z={p.z} rot={(p.rot * Math.PI) / 2} world={[c.x + p.x, y + 0.9, c.z + p.z]}>
              {model}
            </TallPiece>
          )
        }
        return (
          <group key={p.id} position={[p.x, y, p.z]} rotation-y={(p.rot * Math.PI) / 2}>
            {model}
          </group>
        )
      })}
      {/* 켜 둔 불빛 가구는 자기 자리에서 방을 따뜻하게 비춘다. 꺼 두면 빛도 없다. */}
      <LampPool spots={lampSpots} y={y + 1.1} intensity={12} distance={6} />
      <RoomGhost />
      {/* 지하실은 매달린 전구 자리에서 서늘한 빛을 준다. 본채와 옆방은 천장 전구 하나다. */}
      {floor === 3 ? (
        <MoodBulb position={[0, WALL_H - 1.2, 0]} color="#cfe3ff" day={5} night={9} distance={12} />
      ) : (
        <MoodBulb position={[0, WALL_H + 0.4, 0]} day={5.5} night={14} warmDim />
      )}
    </group>
  )
}

/** 지하실 벽과 바닥 색. 흙과 돌 느낌으로 본채보다 어둡다. */
const CELLAR_WALL = '#8a8072'
const CELLAR_FLOOR = '#6e645a'
/** 옆방 벽지 색. 본채 크림 벽지와 달리 연한 민트다. */
const SIDE_WALL = '#dcebe0'

/**
 * 지하실 꾸밈: 아랫단 돌벽, 나무 들보 천장(벽 꼭대기 쪽), 가운데 매달린 전구, 높은 작은 창 한 줄.
 * 천장 면은 두지 않는다. 위에서 내려다보는 카메라를 가리지 않게 들보만 세운다.
 */
function CellarDetails({ size }: { size: RoomSize }) {
  const { w, d } = size
  const stone = '#5f574d'
  const beam = '#6b4a2e'
  const top = WALL_H - 0.15
  return (
    <group>
      {/* 아랫단 돌벽: 벽 안쪽에 0.9 높이로 짙은 돌색을 댄다 */}
      <mesh position={[0, 0.45, -d / 2 + 0.09]}>
        <boxGeometry args={[w, 0.9, 0.04]} />
        <meshToonMaterial color={stone} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (w / 2 - 0.09), 0.45, 0]}>
          <boxGeometry args={[0.04, 0.9, d]} />
          <meshToonMaterial color={stone} />
        </mesh>
      ))}
      {/* 나무 들보: 가로 한 줄과 세로 세 개 */}
      <mesh position={[0, top, 0]}>
        <boxGeometry args={[w, 0.25, 0.25]} />
        <meshToonMaterial color={beam} />
      </mesh>
      {[-1, 0, 1].map((k) => (
        <mesh key={k} position={[k * (w / 3), top, 0]}>
          <boxGeometry args={[0.25, 0.25, d]} />
          <meshToonMaterial color={beam} />
        </mesh>
      ))}
      {/* 매달린 전구: 줄을 내리고 끝에 따뜻한 빛을 두되 조명은 찬 색을 쓴다 */}
      <mesh position={[0, top - 0.55, 0]}>
        <boxGeometry args={[0.02, 1.0, 0.02]} />
        <meshToonMaterial color="#3a2e24" />
      </mesh>
      <mesh position={[0, top - 1.1, 0]}>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshBasicMaterial color="#fff1c9" />
      </mesh>
      {/* 높은 작은 창 한 줄: 뒷벽 위쪽에 좁게 */}
      {[-0.3, -0.1, 0.1, 0.3].map((k) => (
        <mesh key={k} position={[k * w, WALL_H - 0.45, -d / 2 + 0.07]}>
          <planeGeometry args={[0.42, 0.2]} />
          <meshBasicMaterial color="#9fc9dd" />
        </mesh>
      ))}
    </group>
  )
}

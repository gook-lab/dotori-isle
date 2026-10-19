import { inRoomArea, roomWalkable } from './interior'
import { byWater, ISLAND_R, isWalkable, normDist, radiusAt, TRIP, tripDist, tripRadiusAt } from './island'
import { LIGHTHOUSE_SOLID_R, lighthouseSpot } from './lighthouse'
import { cliffFaceAt, inStepBlockAt, STEP_PAD } from './tiers'
import { hashString, mulberry32 } from './rng'
import { treeState, type Felled } from './trees'
import { piers, PIER_LEN } from './waters'

/** 날짜와 상관없이 고정된 섬 배치(상점·나무). */

/**
 * 상점 건물의 가장 큰 크기(큰 가게). 마을·나무·덤불 배치는 처음 로드될 때 이 크기로 비워 둔다.
 * 그래서 단계가 바뀌어도 집터·주민 자리가 상점과 겹치지 않는다.
 */
export const SHOP_MAX = { w: 8.5, d: 6 }
/** 지금 단계의 상점 크기는 setShopSize 로 바꾼다. 처음엔 가장 큰 크기다. */
export const SHOP = { x: 0, z: -9, w: SHOP_MAX.w, d: SHOP_MAX.d }
export const SHOP_DOOR = {
  get x() {
    return SHOP.x
  },
  get z() {
    return SHOP.z + SHOP.d / 2 + 0.6
  },
}
export const SPAWN = { x: 0, z: 2 }

/** 지금 단계의 상점 가로·세로로 바꾼다. 상점 단계가 바뀔 때 store 가 부른다. */
export function setShopSize(w: number, d: number) {
  SHOP.w = w
  SHOP.d = d
}


/**
 * 플레이어 집의 몸체 원. 집 단계가 바뀌면 store 가 갱신한다. 처음엔 집이 없다.
 * 저장 상태에 기대는 값이라 마을 배치(모듈 로드 시점)에는 쓰지 않는다.
 */
export const live: { home: { x: number; z: number; r: number } | null; museum: { x: number; z: number; r: number } | null } = { home: null, museum: null }

export interface TreeSpot {
  id: string
  kind: 'fruit' | 'pine'
  x: number
  z: number
  scale: number
  /** 열매 종류. 없으면 복숭아 */
  fruit?: string
}

/** 작업대: 상점 옆. DIY 레시피로 가구를 만든다. */
export const WORKBENCH = { x: SHOP.x + 4.4, z: SHOP.z + 0.6, r: 0.75 }

/** 옷 가판대: 상점 반대편. 모자와 옷을 판다. */
export const STALL = { x: SHOP.x - SHOP_MAX.w / 2 - 1.4, z: SHOP.z + 0.6, r: 0.85 }

/** 내 우체통: 처음 서는 자리 옆 */
export const MAILBOX = { x: SPAWN.x + 2, z: SPAWN.z - 1.4, r: 0.35 }

/** 펠리컨 부두. 집 섬과 여행 섬에 하나씩 있다. angle 은 섬 중심에서 바다 쪽을 향한 방향 */
export interface Dock {
  id: 'home' | 'trip'
  x: number
  z: number
  angle: number
  /** 도착했을 때 서는 자리 */
  arrive: { x: number; z: number; facing: number }
}

function dockAt(id: Dock['id'], cx: number, cz: number, angle: number, radius: number): Dock {
  const x = cx + Math.cos(angle) * radius * 0.93
  const z = cz + Math.sin(angle) * radius * 0.93
  // 도착 자리는 펠리컨에서 섬 안쪽으로 두 걸음
  const ax = x - Math.cos(angle) * 2
  const az = z - Math.sin(angle) * 2
  return { id, x, z, angle, arrive: { x: ax, z: az, facing: Math.atan2(cx - ax, cz - az) } }
}

const HOME_DOCK_ANGLE = Math.PI / 2 + 0.35
export const DOCKS: Dock[] = [
  dockAt('home', 0, 0, HOME_DOCK_ANGLE, radiusAt(HOME_DOCK_ANGLE)),
  dockAt('trip', TRIP.x, TRIP.z, Math.PI, tripRadiusAt(Math.PI)),
]
export const DOCK_R = 0.6
// 부두마다 판자 길을 등록한다. 걷기·높이 판정(waters.ts 의 onPier)이 이걸 본다.
for (const d of DOCKS) piers.push({ x: d.x, z: d.z, angle: d.angle, len: PIER_LEN })
/** 부두 앞에서 펠리와 말할 수 있는 거리. 조개는 이 안에 떨어지지 않게 한다. */
export const DOCK_TALK_R = 2.2
/** 부두 근처인지. 조개 배치처럼 부두를 비워 둘 곳에 쓴다. */
export const nearDock = (x: number, z: number, r: number) => DOCKS.some((d) => Math.hypot(x - d.x, z - d.z) < r)

const TREE_RADIUS = 0.55

function generateTrees(): TreeSpot[] {
  const rng = mulberry32(hashString('trees-v1'))
  const trees: TreeSpot[] = []
  for (let attempt = 0; attempt < 16000 && trees.length < 90; attempt++) {
    const x = (rng() * 2 - 1) * ISLAND_R
    const z = (rng() * 2 - 1) * ISLAND_R
    if (normDist(x, z) > 0.72 || cliffFaceAt(x, z)) continue
    if (Math.hypot(x - SHOP.x, z - SHOP.z) < 6.5) continue
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 4) continue
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.6)) continue
    const kind = trees.length < 28 ? 'fruit' : 'pine'
    trees.push({ id: `tree-${trees.length}`, kind, x, z, scale: 0.85 + rng() * 0.35 })
  }
  return trees
}

/** 여행 섬 나무: 오렌지 나무 여섯 그루와 소나무 */
function generateTripTrees(): TreeSpot[] {
  const rng = mulberry32(hashString('trip-trees-v1'))
  const trees: TreeSpot[] = []
  const dock = DOCKS[1]
  for (let attempt = 0; attempt < 3000 && trees.length < 11; attempt++) {
    const x = TRIP.x + (rng() * 2 - 1) * 15
    const z = TRIP.z + (rng() * 2 - 1) * 15
    if (tripDist(x, z) > 0.7) continue
    if (Math.hypot(x - dock.arrive.x, z - dock.arrive.z) < 4) continue
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.3)) continue
    const fruit = trees.length < 6
    trees.push({ id: `trip-tree-${trees.length}`, kind: fruit ? 'fruit' : 'pine', x, z, scale: 0.85 + rng() * 0.3, ...(fruit && { fruit: 'orange' }) })
  }
  return trees
}

// 연못·개울에 걸린 나무는 뺀다. 나머지 나무 자리는 물길이 생기기 전과 같다.
// 계단 블록 자리(여유 포함)의 나무·바위는 만든 뒤 뺀다. 생성 루프는 그대로 둬서 남은 나무의 id·자리가 예전과 같다.
const outsideSteps = <T extends { x: number; z: number }>(list: T[]) => list.filter((t) => !inStepBlockAt(t.x, t.z, STEP_PAD))
export const TREES = [...outsideSteps(generateTrees()).filter((t) => !byWater(t.x, t.z, 1.4)), ...generateTripTrees()]

export interface RockSpot {
  id: string
  x: number
  z: number
  scale: number
}

export const ROCK_RADIUS = 0.7

function generateRocks(): RockSpot[] {
  const rng = mulberry32(hashString('rocks-v1'))
  const rocks: RockSpot[] = []
  for (let attempt = 0; attempt < 10000 && rocks.length < 13; attempt++) {
    const x = (rng() * 2 - 1) * ISLAND_R
    const z = (rng() * 2 - 1) * ISLAND_R
    const d = normDist(x, z)
    // 바위는 섬 가장자리 쪽 잔디에 둔다. 가운데는 주민 집터 자리다. 절벽 면에는 놓지 않는다.
    if (d > 0.74 || d < 0.45 || cliffFaceAt(x, z)) continue
    if (Math.hypot(x - SHOP.x, z - SHOP.z) < 7 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 5) continue
    if (TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue
    if (rocks.some((r) => Math.hypot(r.x - x, r.z - z) < 7)) continue
    rocks.push({ id: `rock-${rocks.length}`, x, z, scale: 0.9 + rng() * 0.3 })
  }
  return rocks
}

function generateTripRocks(): RockSpot[] {
  const rng = mulberry32(hashString('trip-rocks-v1'))
  const rocks: RockSpot[] = []
  for (let attempt = 0; attempt < 2000 && rocks.length < 2; attempt++) {
    const x = TRIP.x + (rng() * 2 - 1) * 14
    const z = TRIP.z + (rng() * 2 - 1) * 14
    const d = tripDist(x, z)
    if (d > 0.72 || d < 0.35) continue
    if (TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue
    if (Math.hypot(x - DOCKS[1].arrive.x, z - DOCKS[1].arrive.z) < 4) continue
    if (rocks.some((r) => Math.hypot(r.x - x, r.z - z) < 7)) continue
    rocks.push({ id: `trip-rock-${rocks.length}`, x, z, scale: 1 + rng() * 0.2 })
  }
  return rocks
}

export const ROCKS = [...outsideSteps(generateRocks()).filter((r) => !byWater(r.x, r.z, 1.5)), ...generateTripRocks()]

/** 그루터기 몸 반경. 나무 줄기보다 가늘어 작게 막는다. 싹은 가늘어서 걸리지 않는다. */
const STUMP_R = 0.42

/**
 * 큰 소품(상점·나무·바위·작업대·우체통·부두)에 막혔는지. 집·전시관 자리(live)도 포함한다.
 * felled 를 주면 베어 넘긴 나무는 줄기 대신 그루터기 반경만 막는다. 빼면 처음 배치 그대로다.
 */
export function blockedByProps(x: number, z: number, pad = 0, felled?: Felled, day = ''): boolean {
  if (blockedByFixedProps(x, z, pad, felled, day)) return true
  if (live.home && Math.hypot(x - live.home.x, z - live.home.z) < live.home.r + pad) return true
  return !!live.museum && Math.hypot(x - live.museum.x, z - live.museum.z) < live.museum.r + pad
}

/**
 * 고정 소품에 막혔는지. live 로 등록된 집·전시관 자리는 빼고 본다.
 * 집터 고르기가 store 가 등록한 집 자리(자기 자신)에 막혀 자리가 바뀌지 않도록 따로 둔다.
 */
export function blockedByFixedProps(x: number, z: number, pad = 0, felled?: Felled, day = ''): boolean {
  const hw = SHOP.w / 2 + pad
  const hd = SHOP.d / 2 + pad
  if (Math.abs(x - SHOP.x) < hw && Math.abs(z - SHOP.z) < hd) return true
  if (TREES.some((t) => {
    const st = felled ? treeState(t.id, felled, day) : 'tree'
    const r = st === 'tree' ? TREE_RADIUS + pad : st === 'stump' ? STUMP_R + pad : 0
    return r > 0 && (t.x - x) ** 2 + (t.z - z) ** 2 < r * r
  })) return true
  const lh = lighthouseSpot()
  if (Math.hypot(x - lh.x, z - lh.z) < LIGHTHOUSE_SOLID_R + pad) return true
  const rr = ROCK_RADIUS + pad
  if (ROCKS.some((k) => (k.x - x) ** 2 + (k.z - z) ** 2 < rr * rr)) return true
  if (Math.hypot(x - WORKBENCH.x, z - WORKBENCH.z) < WORKBENCH.r + pad) return true
  if (Math.hypot(x - STALL.x, z - STALL.z) < STALL.r + pad) return true
  if (Math.hypot(x - MAILBOX.x, z - MAILBOX.z) < MAILBOX.r + pad) return true
  return DOCKS.some((d) => Math.hypot(x - d.x, z - d.z) < DOCK_R + pad)
}

export function canStand(x: number, z: number): boolean {
  if (inRoomArea(x)) return roomWalkable(x, z, 0.3)
  return isWalkable(x, z) && !blockedByProps(x, z, 0.3)
}

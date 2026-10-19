import { byWater, groundAt, heightAt, isWalkable } from './island'
import { reservedByHomes } from './villagers'
import { blockedByProps, SHOP_DOOR, SPAWN } from './world'
import { blockedByScenery } from './scenery'
import { blockedByHoles, type Hole } from './holes'
import { onBridge } from './waters'
import { onStepSpot, PLATEAUS, plateauRimAt, rampWeight } from './tiers'
import type { Felled } from './trees'
import type { HomeFloor } from './interior'

/** 가구는 1칸 격자에 놓는다. 회전은 0~3(90도 단위). */

export interface Placed {
  id: string
  itemId: string
  x: number
  z: number
  rot: number
  /** 불빛 가구를 꺼 두었는지 */
  off?: boolean
  /** 리폼한 색 변형(core/reform.ts). 기본 가구는 없다. */
  variant?: string
  /** 집 안에서 놓은 자리. 0 은 본채 방바닥, 1 은 다락, 2 는 옆방, 3 은 지하실(각 단계에서만). 없으면 0 이다. */
  floor?: HomeFloor
  /** 벽에 건 가구(core/wallHang.ts)가 걸린 벽 면. 바닥 가구에는 없다. */
  wall?: WallDir
}

/** 벽 면: 방 칸에서 바깥을 보는 쪽. n 은 -z, s 는 +z, e 는 +x, w 는 -x 다. */
export type WallDir = 'n' | 'e' | 's' | 'w'

/** 앉을 수 있는 가구와 앉는 면의 높이 */
export const SEAT_HEIGHT: Record<string, number> = { chair: 0.43, 'log-stool': 0.45, 'log-bench': 0.57, 'wooden-box': 0.6, 'reading-chair': 0.5, 'star-cushion': 0.3, 'acorn-cushion': 0.3 }

/** 표에 없는 앉을 가구의 기본 앉는 높이. 값이 없어 NaN 으로 화면이 가라앉지 않게 한다. */
export const SEAT_DEFAULT = 0.45

/** 앉는 가구의 앉는 높이. 표에 없으면 기본 높이다. */
export function seatHeightOf(itemId: string): number {
  return SEAT_HEIGHT[itemId] ?? SEAT_DEFAULT
}

/** 놓인 가구로 할 수 있는 일. 없으면 E 로 바로 넣는다. */
export function furnitureUse(itemId: string, glowing: ReadonlySet<string>): 'sit' | 'light' | 'stars' | null {
  if (itemId in SEAT_HEIGHT) return 'sit'
  if (glowing.has(itemId)) return 'light'
  if (itemId === 'telescope') return 'stars'
  return null
}

export const FURNITURE_R = 0.45
const REACH = 1.6

export const snap = (v: number) => Math.round(v)

/** 플레이어가 바라보는 앞 칸 */
export function placementCell(px: number, pz: number, facing: number): { x: number; z: number } {
  return { x: snap(px + Math.sin(facing) * REACH), z: snap(pz + Math.cos(facing) * REACH) }
}

/** 손가락으로 찍은 방 바닥 점(방 가운데 기준 로컬 좌표)을 놓을 칸으로 바꾼다. placementCell 과 같은 1칸 격자다. */
export function tapCell(lx: number, lz: number): { x: number; z: number } {
  // 음수 0 이 생기지 않게 0 으로 고쳐 쓴다
  return { x: snap(lx) || 0, z: snap(lz) || 0 }
}

/** 손가락 광선(원점·방향)이 지형 높이(heightAt)와 만나는 칸. 높이를 몇 번 되풀이해 맞춘다. 지면을 못 만나면 null. */
export function groundCell(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  heightAt: (x: number, z: number) => number,
): { x: number; z: number } | null {
  if (dy >= -1e-6) return null
  let h = 0
  let cell: { x: number; z: number } | null = null
  for (let i = 0; i < 4; i++) {
    const t = (h - oy) / dy
    if (t < 0) return null
    cell = { x: snap(ox + dx * t) || 0, z: snap(oz + dz * t) || 0 }
    h = heightAt(cell.x, cell.z)
  }
  return cell
}

export function blockedByPlaced(x: number, z: number, placed: readonly Placed[], pad = 0): boolean {
  const r = FURNITURE_R + pad
  return placed.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r)
}

/** 절벽 띠 둘레의 경사로·계단 자리인지. 계단은 extraRamps 로 경사로와 같이 세어진다. */
export function onRamp(x: number, z: number): boolean {
  for (const p of PLATEAUS) {
    const dx = x - p.x
    const dz = z - p.z
    const r = Math.hypot(dx, dz)
    const theta = Math.atan2(dz, dx)
    const rim = plateauRimAt(p, theta)
    if (r > rim - 1.8 && r < rim + 1.2 && rampWeight(p, theta) > 0.02) return true
  }
  return false
}

/** 칸 중심 주변 다섯 점의 높이가 거의 같은 평지인지. 경사로·절벽 가장자리는 못 깐다·못 놓는다. */
export function flatAt(x: number, z: number): boolean {
  const e = 0.5
  const hs = [heightAt(x - e, z - e), heightAt(x + e, z - e), heightAt(x + e, z + e), heightAt(x - e, z + e), heightAt(x, z)]
  return Math.max(...hs) - Math.min(...hs) < 0.08
}

/** 가구 발자국(반지름 0.5)의 둘레 여덟 점도 높이가 거의 같은지. 칸 모서리만 보는 flatAt 으로는 못 잡는 턱을 막는다. */
export function footprintFlat(x: number, z: number): boolean {
  const h = heightAt(x, z)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    if (Math.abs(heightAt(x + Math.cos(a) * 0.5, z + Math.sin(a) * 0.5) - h) >= 0.08) return false
  }
  return true
}

/** 가구·꽃을 놓는 자리의 추가 조건. paths 는 길이 깔린 칸의 "x,z" 키(paths.ts pathCellsOf). */
export interface PlaceLive {
  /** 나무 그루터기·구멍 같이 지금 바뀐 섬 상태 */
  felled?: Felled
  day?: string
  holes?: readonly Hole[]
  paths?: ReadonlySet<string>
}

/**
 * 한 칸에 놓을 수 없는 이유. 놓을 수 있으면 null.
 * 미리보기 안내와 실제 놓기가 같은 판정을 쓴다. 한 칸에 하나만, 심은 꽃(plants)도 칸을 차지한다.
 */
export function placeBlocker(x: number, z: number, placed: readonly Placed[], plants: readonly { x: number; z: number }[] = [], live: PlaceLive = {}): string | null {
  if (onBridge(x, z)) return '다리 위에는 놓을 수 없어요'
  const g = groundAt(x, z)
  if (g === 'water') return '물 위에는 놓을 수 없어요'
  if (g !== 'grass') return '모래밭에는 놓을 수 없어요'
  if (!isWalkable(x, z)) return '걸을 수 없는 곳이라 놓을 수 없어요'
  if (byWater(x, z, 0.3)) return '물가에는 놓을 수 없어요'
  if (onStepSpot(x, z)) return '계단 자리라 놓을 수 없어요'
  // 경사로와 계단은 올라가는 길이라 막지 않으면 걸어 오를 수 없다
  if (onRamp(x, z)) return '경사로나 계단 자리라 놓을 수 없어요'
  // 경사로·절벽 가장자리는 가구가 기울거나 떠 보여서 막는다
  if (!flatAt(x, z)) return '경사진 곳이라 놓을 수 없어요'
  if (!footprintFlat(x, z)) return '경사진 곳이라 놓을 수 없어요'
  if (live.paths?.has(`${x},${z}`)) return '길 위에는 놓을 수 없어요'
  if (blockedByProps(x, z, 0.4, live.felled, live.day) || blockedByScenery(x, z, 0.4)) return '다른 물건과 겹쳐요'
  if (live.holes && blockedByHoles(x, z, live.holes, 0.4)) return '구멍이 있어 놓을 수 없어요'
  if (placed.some((p) => p.x === x && p.z === z)) return '이미 가구가 놓인 자리예요'
  if (plants.some((p) => p.x === x && p.z === z)) return '꽃이 심긴 자리예요'
  // 상점 문과 처음 서는 자리는 비워 둬야 갇히지 않는다.
  if (Math.hypot(x - SHOP_DOOR.x, z - SHOP_DOOR.z) < 2) return '상점 문 앞은 비워 둬요'
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 1) return '처음 서는 자리는 비워 둬요'
  // 주민 산책길·집터에 놓으면 주민이나 집과 겹치므로 막는다.
  if (reservedByHomes(x, z, 0.8)) return '주민 산책길이나 집터라 놓을 수 없어요'
  return null
}

/** 한 칸에 하나만. 심은 꽃(plants)도 칸을 차지한다. */
export function canPlace(x: number, z: number, placed: readonly Placed[], plants: readonly { x: number; z: number }[] = [], live: PlaceLive = {}): boolean {
  return placeBlocker(x, z, placed, plants, live) === null
}

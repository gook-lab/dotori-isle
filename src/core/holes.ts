/**
 * 삽으로 판 구멍. 걷기를 막고 메우기 전까지 남는다. 자리는 아무 땅이나 되지만 길·물건·주민 곁은 피한다.
 */
import { byWater, groundAt, isWalkable } from './island'
import { blockedByPlaced, type Placed } from './placement'
import { reservedByHomes, blockedByHouses } from './villagers'
import { blockedByScenery } from './scenery'
import { blockedByProps, TREES } from './world'
import { treeState, type Felled } from './trees'

export interface Hole {
  id: string
  x: number
  z: number
}

/** 한 번에 남길 수 있는 구멍 수. 가득 차면 메워야 새로 판다. */
export const MAX_HOLES = 60
/** 구멍 반지름. 몸 반경 pad 를 더해 막는다. */
export const HOLE_R = 0.4

export function blockedByHoles(x: number, z: number, holes: readonly Hole[], pad = 0): boolean {
  const r = HOLE_R + pad
  return holes.some((h) => (h.x - x) ** 2 + (h.z - z) ** 2 < r * r)
}

/** 판단에 필요한 섬의 현재 상태 */
export interface DigWorld {
  placed: readonly Placed[]
  plants: readonly { x: number; z: number }[]
  houses: readonly string[]
  holes: readonly Hole[]
  felled: Felled
  day: string
  /** 지금 걸어 다니는 주민 자리 */
  villagers: readonly { x: number; z: number }[]
}

const RING = 1.2
const DIRS = 8

/** 플레이어 둘레 여덟 방향 가운데 걸을 수 있는 곳의 개수 */
function openDirections(px: number, pz: number, w: DigWorld, holes: readonly Hole[]): number {
  let n = 0
  for (let i = 0; i < DIRS; i++) {
    const a = (i / DIRS) * Math.PI * 2
    const x = px + Math.sin(a) * RING
    const z = pz + Math.cos(a) * RING
    const free = isWalkable(x, z) && !blockedByProps(x, z, 0.3, w.felled, w.day) && !blockedByScenery(x, z, 0.3) && !blockedByPlaced(x, z, w.placed, 0.3) && !blockedByHoles(x, z, holes, 0.3) && !blockedByHouses(x, z, w.houses, 0.3)
    if (free) n++
  }
  return n
}

/**
 * (x, z) 에 구멍을 팔 수 있는지. 물·길·집·가구·꽃·나무·주민 곁과 다른 구멍 곁은 막는다.
 * player 를 주면 구멍 때문에 플레이어가 완전히 갇히는 자리도 막는다.
 */
export function canDigAt(x: number, z: number, w: DigWorld, player?: { x: number; z: number }): boolean {
  if (groundAt(x, z) === 'water' || !isWalkable(x, z) || byWater(x, z, 0.6)) return false
  if (blockedByProps(x, z, 0.7, w.felled, w.day) || blockedByScenery(x, z, 0.6)) return false
  if (blockedByPlaced(x, z, w.placed, 0.6) || blockedByHouses(x, z, w.houses, 1) || reservedByHomes(x, z, 0.4)) return false
  if (TREES.some((t) => treeState(t.id, w.felled, w.day) !== 'tree' && Math.hypot(t.x - x, t.z - z) < 0.9)) return false
  if (w.plants.some((p) => Math.hypot(p.x - x, p.z - z) < 1)) return false
  if (w.villagers.some((v) => Math.hypot(v.x - x, v.z - z) < 1.4)) return false
  if (w.holes.some((h) => Math.hypot(h.x - x, h.z - z) < 1)) return false
  if (player) {
    const after = [...w.holes, { id: '', x, z }]
    if (openDirections(player.x, player.z, w, after) === 0 && openDirections(player.x, player.z, w, w.holes) > 0) return false
  }
  return true
}

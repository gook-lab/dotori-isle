import type { HomeSite } from './home'
import type { Placed } from './placement'

/**
 * 정원 꾸미기 허가. 한 번 받으면 울타리를 칠 수 있고, 허가를 받아야 바닥·울타리 종류를 더 살 수 있다.
 * 값은 도토리 3000 또는 마일 300 중 하나로 치르고, 나무 울타리 스무 개를 함께 준다.
 */
export const GARDEN_PERMIT = { money: 3000, miles: 300, pieces: 20 } as const

/** 울타리 종류. 나무 울타리는 허가와 함께 받고, 나머지는 도토리로 한 묶음(스무 개)씩 산다. */
export const FENCE_KINDS = ['fence', 'fence-white', 'fence-stone'] as const
export type FenceKind = (typeof FENCE_KINDS)[number]
/** 허가와 함께 주는 나무 울타리 id */
export const FENCE_ID = 'fence'
/** 도토리로 사는 울타리와 한 묶음 값 */
export const FENCE_FOR_SALE: Partial<Record<FenceKind, number>> = { 'fence-white': 500, 'fence-stone': 800 }
/** 한 묶음에 든 조각 수 */
export const FENCE_PIECES = 20

export const isFence = (id: string): id is FenceKind => (FENCE_KINDS as readonly string[]).includes(id)

/** 집 가운데에서 세는 칸 거리(가장 큰 쪽). 몸체 바로 옆은 비우고, 여섯 칸 밖은 이웃 자리라 막는다. */
export const FENCE_NEAR = 3
export const FENCE_FAR = 6
/** 현관 앞은 드나들 길이라 비운다 */
const DOOR_CLEAR = 1.6

/** 정원 칸(울타리·바닥)이 놓일 수 있는 고리인지. 맞지 않으면 이유 한 줄을, 맞으면 null 을 준다. */
export function gardenRingBlocker(x: number, z: number, site: Pick<HomeSite, 'x' | 'z' | 'door'> | null): string | null {
  if (!site) return '집이 있어야 정원을 꾸밀 수 있어요'
  const r = Math.max(Math.abs(x - site.x), Math.abs(z - site.z))
  if (r < FENCE_NEAR) return '집 몸체 바로 옆에는 칠 수 없어요'
  if (r > FENCE_FAR) return '집 둘레 여섯 칸 안에만 칠 수 있어요'
  if (Math.hypot(x - site.door.x, z - site.door.z) < DOOR_CLEAR) return '현관 앞은 비워 둬요'
  return null
}

/**
 * 울타리를 이 칸에 칠 수 있는지. 울타리가 아니면 null(다른 가구는 이 판정을 받지 않는다).
 * 일반 가구 판정(placeBlocker)과 함께 쓴다.
 */
export function fenceBlocker(itemId: string, x: number, z: number, site: Pick<HomeSite, 'x' | 'z' | 'door'> | null): string | null {
  if (!isFence(itemId)) return null
  return gardenRingBlocker(x, z, site)
}

/** 칸마다 네 방향 이웃에 울타리가 있는지. 울타리 모양이 옆 칸과 이어질 때 가로대를 그릴 방향을 정한다. */
export interface FenceSides {
  n: boolean
  e: boolean
  s: boolean
  w: boolean
}

/** 종류와 상관없이 울타리끼리는 이어진다. 회전은 울타리 칸에서 쓰지 않으므로 바깥 방향 그대로 본다. */
export function fenceSides(placed: readonly Placed[], x: number, z: number): FenceSides {
  const fence = new Set(placed.filter((p) => isFence(p.itemId)).map((p) => `${p.x},${p.z}`))
  return { n: fence.has(`${x},${z + 1}`), e: fence.has(`${x + 1},${z}`), s: fence.has(`${x},${z - 1}`), w: fence.has(`${x - 1},${z}`) }
}

/** 집 둘레 고리 안에서 서로 이어진 울타리 쌍의 수(한 쌍은 한 번만 센다). 꾸미기 점수의 울타리 항목이다. */
export function fenceLinks(placed: readonly Placed[], site: Pick<HomeSite, 'x' | 'z' | 'door'> | null): number {
  if (!site) return 0
  const cells = placed.filter((p) => isFence(p.itemId) && gardenRingBlocker(p.x, p.z, site) === null)
  const keys = new Set(cells.map((p) => `${p.x},${p.z}`))
  let links = 0
  for (const p of cells) {
    if (keys.has(`${p.x + 1},${p.z}`)) links++
    if (keys.has(`${p.x},${p.z + 1}`)) links++
  }
  return links
}

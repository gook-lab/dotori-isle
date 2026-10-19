/**
 * 정원 바닥 타일: 집 둘레 고리 안의 풀밭 칸에 자갈·벽돌·나무 데크를 깐다. 잔디 그대로면 칸이 비어 있다.
 * 저장은 `x,zk;...` 한 줄(길 저장과 같은 모양)이고, 칸 판정은 울타리 고리와 길 깔기 판정을 그대로 쓴다.
 */
import { pathSpotOk } from './paths'
import { onStepSpot } from './tiers'
import { fenceLinks, gardenRingBlocker } from './fence'
import type { HomeSite } from './home'
import type { Placed } from './placement'

export const GARDEN_KINDS = ['gravel', 'brick', 'deck'] as const
export type GardenKind = (typeof GARDEN_KINDS)[number]
export const GARDEN_TILE_NAME: Record<GardenKind, string> = { gravel: '자갈 바닥', brick: '벽돌 바닥', deck: '나무 데크' }
/** 바닥 타일을 칠할 때 쓰는 가상 가구 id(주머니에 들지 않는다) */
export const GARDEN_ITEM: Record<GardenKind, string> = { gravel: 'tile-gravel', brick: 'tile-brick', deck: 'tile-deck' }
export const GARDEN_KIND_OF_ITEM: Record<string, GardenKind> = { 'tile-gravel': 'gravel', 'tile-brick': 'brick', 'tile-deck': 'deck' }
/** 한 섬의 정원 바닥 칸 수 상한 */
export const GARDEN_TILE_MAX = 60

export interface GardenTile {
  x: number
  z: number
  kind: GardenKind
}

const CODE: Record<GardenKind, string> = { gravel: 'g', brick: 'b', deck: 'w' }
const KIND_OF: Record<string, GardenKind> = { g: 'gravel', b: 'brick', w: 'deck' }

export const isGardenItem = (id: string | null | undefined): id is string => !!id && id in GARDEN_KIND_OF_ITEM

export function encodeGarden(tiles: readonly GardenTile[]): string {
  return tiles.map((t) => `${t.x},${t.z}${CODE[t.kind]}`).join(';')
}

/** 저장 문자열을 칸 목록으로. 깨진 조각·겹친 칸은 버리고 상한까지만 받는다. */
export function decodeGarden(raw: unknown): GardenTile[] {
  if (typeof raw !== 'string' || !raw) return []
  const seen = new Set<string>()
  const out: GardenTile[] = []
  for (const part of raw.split(';')) {
    const m = /^(-?\d+),(-?\d+)([gbw])$/.exec(part)
    if (!m) continue
    const x = Number(m[1])
    const z = Number(m[2])
    const key = `${x},${z}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ x, z, kind: KIND_OF[m[3]] })
    if (out.length >= GARDEN_TILE_MAX) break
  }
  return out
}

/**
 * 같은 종류를 한 번 더 찍으면 걷어 잔디로 돌린다. 다른 종류면 바꿔 깐다. 상한이면 깔지 않는다.
 */
export function paintGarden(tiles: readonly GardenTile[], x: number, z: number, kind: GardenKind): { tiles: GardenTile[]; done: 'added' | 'removed' | 'replaced' | 'full' } {
  const i = tiles.findIndex((t) => t.x === x && t.z === z)
  if (i >= 0 && tiles[i].kind === kind) return { tiles: tiles.filter((_, k) => k !== i), done: 'removed' }
  if (i >= 0) return { tiles: tiles.map((t, k) => (k === i ? { x, z, kind } : t)), done: 'replaced' }
  if (tiles.length >= GARDEN_TILE_MAX) return { tiles: [...tiles], done: 'full' }
  return { tiles: [...tiles, { x, z, kind }], done: 'added' }
}

/**
 * 정원 바닥을 이 칸에 깔 수 있는지. 고리 밖·현관 앞은 막고, 나머지는 길 깔기와 같은 평지·빈 칸 판정을 쓴다.
 * 이미 깔린 칸은 다른 종류로 바꾸거나 걷을 수 있으므로 길 판정을 다시 묻지 않는다.
 */
export function gardenTileBlocker(x: number, z: number, site: Pick<HomeSite, 'x' | 'z' | 'door'> | null, placed: readonly Placed[], tiles: readonly GardenTile[], live: Parameters<typeof pathSpotOk>[3] = {}): string | null {
  const ring = gardenRingBlocker(x, z, site)
  if (ring) return ring
  if (tiles.some((t) => t.x === x && t.z === z)) return null
  if (onStepSpot(x, z)) return '계단 자리라 놓을 수 없어요'
  return pathSpotOk(x, z, placed, live) ? null : '여기엔 바닥을 깔 수 없어요'
}

/** 점수에 쓰는 정원 입력: 고리 안 울타리 이음 수와 깐 바닥 칸 수 */
export function gardenStats(placed: readonly Placed[], tiles: readonly GardenTile[], site: Pick<HomeSite, 'x' | 'z' | 'door'> | null): { fenceLinks: number; tiles: number } {
  const inRing = tiles.filter((t) => gardenRingBlocker(t.x, t.z, site) === null).length
  return { fenceLinks: fenceLinks(placed, site), tiles: inRing }
}

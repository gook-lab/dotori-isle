/**
 * 바다 수영과 잠수의 순수 규칙: 수영 범위, 되밀기, 거품 자리, 계절·시간대별 해산물.
 * 씬과 게임 로직은 여기 값을 읽기만 한다. React·Three 에 의존하지 않는다.
 */

import { groundAt } from './island'
import { hashString, mulberry32, pickWeighted, type Rng } from './rng'
import type { Season } from './season'

/** 모래 둘레 바깥 바다는 가운데에서 대략 64~76 부터다. 되밀기는 그 바로 바깥에서 시작한다. */
export const SWIM_SOFT = 82
/** 이 밖으로는 몸이 나가지 않는다(되밀기가 세진다) */
export const SWIM_LIMIT = 88
/** 바다 거품 후보의 가장 가까운 거리(물가에 붙은 곳은 뺀다) */
export const MIN_SEA_R = 66
/** 바다 수면 높이. 수영 중 몸은 여기에 반쯤 잠긴다. */
export const SEA_Y = -2.6
/** 눈에 보이는 바다 표면(물결 판)의 높이. SEA_Y 는 그 아래 깊은 바닥 판이다. */
export const SURFACE_Y = 0
/** 잠수 한 번에 물속에 있는 시간(초) */
export const DIVE_SECONDS = 3
/** 거품을 누를 수 있는 거리 */
export const BUBBLE_REACH = 1.4
/** 하루 거품 자리 수 */
export const BUBBLE_COUNT = 8

export interface SeaSpot {
  x: number
  z: number
}

/** 수영 중 몸이 있을 수 있는지. 섬 가운데에서 SWIM_LIMIT 안쪽이면 된다. */
export function swimOK(x: number, z: number): boolean {
  return Math.hypot(x, z) <= SWIM_LIMIT
}

/** 되밀기: 범위 밖으로 나간 만큼 가운데 쪽으로 밀어낸다. 안이면 0. `far` 는 '너무 멀어요'를 보여 줄지. */
export function swimPushback(x: number, z: number, dt: number): { dx: number; dz: number; far: boolean } {
  const d = Math.hypot(x, z)
  if (d <= SWIM_SOFT) return { dx: 0, dz: 0, far: false }
  const excess = d - SWIM_SOFT
  // 초당 넘친 거리의 여섯 배씩 부드럽게 민다. 길게 나가 있을수록 세게 민다.
  const step = Math.min(excess, excess * 6 * dt)
  return { dx: -(x / d) * step, dz: -(z / d) * step, far: d > SWIM_SOFT + 0.3 }
}

/** 바다 쪽인지: 물이면서 수영 범위 안 */
export function isSeaSpot(x: number, z: number): boolean {
  return groundAt(x, z) === 'water' && swimOK(x, z)
}

/** 물가인지: 뭍(모래·풀) 칸이고, 바로 옆 한 칸에 물이 있다 */
export function isShore(x: number, z: number): boolean {
  if (groundAt(x, z) === 'water') return false
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dz]) => groundAt(x + dx, z + dz) === 'water')
}

/** 바다 격자 후보(2칸 간격). 섬 둘레 모래 밖 바다만 본다. 한 번만 만들어 둔다. */
let seaCache: SeaSpot[] | null = null
export function seaCells(): SeaSpot[] {
  if (seaCache) return seaCache
  const out: SeaSpot[] = []
  for (let x = -SWIM_SOFT; x <= SWIM_SOFT; x += 2) {
    for (let z = -SWIM_SOFT; z <= SWIM_SOFT; z += 2) {
      // 물가에 너무 붙지 않게 바다 쪽으로 여유를 둔다
      if (Math.hypot(x, z) < MIN_SEA_R) continue
      if (isSeaSpot(x, z)) out.push({ x, z })
    }
  }
  seaCache = out
  return out
}

/** 하루 거품 자리. 날짜로 고르니 같은 날은 같고 다음 날에는 바뀐다. 날짜별로 한 번만 계산한다. */
const bubbleCache = new Map<string, SeaSpot[]>()
export function bubbleSpots(day: string, cells: readonly SeaSpot[] = seaCells(), count = BUBBLE_COUNT): SeaSpot[] {
  const cached = bubbleCache.get(day)
  if (cached) return cached
  const spots = [...cells].sort((a, b) => hashString(`${day}:${a.x},${a.z}`) - hashString(`${day}:${b.x},${b.z}`)).slice(0, count)
  bubbleCache.set(day, spots)
  return spots
}

export interface DiveSpecies {
  id: string
  weight: number
  /** 나오는 계절. null 이면 사계절 내내. */
  seasons: readonly Season[] | null
  /** 나오는 시간대 */
  time: 'any' | 'day' | 'night'
}

/** 잠수로 잡는 해산물 일곱 종. 드물수록 계절과 시간대 조건이 붙는다. */
export const DIVE_SPECIES: readonly DiveSpecies[] = [
  { id: 'starfish', weight: 30, seasons: null, time: 'any' },
  { id: 'urchin', weight: 25, seasons: null, time: 'day' },
  { id: 'scallop', weight: 20, seasons: ['spring', 'winter'], time: 'any' },
  { id: 'octopus', weight: 10, seasons: ['summer', 'autumn'], time: 'any' },
  { id: 'abalone', weight: 10, seasons: null, time: 'night' },
  { id: 'sea-cucumber', weight: 8, seasons: ['winter'], time: 'night' },
  { id: 'lobster', weight: 4, seasons: ['summer'], time: 'night' },
]

/** 지금 계절·시간대에 잡히는 종 */
export function divePool(season: Season, night: boolean): DiveSpecies[] {
  return DIVE_SPECIES.filter((s) => (!s.seasons || s.seasons.includes(season)) && (s.time === 'any' || (s.time === 'night') === night))
}

/** 잠수해서 잡은 것 하나. 조건에 맞는 종이 없으면 불가사리(언제나 나온다). */
export function catchFor(season: Season, night: boolean, rng: Rng): string {
  const pool = divePool(season, night)
  if (pool.length === 0) return 'starfish'
  return pickWeighted(pool, rng).id
}

/** 잠수 결과를 한 번에 굴린다: 같은 씨앗이면 같은 결과 */
export function diveResult(day: string, bubbleKey: string, season: Season, night: boolean): string {
  return catchFor(season, night, mulberry32(hashString(`dive:${day}:${bubbleKey}`)))
}

/** 물가에서 거품까지 닿는지 */
export function inBubbleReach(px: number, pz: number, bx: number, bz: number): boolean {
  return Math.hypot(px - bx, pz - bz) <= BUBBLE_REACH
}

/**
 * 꽃 교배: 물 준 꽃 두 송이가 옆칸에 붙어 있으면, 밤이 지나 빈 옆칸에 새 꽃이 필 수 있다.
 * 색은 부모 색의 유전 표로 정한다. 표에 없는 조합은 두 부모 중 하나의 색을 받는다.
 * 희귀색은 도감 '꽃' 칸에 오르고, 처음 필 때 편지가 한 통 온다.
 */

import { BLOOM, type Plant } from './garden'
import type { Rng } from './rng'

/** 물 준 쌍 하나가 밤에 새 꽃을 낳을 기본 확률 */
export const BREED_CHANCE = 0.1
/** 금 물뿌리개를 쓰면 더해지는 확률 */
export const GOLD_CAN_BONUS = 0.05

/** 희귀 교배색. 도감 id 는 items.ts 의 꽃 항목과 맞춘다. */
export const RARE_FLOWERS = [
  { id: 'flower-sky', color: '#7fd3ff', name: '하늘 꽃', letter: '처음 보는 맑은 하늘색 꽃이 피었어요' },
  { id: 'flower-rose', color: '#e0559b', name: '자주 꽃', letter: '처음 보는 진한 자주색 꽃이 피었어요' },
] as const

/** 유전 표: 두 색을 섞은 결과. 순서와 무관하도록 키는 두 색을 정렬해 이어 쓴다. */
const MIX: Record<string, string> = {
  // 빨강(분홍)+하양 → 분홍
  [key('#ff8fa3', '#ffffff')]: '#ff8fa3',
  // 빨강(분홍)+노랑 → 주황
  [key('#ff8fa3', '#ffd166')]: '#ff9f68',
  // 주황+보라 → 하늘색(희귀)
  [key('#ff9f68', '#c77dff')]: RARE_FLOWERS[0].color,
  // 분홍+보라 → 자주색(희귀)
  [key('#ff8fa3', '#c77dff')]: RARE_FLOWERS[1].color,
}

function key(a: string, b: string): string {
  return [a, b].sort().join('|')
}

/** 두 부모 색에서 새 꽃 색을 정한다. 표에 없으면 두 부모 중 하나를 고른다. */
export function childColor(a: string, b: string, rng: Rng): string {
  if (a === b) return a
  const mixed = MIX[key(a, b)]
  if (mixed) return mixed
  return rng() < 0.5 ? a : b
}

/** 희귀색이면 그 도감 id, 아니면 null */
export function rareFlowerOf(color: string): (typeof RARE_FLOWERS)[number] | null {
  return RARE_FLOWERS.find((r) => r.color === color) ?? null
}

export interface Born {
  plant: Plant
  /** 희귀색이면 도감 id */
  rare: string | null
}

interface BreedOptions {
  goldCan: boolean
  rng: Rng
  /** 칸이 비어 있는지(섬 지형·가구·꽃 포함). 이 함수 밖에서 막힌 칸은 여기서 한 번 더 거른다. */
  free: (x: number, z: number) => boolean
  newId: () => string
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

/** 두 칸이 가로나 세로로 붙어 있는지 */
export function adjacent(a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1
}

/**
 * 밤에 호출한다. 물 준 꽃(활짝 핀 것) 쌍마다 한 번씩 확률을 굴려, 성공하면 두 꽃 중 하나의 빈 옆칸에 새 꽃을 낳는다.
 * 낳은 꽃은 활짝 핀 상태로 시작하고, 원래 꽃 목록은 바꾸지 않는다.
 */
export function breedOvernight(plants: readonly Plant[], opts: BreedOptions): { plants: Plant[]; born: Born[] } {
  const parents = plants.filter((p) => p.watered && p.stage >= BLOOM)
  const chance = BREED_CHANCE + (opts.goldCan ? GOLD_CAN_BONUS : 0)
  const taken = new Set(plants.map((p) => `${p.x},${p.z}`))
  const born: Born[] = []
  for (let i = 0; i < parents.length; i++) {
    for (let j = i + 1; j < parents.length; j++) {
      const a = parents[i]
      const b = parents[j]
      if (!adjacent(a, b)) continue
      if (opts.rng() >= chance) continue
      // 두 꽃의 빈 옆칸 가운데 하나를 고른다
      const cells: { x: number; z: number }[] = []
      for (const p of [a, b]) {
        for (const [dx, dz] of NEIGHBORS) {
          const x = p.x + dx
          const z = p.z + dz
          if (taken.has(`${x},${z}`) || !opts.free(x, z)) continue
          if (cells.some((c) => c.x === x && c.z === z)) continue
          cells.push({ x, z })
        }
      }
      if (cells.length === 0) continue
      const cell = cells[Math.floor(opts.rng() * cells.length)]
      const color = childColor(a.color, b.color, opts.rng)
      taken.add(`${cell.x},${cell.z}`)
      born.push({
        plant: { id: opts.newId(), x: cell.x, z: cell.z, color, stage: BLOOM, watered: false },
        rare: rareFlowerOf(color)?.id ?? null,
      })
    }
  }
  return { plants: [...plants, ...born.map((b) => b.plant)], born }
}

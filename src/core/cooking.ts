/**
 * 요리: 작은 화덕 앞에서 재료로 요리를 만든다. 요리는 가방에 들어가고, 먹으면 효과가 난다.
 * 순수 로직이라 React·Three 에 의존하지 않는다. 재료 칸은 items.ts 의 종류로 고른다.
 */

import { ITEMS } from './items'
import { addItem, type Slot } from './inventory'

/** 먹은 뒤 효과. haste 는 달리기 빠르기, rock 은 다음 바위를 한 번에 깨기, happy 는 기분 표정 기쁨. */
export type DishEffect = 'haste' | 'rock' | 'happy'

export const HASTE_SECONDS = 180
export const HASTE_MUL = 1.2
export const HAPPY_SECONDS = 120
/** 요리를 선물하면 더 오르는 우정 점수 */
export const DISH_GIFT_BONUS = 2

/** 조개 종류(조개 수프의 재료) */
const CLAMS = ['scallop', 'conch']
/** 버섯 종류 */
const MUSHROOMS = ['mushroom']

/** 재료 한 줄: 종류에 맞는 물건 `count` 개. money 가 있으면 도토리(화폐)를 쓴다. */
export interface Ingredient {
  label: string
  count: number
  match: (id: string) => boolean
}

export interface CookRecipe {
  /** 결과물 id(items.ts 의 dish 항목) */
  id: string
  /** 재료 종류 */
  needs: Ingredient[]
  /** 소모하는 도토리 */
  money: number
  effect: DishEffect
  /** 효과를 한 줄로 */
  effectText: string
}

const isFruit = (id: string) => ITEMS[id]?.kind === 'fruit'
const isFish = (id: string) => ITEMS[id]?.kind === 'fish'
const isClam = (id: string) => CLAMS.includes(id)
const isMushroom = (id: string) => MUSHROOMS.includes(id)
const isPetal = (id: string) => id === 'petal'

export const COOK_RECIPES: CookRecipe[] = [
  { id: 'dish-fruit-pie', needs: [{ label: '과일', count: 3, match: isFruit }], money: 0, effect: 'haste', effectText: `${HASTE_SECONDS / 60}분 동안 달리기가 ${Math.round((HASTE_MUL - 1) * 100)}% 빨라요` },
  { id: 'dish-grilled-fish', needs: [{ label: '물고기', count: 1, match: isFish }], money: 0, effect: 'rock', effectText: '다음 바위를 한 번에 깨요' },
  { id: 'dish-clam-soup', needs: [{ label: '조개', count: 2, match: isClam }], money: 0, effect: 'rock', effectText: '다음 바위를 한 번에 깨요' },
  { id: 'dish-mushroom-skewer', needs: [{ label: '버섯', count: 2, match: isMushroom }], money: 0, effect: 'happy', effectText: `${HAPPY_SECONDS / 60}분 동안 기분이 좋아요` },
  { id: 'dish-acorn-cookie', needs: [], money: 5, effect: 'haste', effectText: `${HASTE_SECONDS / 60}분 동안 달리기가 ${Math.round((HASTE_MUL - 1) * 100)}% 빨라요` },
  { id: 'dish-petal-tea', needs: [{ label: '꽃잎', count: 1, match: isPetal }], money: 0, effect: 'happy', effectText: `${HAPPY_SECONDS / 60}분 동안 기분이 좋아요` },
]

export const COOK_BY_ID: Record<string, CookRecipe> = Object.fromEntries(COOK_RECIPES.map((r) => [r.id, r]))

/** 종류 조건에 맞는 주머니 물건 수 */
function haveOf(inv: readonly Slot[], match: (id: string) => boolean): number {
  return inv.filter((s) => match(s.id)).reduce((n, s) => n + s.count, 0)
}

export interface Shortfall {
  label: string
  have: number
  need: number
}

/** 부족한 재료. 다 있으면 빈 목록. 도토리가 모자라면 '도토리' 줄이 붙는다. */
export function shortfall(r: CookRecipe, inv: readonly Slot[], money: number): Shortfall[] {
  const out: Shortfall[] = []
  for (const n of r.needs) {
    const have = haveOf(inv, n.match)
    if (have < n.count) out.push({ label: n.label, have, need: n.count })
  }
  if (money < r.money) out.push({ label: '도토리', have: money, need: r.money })
  return out
}

export function canCook(r: CookRecipe, inv: readonly Slot[], money: number): boolean {
  return shortfall(r, inv, money).length === 0
}

/**
 * 재료를 빼고 요리를 넣는다. 재료가 모자라거나 주머니가 꽉 찼으면 null.
 * 재료는 주머니 앞 칸부터 쓴다.
 */
export function cook(r: CookRecipe, inv: readonly Slot[], money: number, capacity?: number): { inv: Slot[]; money: number } | null {
  if (!canCook(r, inv, money)) return null
  let next: Slot[] = inv.map((s) => ({ ...s }))
  for (const n of r.needs) {
    let left = n.count
    for (const s of next) {
      if (left === 0) break
      if (!n.match(s.id)) continue
      const take = Math.min(s.count, left)
      s.count -= take
      left -= take
    }
    next = next.filter((s) => s.count > 0)
  }
  const res = addItem(next, r.id, 1, capacity)
  if (!res.added) return null
  return { inv: res.inv, money: money - r.money }
}

/** 요리 한 종을 먹었을 때 바뀌는 효과 시간(초). 없으면 0 */
export function effectSeconds(effect: DishEffect): number {
  if (effect === 'haste') return HASTE_SECONDS
  if (effect === 'happy') return HAPPY_SECONDS
  return 0
}

/** 요리인지(먹을 수 있는지) */
export function isDish(id: string): boolean {
  return ITEMS[id]?.kind === 'dish'
}

/** 지금 남아 있는 요리 효과 한 줄씩. 시간이 있는 효과는 남은 초를 함께 준다. */
export interface ActiveBuff {
  label: string
  /** 남은 초. 시간이 없는 효과는 null */
  seconds: number | null
}

/** 효과 시각(초, runtime 기준)과 바위 대기 여부로 HUD 칩 목록을 만든다 */
export function activeBuffs(nowSec: number, b: { hasteUntil: number; happyUntil: number; rockCharge: boolean }): ActiveBuff[] {
  const out: ActiveBuff[] = []
  if (b.hasteUntil > nowSec) out.push({ label: '달리기 빨라짐', seconds: b.hasteUntil - nowSec })
  if (b.happyUntil > nowSec) out.push({ label: '기분 좋음', seconds: b.happyUntil - nowSec })
  if (b.rockCharge) out.push({ label: '바위 한 번에 대기', seconds: null })
  return out
}

/** 남은 시간 m:ss (올림) */
export function clockOf(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

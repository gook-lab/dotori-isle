import { addItem, countOf, removeOne, type Slot } from './inventory'

/** DIY 레시피. 작업대에서 재료를 써서 가구를 만든다. 결과물 id 가 곧 레시피 id 다. */

export interface Recipe {
  id: string
  materials: Record<string, number>
}

export const RECIPES: Recipe[] = [
  { id: 'log-stool', materials: { wood: 4 } },
  { id: 'wooden-box', materials: { wood: 6 } },
  { id: 'log-bench', materials: { wood: 8 } },
  { id: 'stone-lantern', materials: { stone: 6, wood: 2 } },
  { id: 'iron-lamp', materials: { iron: 4, wood: 3 } },
  { id: 'gold-acorn', materials: { gold: 2, stone: 4 } },
]

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]))
export const STARTER_RECIPES = ['log-stool', 'wooden-box']

export function canCraft(r: Recipe, inv: readonly Slot[]): boolean {
  return Object.entries(r.materials).every(([id, n]) => countOf(inv, id) >= n)
}

/** 재료를 빼고 결과물을 넣은 새 주머니. 재료가 모자라거나 결과물이 들어갈 칸이 없으면 null */
export function craft(r: Recipe, inv: readonly Slot[], capacity?: number): Slot[] | null {
  if (!canCraft(r, inv)) return null
  let next: Slot[] = [...inv]
  for (const [id, n] of Object.entries(r.materials)) for (let i = 0; i < n; i++) next = removeOne(next, id) ?? next
  const res = addItem(next, r.id, 1, capacity)
  return res.added ? res.inv : null
}

/** 아직 모르는 레시피 하나를 고른다. 다 알면 null */
export function pickUnknown(known: readonly string[], rng: () => number): string | null {
  const left = RECIPES.map((r) => r.id).filter((id) => !known.includes(id))
  return left.length ? left[Math.floor(rng() * left.length)] : null
}

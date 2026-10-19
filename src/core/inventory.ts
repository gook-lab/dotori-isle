import { ITEMS } from './items'
import { SONGI_ID } from './songi'

export interface Slot {
  id: string
  count: number
  /** 리폼한 가구의 색 변형(core/reform.ts). 기본 가구는 없다. */
  variant?: string
}

export const INVENTORY_SIZE = 20

/** 기존 칸을 먼저 채우고 남으면 새 칸을 연다. 주머니가 차면 일부만 들어갈 수 있다. */
export function addItem(inv: readonly Slot[], id: string, count = 1, capacity = INVENTORY_SIZE, variant?: string): { inv: Slot[]; added: number } {
  const limit = ITEMS[id]?.stack ?? 1
  const next = inv.map((s) => ({ ...s }))
  let left = count
  for (const s of next) {
    if (left === 0) break
    // 변형이 다른 가구끼리는 한 칸에 합치지 않는다
    if (s.id !== id || s.count >= limit || s.variant !== variant) continue
    const take = Math.min(limit - s.count, left)
    s.count += take
    left -= take
  }
  while (left > 0 && next.length < capacity) {
    const take = Math.min(limit, left)
    next.push(variant ? { id, count: take, variant } : { id, count: take })
    left -= take
  }
  return { inv: next, added: count - left }
}

/** 칸 값. 송이는 오늘 시세(songi) 로 매기고, 시세가 0 이면(일요일) 값이 없다. */
export function slotValue(s: Slot, songi = 0): number {
  if (s.id === SONGI_ID) return songi * s.count
  return (ITEMS[s.id]?.price ?? 0) * s.count
}

export function totalValue(inv: readonly Slot[], songi = 0): number {
  return inv.reduce((sum, s) => sum + slotValue(s, songi), 0)
}

/** 해당 물건을 하나 뺀다. 뒤쪽 칸부터 줄여 앞 칸 묶음이 유지되게 한다. */
export function removeOne(inv: readonly Slot[], id: string): Slot[] | null {
  for (let i = inv.length - 1; i >= 0; i--) {
    if (inv[i].id !== id) continue
    if (inv[i].count > 1) return inv.map((s, k) => (k === i ? { ...s, count: s.count - 1 } : s))
    return inv.filter((_, k) => k !== i)
  }
  return null
}

/** 같은 물건이라도 변형(색·마감)이 같은 것만 하나 뺀다. 보관함으로 옮길 때 고른 칸의 색을 지키려고 쓴다. */
export function removeOneOf(inv: readonly Slot[], id: string, variant?: string): Slot[] | null {
  for (let i = inv.length - 1; i >= 0; i--) {
    if (inv[i].id !== id || (inv[i].variant ?? undefined) !== variant) continue
    if (inv[i].count > 1) return inv.map((s, k) => (k === i ? { ...s, count: s.count - 1 } : s))
    return inv.filter((_, k) => k !== i)
  }
  return null
}

export function countOf(inv: readonly Slot[], id: string): number {
  return inv.reduce((n, s) => (s.id === id ? n + s.count : n), 0)
}

/** 가방 정렬 순서: 종류를 이 순서로 묶고, 같은 종류 안에서는 값이 비싼 것부터 */
const KIND_ORDER: readonly string[] = ['seed', 'fruit', 'shell', 'seafood', 'fish', 'bug', 'flower', 'dish', 'material', 'junk', 'treasure', 'ticket', 'furniture']

/** 가방을 종류 → 낱개 값(비싼 것 먼저) 순으로 다시 늘어놓는다. 같은 물건은 다시 쌓는다. */
export function sortInventory(inv: readonly Slot[]): Slot[] {
  const rank = (id: string) => {
    const k = KIND_ORDER.indexOf(ITEMS[id]?.kind ?? '')
    return k === -1 ? KIND_ORDER.length : k
  }
  const sorted = [...inv].sort((a, b) => {
    const byKind = rank(a.id) - rank(b.id)
    if (byKind) return byKind
    const byPrice = (ITEMS[b.id]?.price ?? 0) - (ITEMS[a.id]?.price ?? 0)
    if (byPrice) return byPrice
    return a.id < b.id ? -1 : a.id > b.id ? 1 : (a.variant ?? '') < (b.variant ?? '') ? -1 : 1
  })
  // 칸 수는 가방 크기 그대로 두고, 같은 물건끼리는 쌓는 한도 안에서 다시 합친다
  return sorted.reduce<Slot[]>((acc, s) => addItem(acc, s.id, s.count, Infinity, s.variant).inv, [])
}

/** 고른 칸들(인덱스)을 판다. 범위 밖이나 중복 인덱스는 무시한다. */
export function sellSlots(inv: readonly Slot[], picked: readonly number[], songi = 0): { inv: Slot[]; sold: Slot[]; earned: number } {
  // 시세가 없을 때(일요일)는 송이를 팔지 않고 가방에 남긴다
  const idx = new Set(picked.filter((i) => Number.isInteger(i) && i >= 0 && i < inv.length && (songi > 0 || inv[i].id !== SONGI_ID)))
  const sold = inv.filter((_, i) => idx.has(i))
  return { inv: inv.filter((_, i) => !idx.has(i)), sold, earned: totalValue(sold, songi) }
}

/** 가구가 섞여 있으면 실수로 팔지 않게 한 번 더 물어본다 */
export function hasFurniture(slots: readonly Slot[]): boolean {
  return slots.some((s) => ITEMS[s.id]?.kind === 'furniture')
}

/** 이미 가진 가구 개수: 주머니·보관함의 낱개 수량과 방에 놓은 가구(한 개씩)를 더한다. 상점 진열 옆 "가짐" 표시에 쓴다. */
export function furnitureOwned(id: string, parts: { bag: readonly Slot[]; storage: readonly Slot[]; placed: readonly { itemId: string }[] }): number {
  return countOf(parts.bag, id) + countOf(parts.storage, id) + parts.placed.filter((p) => p.itemId === id).length
}

/**
 * 새 물건 배지. 상점이 한 단계 오르면 그 단계에서 처음 진열되는 물건에 "새" 배지를 붙인다.
 * 배지는 재개장 날부터 사흘 동안만 보이고, 그 물건을 사거나 살펴보면 사라진다.
 * 날짜와 목록만 보는 순수 함수다. 저장 값은 선택 필드라 예전 저장에서는 배지가 없다.
 */

import { dayDiff, dayIndex } from './economy'
import { ITEMS } from './items'
import { isShopTier, SHOP_TIERS, type ShopTier } from './shopTiers'

/** 재개장 날을 포함해 배지가 남는 날 수 */
export const NEW_ITEM_DAYS = 3

/** 가장 최근 재개장 기록. seen 은 배지를 이미 떼어 낸 물건 id 들이다. */
export interface ShopNewState {
  tier: ShopTier
  /** 재개장한 날 (날짜 키) */
  day: string
  seen: string[]
}

/** 이 단계에서 처음 진열되는 물건 id. 노점은 없다. shopTiers.newItemsAt 과 같은 규칙이고 이름 대신 id 를 준다. */
export function newItemIds(tier: ShopTier): string[] {
  if (tier === 0) return []
  const before = SHOP_TIERS[tier - 1].pool
  return SHOP_TIERS[tier].pool.filter((id) => !before.includes(id) && ITEMS[id] !== undefined)
}

/** 배지를 달지: 재개장 사흘 안이고, 이번 단계에서 새로 들어왔고, 아직 사거나 살펴보지 않은 물건이다. */
export function isNewShopItem(itemId: string, state: ShopNewState | null, day: string): boolean {
  if (!state || state.seen.includes(itemId)) return false
  if (!newItemIds(state.tier).includes(itemId)) return false
  const passed = dayDiff(state.day, day)
  return passed !== null && passed >= 0 && passed < NEW_ITEM_DAYS
}

/** 물건을 샀거나 살펴봤을 때 배지를 뗀다. 배지가 없는 물건이면 같은 값을 돌려준다. */
export function seeShopNew(state: ShopNewState | null, itemId: string, day: string): ShopNewState | null {
  if (!state || !isNewShopItem(itemId, state, day)) return state
  return { ...state, seen: [...state.seen, itemId] }
}

/** 불러온 값 검사. 틀린 값은 없는 것으로 본다. */
export function cleanShopNew(v: unknown): ShopNewState | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Partial<Record<keyof ShopNewState, unknown>>
  if (!isShopTier(o.tier) || typeof o.day !== 'string' || dayIndex(o.day) === null) return null
  const seen = Array.isArray(o.seen) ? o.seen.filter((x): x is string => typeof x === 'string' && ITEMS[x] !== undefined) : []
  return { tier: o.tier, day: o.day, seen: [...new Set(seen)] }
}

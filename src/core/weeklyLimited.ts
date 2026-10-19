/**
 * 주간 한정 진열. 상점 2단계 이상에서 매주 월요일에 고급 마감(금박·반짝이)이 미리 입혀진 가구 한 점이 진열대 한 칸에 올라온다.
 * 값은 가구 정가에 고급 마감 값(advancedAcorns)을 더하고 500 단위로 올린 값이다. 물건과 마감은 주의 월요일 날짜로 정한다.
 * 한 주에 한 번만 살 수 있다. 주머니에는 마감이 붙은 채 들어가며, 되팔 때는 기본 가구 값만 받는다(마감 값은 붙지 않는다).
 * 고급 마감은 상점 3단계 이후에만 리폼으로 고를 수 있지만, 한정 칸은 2단계부터 미리 맛보는 예외다.
 * 순수 함수라 React·Three 에 의존하지 않는다. 저장은 "이번 주 한정을 산 주의 월요일" 한 칸(선택 필드)이다.
 */

import { addDays, dayIndex } from './economy'
import { ITEM_LIST, ITEMS } from './items'
import { advancedAcorns, FINISHES } from './reform'
import { hashString, mulberry32 } from './rng'
import { weekdayOf } from './market'

/** 한정 진열이 열리는 상점 단계(큰 가게 이상) */
export const LIMITED_TIER = 2
/** 한정 값은 500 단위로 올린다 */
export const LIMITED_STEP = 500

/** 날짜가 속한 주의 월요일(YYYY-MM-DD). 잘못된 날짜면 null. */
export function weekStart(day: string): string | null {
  const wd = weekdayOf(day)
  if (wd === null) return null
  return addDays(day, -((wd + 6) % 7))
}

/** 값: 가구 정가 + 고급 마감 값(advancedAcorns, 백화점에서 직접 입히는 값)을 500 단위로 올린다. 직접 리폼보다 싸지 않게 한다. 가구가 아니거나 정가가 없으면 null. */
export function limitedPrice(itemId: string): number | null {
  const buy = ITEMS[itemId]?.buy
  const finish = advancedAcorns(itemId)
  if (buy === undefined || finish === null) return null
  return Math.ceil((buy + finish) / LIMITED_STEP) * LIMITED_STEP
}

/** 이번 주 한정 물건: 가구와 마감을 주의 월요일 시드로 고른다. 진열 기본 물건과 겹치면 다음 가구로 넘긴다. */
export function limitedFor(day: string, taken: readonly string[] = []): { itemId: string; variant: string; price: number } | null {
  const monday = weekStart(day)
  if (!monday) return null
  // 정가가 있는 가구만 고른다(상점에서 파는 가구). 퀘스트·행사 보상 가구는 빠진다.
  const furniture = ITEM_LIST.filter((i) => i.kind === 'furniture' && i.buy !== undefined).map((i) => i.id)
  if (furniture.length === 0 || FINISHES.length === 0) return null
  const rng = mulberry32(hashString(`limited:${monday}`))
  const start = Math.floor(rng() * furniture.length)
  const variant = FINISHES[Math.floor(rng() * FINISHES.length)].id
  for (let k = 0; k < furniture.length; k++) {
    const id = furniture[(start + k) % furniture.length]
    if (taken.includes(id)) continue
    const price = limitedPrice(id)
    if (price !== null) return { itemId: id, variant, price }
  }
  return null
}

/** 한정 칸 이름. 마감 이름의 첫 낱말을 앞에 붙인다. 예: 금박 나무 의자. 조사는 이 이름 끝 글자로 고르고, '주간 한정' 표시는 따로 붙인다. */
export function limitedName(itemId: string, variant: string): string {
  const finish = FINISHES.find((f) => f.id === variant)
  const word = finish ? finish.name.split(' ')[0] : ''
  return `${word} ${ITEMS[itemId].name}`
}

/** 진열대에 올릴 한정 칸. 상점 단계가 모자라거나 날짜가 틀리면 null. */
export function limitedEntry(tier: number, day: string, taken: readonly string[] = []) {
  if (tier < LIMITED_TIER || dayIndex(day) === null) return null
  const pick = limitedFor(day, taken)
  if (!pick) return null
  const item = ITEMS[pick.itemId]
  return { itemId: pick.itemId, name: limitedName(pick.itemId, pick.variant), icon: item.icon, price: pick.price, basePrice: pick.price, sale: false, flash: false, weekly: true, variant: pick.variant }
}

/** 이번 주에 한정 물건을 이미 샀는지. lastWeek 는 마지막으로 산 주의 월요일이다. */
export function weeklyBoughtOn(lastWeek: string | null | undefined, day: string): boolean {
  const monday = weekStart(day)
  return monday !== null && lastWeek === monday
}

/** 불러온 한정 구매 기록 검사. 월요일 날짜가 아니면 버린다. */
export function cleanWeeklyBuy(v: unknown): string | null {
  if (typeof v !== 'string' || dayIndex(v) === null || weekdayOf(v) !== 1) return null
  return v
}

import { ITEMS } from './items'
import type { ShopLog } from './shopEvents'
import { dailyStock, shopStock, type StockEntry } from './shopTiers'
import { weeklyBoughtOn } from './weeklyLimited'

/**
 * 계산대 앞 진열대 두 자리. 왼쪽이 0, 오른쪽이 1이다. 장면 배치와 E 판정이 같은 값을 쓴다.
 * 방 가운데(0, 0) 기준의 자리다.
 */
export const DISPLAY_SPOTS = [
  { x: -2.3, z: -0.3 },
  { x: 2.3, z: -0.3 },
] as const
/** 주간 한정 받침대 자리. 바닥 진열 두 자리와 떨어진 가게 앞 왼쪽이고, 가운데 통로는 비워 둔다. */
export const LIMITED_SPOT = { x: -2.3, z: 1.9 } as const
/** 진열대에서 E 가 닿는 거리(미터) */
export const DISPLAY_REACH = 1.2

/** 전시할 때 부피가 큰 가구를 먼저 고른다. 목록에 없는 가구는 뒤로 민다. */
const BULKY = ['wardrobe', 'bookshelf', 'workbench', 'boiler', 'storage-shelf', 'table', 'chair', 'drawer', 'iron-lamp', 'log-bench', 'stone-lantern', 'telescope', 'bonsai', 'stove', 'campfire', 'lamp']
const bulk = (id: string) => {
  const i = BULKY.indexOf(id)
  return i < 0 ? BULKY.length : i
}

/**
 * 오늘 진열대에 올릴 가구. 그날 진열(dailyStock)에서 가구만 고르고, 큰 것부터 자리 순서를 정한다.
 * 자리 수(DISPLAY_SPOTS)만큼만 본다. 자리 i 의 물건은 결과의 i 번째다.
 */
export function displayStock(tier: number, day: string): StockEntry[] {
  return dailyStock(tier, day)
    .filter((e) => ITEMS[e.itemId]?.kind === 'furniture')
    .sort((a, b) => bulk(a.itemId) - bulk(b.itemId))
    .slice(0, DISPLAY_SPOTS.length)
}

/**
 * 품절이 걸리는 물건인지. 한 점씩 진열하는 가구(바닥 진열 두 자리, 그날 진열 가구)와 옷처럼 하나뿐인 물건만 해당한다.
 * 사탕·씨앗·먹거리 같은 소모품은 몇 개든 살 수 있으니 해당하지 않는다. 옷은 아직 ITEMS 에 없어서 가구 분류로 본다.
 */
export function soldOutApplies(itemId: string): boolean {
  return ITEMS[itemId]?.kind === 'furniture'
}

/** 오늘 이 진열 물건을 이미 샀는지. 날이 바뀌면 산 기록은 없는 셈이다. */
export function isSoldToday(log: ShopLog, day: string, itemId: string): boolean {
  return log.stockDay === day && log.stockSold.includes(itemId)
}

/** 품절인지: 품절이 걸리는 물건이고, 오늘 이미 샀을 때만 참이다. 화면과 구매가 이 판정을 같이 쓴다. */
export function isSoldOut(log: ShopLog, day: string, itemId: string): boolean {
  return soldOutApplies(itemId) && isSoldToday(log, day, itemId)
}

/** 오늘 산 물건을 기록한 새 로그. 날이 바뀌었으면 어제 기록은 버린다. 같은 날 다시 와도 기록은 남는다. */
export function markSoldToday(log: ShopLog, day: string, itemId: string): ShopLog {
  const ids = log.stockDay === day ? log.stockSold : []
  return { ...log, stockDay: day, stockSold: ids.includes(itemId) ? ids : [...ids, itemId] }
}

/**
 * 주간 한정 받침대. 2단계 이상이면 한정 칸을 돌려주고, 이번 주에 이미 샀으면 bought 가 참이라 빈 받침대로 보인다.
 * entry 가 null 이면 받침대를 세우지 않는다(2단계 전).
 */
export function limitedShelf(tier: number, day: string, lastWeek: string | null | undefined): { entry: StockEntry | null; bought: boolean } {
  const entry = shopStock(tier, day).find((e) => e.weekly) ?? null
  return { entry, bought: entry !== null && weeklyBoughtOn(lastWeek, day) }
}

/** 점원이 이번 주 한정 물건을 소개할 때 쓸 물건 id. 이번 주에 이미 샀으면 null(소개하지 않는다). */
export function limitedPitch(tier: number, day: string, lastWeek: string | null | undefined): StockEntry | null {
  const r = limitedShelf(tier, day, lastWeek)
  return r.entry && !r.bought ? r.entry : null
}

/** 진열대에 떠 있는 안내 한 줄. 살 수 있으면 가격과 E 사기, 샀으면 품절이다. */
export function displayLabel(e: { name: string; price: number }, sold: boolean): string {
  return sold ? `${e.name} · 품절` : `${e.name} · 🌰 ${e.price.toLocaleString()} · E 사기`
}

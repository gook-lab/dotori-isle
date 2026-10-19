/**
 * 가구 주문. 한 번이라도 가져 본 가구(가구 도감에 오른 것)를 정가로 주문하면 다음 날 아침 우체통에 소포 편지로 온다.
 * 하루 주문은 다섯 개까지다. 이달의 가구·축제 보상 가구·한정품·울타리는 주문할 수 없다.
 * 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { isFence } from './fence'
import { LIMITED_ITEM } from './homeScore'
import { ITEMS } from './items'
import type { Letter } from './letters'
import { FESTIVALS } from './festivals'
import { monthlyFurniture } from './shopEvents'

/** 하루에 넣을 수 있는 주문 수 */
export const ORDER_DAILY_MAX = 5
/** 정가가 없는 가구의 주문가 배율(판매가 기준) */
export const ORDER_SELL_MULTIPLE = 4
/** 저장에 남기는 주문 목록의 상한. 정상 흐름에서는 하루 치만 쌓인다. */
export const ORDER_KEEP_MAX = 50

export interface CatalogOrder {
  itemId: string
  /** 주문한 날(YYYY-MM-DD). 다음 날 아침에 배달된다. */
  day: string
}

export interface OrderCtx {
  day: string
  money: number
  /** 가구 도감에 오른 가구 id */
  seen: readonly string[]
  orders: readonly CatalogOrder[]
}

export type OrderCheck = { ok: true; price: number } | { ok: false; reason: string; price?: number }

const FESTIVAL_REWARDS: readonly string[] = Object.values(FESTIVALS).map((f) => f.reward)

/** 주문가. 정가(buy)가 있으면 그대로, 없으면 판매가(price)의 네 배를 열 단위로 반올림한다. 값이 없으면 null. */
export function orderPrice(itemId: string): number | null {
  const item = ITEMS[itemId]
  if (!item) return null
  if (item.buy !== undefined) return item.buy
  return item.price > 0 ? Math.round((item.price * ORDER_SELL_MULTIPLE) / 10) * 10 : null
}

/** 주문할 수 있는지 본다. 이유는 화면에 그대로 보여 준다. 정가가 있으면 실패해도 price 를 같이 돌려준다. */
export function checkOrder(itemId: string, c: OrderCtx): OrderCheck {
  const item = ITEMS[itemId]
  if (!item || item.kind !== 'furniture' || isFence(itemId)) return { ok: false, reason: '울타리는 주문할 수 없어요' }
  const price = orderPrice(itemId)
  if (price === null) return { ok: false, reason: '정가가 없는 가구라 주문할 수 없어요' }
  if (!c.seen.includes(itemId)) return { ok: false, reason: '한 번 가져 본 가구만 주문할 수 있어요', price }
  if (monthlyFurniture(c.day)?.itemId === itemId) return { ok: false, reason: '이달의 가구는 주문할 수 없어요', price }
  if (FESTIVAL_REWARDS.includes(itemId)) return { ok: false, reason: '축제 전용 가구는 주문할 수 없어요', price }
  if (itemId === LIMITED_ITEM) return { ok: false, reason: '한정품은 주문할 수 없어요', price }
  if (c.orders.filter((o) => o.day === c.day).length >= ORDER_DAILY_MAX) {
    return { ok: false, reason: `오늘은 ${ORDER_DAILY_MAX}개까지만 주문할 수 있어요`, price }
  }
  if (c.money < price) return { ok: false, reason: '도토리가 모자라요', price }
  return { ok: true, price }
}

/** 소포 편지 한 통. 받기를 누르면 주머니로 들어간다(편지의 선물 칸을 그대로 쓴다). */
export function parcelLetter(day: string, o: CatalogOrder, n: number): Letter {
  const name = ITEMS[o.itemId]?.name ?? '가구'
  return {
    id: `parcel-${o.day}-${o.itemId}-${n}`,
    from: 'shop',
    fromName: '도토리 소포 배달',
    day,
    text: `${o.day} 에 주문하신 ${name} 소포가 도착했어요. 편지에서 받으면 주머니에 들어가요.`,
    gift: o.itemId,
    read: false,
    claimed: false,
  }
}

/** 하루 넘김 때 배달할 소포 편지들. 주문한 날보다 뒤인 날에만 보낸다. */
export function parcelLetters(day: string, orders: readonly CatalogOrder[]): Letter[] {
  return orders.filter((o) => o.day < day).map((o, n) => parcelLetter(day, o, n))
}

/** 저장에서 읽은 주문 목록을 검증한다. 가구가 아니거나 날짜가 깨진 항목은 버린다. */
export function sanitizeOrders(raw: unknown): CatalogOrder[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((x): CatalogOrder[] => {
      if (!x || typeof x !== 'object') return []
      const o = x as Record<string, unknown>
      const ok = typeof o.itemId === 'string' && ITEMS[o.itemId]?.kind === 'furniture' && typeof o.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.day)
      return ok ? [{ itemId: o.itemId as string, day: o.day as string }] : []
    })
    .slice(0, ORDER_KEEP_MAX)
}

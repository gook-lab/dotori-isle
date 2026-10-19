/**
 * 상점 이벤트와 주인의 기억. 순수 함수라 React·Three 에 의존하지 않는다.
 * - 반짝 할인: 금요일마다 진열 하나를 절반 값에 판다(shopTiers.dailyStock 이 쓴다).
 * - 이달의 가구: 매달 정해진 가구 한 점을 그 달 동안 한 번 살 수 있다.
 * - 주인 인사: 단계마다 다른 말을 하고, 많이 팔아 준 품목을 기억해 한마디 덧붙인다.
 */

import type { ShopTier } from './shopTiers'
import { ITEMS } from './items'
import { weekdayOf } from './market'
import { dayIndex } from './economy'
import { hashString } from './rng'

/** 반짝 할인이 열리는 요일(금요일, 0 = 일요일) */
export const FLASH_WEEKDAY = 5
/** 반짝 할인 값. 정가의 절반이다. */
export const FLASH_RATE = 0.5

export const isFlashDay = (day: string): boolean => weekdayOf(day) === FLASH_WEEKDAY

/** 반짝 할인이 걸리는 진열 칸. 날짜로 정해져서 새로고침해도 같다. */
export const flashIndex = (day: string, n: number): number => (n > 0 ? hashString(`flash:${day}`) % n : -1)

/** 이달의 가구 후보. 가구 종류 가운데 상점에서 파는 것만 든다. */
export const MONTHLY_POOL: readonly string[] = ['flowerpot', 'chair', 'mailbox', 'table', 'lamp', 'campfire', 'stove']

/** 날짜의 달 키(YYYY-MM). 잘못된 날짜면 null. */
export function monthKey(day: string): string | null {
  return dayIndex(day) === null ? null : day.slice(0, 7)
}

export interface MonthlyFurniture {
  itemId: string
  name: string
  icon: string
  price: number
}

/** 그 달의 이달의 가구. 정가로 판다. */
export function monthlyFurniture(day: string): MonthlyFurniture | null {
  const key = monthKey(day)
  if (!key) return null
  const itemId = MONTHLY_POOL[hashString(`monthly:${key}`) % MONTHLY_POOL.length]
  const item = ITEMS[itemId]
  if (!item || item.buy === undefined) return null
  return { itemId, name: item.name, icon: item.icon, price: item.buy }
}

/** 저장하는 상점 기록: 주인에게 판 품목별 개수와, 이달의 가구를 산 달 */
export interface ShopLog {
  sold: Record<string, number>
  /** 이달의 가구를 산 달(YYYY-MM). 없으면 아직 안 샀다. */
  monthly: string | null
  /** 진열을 산 날(YYYY-MM-DD)과 그날 팔린 진열 물건 id. 날이 바뀌면 빈 목록으로 본다. */
  stockDay: string | null
  stockSold: string[]
}

export const NEW_SHOP_LOG: ShopLog = { sold: {}, monthly: null, stockDay: null, stockSold: [] }

export function sanitizeShopLog(raw: unknown): ShopLog {
  if (!raw || typeof raw !== 'object') return NEW_SHOP_LOG
  const p = raw as Partial<ShopLog>
  const sold: Record<string, number> = {}
  if (p.sold && typeof p.sold === 'object') {
    for (const [id, n] of Object.entries(p.sold)) {
      if (ITEMS[id] && typeof n === 'number' && Number.isFinite(n) && n > 0) sold[id] = Math.floor(n)
    }
  }
  const monthly = typeof p.monthly === 'string' && /^\d{4}-\d{2}$/.test(p.monthly) ? p.monthly : null
  const stockDay = typeof p.stockDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.stockDay) ? p.stockDay : null
  const stockSold = Array.isArray(p.stockSold) ? [...new Set(p.stockSold.filter((id): id is string => typeof id === 'string' && !!ITEMS[id]))] : []
  return { sold, monthly, stockDay, stockSold }
}

/** 이달의 가구를 이번 달에 이미 샀는지 */
export const monthlyBoughtOn = (log: ShopLog, day: string): boolean => log.monthly !== null && log.monthly === monthKey(day)

/** 가장 많이 판 품목. 같은 개수면 id 순서로 고른다. 판 게 없으면 null. */
export function topSold(sold: Readonly<Record<string, number>>): { itemId: string; count: number } | null {
  let best: { itemId: string; count: number } | null = null
  for (const [itemId, count] of Object.entries(sold)) {
    if (count <= 0) continue
    if (!best || count > best.count || (count === best.count && itemId < best.itemId)) best = { itemId, count }
  }
  return best
}

/** 단계마다 다른 인사말. 날짜로 한 줄을 고른다. */
const GREETINGS: Record<ShopTier, readonly string[]> = {
  0: ['어서 와요! 노점이지만 정성은 가득해요.', '비가 와도 노점은 문을 열어요. 천천히 보고 가요.', '오늘도 와 줘서 고마워요!'],
  1: ['어서 오세요, 가게에 오신 걸 환영해요!', '진열장을 새로 짰어요. 구경해 보세요.', '단골이 늘어서 기분이 좋아요.'],
  2: ['큰 가게에 잘 오셨어요. 구경할 게 많죠?', '가구 진열을 가득 채웠어요. 마음에 드는 게 있을 거예요.', '큰 가게는 늘 손님으로 북적여요!'],
  3: ['도토리 백화점에 오신 걸 환영해요! 2층도 둘러봐요.', '층마다 가구와 잡화가 가득해요.', '백화점은 오늘도 활기차요. 천천히 골라 보세요.'],
}

/** 주인의 인사 한 줄과, 많이 팔아 준 품목을 기억해 붙이는 한마디(없으면 null) */
export function shopkeeperLines(tier: ShopTier, day: string, sold: Readonly<Record<string, number>>): { name: string; greeting: string; memory: string | null } {
  const list = GREETINGS[tier]
  const pick = dayIndex(day) === null ? 0 : hashString(`greet:${day}`) % list.length
  // 도토리 상점 점원은 가람과 나루 둘이다. 날마다 번갈아 말한다.
  const name = dayIndex(day) === null ? '가람' : (dayIndex(day) ?? 0) % 2 ? '나루' : '가람'
  const top = topSold(sold)
  const memory = top && ITEMS[top.itemId] ? `${ITEMS[top.itemId].icon} ${ITEMS[top.itemId].name}, ${top.count}개나 팔아 주셨죠? 오늘도 진열해 뒀어요.` : null
  return { name, greeting: list[pick], memory }
}

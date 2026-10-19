/**
 * 요일 장터. 토요일마다 떠돌이 상인이 광장에 가판대를 펴고, 다음 날 아침이 되면 접고 떠난다.
 *
 * 가판대는 세 가지를 판다.
 * - 희귀 가구: 날짜로 세 점을 골라 펴고, 한 번 방문할 때 점마다 한 개씩만 살 수 있다.
 * - 씨앗 꾸러미: 꽃씨 다섯 개를 한 묶음으로 판다. 방문마다 한 묶음.
 * - 오늘만 주머니: 무엇이 들었는지 열기 전엔 모른다. 방문마다 하나.
 * 자리는 주변에서 평평하고 걸을 수 있는 첫 칸이다(날짜와 무관하게 늘 같다).
 */

import { canWalk } from './scenery'
import { flatWithin } from './tiers'
import { byWater, isWalkable } from './island'
import { blockedByProps, SPAWN } from './world'
import { HOME_SITE } from './home'
import { HOUSE_R } from './villagers'
import { dayIndex } from './economy'
import { hashString, mulberry32 } from './rng'

export const MARKET_WEEKDAY = 6 // 토요일 (0 = 일요일)

/** 날짜 키의 요일(0 = 일요일). 날짜가 아니면 null. */
export function weekdayOf(key: string): number | null {
  if (dayIndex(key) === null) return null
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export const isMarketDay = (key: string): boolean => weekdayOf(key) === MARKET_WEEKDAY

/** 다음 날이 장날인지. 주민이 전날 미리 알려 줄 때 쓴다. */
export function marketTomorrow(key: string): boolean {
  if (dayIndex(key) === null) return false
  const [y, m, d] = key.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.getUTCDay() === MARKET_WEEKDAY
}

/** 희귀 가구 후보와 값. 기존 가구 모델을 쓰고 상점에 없는 것만 골랐다. */
export const MARKET_RARE: Record<string, number> = {
  snowman: 420,
  telescope: 520,
  'stone-lantern': 480,
  'log-bench': 360,
  'iron-lamp': 680,
  'gold-acorn': 1600,
}

export const SEED_BUNDLE = { count: 5, price: 60 }
export const MYSTERY_PRICE = 200

/** 오늘만 주머니에 든 것. 가중치로 고른다. */
const MYSTERY_POOL: { itemId: string; count: number; weight: number }[] = [
  { itemId: 'flower-seed', count: 3, weight: 30 },
  { itemId: 'wood', count: 6, weight: 25 },
  { itemId: 'stone', count: 6, weight: 20 },
  { itemId: 'iron', count: 2, weight: 12 },
  { itemId: 'gold', count: 1, weight: 4 },
  { itemId: 'fossil', count: 1, weight: 2 },
  { itemId: 'acorn-pouch', count: 1, weight: 4 },
]

export interface MarketStock {
  rare: { itemId: string; price: number }[]
  seed: { count: number; price: number }
  mystery: { price: number }
}

/** 장날의 진열. 날짜로 희귀 가구 세 점을 고르므로 같은 날이면 늘 같다. */
export function marketStock(key: string): MarketStock {
  const rng = mulberry32(hashString(`market:${key}`))
  const pool = Object.keys(MARKET_RARE)
  const picked: string[] = []
  const left = [...pool]
  while (picked.length < 3 && left.length) picked.push(left.splice(Math.floor(rng() * left.length), 1)[0])
  return {
    rare: picked.map((itemId) => ({ itemId, price: MARKET_RARE[itemId] })),
    seed: SEED_BUNDLE,
    mystery: { price: MYSTERY_PRICE },
  }
}

/** 오늘만 주머니를 열었을 때 나오는 것. rng 를 받아 테스트할 수 있다. */
export function mysteryPick(rng: () => number = Math.random): { itemId: string; count: number } {
  const total = MYSTERY_POOL.reduce((n, x) => n + x.weight, 0)
  let r = rng() * total
  for (const x of MYSTERY_POOL) {
    r -= x.weight
    if (r < 0) return { itemId: x.itemId, count: x.count }
  }
  const last = MYSTERY_POOL[MYSTERY_POOL.length - 1]
  return { itemId: last.itemId, count: last.count }
}

/** 방문마다 한 번씩만 사는 물건의 표식. 날짜와 물건으로 묶는다. */
export const visitKey = (key: string, itemId: string) => `${key}:${itemId}`

/** 이번 장날에 이 물건을 이미 샀는지 */
export const boughtThisVisit = (bought: readonly string[], key: string, itemId: string): boolean => bought.includes(visitKey(key, itemId))

/**
 * 가판대 자리. 중심에서 점점 먼 고리를 돌며, 평평하고 걸을 수 있고 물과 물건에서 떨어진 첫 칸을 고른다.
 * 판정은 `ok` 로 받아서 테스트할 때 따로 검증할 수 있다.
 */
export function pickMarketSite(ok: (x: number, z: number) => boolean, center: { x: number; z: number } = SPAWN, radii: readonly number[] = [6, 7, 8, 9, 10, 11]): { x: number; z: number } | null {
  for (const r of radii) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const x = center.x + Math.cos(a) * r
      const z = center.z + Math.sin(a) * r
      if (ok(x, z)) return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }
    }
  }
  return null
}

/** 가판대 반지름. 집터와의 간격 계산에 쓴다. */
const MARKET_HALF = 2

/** 실제 섬에서 가판대를 세울 자리. 평평하고 걸을 수 있고 물·물건·집터와 떨어져 있어야 한다. 집터는 이 파일보다 먼저 정해진다. */
export const marketSiteOnIsland = (): { x: number; z: number } | null =>
  pickMarketSite((x, z) => flatWithin(x, z, 1.4) && isWalkable(x, z) && canWalk(x, z) && !blockedByProps(x, z, 1.4) && !byWater(x, z, 1.6) && (!HOME_SITE || Math.hypot(x - HOME_SITE.x, z - HOME_SITE.z) > HOUSE_R + MARKET_HALF + 0.8))

/** 섬에서 정해진 장터 자리. 한 번만 고른다. 자리가 없으면 null(장터가 서지 않는다). */
export const MARKET_SITE = marketSiteOnIsland()

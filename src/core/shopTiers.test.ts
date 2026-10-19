import { CANDY_ID, CANDY_PRICE } from './pumpkin'
import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { isMarketDay, MARKET_RARE, marketStock } from './market'
import { RECIPES } from './recipes'
import {
  dailyStock,
  lookFor,
  NEW_SHOP,
  SHOP_TIERS,
  shopTierFor,
  settleUpgrade,
  startUpgrade,
  unlockChecks,
  upgradeState,
  type ShopStats,
  type ShopState,
} from './shopTiers'

const none: ShopStats = { sold: 0, spent: 0, questsDone: [] }
const tier1Ready: ShopStats = { sold: 1000, spent: 0, questsDone: ['materials'] }
const tier2Ready: ShopStats = { sold: 10000, spent: 1500, questsDone: ['materials', 'newcomer-guriguri'] }
const DAY = '2026-10-18'

describe('상점 단계 — 조건', () => {
  it('처음에는 노점이고 조건이 없다', () => {
    expect(NEW_SHOP).toEqual({ tier: 0, order: null })
    expect(shopTierFor(none)).toBe(0)
    expect(unlockChecks(0, none)).toEqual([])
  })

  it('팔기만 채워도 퀘스트가 없으면 가게가 안 된다', () => {
    expect(shopTierFor({ sold: 1000, spent: 0, questsDone: [] })).toBe(0)
    expect(shopTierFor(tier1Ready)).toBe(1)
  })

  it('큰 가게는 팔기·쓰기·퀘스트 셋을 모두 채워야 한다', () => {
    expect(shopTierFor({ sold: 10000, spent: 1499, questsDone: ['materials', 'newcomer-guriguri'] })).toBe(1)
    expect(shopTierFor({ sold: 9999, spent: 1500, questsDone: ['materials', 'newcomer-guriguri'] })).toBe(1)
    expect(shopTierFor({ sold: 10000, spent: 1500, questsDone: ['materials'] })).toBe(1)
    expect(shopTierFor(tier2Ready)).toBe(2)
  })

  it('조건 확인 목록은 부족한 양을 have/need 로 보여 준다', () => {
    const checks = unlockChecks(1, { sold: 400, spent: 0, questsDone: [] })
    const sold = checks.find((c) => c.label.includes('팔기'))!
    expect(sold).toMatchObject({ have: 400, need: 1000, done: false })
    expect(checks.find((c) => c.label.includes('퀘스트'))!.done).toBe(false)
  })
})

describe('상점 단계 — 올리기와 공사', () => {
  it('조건과 돈이 있으면 공사를 맡기고 문은 아직 연 채로 둔다', () => {
    const r = startUpgrade(NEW_SHOP, tier1Ready, 1500, DAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.to).toBe(1)
    expect(r.cost).toBe(1500)
    expect(r.state).toEqual({ tier: 0, order: { to: 1, day: DAY } })
    expect(upgradeState(r.state, DAY)).toEqual({ status: 'open', tier: 0 })
  })

  it('다음 날은 문을 닫고, 그다음 날 새 단계로 다시 연다', () => {
    const order: ShopState = { tier: 0, order: { to: 1, day: DAY } }
    expect(upgradeState(order, '2026-10-19')).toEqual({ status: 'closed', tier: 0, to: 1, reopenDay: '2026-10-20' })
    expect(upgradeState(order, '2026-10-20')).toEqual({ status: 'open', tier: 1 })
    expect(settleUpgrade(order, '2026-10-19')).toBe(order)
    expect(settleUpgrade(order, '2026-10-20')).toEqual({ tier: 1, order: null })
  })

  it('공사 중에는 또 맡길 수 없다', () => {
    const r = startUpgrade({ tier: 0, order: { to: 1, day: DAY } }, tier1Ready, 99999, '2026-10-19')
    expect(r.ok).toBe(false)
  })

  it('조건이 모자라면 부족한 항목 이름을 사유에 담는다', () => {
    const r = startUpgrade(NEW_SHOP, { sold: 1000, spent: 0, questsDone: [] }, 9999, DAY)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toContain('아직 조건이 안 돼요')
    expect(r.reason).toContain('메인 퀘스트')
  })

  it('도토리가 모자라면 실패하고 상태를 바꾸지 않는다', () => {
    const r = startUpgrade(NEW_SHOP, tier1Ready, 1499, DAY)
    expect(r).toEqual({ ok: false, reason: '도토리가 모자라요' })
  })

  it('큰 가게에서는 더 올릴 수 없고, 잘못된 날짜는 거절한다', () => {
    expect(startUpgrade({ tier: 2, order: null }, tier2Ready, 99999, DAY).ok).toBe(false)
    expect(startUpgrade(NEW_SHOP, tier1Ready, 99999, 'bad-day').ok).toBe(false)
  })

  it('단계 2까지 한 번에 건너뛰지 못한다', () => {
    const r = startUpgrade(NEW_SHOP, tier2Ready, 99999, DAY)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.to).toBe(1)
  })
})

describe('상점 진열 — 날짜로 정해지는 매일 고르기', () => {
  it('같은 날·같은 단계면 늘 같은 진열이다', () => {
    expect(dailyStock(1, DAY)).toEqual(dailyStock(1, DAY))
  })

  it('진열 수는 단계별 stockSize 이고, 후보 안에서만 고른다', () => {
    for (const t of [0, 1, 2] as const) {
      const def = SHOP_TIERS[t]
      for (let d = 1; d <= 30; d++) {
        const day = `2026-10-${String(d).padStart(2, '0')}`
        // 행사 주간(10/25~)에는 사탕이 한 칸 더 있다. 그 칸은 따로 본다.
        const stock = dailyStock(t, day).filter((s) => s.itemId !== CANDY_ID)
        expect(stock).toHaveLength(def.stockSize)
        expect(new Set(stock.map((s) => s.itemId)).size).toBe(stock.length)
        for (const s of stock) expect(def.pool).toContain(s.itemId)
      }
    }
  })

  it('하루에 특가는 한 개이고, 특가 가격은 정가보다 낮고 10 단위다', () => {
    for (let d = 1; d <= 30; d++) {
      const day = `2026-10-${String(d).padStart(2, '0')}`
      const stock = dailyStock(2, day)
      const sales = stock.filter((s) => s.sale)
      expect(sales).toHaveLength(1)
      expect(sales[0].price).toBeLessThan(sales[0].basePrice)
      expect(sales[0].price % 10).toBe(0)
    }
  })

  it('날마다 진열이 바뀌어 한 달 안에 여러 구성이 나온다', () => {
    const sets = new Set<string>()
    for (let d = 1; d <= 30; d++) {
      const day = `2026-10-${String(d).padStart(2, '0')}`
      sets.add(dailyStock(1, day).map((s) => s.itemId).sort().join(','))
    }
    expect(sets.size).toBeGreaterThan(3)
  })

  it('가격은 items.ts 의 buy 값을 그대로 쓴다', () => {
    const stock = dailyStock(2, DAY)
    for (const s of stock) {
      expect(s.basePrice).toBe(ITEMS[s.itemId].buy)
      expect(s.name).toBe(ITEMS[s.itemId].name)
    }
  })

  it('모든 후보는 buy 가격이 있는 물건이다', () => {
    for (const def of SHOP_TIERS) for (const id of def.pool) expect(ITEMS[id]?.buy).toBeGreaterThan(0)
  })

  it('잘못된 단계나 날짜면 빈 진열이다', () => {
    expect(dailyStock(4, DAY)).toEqual([])
    expect(dailyStock(-1, DAY)).toEqual([])
    expect(dailyStock(1, '2026-02-30')).toEqual([])
  })

  it('단계마다 건물 모양과 간판이 다르다', () => {
    const signs = new Set([0, 1, 2].map((t) => lookFor(t as 0 | 1 | 2).sign))
    expect(signs.size).toBe(3)
    expect(lookFor(2).w).toBeGreaterThan(lookFor(0).w)
  })
})

describe('철광석 — 상점 공급', () => {
  it('가게와 큰 가게 진열 후보에 철광석이 있고, 상점 가격은 판매가의 3배다', () => {
    expect(SHOP_TIERS[1].pool).toContain('iron')
    expect(SHOP_TIERS[2].pool).toContain('iron')
    expect(ITEMS.iron.buy).toBe(ITEMS.iron.price * 3)
  })

  it('가게 단계면 한 달 안에 철광석이 진열에 한 번은 오른다', () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
    expect(days.some((d) => dailyStock(1, d).some((s) => s.itemId === 'iron'))).toBe(true)
  })
})

describe('호박 등불 행사 주간 사탕', () => {
  it('사탕은 10월 25일부터 31일까지 문 연 도토리 상점에서만 판다', () => {
    expect(dailyStock(0, '2026-10-24').some((s) => s.itemId === CANDY_ID)).toBe(false)
    expect(dailyStock(0, '2026-10-25').some((s) => s.itemId === CANDY_ID)).toBe(true)
    expect(dailyStock(3, '2026-10-31').find((s) => s.itemId === CANDY_ID)?.price).toBe(CANDY_PRICE)
  })
})

describe('가구 살 길 — 상점 진열·장터·DIY 로 한 번은 손에 넣을 수 있다', () => {
  // 2026-10-19 부터 1년치 날짜 키
  const YEAR = Array.from({ length: 365 }, (_, i) => new Date(Date.UTC(2026, 9, 19 + i)).toISOString().slice(0, 10))
  const furniture = Object.values(ITEMS).filter((d) => d.kind === 'furniture')
  // 1년 동안 단계별 진열에 한 번이라도 오른 물건
  const shopSeen = new Set<string>()
  for (const t of SHOP_TIERS) for (const day of YEAR) for (const s of dailyStock(t.tier, day)) shopSeen.add(s.itemId)
  // 장날(토요일)마다 희귀 가구 세 점이 오른다
  const marketSeen = new Set<string>()
  for (const day of YEAR) if (isMarketDay(day)) for (const r of marketStock(day).rare) marketSeen.add(r.itemId)

  it('정가가 있는 가구는 1년 안에 상점 진열에 한 번은 오른다', () => {
    for (const d of furniture.filter((x) => x.buy !== undefined)) expect(shopSeen.has(d.id), d.id).toBe(true)
  })

  it('정가가 없는 유료 가구는 장터 희귀 목록이거나 DIY 레시피다', () => {
    for (const d of furniture.filter((x) => x.buy === undefined && x.price > 0)) {
      const viaMarket = d.id in MARKET_RARE
      const viaDiy = RECIPES.some((r) => r.id === d.id)
      expect(viaMarket || viaDiy, d.id).toBe(true)
    }
  })

  it('장터 희귀 가구는 1년 안의 장날에 한 번은 오른다', () => {
    for (const id of Object.keys(MARKET_RARE)) expect(marketSeen.has(id), id).toBe(true)
  })

  it('벽에 거는 가구 중 정가가 있는 것(벽시계·작은 벽 선반)은 상점 진열에 오른다', () => {
    for (const id of ['wall-clock', 'wall-shelf']) {
      expect(ITEMS[id]?.buy).toBeGreaterThan(0)
      expect(shopSeen.has(id), id).toBe(true)
    }
  })

  it('서재·지하 작업실 세트는 큰 가게 이상의 진열 풀에 든다', () => {
    const studyAndWorkshop = ['bookshelf', 'reading-chair', 'floor-lamp', 'globe', 'workbench', 'tool-rack', 'storage-shelf', 'boiler']
    for (const id of studyAndWorkshop) {
      expect(SHOP_TIERS[2].pool.includes(id) || SHOP_TIERS[3].pool.includes(id), id).toBe(true)
      expect(shopSeen.has(id), id).toBe(true)
    }
  })
})

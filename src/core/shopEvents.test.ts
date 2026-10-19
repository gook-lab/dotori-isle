import { describe, expect, it } from 'vitest'
import { dailyStock, startUpgrade, shopTierFor, NEW_SHOP, SHOP_TIERS, type ShopStats } from './shopTiers'
import { FLASH_RATE, flashIndex, isFlashDay, monthKey, monthlyBoughtOn, monthlyFurniture, MONTHLY_POOL, NEW_SHOP_LOG, sanitizeShopLog, shopkeeperLines, topSold } from './shopEvents'
import { ITEMS } from './items'

const FRI = '2026-10-23'
const THU = '2026-10-22'

const rich: ShopStats = { sold: 30000, spent: 6000, questsDone: ['newcomer-guriguri'], stars: 3 }

describe('도토리 백화점 단계', () => {
  it('누적 판매·구매와 섬 별점 3★ 을 다 채워야 열린다', () => {
    expect(shopTierFor(rich)).toBe(3)
    expect(shopTierFor({ ...rich, stars: 2 })).toBe(2)
    expect(shopTierFor({ ...rich, sold: 29999 })).toBe(2)
    expect(shopTierFor({ ...rich, spent: 5000 })).toBe(2)
  })

  it('올리기는 공사를 맡기고 금액을 요구한다', () => {
    const r = startUpgrade({ tier: 2, order: null }, rich, 15000, THU)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.cost).toBe(15000)
    const poor = startUpgrade({ tier: 2, order: null }, rich, 14999, THU)
    expect(poor.ok).toBe(false)
    const lowStar = startUpgrade({ tier: 2, order: null }, { ...rich, stars: 2 }, 99999, THU)
    expect(lowStar.ok).toBe(false)
    expect(startUpgrade({ tier: 3, order: null }, rich, 99999, THU).ok).toBe(false)
  })

  it('백화점은 큰 가게의 진열을 두 배로 늘리고 2층 건물이다', () => {
    expect(SHOP_TIERS[3].stockSize).toBe(SHOP_TIERS[2].stockSize * 2)
    expect(SHOP_TIERS[3].look.floors).toBe(2)
    expect(SHOP_TIERS[3].look.h).toBeGreaterThan(SHOP_TIERS[2].look.h)
    expect(dailyStock(3, THU)).toHaveLength(10)
    expect(NEW_SHOP.tier).toBe(0)
  })
})

describe('금요일 반짝 할인', () => {
  it('금요일만 열리고, 진열 하나를 정가의 절반으로 판다', () => {
    expect(isFlashDay(FRI)).toBe(true)
    expect(isFlashDay(THU)).toBe(false)
    const flash = dailyStock(3, FRI).filter((e) => e.flash)
    expect(flash).toHaveLength(1)
    expect(flash[0].price).toBe(Math.round((flash[0].basePrice * FLASH_RATE) / 10) * 10)
    expect(flash[0].sale).toBe(true)
  })

  it('금요일 칸은 날짜로 정해지고, 평일에는 반짝 칸이 없다', () => {
    expect(flashIndex(FRI, 10)).toBe(flashIndex(FRI, 10))
    expect(dailyStock(3, THU).some((e) => e.flash)).toBe(false)
  })
})

describe('이달의 가구', () => {
  it('같은 달이면 같은 가구이고, 가구 종류만 나온다', () => {
    const a = monthlyFurniture('2026-10-01')
    const b = monthlyFurniture('2026-10-28')
    expect(a).toEqual(b)
    expect(MONTHLY_POOL).toContain(a!.itemId)
    expect(ITEMS[a!.itemId].kind).toBe('furniture')
    expect(a!.price).toBe(ITEMS[a!.itemId].buy)
  })

  it('한 달에 한 번만 살 수 있다', () => {
    expect(monthKey('2026-10-19')).toBe('2026-10')
    expect(monthKey('2026-02-30')).toBeNull()
    const log = { ...NEW_SHOP_LOG, monthly: '2026-10' }
    expect(monthlyBoughtOn(log, '2026-10-30')).toBe(true)
    expect(monthlyBoughtOn(log, '2026-11-01')).toBe(false)
    expect(monthlyBoughtOn(NEW_SHOP_LOG, '2026-10-30')).toBe(false)
  })
})

describe('주인의 기억', () => {
  it('가장 많이 판 품목을 고르고, 같은 개수면 id 순서로 고른다', () => {
    expect(topSold({})).toBeNull()
    expect(topSold({ chair: 3, lamp: 5 })).toEqual({ itemId: 'lamp', count: 5 })
    expect(topSold({ lamp: 2, chair: 2 })).toEqual({ itemId: 'chair', count: 2 })
  })

  it('단계마다 다른 인사를 하고, 판 품목이 있으면 한마디를 덧붙인다', () => {
    const g0 = shopkeeperLines(0, THU, {})
    const g3 = shopkeeperLines(3, THU, {})
    expect(g0.greeting).not.toBe(g3.greeting)
    expect(g3.greeting).toContain('백화점')
    expect(g0.memory).toBeNull()
    const mem = shopkeeperLines(2, THU, { chair: 4 })
    expect(mem.memory).toContain('나무 의자')
    expect(mem.memory).toContain('4개')
  })

  it('저장된 기록은 잘못된 값을 걸러낸다', () => {
    expect(sanitizeShopLog(undefined)).toEqual(NEW_SHOP_LOG)
    expect(sanitizeShopLog({ sold: { chair: 3, nope: 2, lamp: -1 }, monthly: '2026-10' })).toEqual({ sold: { chair: 3 }, monthly: '2026-10', stockDay: null, stockSold: [] })
    expect(sanitizeShopLog({ monthly: 'bad' }).monthly).toBeNull()
  })
})

describe('점원 이름', () => {
  it('점원은 가람이나 나루 둘 중 하나이고, 날마다 번갈아 말한다', () => {
    const names = new Set<string>()
    for (let d = 1; d <= 6; d++) names.add(shopkeeperLines(0, `2026-10-${String(d).padStart(2, '0')}`, {}).name)
    expect([...names].sort()).toEqual(['가람', '나루'])
  })
})

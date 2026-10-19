import { describe, expect, it } from 'vitest'
import { ITEM_LIST, ITEMS } from './items'
import { advancedAcorns, FINISHES } from './reform'
import { slotValue } from './inventory'
import { shopStock } from './shopTiers'
import { cleanWeeklyBuy, LIMITED_STEP, LIMITED_TIER, limitedEntry, limitedFor, limitedName, limitedPrice, weekStart, weeklyBoughtOn } from './weeklyLimited'

// 2026-10-19 는 월요일이다.
const MON = '2026-10-19'
const FURNITURE = ITEM_LIST.filter((i) => i.kind === 'furniture' && i.buy !== undefined).map((i) => i.id)

describe('주간 한정 진열 — 주 시작과 물건', () => {
  it('날짜가 속한 주의 월요일을 돌려준다(일요일은 그 전 월요일)', () => {
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(weekStart('2026-10-25')).toBe('2026-10-19')
    expect(weekStart('2026-10-26')).toBe('2026-10-26')
    expect(weekStart('nope')).toBeNull()
  })

  it('같은 주 안에서는 물건과 마감이 같고, 다음 주에는 바뀔 수 있다', () => {
    const a = limitedFor('2026-10-19')
    expect(limitedFor('2026-10-25')).toEqual(a)
    expect(a).not.toBeNull()
    expect(ITEMS[a!.itemId].kind).toBe('furniture')
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 9, 19 + i * 7)).toISOString().slice(0, 10)
      const pick = limitedFor(d)!
      seen.add(`${pick.itemId}/${pick.variant}`)
    }
    expect(seen.size).toBeGreaterThan(5)
  })

  it('진열 기본 물건과 겹치면 다른 가구로 넘긴다', () => {
    const first = limitedFor(MON)!
    const next = limitedFor(MON, [first.itemId])!
    expect(next.itemId).not.toBe(first.itemId)
  })
})

describe('주간 한정 진열 — 미리 입힌 마감과 값', () => {
  it('마감은 금박이나 반짝이 둘 중 하나다', () => {
    const finishes = new Set(FINISHES.map((f) => f.id))
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 9, 19 + i * 7)).toISOString().slice(0, 10)
      expect(finishes.has(limitedFor(d)!.variant)).toBe(true)
    }
  })

  it('값은 가구 정가 + 고급 마감 값을 500 단위로 올린 값이다(의자 예: 200 + 1,500 → 2,000)', () => {
    expect(limitedPrice('chair')).toBe(2000)
    expect(limitedPrice('chair')).toBe(Math.ceil((ITEMS.chair.buy! + advancedAcorns('chair')!) / LIMITED_STEP) * LIMITED_STEP)
    for (const id of FURNITURE) {
      const p = limitedPrice(id)!
      expect(p % LIMITED_STEP).toBe(0)
      expect(p).toBeGreaterThan(ITEMS[id].buy!)
    }
  })

  it('한정판 값은 백화점에서 직접 입히는 값(정가 + 고급 마감)보다 싸지 않다', () => {
    for (const id of FURNITURE) {
      expect(limitedPrice(id)!).toBeGreaterThanOrEqual(ITEMS[id].buy! + advancedAcorns(id)!)
    }
  })

  it('이름은 마감 낱말을 앞에 붙이고, 끝은 가구 이름으로 끝나서 조사가 맞는다', () => {
    expect(limitedName('chair', 'gold')).toBe('금박 나무 의자')
    expect(limitedName('chair', 'glitter')).toBe('반짝이 나무 의자')
  })

  it('되팔 값은 기본 가구 값이라 산 값보다 크지 않다(모든 가구·마감 조합)', () => {
    for (const id of FURNITURE) {
      for (const f of FINISHES) {
        const sell = slotValue({ id, count: 1, variant: f.id })
        expect(sell).toBeLessThanOrEqual(limitedPrice(id)!)
        expect(sell).toBeLessThanOrEqual(ITEMS[id].buy!)
      }
    }
  })
})

describe('주간 한정 진열 — 칸과 진열대', () => {
  it('상점 2단계 미만에는 칸이 없다', () => {
    expect(limitedEntry(LIMITED_TIER - 1, MON)).toBeNull()
    expect(limitedEntry(LIMITED_TIER, MON)).toMatchObject({ weekly: true, sale: false, flash: false })
  })

  it('한정 칸에는 마감이 붙어 있고, 진열대 맨 끝에 한 칸 더 붙는다', () => {
    const stock = shopStock(LIMITED_TIER, MON)
    const weekly = stock.filter((e) => e.weekly)
    expect(weekly).toHaveLength(1)
    expect(weekly[0].variant).toBe(limitedFor(MON)!.variant)
    expect(stock[stock.length - 1]).toBe(weekly[0])
    expect(shopStock(LIMITED_TIER - 1, MON).some((e) => e.weekly)).toBe(false)
  })

  it('한정 칸은 같은 주 안에서 진열대에 계속 있다', () => {
    const a = shopStock(3, '2026-10-19').find((e) => e.weekly)
    const b = shopStock(3, '2026-10-24').find((e) => e.weekly)
    expect(b).toEqual(a)
  })
})

describe('주간 한정 진열 — 한 주에 한 번 사기', () => {
  it('같은 주에 한 번 샀으면 이번 주는 막히고, 다음 월요일에는 풀린다', () => {
    expect(weeklyBoughtOn(MON, '2026-10-22')).toBe(true)
    expect(weeklyBoughtOn(MON, '2026-10-26')).toBe(false)
    expect(weeklyBoughtOn('2026-10-26', '2026-10-26')).toBe(true)
    expect(weeklyBoughtOn(null, '2026-10-26')).toBe(false)
  })

  it('저장된 구매 기록은 월요일 날짜만 받는다', () => {
    expect(cleanWeeklyBuy('2026-10-19')).toBe('2026-10-19')
    expect(cleanWeeklyBuy('2026-10-20')).toBeNull()
    expect(cleanWeeklyBuy('nope')).toBeNull()
    expect(cleanWeeklyBuy(undefined)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { NEW_SHOP_LOG, sanitizeShopLog } from './shopEvents'
import { DISPLAY_SPOTS, displayLabel, displayStock, isSoldOut, isSoldToday, markSoldToday, soldOutApplies } from './shopDisplay'
import { dailyStock } from './shopTiers'

describe('진열대 가구 고르기', () => {
  it('가구만, 자리 수만큼, 그날 진열 안에서 고른다', () => {
    for (const tier of [1, 2, 3]) {
      for (let d = 1; d <= 20; d++) {
        const day = `2026-10-${String(d).padStart(2, '0')}`
        const stock = displayStock(tier, day)
        expect(stock.length).toBeLessThanOrEqual(DISPLAY_SPOTS.length)
        const all = dailyStock(tier, day)
        for (const e of stock) {
          expect(ITEMS[e.itemId].kind).toBe('furniture')
          expect(all.some((x) => x.itemId === e.itemId)).toBe(true)
        }
      }
    }
  })

  it('같은 날·같은 단계면 같은 자리 순서가 나온다', () => {
    const a = displayStock(2, '2026-10-19').map((e) => e.itemId)
    const b = displayStock(2, '2026-10-19').map((e) => e.itemId)
    expect(a).toEqual(b)
  })

  it('잘못된 단계나 날짜면 빈 진열이다', () => {
    expect(displayStock(99, '2026-10-19')).toEqual([])
    expect(displayStock(2, 'not-a-day')).toEqual([])
  })
})

describe('오늘 산 진열 기록', () => {
  it('산 날에는 품절이고, 다른 날에는 품절이 아니다', () => {
    const log = markSoldToday(NEW_SHOP_LOG, '2026-10-19', 'chair')
    expect(isSoldToday(log, '2026-10-19', 'chair')).toBe(true)
    expect(isSoldToday(log, '2026-10-20', 'chair')).toBe(false)
    expect(isSoldToday(log, '2026-10-19', 'table')).toBe(false)
  })

  it('같은 날 다시 들어와도 기록이 남는다. 같은 물건을 두 번 적지 않는다', () => {
    const once = markSoldToday(NEW_SHOP_LOG, '2026-10-19', 'chair')
    const twice = markSoldToday(once, '2026-10-19', 'chair')
    expect(twice.stockSold).toEqual(['chair'])
    expect(isSoldToday(sanitizeShopLog(JSON.parse(JSON.stringify(twice))), '2026-10-19', 'chair')).toBe(true)
  })

  it('날이 바뀌어 산 기록을 새로 적으면 어제 것은 지운다', () => {
    const yesterday = markSoldToday(NEW_SHOP_LOG, '2026-10-18', 'chair')
    const today = markSoldToday(yesterday, '2026-10-19', 'table')
    expect(today.stockDay).toBe('2026-10-19')
    expect(today.stockSold).toEqual(['table'])
  })

  it('저장 글을 읽을 때 날짜 형식이 아니거나 없는 물건은 버린다', () => {
    const clean = sanitizeShopLog({ stockDay: '2026-10-19', stockSold: ['chair', 'nope', 3] })
    expect(clean.stockSold).toEqual(['chair'])
    expect(sanitizeShopLog({ stockDay: 'yesterday', stockSold: [] }).stockDay).toBeNull()
  })
})

describe('진열대 안내 문구', () => {
  it('살 수 있으면 가격과 E 사기, 샀으면 품절이다', () => {
    expect(displayLabel({ name: '의자', price: 120 }, false)).toBe('의자 · 🌰 120 · E 사기')
    expect(displayLabel({ name: '의자', price: 120 }, true)).toBe('의자 · 품절')
  })
})

describe('품절이 걸리는 물건', () => {
  it('가구만 품절이 걸린다. 사탕·씨앗·먹거리 같은 소모품은 제외', () => {
    expect(soldOutApplies('chair')).toBe(true)
    expect(soldOutApplies('candy')).toBe(false)
    expect(soldOutApplies('peach')).toBe(false)
    expect(soldOutApplies('no-such-item')).toBe(false)
  })

  it('소모품은 기록이 있어도 품절이 아니다', () => {
    const log = markSoldToday(NEW_SHOP_LOG, '2026-10-26', 'candy')
    expect(isSoldToday(log, '2026-10-26', 'candy')).toBe(true)
    expect(isSoldOut(log, '2026-10-26', 'candy')).toBe(false)
  })

  it('가구는 오늘 산 뒤에만 품절이다', () => {
    const log = markSoldToday(NEW_SHOP_LOG, '2026-10-26', 'chair')
    expect(isSoldOut(log, '2026-10-26', 'chair')).toBe(true)
    expect(isSoldOut(log, '2026-10-27', 'chair')).toBe(false)
  })
})

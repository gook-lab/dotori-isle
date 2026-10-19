import { describe, expect, it } from 'vitest'
import { addSales, cleanSalesLedger, SALES_DAYS, saleLines, shiftDay, topItems, vsYesterday, weekTotals, type SalesDay } from './salesLedger'

const TODAY = '2026-10-25'

describe('가게 장부 더하기와 잘라내기', () => {
  it('팔린 금액을 오늘 칸에 더하고 물건별로도 쌓는다', () => {
    let days: SalesDay[] = []
    days = addSales(days, TODAY, [{ id: 'peach', amount: 60 }, { id: 'peach', amount: 40 }])
    days = addSales(days, TODAY, [{ id: 'honeybee', amount: 120 }])
    expect(days).toEqual([{ day: TODAY, total: 220, items: { peach: 100, honeybee: 120 } }])
  })

  it('금액이 0 이하인 줄은 무시하고, 아무것도 없으면 같은 배열을 돌려준다', () => {
    const days: SalesDay[] = []
    expect(addSales(days, TODAY, [{ id: 'peach', amount: 0 }])).toBe(days)
  })

  it('14일이 넘으면 가장 오래된 날부터 버린다', () => {
    let days: SalesDay[] = []
    for (let i = 0; i < SALES_DAYS + 3; i++) days = addSales(days, shiftDay(TODAY, i), [{ id: 'peach', amount: 10 }])
    expect(days).toHaveLength(SALES_DAYS)
    expect(days[0].day).toBe(shiftDay(TODAY, 3))
    expect(days[days.length - 1].day).toBe(shiftDay(TODAY, SALES_DAYS + 2))
  })

  it('판매 줄에서 칸의 금액을 뽑는다(송이는 시세로)', () => {
    expect(saleLines([{ id: 'peach', count: 2 }], 0)).toEqual([{ id: 'peach', amount: 40 }])
    expect(saleLines([{ id: 'songi', count: 3 }], 82)).toEqual([{ id: 'songi', amount: 246 }])
  })
})

describe('가게 장부 요약', () => {
  const days: SalesDay[] = [
    { day: shiftDay(TODAY, -8), total: 999, items: { peach: 999 } },
    { day: shiftDay(TODAY, -6), total: 100, items: { peach: 100 } },
    { day: shiftDay(TODAY, -1), total: 300, items: { honeybee: 200, peach: 100 } },
    { day: TODAY, total: 500, items: { honeybee: 300, 'rhino-beetle': 200 } },
  ]

  it('최근 7일 막대는 오늘이 맨 뒤이고 빈 날은 0 이다', () => {
    const w = weekTotals(days, TODAY)
    expect(w).toHaveLength(7)
    expect(w[6]).toEqual({ day: TODAY, total: 500 })
    expect(w[0]).toEqual({ day: shiftDay(TODAY, -6), total: 100 })
    expect(w[1].total).toBe(0)
  })

  it('어제와의 차이는 오늘에서 어제를 뺀 값이다', () => {
    expect(vsYesterday(days, TODAY)).toBe(200)
    expect(vsYesterday(days, shiftDay(TODAY, -1))).toBe(300)
  })

  it('최근 7일에 많이 팔린 물건 상위 3개를 금액순으로 보여 준다(같은 금액은 id 순)', () => {
    // 최근 7일: 꿀벌 200+300, 복숭아 100+100, 장수풍뎅이 200. 8일 전의 복숭아 999 는 빠진다.
    expect(topItems(days, TODAY)).toEqual([
      { id: 'honeybee', amount: 500 },
      { id: 'peach', amount: 200 },
      { id: 'rhino-beetle', amount: 200 },
    ])
  })
})

describe('가게 장부 불러오기', () => {
  it('정상 줄은 날짜순으로 읽고, 틀린 날짜·음수 금액·모르는 물건은 버린다', () => {
    const out = cleanSalesLedger([
      { day: TODAY, total: 50, items: { peach: 50, nope: 9, honeybee: -3 } },
      { day: 'bad', total: 1, items: {} },
      { day: shiftDay(TODAY, -1), total: -5, items: {} },
      { day: shiftDay(TODAY, -2), total: 20, items: { peach: 20 } },
    ])
    expect(out).toEqual([
      { day: shiftDay(TODAY, -2), total: 20, items: { peach: 20 } },
      { day: TODAY, total: 50, items: { peach: 50 } },
    ])
  })

  it('배열이 아니면 빈 장부다', () => {
    expect(cleanSalesLedger(undefined)).toEqual([])
    expect(cleanSalesLedger('x')).toEqual([])
  })
})

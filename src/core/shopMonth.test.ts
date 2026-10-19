import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { addMonthSales, cleanShopMonth, isMonthEnd, monthBonus, settleMonth, shouldSettle, topMonthItem, type ShopMonth } from './shopMonth'

const tally = (over: Partial<ShopMonth> = {}): ShopMonth => ({ month: '2026-10', total: 12000, items: { peach: 8000, honeybee: 4000 }, settled: false, ...over })

describe('addMonthSales', () => {
  it('같은 달이면 누계에 더하고, 달이 바뀌면 새 달부터 센다', () => {
    const a = addMonthSales(null, '2026-10-03', [{ id: 'peach', amount: 300 }])
    const b = addMonthSales(a, '2026-10-04', [{ id: 'peach', amount: 200 }, { id: 'honeybee', amount: 50 }])
    expect(b).toEqual({ month: '2026-10', total: 550, items: { peach: 500, honeybee: 50 }, settled: false })
    const c = addMonthSales({ ...b!, settled: true }, '2026-11-01', [{ id: 'peach', amount: 40 }])
    expect(c).toEqual({ month: '2026-11', total: 40, items: { peach: 40 }, settled: false })
  })

  it('팔린 게 없으면 같은 값을 돌려준다', () => {
    const cur = tally()
    expect(addMonthSales(cur, '2026-10-05', [{ id: 'peach', amount: 0 }])).toBe(cur)
    expect(addMonthSales(null, '2026-10-05', [])).toBeNull()
  })
})

describe('monthBonus', () => {
  it('구간 경계에서 보너스 마일이 오른다', () => {
    expect([monthBonus(9999), monthBonus(10000), monthBonus(29999), monthBonus(30000), monthBonus(59999), monthBonus(60000)]).toEqual([0, 20, 20, 50, 50, 100])
  })
})

describe('isMonthEnd', () => {
  it('달의 마지막 날만 참이다(윤년 포함)', () => {
    expect(isMonthEnd('2026-10-31')).toBe(true)
    expect(isMonthEnd('2026-10-30')).toBe(false)
    expect(isMonthEnd('2026-02-28')).toBe(true)
    expect(isMonthEnd('2028-02-29')).toBe(true)
    expect(isMonthEnd('2028-02-28')).toBe(false)
  })
})

describe('shouldSettle', () => {
  it('이번 달 마지막 날 아침에 아직 안 보낸 판매가 있으면 보낸다', () => {
    expect(shouldSettle(tally(), '2026-10-31')).toBe(true)
    expect(shouldSettle(tally(), '2026-10-30')).toBe(false)
  })

  it('지난달 것을 놓쳤으면 다음 달 첫 아침에 보낸다', () => {
    expect(shouldSettle(tally(), '2026-11-01')).toBe(true)
  })

  it('이미 보냈거나 판 것이 없으면 보내지 않는다', () => {
    expect(shouldSettle(tally({ settled: true }), '2026-11-01')).toBe(false)
    expect(shouldSettle(tally({ total: 0, items: {} }), '2026-11-01')).toBe(false)
    expect(shouldSettle(null, '2026-11-01')).toBe(false)
  })
})

describe('topMonthItem', () => {
  it('판매 합계가 가장 큰 물건을 고른다. 같으면 id 순이다', () => {
    expect(topMonthItem({ peach: 5, honeybee: 9, 'rhino-beetle': 9 })).toEqual({ id: 'honeybee', amount: 9 })
    expect(topMonthItem({})).toBeNull()
  })
})

describe('settleMonth', () => {
  it('편지에 판매 합계·가장 많이 팔린 물건·보너스 마일을 적고 settled 를 세운다', () => {
    const { letter, bonus, tally: next } = settleMonth(tally(), '2026-10-31')
    expect(bonus).toBe(20)
    expect(next.settled).toBe(true)
    expect(letter.id).toBe('shop-month-2026-10')
    expect(letter.fromName).toBe('점장')
    expect(letter.day).toBe('2026-10-31')
    expect(letter.text).toContain('10월 가게 장부를 정리했어요. 1일부터 어제까지 도토리 12,000개를 팔았어요.')
    expect(letter.text).toContain(`${ITEMS.peach.icon} ${ITEMS.peach.name}예요. 보너스로`)
    expect(letter.text).toContain('보너스로 20마일을 넣어 뒀어요.')
  })

  it('지난달 편지는 말일까지라고 쓰고, 구간에 못 미치면 보너스 줄 대신 다음 달 권유를 쓴다', () => {
    const { letter, bonus } = settleMonth(tally({ total: 3000, items: { peach: 3000 } }), '2026-11-01')
    expect(bonus).toBe(0)
    expect(letter.text).toContain('1일부터 말일까지 도토리 3,000개를 팔았어요.')
    expect(letter.text).not.toContain('보너스')
    expect(letter.text).toContain('다음 달에는 더 많이 팔아 봐요.')
  })
})

describe('cleanShopMonth', () => {
  it('정상 값은 그대로 두고, settled 가 없으면 false 로 본다', () => {
    expect(cleanShopMonth({ month: '2026-10', total: 500, items: { peach: 500 } })).toEqual({ month: '2026-10', total: 500, items: { peach: 500 }, settled: false })
  })

  it('달 형식·금액이 틀리면 버리고, 모르는 물건 줄은 뺀다', () => {
    expect(cleanShopMonth({ month: '2026-1', total: 5, items: {} })).toBeNull()
    expect(cleanShopMonth({ month: '2026-10', total: -1, items: {} })).toBeNull()
    expect(cleanShopMonth({ month: '2026-10', total: 5, items: { nope: 5, peach: -2 } })).toEqual({ month: '2026-10', total: 5, items: {}, settled: false })
    expect(cleanShopMonth(null)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import {
  accrueInterest,
  ATM_PRODUCTS,
  buyAtmProduct,
  createBank,
  deposit,
  INTEREST_CAP,
  repayLoan,
  savingsCap,
  SAVINGS_BASE_CAP,
  withdraw,
  withdrawableNow,
  withdrawLimit,
  WITHDRAW_BASE,
  type BankState,
} from './bank'

const DAY = '2026-10-18'
const base = (over: Partial<BankState> = {}): BankState => ({ ...createBank(DAY), ...over })

describe('도토리 ATM — 입금과 출금', () => {
  it('지갑에서 통장으로 옮긴다', () => {
    const r = deposit(createBank(DAY), 5000, 2000, DAY)
    expect(r).toMatchObject({ ok: true, money: 3000 })
    if (r.ok) expect(r.state.savings).toBe(2000)
  })

  it('가진 도토리보다 많이 넣을 수 없다', () => {
    expect(deposit(createBank(DAY), 100, 101, DAY)).toEqual({ ok: false, reason: '가진 도토리가 모자라요' })
  })

  it('통장 한도를 넘으면 남은 칸을 알려 준다', () => {
    const s = base({ savings: SAVINGS_BASE_CAP - 50 })
    const r = deposit(s, 10000, 100, DAY)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('50개까지')
  })

  it('출금은 통장 잔고 안에서만 된다', () => {
    const r = withdraw(base({ savings: 1000 }), 1200, DAY)
    expect(r).toEqual({ ok: false, reason: '통장에 그만큼 없어요' })
  })

  it('하루 인출 한도를 넘으면 실패하고, 다음 날에는 다시 쓴다', () => {
    const s = base({ savings: 10000 })
    const first = withdraw(s, 2000, DAY)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.gained).toBe(2000)
    expect(first.state.withdrawnToday).toBe(2000)
    const over = withdraw(first.state, 1500, DAY)
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.reason).toContain('1,000개까지')
    const next = withdraw(first.state, 1000, DAY)
    expect(next.ok).toBe(true)
    if (next.ok) expect(withdraw(next.state, 1, DAY).ok).toBe(false)
    expect(withdraw(next.ok ? next.state : first.state, 1000, '2026-10-19').ok).toBe(true)
  })

  it('한도를 다 쓰면 오늘은 더 못 뺀다는 사유를 준다', () => {
    const s = base({ savings: 10000, withdrawnDay: DAY, withdrawnToday: WITHDRAW_BASE })
    const r = withdraw(s, 1, DAY)
    expect(r).toEqual({ ok: false, reason: '오늘 인출 한도를 다 썼어요. 내일 다시 와요' })
  })
})

describe('도토리 ATM — 이자', () => {
  it('30일이 지나면 잔고의 0.5% 를 붙인다(내림)', () => {
    const s = accrueInterest(base({ savings: 10000 }), '2026-11-17')
    expect(s.savings).toBe(10050)
    expect(s.day).toBe('2026-11-17')
  })

  it('29일 이하면 아무것도 붙이지 않는다', () => {
    const s = base({ savings: 10000 })
    expect(accrueInterest(s, '2026-11-16')).toBe(s)
  })

  it('이자 한 번의 상한은 1000 이다(0.5% 가 1000 을 넘는 잔고부터 막힌다)', () => {
    // 250000 의 0.5% 는 1250 이라 상한 1000 에 걸린다. 통장 한도 30만 안에 있는 값으로 본다.
    const s = accrueInterest(base({ savings: 250_000 }), '2026-11-17')
    expect(s.savings).toBe(250_000 + INTEREST_CAP)
  })

  it('60일이면 두 번 붙고, 기준일은 60일 뒤로 옮겨 간다', () => {
    const s = accrueInterest(base({ savings: 10000 }), '2026-12-17')
    // 10000 → 10050 → 10100(floor(10050*0.005)=50)
    expect(s.savings).toBe(10100)
    expect(s.day).toBe('2026-12-17')
  })

  it('30일이 안 찬 나머지 날은 버리지 않고 다음 계산에 이어 센다', () => {
    const s = accrueInterest(base({ savings: 10000 }), '2026-12-16')
    // 59일 → 한 번만 붙고 기준일은 11-17 에 머문다. 12-17 이 되면 두 번째가 붙는다.
    expect(s.savings).toBe(10050)
    expect(s.day).toBe('2026-11-17')
    expect(accrueInterest(s, '2026-12-17').savings).toBe(10100)
  })

  it('같은 날 여러 번 열어도 한 번만 붙는다', () => {
    const once = accrueInterest(base({ savings: 10000 }), '2026-11-17')
    const twice = accrueInterest(once, '2026-11-17')
    expect(twice.savings).toBe(once.savings)
  })

  it('이자 계산이 통장 한도를 넘지 못한다', () => {
    const s = accrueInterest(base({ savings: SAVINGS_BASE_CAP }), '2026-11-17')
    expect(s.savings).toBe(SAVINGS_BASE_CAP)
  })

  it('날짜가 거꾸로 가거나 잘못되면 그대로 둔다', () => {
    const s = base({ savings: 10000 })
    expect(accrueInterest(s, '2026-01-01')).toBe(s)
    expect(accrueInterest(s, 'bad')).toBe(s)
  })

  it('입금·출금 전에 이자가 먼저 붙는다', () => {
    const s = base({ savings: 10000, day: DAY })
    const r = withdraw(s, 100, '2026-11-17')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state.savings).toBe(10050 - 100)
  })
})

describe('도토리 ATM — 한도와 집 빚', () => {
  it('마일리지로 늘린 만큼 한도가 오른다', () => {
    const s = base({ capUpgrades: 2, limitUpgrades: 1 })
    expect(savingsCap(s)).toBe(SAVINGS_BASE_CAP + 2 * 200_000)
    expect(withdrawLimit(s)).toBe(WITHDRAW_BASE + 2000)
  })

  it('통장에서 빚을 갚으면 통장에서 빠지고, 빚은 줄어든다', () => {
    const r = repayLoan(base({ savings: 3000 }), 2500, 2000, DAY)
    expect(r).toMatchObject({ ok: true, loan: 500, paid: 2000 })
    if (r.ok) expect(r.state.savings).toBe(1000)
  })

  it('빚보다 많이 내면 빚만큼만 빠진다', () => {
    const r = repayLoan(base({ savings: 9000 }), 2500, 9000, DAY)
    expect(r).toMatchObject({ ok: true, loan: 0, paid: 2500 })
    if (r.ok) expect(r.state.savings).toBe(6500)
  })

  it('통장에 갚을 만큼이 없으면 실패한다', () => {
    expect(repayLoan(base({ savings: 100 }), 2500, 500, DAY)).toEqual({ ok: false, reason: '통장에 갚을 만큼이 없어요' })
  })

  it('빚이 없거나 금액이 잘못되면 실패한다', () => {
    expect(repayLoan(base({ savings: 100 }), 0, 50, DAY).ok).toBe(false)
    expect(repayLoan(base({ savings: 100 }), 500, 0, DAY).ok).toBe(false)
  })
})

describe('도토리 ATM — 마일리지 상품', () => {
  it('ATM 상품은 M 패널 교환과 겹치지 않는다', () => {
    const mShop = ['trip-ticket', 'recipe', 'pocket', 'gold-acorn']
    expect(ATM_PRODUCTS.map((p) => p.id)).not.toEqual(expect.arrayContaining(mShop))
  })

  it('쿠폰은 마일을 내고 쿠폰 한 장을 준다', () => {
    const r = buyAtmProduct(base(), 400, 'coupon', '2026-10-19')
    expect(r).toMatchObject({ ok: true, miles: 0, grant: { itemId: 'acorn-coupon', count: 1 } })
  })

  it('섬 고유 가구는 마일로만 받고 한 번씩만 살 수 있다', () => {
    const want = [
      ['acorn-cushion', 1200],
      ['acorn-vase', 1800],
      ['acorn-lantern', 2400],
    ] as const
    for (const [id, cost] of want) {
      const p = ATM_PRODUCTS.find((x) => x.id === id)
      expect(p, id).toMatchObject({ cost, max: 1, grant: { itemId: id, count: 1 } })
      const first = buyAtmProduct(base(), 10_000, id, '2026-10-19')
      expect(first).toMatchObject({ ok: true, miles: 10_000 - cost, grant: { itemId: id, count: 1 } })
      if (!first.ok) throw new Error('구매 실패')
      expect(buyAtmProduct(first.state, 10_000, id, '2026-10-19')).toEqual({ ok: false, reason: '이 상품은 이미 최대예요' })
    }
  })

  it('마일이 모자라면 실패한다', () => {
    expect(buyAtmProduct(base(), 399, 'coupon', '2026-10-19')).toEqual({ ok: false, reason: '마일이 모자라요' })
  })

  it('통장 한도와 인출 한도는 세 번까지만 늘린다', () => {
    let s = base()
    let miles = 10_000
    for (let i = 0; i < 3; i++) {
      const r = buyAtmProduct(s, miles, 'savings-cap', '2026-10-19')
      expect(r.ok).toBe(true)
      if (!r.ok) return
      s = r.state
      miles = r.miles
    }
    expect(s.capUpgrades).toBe(3)
    expect(buyAtmProduct(s, miles, 'savings-cap', '2026-10-19')).toEqual({ ok: false, reason: '통장 한도는 이미 최대예요' })

    for (let i = 0; i < 3; i++) {
      const r = buyAtmProduct(s, miles, 'withdraw-limit', '2026-10-19')
      if (!r.ok) throw new Error('should buy')
      s = r.state
      miles = r.miles
    }
    expect(s.limitUpgrades).toBe(3)
    expect(buyAtmProduct(s, miles, 'withdraw-limit', '2026-10-19').ok).toBe(false)
  })

  it('없는 상품 id 나 잘못된 마일리지는 거절한다', () => {
    expect(buyAtmProduct(base(), 9999, 'nope', '2026-10-19').ok).toBe(false)
    expect(buyAtmProduct(base(), -1, 'coupon', '2026-10-19').ok).toBe(false)
    expect(buyAtmProduct(base(), Number.NaN, 'coupon', '2026-10-19').ok).toBe(false)
  })
})

describe('도토리 ATM — 잘못된 입력', () => {
  it('금액이 0, 음수, 소수, NaN 이면 실패한다', () => {
    const s = createBank(DAY)
    for (const amount of [0, -10, 1.5, Number.NaN]) {
      expect(deposit(s, 1000, amount, DAY).ok).toBe(false)
      expect(withdraw(s, amount, DAY).ok).toBe(false)
    }
  })

  it('잘못된 날짜 키면 거절한다', () => {
    expect(deposit(createBank(DAY), 100, 10, '2026-02-31').ok).toBe(false)
    expect(withdraw(createBank(DAY), 10, 'x').ok).toBe(false)
  })
})

describe('지금 뺄 수 있는 돈', () => {
  it('is the smaller of the balance and what is left of today', () => {
    const empty = { savings: 0, day: '2026-10-19', withdrawnDay: '2026-10-19', withdrawnToday: 0, capUpgrades: 0, limitUpgrades: 0 }
    expect(withdrawableNow(empty, '2026-10-19')).toBe(0)
    const rich = { ...empty, savings: 100000 }
    expect(withdrawableNow(rich, '2026-10-19')).toBe(withdrawLimit(rich))
    const small = { ...empty, savings: 500 }
    expect(withdrawableNow(small, '2026-10-19')).toBe(500)
    const spent = { ...rich, withdrawnToday: withdrawLimit(rich) }
    expect(withdrawableNow(spent, '2026-10-19')).toBe(0)
    // 날이 바뀌면 오늘 한도는 다시 찬다
    expect(withdrawableNow(spent, '2026-10-20')).toBe(withdrawLimit(spent))
  })
})

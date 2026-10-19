import { describe, expect, it } from 'vitest'
import { buyAtmProduct, cleanCoupons, COUPON_DAILY_MAX, couponsLeft, createBank, type BankState } from './bank'

const DAY = '2026-10-19'
const base = (over: Partial<BankState> = {}): BankState => ({ ...createBank(DAY), ...over })

describe('마일 쿠폰 하루 상한', () => {
  it('하루 두 장까지 사고, 세 번째는 막는다', () => {
    const a = buyAtmProduct(base(), 10_000, 'coupon', DAY)
    expect(a.ok).toBe(true)
    if (!a.ok) return
    expect(couponsLeft(a.state, DAY)).toBe(1)
    const b = buyAtmProduct(a.state, 10_000, 'coupon', DAY)
    expect(b.ok).toBe(true)
    if (!b.ok) return
    expect(couponsLeft(b.state, DAY)).toBe(0)
    expect(buyAtmProduct(b.state, 10_000, 'coupon', DAY)).toEqual({ ok: false, reason: '오늘 쿠폰은 다 샀어요. 내일 다시 살 수 있어요' })
  })

  it('다음 날이 되면 다시 두 장을 살 수 있다', () => {
    const a = buyAtmProduct(base({ coupons: { day: DAY, n: COUPON_DAILY_MAX } }), 10_000, 'coupon', '2026-10-20')
    expect(a.ok).toBe(true)
    expect(couponsLeft(base({ coupons: { day: DAY, n: 2 } }), '2026-10-20')).toBe(COUPON_DAILY_MAX)
  })

  it('실패하면 마일과 쿠폰 기록을 바꾸지 않는다', () => {
    const full = base({ coupons: { day: DAY, n: 2 } })
    expect(buyAtmProduct(full, 10_000, 'coupon', DAY).ok).toBe(false)
    expect(full.coupons).toEqual({ day: DAY, n: 2 })
  })

  it('쿠폰이 아닌 상품은 상한과 상관없다', () => {
    const r = buyAtmProduct(base({ coupons: { day: DAY, n: 2 } }), 500, 'seed-pack', DAY)
    expect(r.ok).toBe(true)
  })

  it('저장에서 읽은 쿠폰 기록은 날짜와 장 수를 검사한다', () => {
    expect(cleanCoupons({ day: DAY, n: 1 })).toEqual({ day: DAY, n: 1 })
    expect(cleanCoupons({ day: DAY, n: 3 })).toBeUndefined()
    expect(cleanCoupons({ day: 'nope', n: 1 })).toBeUndefined()
    expect(cleanCoupons(undefined)).toBeUndefined()
  })
})

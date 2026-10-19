import { describe, expect, it } from 'vitest'
import { accrueInterest, buyAtmProduct, createBank, INTEREST_CAP, interestCap, perkCount, type BankState } from './bank'

const D = '2026-10-19'
const LATER = '2026-11-18'
const base = (over: Partial<BankState> = {}): BankState => ({ ...createBank(D), ...over })

describe('ATM 마일리지 상품: 물건 묶음', () => {
  it('sells a flower seed bundle for 120 miles and puts 5 seeds in the pocket', () => {
    const r = buyAtmProduct(base(), 500, 'seed-pack', '2026-10-19')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.miles).toBe(380)
    expect(r.grant).toEqual({ itemId: 'flower-seed', count: 5 })
    expect(perkCount(r.state, 'seed-pack')).toBe(1)
  })

  it('stops the seed bundle at its cap of 6', () => {
    const r = buyAtmProduct(base({ perks: { 'seed-pack': 6 } }), 500, 'seed-pack', '2026-10-19')
    expect(r).toEqual({ ok: false, reason: '이 상품은 이미 최대예요' })
  })

  it('sells wood bundles and coupon bundles with their own caps', () => {
    const wood = buyAtmProduct(base(), 500, 'wood-pack', '2026-10-19')
    expect(wood.ok && wood.grant).toEqual({ itemId: 'wood', count: 10 })
    // 쿠폰 묶음은 2장이라 하루 상한(COUPON_DAILY_MAX)을 한 번에 채운다
    const pack = buyAtmProduct(base(), 1500, 'coupon-pack', '2026-10-19')
    expect(pack.ok && pack.grant).toEqual({ itemId: 'acorn-coupon', count: 2 })
    expect(pack.ok && buyAtmProduct(pack.state, 1500, 'coupon', '2026-10-19')).toEqual({ ok: false, reason: '오늘 쿠폰은 다 샀어요. 내일 다시 살 수 있어요' })
  })

  it('refuses when the miles are short and does not change the bank', () => {
    const b = base()
    const r = buyAtmProduct(b, 119, 'seed-pack', '2026-10-19')
    expect(r).toEqual({ ok: false, reason: '마일이 모자라요' })
  })
})

describe('ATM 마일리지 상품: 이자 한도', () => {
  it('raises the interest cap by 1000 per purchase, up to 3 times', () => {
    const r = buyAtmProduct(base({ savings: 300000 }), 1000, 'interest-cap', '2026-10-19')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.grant).toBeNull()
    expect(interestCap(r.state)).toBe(INTEREST_CAP + 1000)
    expect(buyAtmProduct(base({ perks: { 'interest-cap': 3 } }), 1000, 'interest-cap', '2026-10-19')).toEqual({ ok: false, reason: '이 상품은 이미 최대예요' })
  })

  it('pays more interest after the cap is raised', () => {
    // 통장 한도를 한 번 늘려 두어야 1500 이자가 들어갈 자리가 생긴다
    const before = accrueInterest(base({ savings: 300000, capUpgrades: 1 }), LATER)
    const after = accrueInterest(base({ savings: 300000, capUpgrades: 1, perks: { 'interest-cap': 1 } }), LATER)
    expect(before.savings - 300000).toBe(INTEREST_CAP)
    expect(after.savings - 300000).toBe(1500)
  })
})

describe('ATM 마일리지 상품: 저장값 검증', () => {
  it('treats a save without perks, or with broken counts, as zero', () => {
    expect(perkCount(base(), 'seed-pack')).toBe(0)
    expect(perkCount(base({ perks: { 'seed-pack': -1 } }), 'seed-pack')).toBe(0)
    expect(perkCount(base({ perks: { 'seed-pack': 1.5 } }), 'seed-pack')).toBe(0)
    expect(perkCount(base({ perks: { 'seed-pack': '2' as unknown as number } }), 'seed-pack')).toBe(0)
  })
})

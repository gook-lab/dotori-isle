import { describe, expect, it } from 'vitest'
import { createBank, nextInterest, savingsCap, SAVINGS_CAP_STEP } from './bank'

const D = '2026-10-19'

describe('도토리 ATM — 다음 이자 안내', () => {
  it('계산일 당일이면 30일 뒤, 잔고의 0.5%(내림)를 준다', () => {
    const b = { ...createBank(D), savings: 20000 }
    expect(nextInterest(b, D)).toEqual({ days: 30, amount: 100 })
  })

  it('가는 날만큼 남은 날이 줄어든다', () => {
    const b = { ...createBank('2026-10-01'), savings: 20000 }
    expect(nextInterest(b, '2026-10-11')).toEqual({ days: 20, amount: 100 })
  })

  it('30일이 지나 이자가 붙은 뒤의 남은 날을 준다', () => {
    const b = { ...createBank('2026-09-01'), savings: 20000 }
    // 2026-10-01 에 한 번 붙고(20100), 10-19 까지 18일 지났으니 12일 남는다
    expect(nextInterest(b, '2026-10-19')).toEqual({ days: 12, amount: Math.floor(20100 * 0.005) })
  })

  it('이자는 한 번에 1000을 넘지 않는다', () => {
    const b = { ...createBank(D), savings: 400000, capUpgrades: 1 }
    expect(nextInterest(b, D)?.amount).toBe(1000)
  })

  it('통장 한도에 닿으면 더 붙을 자리만큼만 준다', () => {
    const b = { ...createBank(D), savings: savingsCap(createBank(D)) - 100 }
    expect(nextInterest(b, D)?.amount).toBe(100)
  })

  it('한도가 찼거나 잔고가 0 이면 0 이다', () => {
    expect(nextInterest({ ...createBank(D), savings: savingsCap(createBank(D)) }, D)?.amount).toBe(0)
    expect(nextInterest(createBank(D), D)?.amount).toBe(0)
  })

  it('한도 늘리기로 한도가 올라가면 그만큼 더 받을 수 있다', () => {
    const b = { ...createBank(D), savings: 300000, capUpgrades: 1 }
    expect(savingsCap(b)).toBe(300000 + SAVINGS_CAP_STEP)
    expect(nextInterest(b, D)?.amount).toBe(1000)
  })

  it('날짜 키가 잘못되면 null 이다', () => {
    expect(nextInterest(createBank(D), 'not-a-day')).toBeNull()
  })
})

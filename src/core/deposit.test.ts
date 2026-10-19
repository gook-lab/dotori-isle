import { describe, expect, it } from 'vitest'
import { breakDeposit, cleanDeposit, DEPOSIT_MAX, depositInterest, openDeposit, settleDeposit, type FixedDeposit } from './deposit'

const D = '2026-10-29'
const three: FixedDeposit = { principal: 1000, days: 3, start: D, due: '2026-11-01' }

describe('정기 예금 이자', () => {
  it('3일 예금은 2%, 상한 100', () => {
    expect(depositInterest(1000, 3)).toBe(20)
    expect(depositInterest(999, 3)).toBe(19)
    expect(depositInterest(5000, 3)).toBe(100)
  })

  it('7일 예금은 6%, 상한 300', () => {
    expect(depositInterest(1000, 7)).toBe(60)
    expect(depositInterest(5000, 7)).toBe(300)
  })

  it('없는 기간은 이자가 없다', () => {
    expect(depositInterest(1000, 5)).toBe(0)
  })
})

describe('맡기기', () => {
  it('지갑에서 원금이 빠지고, 만기 날이 맡긴 날 + 기간으로 정해진다', () => {
    const r = openDeposit(null, 3000, 1000, 3, D)
    expect(r).toEqual({ ok: true, deposit: three, money: 2000 })
  })

  it('만기 날은 달이 넘어가도 맞다', () => {
    const r = openDeposit(null, 3000, 1000, 7, '2026-10-28')
    expect(r.ok && r.deposit.due).toBe('2026-11-04')
  })

  it('지갑 잔고만큼은 맡길 수 있고, 넘으면 실패한다', () => {
    expect(openDeposit(null, 1000, 1000, 3, D).ok).toBe(true)
    expect(openDeposit(null, 999, 1000, 3, D)).toMatchObject({ ok: false, reason: '가진 도토리가 모자라요' })
  })

  it('원금은 1 이상 5000 이하의 정수여야 한다', () => {
    expect(openDeposit(null, 99999, DEPOSIT_MAX, 3, D).ok).toBe(true)
    expect(openDeposit(null, 99999, DEPOSIT_MAX + 1, 3, D).ok).toBe(false)
    expect(openDeposit(null, 99999, 0, 3, D).ok).toBe(false)
    expect(openDeposit(null, 99999, 10.5, 3, D).ok).toBe(false)
  })

  it('동시에 한 건만 맡긴다', () => {
    const r = openDeposit(three, 9000, 500, 7, D)
    expect(r.ok).toBe(false)
  })

  it('3일과 7일 상품만 있다', () => {
    expect(openDeposit(null, 1000, 1000, 5, D).ok).toBe(false)
  })

  it('잘못된 날짜는 거절한다', () => {
    expect(openDeposit(null, 1000, 1000, 3, 'not-a-day').ok).toBe(false)
  })
})

describe('만기 정산', () => {
  it('만기 전에는 아무 일도 없다', () => {
    expect(settleDeposit(three, '2026-10-31')).toEqual({ deposit: three, payout: 0, interest: 0 })
  })

  it('만기 날 아침에 원금과 이자를 돌려주고 예금을 비운다', () => {
    expect(settleDeposit(three, '2026-11-01')).toEqual({ deposit: null, payout: 1020, interest: 20 })
  })

  it('며칠 늦게 와도 이자는 한 번만 붙는다', () => {
    const late = settleDeposit(three, '2026-11-09')
    expect(late).toEqual({ deposit: null, payout: 1020, interest: 20 })
  })

  it('예금이 없으면 아무것도 하지 않는다', () => {
    expect(settleDeposit(null, '2026-11-01')).toEqual({ deposit: null, payout: 0, interest: 0 })
  })
})

describe('중도 해지', () => {
  it('만기 전에는 원금만 돌려준다', () => {
    expect(breakDeposit(three, '2026-10-30')).toEqual({ ok: true, principal: 1000 })
  })

  it('만기가 지난 예금은 해지할 수 없다', () => {
    expect(breakDeposit(three, '2026-11-01').ok).toBe(false)
  })

  it('맡긴 예금이 없으면 실패한다', () => {
    expect(breakDeposit(null, D).ok).toBe(false)
  })
})

describe('저장 값 검증', () => {
  it('맞는 예금은 그대로 읽는다', () => {
    expect(cleanDeposit(three)).toEqual(three)
  })

  it('만기일이 날수와 맞지 않거나 상품이 없으면 버린다', () => {
    expect(cleanDeposit({ ...three, due: '2026-11-05' })).toBeNull()
    expect(cleanDeposit({ ...three, days: 5 })).toBeNull()
    expect(cleanDeposit({ ...three, principal: 6000 })).toBeNull()
    expect(cleanDeposit({ ...three, principal: -1 })).toBeNull()
  })

  it('없거나 모양이 다르면 null', () => {
    expect(cleanDeposit(null)).toBeNull()
    expect(cleanDeposit('x')).toBeNull()
    expect(cleanDeposit({ principal: 1000 })).toBeNull()
  })

  it('화면에 보이는 만기 금액은 원금과 이자의 합이고, 실제 정산 금액과 같다', () => {
    // 화면: 300 을 7일 맡기면 "318을 받아요 (이자 18)", 200 을 3일 맡기면 "204"
    expect(depositInterest(300, 7) + 300).toBe(318)
    expect(depositInterest(200, 3) + 200).toBe(204)
    const dep = openDeposit(null, 3000, 300, 7, D)
    if (!dep.ok) throw new Error('open failed')
    const due = settleDeposit(dep.deposit, dep.deposit.due)
    expect(due.payout).toBe(318)
    expect(due.interest).toBe(18)
  })
})

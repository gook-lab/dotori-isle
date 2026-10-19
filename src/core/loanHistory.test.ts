import { describe, expect, it } from 'vitest'
import { cleanLoanHistory, EMPTY_LOAN_HISTORY, legacyLoanHistory, LOAN_RECENT, recordBorrow, recordPayment } from './loanHistory'

describe('대출 상환 기록', () => {
  it('빌린 금액과 갚은 금액을 누적한다', () => {
    let h = recordBorrow(EMPTY_LOAN_HISTORY, 1200)
    h = recordPayment(h, '2026-10-01', 500, 'pocket')
    h = recordPayment(h, '2026-10-02', 300, 'savings')
    expect(h.borrowed).toBe(1200)
    expect(h.paid).toBe(800)
  })

  it('최근 상환은 새 것이 앞이고 최대 3건이다', () => {
    let h = EMPTY_LOAN_HISTORY
    for (let i = 1; i <= 5; i++) h = recordPayment(h, `2026-10-0${i}`, 100 * i, 'pocket')
    expect(h.recent).toHaveLength(LOAN_RECENT)
    expect(h.recent.map((p) => p.day)).toEqual(['2026-10-05', '2026-10-04', '2026-10-03'])
    expect(h.paid).toBe(1500)
  })

  it('잘못된 날짜·금액은 기록하지 않는다', () => {
    const h = recordPayment(EMPTY_LOAN_HISTORY, 'bad', 100, 'pocket')
    expect(h).toEqual(EMPTY_LOAN_HISTORY)
    expect(recordPayment(EMPTY_LOAN_HISTORY, '2026-10-01', 0, 'pocket')).toEqual(EMPTY_LOAN_HISTORY)
    expect(recordBorrow(EMPTY_LOAN_HISTORY, -5)).toEqual(EMPTY_LOAN_HISTORY)
  })

  it('저장값이 없거나 틀리면 빈 기록으로 읽는다', () => {
    expect(cleanLoanHistory(undefined)).toEqual(EMPTY_LOAN_HISTORY)
    expect(cleanLoanHistory('x')).toEqual(EMPTY_LOAN_HISTORY)
    expect(cleanLoanHistory({ borrowed: -1, paid: 'a', recent: 'no' })).toEqual(EMPTY_LOAN_HISTORY)
  })

  it('저장값의 나쁜 항목은 버리고, 갚은 금액은 빌린 금액을 넘지 않는다', () => {
    const h = cleanLoanHistory({
      borrowed: 1000,
      paid: 5000,
      recent: [
        { day: '2026-10-01', amount: 200, from: 'pocket' },
        { day: 'nope', amount: 200, from: 'pocket' },
        { day: '2026-10-02', amount: 0, from: 'savings' },
        { day: '2026-10-03', amount: 300, from: 'card' },
        { day: '2026-10-04', amount: 400, from: 'savings' },
      ],
    })
    expect(h.paid).toBe(1000)
    expect(h.recent).toEqual([
      { day: '2026-10-01', amount: 200, from: 'pocket' },
      { day: '2026-10-04', amount: 400, from: 'savings' },
    ])
  })
})

describe('예전 저장의 상환 기록 만들기', () => {
  const home = (stage: number, loan: number, order: { to: number; day: string } | null = null) => ({ stage, loan, order }) as Parameters<typeof legacyLoanHistory>[0]

  it('작은 집을 짓는 중 빚이 남았으면 단계 금액으로 빌린 총액을, 나머지로 갚은 금액을 채운다', () => {
    expect(legacyLoanHistory(home(0, 1000, { to: 1, day: '2026-10-10' }))).toEqual({ borrowed: 2500, paid: 1500, recent: [] })
  })

  it('지금 단계의 빚이 남았으면 그 단계 금액을 쓴다', () => {
    expect(legacyLoanHistory(home(2, 3000))).toEqual({ borrowed: 8000, paid: 5000, recent: [] })
  })

  it('빚이 0 이면 기록을 만들지 않는다', () => {
    expect(legacyLoanHistory(home(2, 0))).toEqual(EMPTY_LOAN_HISTORY)
  })

  it('빚이 단계 금액보다 크면(표와 안 맞으면) 기록을 만들지 않는다', () => {
    expect(legacyLoanHistory(home(1, 9999))).toEqual(EMPTY_LOAN_HISTORY)
  })

  it('텐트 단계(금액 0)에서는 기록을 만들지 않는다', () => {
    expect(legacyLoanHistory(home(0, 500))).toEqual(EMPTY_LOAN_HISTORY)
  })
})

import { describe, expect, it } from 'vitest'
import { birthdayLetter, birthdayThanksLetter, loanPaidLetter, warmFundLetter } from './letters'

describe('loan paid letter', () => {
  it('suggests the next home by name and loan', () => {
    const l = loanPaidLetter('2026-05-01', { name: '작은 집', loan: 2500 })
    expect(l.from).toBe('pelican')
    expect(l.fromName).toBe('펠리')
    expect(l.text).toContain('다음 집(작은 집)을 맡길 수 있어요')
    expect(l.text).toContain('2,500')
    expect(l.read).toBe(false)
    expect(l.gift).toBeNull()
  })

  it('congratulates without a suggestion at the biggest home', () => {
    const l = loanPaidLetter('2026-05-01', null)
    expect(l.text).toContain('가장 큰 집')
    expect(l.text).not.toContain('짓기를 맡길')
    expect(l.text).not.toContain('살고 있어요')
    // 다음 집이 없으면 할 일을 한 줄 더 준다(칠하기나 섬 가꾸기)
    expect(l.text).toMatch(/칠하거나 섬 가꾸기/)
  })

  it('keys the id by day so one payoff makes one letter', () => {
    expect(loanPaidLetter('2026-05-01', null).id).toBe('loan-paid-2026-05-01')
    expect(loanPaidLetter('2026-05-02', null).id).not.toBe(loanPaidLetter('2026-05-01', null).id)
  })
})

describe('birthday letters', () => {
  it('an invite names the villager and the day, and has no gift', () => {
    const l = birthdayLetter('2026-03-03', { id: 'bomi', name: '봄이', tic: '깡총' })
    expect(l.id).toBe('birthday-2026-03-03-bomi')
    expect(l.fromName).toBe('봄이')
    expect(l.text).toContain('생일')
    expect(l.gift).toBeNull()
  })

  it('the thank-you letter carries the present when there is one', () => {
    const l = birthdayThanksLetter('2026-03-04', { id: 'bomi', name: '봄이', tic: '깡총' }, 'chair')
    expect(l.id).toBe('birthday-thanks-2026-03-04-bomi')
    expect(l.gift).toBe('chair')
    expect(l.text).toContain('나무 의자')
    expect(birthdayThanksLetter('2026-03-04', { id: 'bomi', name: '봄이', tic: '' }, null).gift).toBeNull()
  })
})

describe('warm fund letter', () => {
  it('첫날 편지는 날짜로 id 를 정하고 기부 배율을 알려 준다', () => {
    const l = warmFundLetter('2026-12-01')
    expect(l.id).toBe('warm-fund-2026-12-01')
    expect(l.from).toBe('committee')
    expect(l.text).toContain('1.2배')
    expect(l.text).toContain('마을회관 접수대')
  })
})

import { describe, expect, it } from 'vitest'
import { addDays, dayDiff, dayIndex, isNonNegativeAmount, isWholeAmount } from './economy'

describe('날짜 키 계산', () => {
  it('날짜 키 사이의 일수를 센다', () => {
    expect(dayDiff('2026-10-18', '2026-10-19')).toBe(1)
    expect(dayDiff('2026-10-18', '2026-10-18')).toBe(0)
    expect(dayDiff('2026-10-18', '2026-10-01')).toBe(-17)
  })

  it('달과 해가 넘어가도 하루씩 센다(윤년 포함)', () => {
    expect(dayDiff('2026-02-28', '2026-03-01')).toBe(1)
    expect(dayDiff('2024-02-28', '2024-03-01')).toBe(2)
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('n 일 뒤 날짜 키를 만든다', () => {
    expect(addDays('2026-10-18', 2)).toBe('2026-10-20')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-18', -18)).toBe('2026-09-30')
  })

  it('없는 날짜나 잘못된 형식은 null 이다', () => {
    expect(dayIndex('2026-02-30')).toBeNull()
    expect(dayIndex('2026-13-01')).toBeNull()
    expect(dayIndex('2026/10/18')).toBeNull()
    expect(dayIndex('')).toBeNull()
    expect(dayDiff('2026-10-18', 'nope')).toBeNull()
    expect(addDays('nope', 1)).toBeNull()
    expect(addDays('2026-10-18', 1.5)).toBeNull()
  })
})

describe('금액 검증', () => {
  it('금액은 정수만 받는다', () => {
    expect(isWholeAmount(1)).toBe(true)
    expect(isWholeAmount(0)).toBe(false)
    expect(isWholeAmount(-5)).toBe(false)
    expect(isWholeAmount(1.5)).toBe(false)
    expect(isWholeAmount(Number.NaN)).toBe(false)
    expect(isWholeAmount(Infinity)).toBe(false)
    expect(isWholeAmount('10')).toBe(false)
  })

  it('잔액은 0 도 허용한다', () => {
    expect(isNonNegativeAmount(0)).toBe(true)
    expect(isNonNegativeAmount(-1)).toBe(false)
    expect(isNonNegativeAmount(2.5)).toBe(false)
  })
})

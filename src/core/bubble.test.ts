import { describe, expect, it } from 'vitest'
import { balanceLines } from './bubble'

// 글자 하나를 10px 로 잰다고 치면 공백 포함 글자 수가 너비가 된다
const measure = (s: string) => s.length * 10

describe('말풍선 줄 나누기', () => {
  it('한 줄에 들어가면 줄을 나누지 않는다', () => {
    expect(balanceLines('안녕하세요 반가워요', measure, 460)).toEqual(['안녕하세요 반가워요'])
  })

  it('낱말 사이에서만 나눈다', () => {
    const lines = balanceLines('이 가구 색이 참 예쁘네요 살까 말까 고민 중이에요', measure, 120)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe('이 가구 색이 참 예쁘네요 살까 말까 고민 중이에요')
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(120)
  })

  it('줄 수를 가장 적게 하면서 가장 긴 줄이 가장 짧게 나눈다', () => {
    // 여섯 낱말 각 두 글자(20px)에 공백 한 칸을 더해 재면 줄 수에 따라 너비가 정해진다
    const words = 'aa bb cc dd ee ff'
    const lines = balanceLines(words, measure, 100)
    expect(lines).toEqual(['aa bb cc', 'dd ee ff'])
  })

  it('줄 상한을 넘으면 마지막 줄에 남은 낱말을 모은다', () => {
    const lines = balanceLines('가 나 다 라 마 바 사 아 자 차', measure, 20, 3)
    expect(lines.length).toBe(3)
    expect(lines.join(' ')).toBe('가 나 다 라 마 바 사 아 자 차')
  })
})

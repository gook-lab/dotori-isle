import { describe, expect, it } from 'vitest'
import { autumnTone, paletteFor } from './season'

describe('가을 색 진행', () => {
  it('9월은 초록에 가깝고, 10월 중순부터 황토, 11월 말에 가장 갈색이다', () => {
    expect(autumnTone('2026-09-01')).toBeLessThan(0.05)
    expect(autumnTone('2026-09-30')).toBeLessThan(0.15)
    expect(autumnTone('2026-10-15')).toBeGreaterThan(0.3)
    expect(autumnTone('2026-10-15')).toBeLessThan(0.7)
    expect(autumnTone('2026-11-30')).toBeGreaterThan(0.95)
  })
  it('날짜가 갈수록 값이 늘어나고 0~1 안에 머문다', () => {
    let prev = -1
    for (let m = 9; m <= 11; m++) {
      for (let d = 1; d <= 28; d += 3) {
        const day = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const t = autumnTone(day)
        expect(t).toBeGreaterThanOrEqual(prev)
        expect(t).toBeGreaterThanOrEqual(0)
        expect(t).toBeLessThanOrEqual(1)
        prev = t
      }
    }
  })
  it('가을 풀색은 9월 초록에서 11월 갈색 쪽으로 옮겨 간다', () => {
    const sept = paletteFor('autumn', '2026-09-01').grass[0]
    const nov = paletteFor('autumn', '2026-11-30').grass[0]
    expect(sept).toBe('#b5c46a')
    expect(nov).not.toBe(sept)
  })
  it('여름과 봄은 날짜와 상관없이 같은 땅 색이다', () => {
    expect(paletteFor('summer', '2026-07-01')).toEqual(paletteFor('summer', '2026-07-30'))
    expect(paletteFor('spring', '2026-04-01')).toEqual(paletteFor('spring', '2026-04-30'))
  })
})

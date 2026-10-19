import { describe, expect, it } from 'vitest'
import { bubbleLevel, snowLevel } from './ambience'

describe('snowLevel — 눈 바람 음량', () => {
  it('눈 오는 날에만 소리가 난다', () => {
    expect(snowLevel('sunny', false, false)).toBe(0)
    expect(snowLevel('cloudy', false, false)).toBe(0)
    expect(snowLevel('rain', false, false)).toBe(0)
    expect(snowLevel('snow', false, false)).toBeGreaterThan(0)
  })

  it('비보다 작고, 집 안과 밤엔 더 작다', () => {
    const outdoor = snowLevel('snow', false, false)
    expect(outdoor).toBeLessThan(0.05)
    expect(snowLevel('snow', false, true)).toBeLessThan(outdoor)
    expect(snowLevel('snow', true, false)).toBeLessThan(outdoor)
  })
})

describe('수조 거품 세기', () => {
  it('is full at the tank and fades to nothing beyond its range', () => {
    expect(bubbleLevel(0)).toBe(1)
    expect(bubbleLevel(2, 4)).toBeCloseTo(0.5)
    expect(bubbleLevel(9)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { countValue, easeOut } from './countUp'

describe('숫자 카운트 업', () => {
  it('시작은 이전 값, 끝은 새 값이고 중간은 그 사이에 있다', () => {
    expect(countValue(100, 500, 0)).toBe(100)
    expect(countValue(100, 500, 1)).toBe(500)
    const mid = countValue(100, 500, 0.5)
    expect(mid).toBeGreaterThan(100)
    expect(mid).toBeLessThan(500)
  })

  it('내려갈 때도 같은 방식으로 세고, 정수로 보인다', () => {
    const v = countValue(1000, 200, 0.3)
    expect(v).toBeLessThan(1000)
    expect(v).toBeGreaterThan(200)
    expect(Number.isInteger(v)).toBe(true)
  })

  it('앞으로 갈수록 빨리 움직이고 끝에서 천천히 멈춘다', () => {
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
    expect(easeOut(0.9) - easeOut(0.8)).toBeLessThan(easeOut(0.2) - easeOut(0.1))
  })

  it('범위를 넘는 진행률은 끝 값에 머문다', () => {
    expect(countValue(10, 20, 2)).toBe(20)
    expect(countValue(10, 20, -1)).toBe(10)
  })
})

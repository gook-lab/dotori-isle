import { describe, expect, it } from 'vitest'
import { guessQuality, isQuality, PROFILES } from './quality'

describe('그래픽 품질 기본값', () => {
  it('데스크톱 큰 화면은 높음', () => {
    expect(guessQuality({ touch: false, width: 1280, cores: 8 })).toBe('high')
  })

  it('터치 기기나 좁은 화면은 보통', () => {
    expect(guessQuality({ touch: true, width: 1280, cores: 8 })).toBe('normal')
    expect(guessQuality({ touch: false, width: 390, cores: 8 })).toBe('normal')
  })

  it('코어가 두 개 이하면 낮음', () => {
    expect(guessQuality({ touch: false, width: 1280, cores: 2 })).toBe('low')
    expect(guessQuality({ touch: true, width: 390, cores: 2 })).toBe('low')
  })

  it('코어 수를 모르면 화면 기준으로 정한다', () => {
    expect(guessQuality({ touch: false, width: 1280 })).toBe('high')
  })
})

describe('품질 값', () => {
  it('낮음은 그림자를 끄고 풀을 절반으로, 픽셀 비율은 1 로 고정한다', () => {
    expect(PROFILES.low.shadows).toBe(false)
    expect(PROFILES.low.grass).toBe(0.5)
    expect(PROFILES.low.dpr).toEqual([1, 1])
  })

  it('높음은 풀과 그림자를 모두 쓰고, 보통은 높음보다 픽셀 비율이 낮다', () => {
    expect(PROFILES.high.grass).toBe(1)
    expect(PROFILES.high.shadows).toBe(true)
    expect(PROFILES.normal.dpr[1]).toBeLessThan(PROFILES.high.dpr[1])
  })

  it('저장된 값을 검사한다', () => {
    expect(isQuality('low')).toBe(true)
    expect(isQuality('ultra')).toBe(false)
    expect(isQuality(undefined)).toBe(false)
  })
})

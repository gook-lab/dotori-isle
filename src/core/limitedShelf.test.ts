import { describe, expect, it } from 'vitest'
import { displayStock, LIMITED_SPOT, limitedPitch, limitedShelf, DISPLAY_SPOTS } from './shopDisplay'
import { LIMITED_TIER } from './weeklyLimited'

// 주간 한정 받침대: 2단계부터 서고, 이번 주에 샀으면 빈 받침대로 보인다. 바닥 진열 두 자리는 그대로다.
const MON = '2026-10-19'

describe('주간 한정 받침대', () => {
  it('2단계 전에는 받침대가 없다', () => {
    expect(limitedShelf(LIMITED_TIER - 1, MON, null).entry).toBeNull()
  })

  it('2단계부터 한정 칸을 보여 주고, 이번 주에 안 샀으면 살 수 있다', () => {
    const r = limitedShelf(LIMITED_TIER, MON, null)
    expect(r.entry).toMatchObject({ weekly: true, variant: expect.any(String) })
    expect(r.bought).toBe(false)
  })

  it('이번 주에 샀으면 빈 받침대(bought)이고, 다음 월요일에는 다시 산다', () => {
    expect(limitedShelf(LIMITED_TIER, '2026-10-22', MON).bought).toBe(true)
    expect(limitedShelf(LIMITED_TIER, '2026-10-26', MON).bought).toBe(false)
  })

  it('점원 소개는 이번 주에 안 샀을 때만 한정 물건을 말한다', () => {
    expect(limitedPitch(LIMITED_TIER, MON, null)).toEqual(limitedShelf(LIMITED_TIER, MON, null).entry)
    expect(limitedPitch(LIMITED_TIER, MON, MON)).toBeNull()
    expect(limitedPitch(LIMITED_TIER - 1, MON, null)).toBeNull()
    expect(limitedPitch(LIMITED_TIER, '2026-10-26', MON)).not.toBeNull()
  })

  it('받침대 자리는 바닥 진열 두 자리와 겹치지 않는다', () => {
    for (const spot of DISPLAY_SPOTS) {
      expect(Math.hypot(LIMITED_SPOT.x - spot.x, LIMITED_SPOT.z - spot.z)).toBeGreaterThan(1.5)
    }
  })

  it('바닥 진열 목록은 한정 칸을 담지 않는다', () => {
    expect(displayStock(LIMITED_TIER, MON).some((e) => e.weekly)).toBe(false)
  })
})

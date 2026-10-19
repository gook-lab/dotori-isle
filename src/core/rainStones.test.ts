import { describe, expect, it } from 'vitest'
import { generateDay } from './daily'
import { morningNews } from './morningNews'
import { rainStoneCount, RAIN_STONE_ID, RAIN_STONE_MAX, rainStoneSpawns } from './rainStones'
import { weatherFor } from './weather'

/** 비 오는 날 하나와 맑은 날 하나를 찾는다(날씨는 날짜로 정해져 있다) */
function days(n: number, want: string): string[] {
  const out: string[] = []
  for (let d = new Date(2026, 9, 1); out.length < n; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (weatherFor(key) === want) out.push(key)
  }
  return out
}

describe('rainStoneCount', () => {
  it('맑은 날에는 한 개도 깔지 않는다', () => {
    expect(rainStoneCount('2026-10-19', false)).toBe(0)
  })

  it('비 오는 날에는 2~3개이고 같은 날이면 늘 같다', () => {
    for (const key of days(5, 'rain')) {
      const n = rainStoneCount(key, true)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(RAIN_STONE_MAX)
      expect(rainStoneCount(key, true)).toBe(n)
    }
  })
})

describe('rainStoneSpawns', () => {
  it('자리가 모두 열려 있으면 정해진 수만큼 서로 다른 id 로 돌려준다', () => {
    const list = rainStoneSpawns('2026-10-20', true, (theta, d) => ({ x: Math.cos(theta) * d, z: Math.sin(theta) * d }))
    expect(list).toHaveLength(rainStoneCount('2026-10-20', true))
    expect(new Set(list.map((s) => s.id)).size).toBe(list.length)
    expect(list.every((s) => s.itemId === RAIN_STONE_ID)).toBe(true)
  })

  it('맑은 날이나 자리가 막힌 날에는 빈 목록이다', () => {
    expect(rainStoneSpawns('2026-10-20', false, () => ({ x: 0, z: 0 }))).toEqual([])
    expect(rainStoneSpawns('2026-10-20', true, () => null)).toEqual([])
  })
})

describe('generateDay 에 든 조약돌', () => {
  it('비 오는 날에는 조약돌이 깔리고 맑은 날에는 없다', () => {
    for (const key of days(3, 'rain')) {
      const stones = generateDay(key).shells.filter((s) => s.itemId === RAIN_STONE_ID)
      expect(stones.length).toBeGreaterThan(0)
      expect(stones.length).toBeLessThanOrEqual(RAIN_STONE_MAX)
    }
    for (const key of days(3, 'sunny')) {
      expect(generateDay(key).shells.some((s) => s.itemId === RAIN_STONE_ID)).toBe(false)
    }
  })
})

describe('아침 소식 한 줄', () => {
  const base = {
    weather: 'rain' as const,
    tomorrow: 'sunny' as const,
    rainbow: false,
    meteor: false,
    festival: null,
    market: false,
    marketTomorrow: false,
    tourney: false,
    visitor: null,
    birthdays: [],
    flashSale: null,
    sales: [],
    monthly: null,
    loan: 0,
  }
  it('조약돌이 있는 비 오는 날에는 날씨 다음 줄에 알린다', () => {
    const lines = morningNews({ ...base, rainStones: 2 })
    expect(lines[1]).toContain('반짝이는 조약돌이 해변에 2개')
  })
  it('없으면 그 줄을 붙이지 않는다', () => {
    expect(morningNews({ ...base, rainStones: 0 }).some((l) => l.includes('조약돌'))).toBe(false)
  })
})

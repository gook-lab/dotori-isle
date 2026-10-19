import { describe, expect, it } from 'vitest'
import { birthdayLetter } from '../core/letters'
import { FIRST_SNOW_DAY_LINE, FIRST_SNOW_EVE_LINE, firstSnowLetter, isFirstSnowDay } from '../core/firstSnow'
import { harvestFairLetter, isHarvestFairDay, HARVEST_DAY_LINE, HARVEST_EVE_LINE } from '../core/harvestFair'
import { isPumpkinDay, pumpkinLetter, PUMPKIN_DAY_LINE } from '../core/pumpkin'
import { playerBirthdayLetter } from '../core/playerBirthday'
import { NEW_SHOP } from '../core/shopTiers'
import { VILLAGERS } from '../core/villagers'
import { weatherFor } from '../core/weather'
import { newsFor } from './news'

/**
 * 계절 행사 네 가지(호박 등불 밤, 도토리 감사 장날, 첫눈 오는 날, 생일)가 한 날에 겹칠 때 서로 덮어쓰지 않는지 막는다.
 * 날짜로 정해지는 행사끼리는 같은 날에 올 수 없고, 생일은 주민·플레이어 날짜가 정해진 뒤 따로 겹친다.
 */

const YEARS = [2026, 2027, 2028]
const allDays = (y: number): string[] => {
  const out: string[] = []
  const d = new Date(Date.UTC(y, 0, 1))
  while (d.getUTCFullYear() === y) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

const home = { stage: 0 as const, loan: 0, order: null }

describe('계절 행사 날짜 겹침 표', () => {
  it('호박 등불 밤, 도토리 감사 장날, 첫눈 날은 같은 날에 겹치지 않는다', () => {
    const combos: Record<string, number> = {}
    for (const y of YEARS)
      for (const day of allDays(y)) {
        const on = [
          isPumpkinDay(day) ? '호박' : null,
          isHarvestFairDay(day) ? '장날' : null,
          isFirstSnowDay(day, weatherFor) ? '첫눈' : null,
        ].filter((x): x is string => !!x)
        if (on.length > 1) combos[`${day} ${on.join('+')}`] = (combos[`${day} ${on.join('+')}`] ?? 0) + 1
      }
    expect(combos).toEqual({})
  })

  it('편지 아이디는 한 날의 모든 행사 편지에서 서로 다르다', () => {
    const day = '2026-11-21'
    const v = VILLAGERS[0]
    const ids = [
      pumpkinLetter(day).id,
      harvestFairLetter(day).id,
      firstSnowLetter(day).id,
      playerBirthdayLetter(day).id,
      birthdayLetter(day, v).id,
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('행사 방송 줄은 같은 날 한 번만 나온다', () => {
    const days = ['2026-10-30', '2026-10-31', '2026-11-20', '2026-11-21', '2026-11-30', '2026-12-01']
    for (const day of days) {
      const lines = newsFor({ day, houses: [], shop: NEW_SHOP, home })
      expect(new Set(lines).size, day).toBe(lines.length)
    }
    expect(newsFor({ day: '2026-10-31', houses: [], shop: NEW_SHOP, home })).toContain(PUMPKIN_DAY_LINE)
    expect(newsFor({ day: '2026-11-21', houses: [], shop: NEW_SHOP, home })).toContain(HARVEST_DAY_LINE)
    expect(newsFor({ day: '2026-11-20', houses: [], shop: NEW_SHOP, home })).toContain(HARVEST_EVE_LINE)
    expect(newsFor({ day: '2026-12-01', houses: [], shop: NEW_SHOP, home })).toContain(FIRST_SNOW_DAY_LINE)
    expect(newsFor({ day: '2026-11-30', houses: [], shop: NEW_SHOP, home })).toContain(FIRST_SNOW_EVE_LINE)
  })
})

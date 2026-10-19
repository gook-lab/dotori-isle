import { describe, expect, it } from 'vitest'
import { isMeteorNight, meteorHours, prevDay, rainbowDay, rainbowHour, METEOR_ODDS } from './skyEvents'

describe('meteor nights', () => {
  it('only clear nights can be meteor nights', () => {
    const days = Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
    const onRain = days.filter((d) => isMeteorNight(d, 'rain'))
    expect(onRain).toEqual([])
  })

  it('is deterministic per day and roughly one in ten clear days', () => {
    const days = Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
    const hits = days.filter((d) => isMeteorNight(d, 'sunny'))
    expect(hits).toEqual(days.filter((d) => isMeteorNight(d, 'sunny')))
    expect(hits.length).toBeGreaterThan(400 / METEOR_ODDS / 2)
    expect(hits.length).toBeLessThan((400 / METEOR_ODDS) * 2)
  })

  it('shows only in the evening and early night hours', () => {
    expect(meteorHours(19)).toBe(false)
    expect(meteorHours(20)).toBe(true)
    expect(meteorHours(23)).toBe(true)
    expect(meteorHours(4)).toBe(true)
    expect(meteorHours(5)).toBe(false)
  })
})

describe('rainbow after rain', () => {
  it('appears on the first dry day after a rainy day', () => {
    expect(rainbowDay('rain', 'sunny')).toBe(true)
    expect(rainbowDay('rain', 'cloudy')).toBe(true)
    expect(rainbowDay('rain', 'rain')).toBe(false)
    expect(rainbowDay('sunny', 'sunny')).toBe(false)
  })

  it('is seen for three game hours in the afternoon, from 14 to 17', () => {
    expect(rainbowHour(13.9)).toBe(false)
    expect(rainbowHour(14)).toBe(true)
    expect(rainbowHour(16.5)).toBe(true)
    expect(rainbowHour(17)).toBe(false)
  })

  it('steps back a day across months and years', () => {
    expect(prevDay('2026-03-01')).toBe('2026-02-28')
    expect(prevDay('2027-01-01')).toBe('2026-12-31')
  })
})

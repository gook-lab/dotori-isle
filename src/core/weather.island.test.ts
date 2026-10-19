import { afterEach, describe, expect, it } from 'vitest'
import { ISLAND_SUNNY_DAYS, setIslandStart, weatherFor } from './weather'

afterEach(() => setIslandStart(null))

describe('섬 첫 날씨', () => {
  it('is sunny on the day the island was first visited and the day after', () => {
    setIslandStart('2026-10-19')
    expect(weatherFor('2026-10-19')).toBe('sunny')
    expect(weatherFor('2026-10-20')).toBe('sunny')
    expect(ISLAND_SUNNY_DAYS).toBe(2)
  })

  it('follows the usual rule from the third day on', () => {
    setIslandStart(null)
    const usual = [weatherFor('2026-10-21'), weatherFor('2026-10-22')]
    setIslandStart('2026-10-19')
    expect([weatherFor('2026-10-21'), weatherFor('2026-10-22')]).toEqual(usual)
  })
})

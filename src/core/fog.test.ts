import { describe, expect, it } from 'vitest'
import { FOG_CHANCE, fogActive, fogDay } from './fog'

const days = Array.from({ length: 1000 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000)
  return d.toISOString().slice(0, 10)
})

describe('안개 확률', () => {
  it('summer and winter never fog', () => {
    expect(days.some((d) => fogDay(d, 'summer', 'sunny'))).toBe(false)
    expect(days.some((d) => fogDay(d, 'winter', 'cloudy'))).toBe(false)
  })

  it('rain and snow days never fog', () => {
    expect(days.some((d) => fogDay(d, 'spring', 'rain'))).toBe(false)
    expect(days.some((d) => fogDay(d, 'autumn', 'snow'))).toBe(false)
  })

  it('spring and autumn fog near the table rate', () => {
    for (const season of ['spring', 'autumn'] as const) {
      const n = days.filter((d) => fogDay(d, season, 'sunny')).length
      expect(n / days.length).toBeGreaterThan(FOG_CHANCE[season] - 0.06)
      expect(n / days.length).toBeLessThan(FOG_CHANCE[season] + 0.06)
    }
  })

  it('is deterministic for the same day', () => {
    expect(days.map((d) => fogDay(d, 'spring', 'cloudy'))).toEqual(days.map((d) => fogDay(d, 'spring', 'cloudy')))
  })
})

describe('안개 시각', () => {
  const foggy = days.find((d) => fogDay(d, 'spring', 'sunny')) as string

  it('is visible only from 6 to before 10', () => {
    expect(fogActive(foggy, 'spring', 'sunny', 5.9)).toBe(false)
    expect(fogActive(foggy, 'spring', 'sunny', 6)).toBe(true)
    expect(fogActive(foggy, 'spring', 'sunny', 9.9)).toBe(true)
    expect(fogActive(foggy, 'spring', 'sunny', 10)).toBe(false)
  })

  it('never shows on a clear day', () => {
    const clear = days.find((d) => !fogDay(d, 'spring', 'sunny')) as string
    expect(fogActive(clear, 'spring', 'sunny', 8)).toBe(false)
  })
})

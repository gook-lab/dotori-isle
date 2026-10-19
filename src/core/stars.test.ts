import { describe, expect, it } from 'vitest'
import { CONSTELLATIONS, constellationOf, isNewSighting, nearTelescope, sanitizeStars, SKY_FROM, SKY_UNTIL, skyDir, skyViewSpread, starsComplete, TELESCOPE, telescopeOpen } from './stars'

describe('별자리 목록', () => {
  it('has twelve, three per season, with unique ids', () => {
    expect(CONSTELLATIONS).toHaveLength(12)
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      expect(CONSTELLATIONS.filter((c) => c.season === season)).toHaveLength(3)
    }
    expect(new Set(CONSTELLATIONS.map((c) => c.id)).size).toBe(12)
  })

  it('links only refer to existing points and every star is linked', () => {
    for (const c of CONSTELLATIONS) {
      for (const [a, b] of c.links) {
        expect(a).toBeLessThan(c.points.length)
        expect(b).toBeLessThan(c.points.length)
      }
      const touched = new Set(c.links.flat())
      expect(touched.size).toBe(c.points.length)
    }
  })

  it('points stay within the sky plane', () => {
    for (const c of CONSTELLATIONS) for (const [u, v] of c.points) {
      expect(Math.abs(u)).toBeLessThanOrEqual(1)
      expect(Math.abs(v)).toBeLessThanOrEqual(1)
    }
  })
})

describe('그날의 별자리', () => {
  it('picks one of the current season and is stable for the same day', () => {
    const c = constellationOf('2026-07-15', 'summer')
    expect(c.season).toBe('summer')
    expect(constellationOf('2026-07-15', 'summer').id).toBe(c.id)
  })

  it('uses all three of a season over the days', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2026, 6, 1) + i * 86400000).toISOString().slice(0, 10)
      seen.add(constellationOf(d, 'summer').id)
    }
    expect(seen.size).toBe(3)
  })
})

describe('망원경 열림', () => {
  it('opens on clear nights from 20:00 to before 04:00 only', () => {
    expect(SKY_FROM).toBe(20)
    expect(SKY_UNTIL).toBe(4)
    expect(telescopeOpen(20, 'sunny')).toBe(true)
    expect(telescopeOpen(2, 'sunny')).toBe(true)
    expect(telescopeOpen(4, 'sunny')).toBe(false)
    expect(telescopeOpen(12, 'sunny')).toBe(false)
  })

  it('stays closed when clouds or rain cover the sky', () => {
    expect(telescopeOpen(22, 'cloudy')).toBe(false)
    expect(telescopeOpen(22, 'rain')).toBe(false)
    expect(telescopeOpen(22, 'snow')).toBe(false)
  })

  it('is near the viewpoint bench', () => {
    expect(nearTelescope(TELESCOPE.x, TELESCOPE.z)).toBe(true)
    expect(nearTelescope(TELESCOPE.x + 5, TELESCOPE.z)).toBe(false)
  })
})

describe('기록과 완성', () => {
  it('records only the first sighting', () => {
    expect(isNewSighting([], 'spring-fence')).toBe(true)
    expect(isNewSighting(['spring-fence'], 'spring-fence')).toBe(false)
  })

  it('is complete only when all twelve are seen', () => {
    const all = CONSTELLATIONS.map((c) => c.id)
    expect(starsComplete(all.slice(0, 11))).toBe(false)
    expect(starsComplete(all)).toBe(true)
  })
})

describe('저장된 기록 정리', () => {
  it('drops non-arrays, unknown ids and duplicates', () => {
    expect(sanitizeStars(null)).toEqual([])
    expect(sanitizeStars('spring-fence')).toEqual([])
    expect(sanitizeStars(['spring-fence', 'nope', 'spring-fence', 3, 'winter-sled'])).toEqual(['spring-fence', 'winter-sled'])
  })
})

describe('하늘 방향', () => {
  it('narrows the spread on tall phone screens only', () => {
    expect(skyViewSpread(16 / 9)).toBeCloseTo(0.45)
    expect(skyViewSpread(390 / 844)).toBeLessThan(0.2)
  })

  it('center point looks ahead and up', () => {
    const [x, y, z] = skyDir([0, 0], 0)
    expect(x).toBeCloseTo(0)
    expect(y).toBeGreaterThan(0.1)
    expect(y).toBeLessThan(0.3)
    expect(z).toBeGreaterThan(0.5)
  })

  it('unit length in every direction', () => {
    for (const pt of [[-1, -1], [1, 1], [0.5, -0.3]] as [number, number][]) {
      const [x, y, z] = skyDir(pt, 1.2)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1)
    }
  })
})

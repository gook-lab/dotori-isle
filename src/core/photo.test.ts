import { describe, expect, it } from 'vitest'
import { CAMERA_CLEARANCE, clampOrbit, filterCss, orbitCamera, photoFileName, stampText, DEFAULT_ORBIT, ORBIT_LIMITS } from './photo'

describe('orbit limits', () => {
  it('keeps distance and pitch inside the limits and wraps yaw', () => {
    const c = clampOrbit({ yaw: 7, pitch: 9, dist: 99 })
    expect(c.dist).toBe(ORBIT_LIMITS.maxDist)
    expect(c.pitch).toBe(ORBIT_LIMITS.maxPitch)
    expect(c.yaw).toBeGreaterThanOrEqual(0)
    expect(c.yaw).toBeLessThan(Math.PI * 2)
    expect(clampOrbit({ ...DEFAULT_ORBIT, dist: 0 }).dist).toBe(ORBIT_LIMITS.minDist)
  })
})

describe('orbit camera', () => {
  const target = { x: 0, y: 1, z: 0 }
  const flat = () => 0

  it('stays on the orbit around the target', () => {
    const p = orbitCamera(target, { yaw: 0, pitch: 0, dist: 5 }, flat)
    expect(Math.hypot(p.x - target.x, p.z - target.z)).toBeCloseTo(5)
    expect(p.y).toBeCloseTo(1)
  })

  it('never goes under the terrain', () => {
    const hill = (x: number, _z: number) => (x > 0 ? 10 : 0)
    const p = orbitCamera(target, { yaw: Math.PI / 2, pitch: -0.1, dist: 4 }, hill)
    expect(p.y).toBeGreaterThanOrEqual(hill(p.x, p.z) + CAMERA_CLEARANCE)
  })
})

describe('stamp and names', () => {
  it('writes the island name with the date', () => {
    expect(stampText('2026-10-19')).toBe('도토리섬 · 2026.10.19')
    expect(photoFileName('2026-10-19')).toBe('dotori-isle-2026-10-19.png')
  })

  it('gives every filter a css string, and basic is plain', () => {
    expect(filterCss('basic')).toBe('none')
    expect(filterCss('mono')).toContain('grayscale')
  })
})

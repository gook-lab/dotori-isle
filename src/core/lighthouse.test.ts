import { describe, expect, it } from 'vitest'
import { ISLAND_R } from './island'
import { beamStrength, BEAM_LENGTH, lampAngle, lighthouseSpot, LAMP_SPEED } from './lighthouse'

describe('등대 자리', () => {
  it('sits on the north coast inside the shore', () => {
    const { x, z } = lighthouseSpot()
    const r = Math.hypot(x, z)
    expect(z).toBeLessThan(0)
    expect(r).toBeGreaterThan(ISLAND_R * 0.8)
    expect(r).toBeLessThan(ISLAND_R * 1.1)
  })
})

describe('등불과 빛줄기', () => {
  it('beam is off in daylight and on at night', () => {
    expect(beamStrength(12, false)).toBe(0)
    expect(beamStrength(19, false)).toBe(1)
    expect(beamStrength(4, false)).toBe(1)
    expect(beamStrength(5, false)).toBe(0)
  })

  it('foggy night makes the beam brighter', () => {
    expect(beamStrength(22, true)).toBeGreaterThan(beamStrength(22, false))
    expect(beamStrength(12, true)).toBe(0)
  })

  it('lamp turns steadily and wraps', () => {
    expect(lampAngle(0)).toBe(0)
    expect(lampAngle(1)).toBeCloseTo(LAMP_SPEED)
    expect(lampAngle(100)).toBeGreaterThanOrEqual(0)
    expect(lampAngle(100)).toBeLessThan(Math.PI * 2)
    expect(BEAM_LENGTH).toBeGreaterThan(ISLAND_R)
  })
})

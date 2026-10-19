import { describe, expect, it } from 'vitest'
import { footprintDepth, PUDDLE_MAX, puddleDay, puddleLevel, puddleSpots, scarfOn, umbrellaOn } from './weatherFx'

describe('puddle level', () => {
  it('a rainy day is full of puddles all day', () => {
    expect(puddleLevel('sunny', 'rain', 3)).toBe(1)
    expect(puddleLevel('cloudy', 'rain', 22)).toBe(1)
  })

  it('a dry day after no rain has none', () => {
    expect(puddleLevel('sunny', 'sunny', 12)).toBe(0)
    expect(puddleLevel('rain', 'cloudy', 4)).toBe(1)
  })

  it('after rain the puddles dry out over two hours from six in the morning', () => {
    expect(puddleLevel('rain', 'sunny', 5)).toBe(1)
    expect(puddleLevel('rain', 'sunny', 6)).toBe(1)
    expect(puddleLevel('rain', 'sunny', 7)).toBeCloseTo(0.5)
    expect(puddleLevel('rain', 'sunny', 8)).toBe(0)
    expect(puddleLevel('rain', 'sunny', 12)).toBe(0)
  })
})

describe('puddle places', () => {
  const cands = Array.from({ length: 40 }, (_, i) => ({ x: i, z: -i }))

  it('picks at most the cap, and the same places for the same day', () => {
    const a = puddleSpots('2026-10-19', cands)
    expect(a.length).toBe(PUDDLE_MAX)
    expect(puddleSpots('2026-10-19', cands)).toEqual(a)
  })

  it('a different day usually picks different places', () => {
    expect(puddleSpots('2026-10-20', cands)).not.toEqual(puddleSpots('2026-10-19', cands))
  })

  it('keeps all candidates when there are fewer than the cap', () => {
    expect(puddleSpots('2026-10-19', cands.slice(0, 3))).toHaveLength(3)
  })

  it('after rain the drying puddles stay where they were on the rainy day', () => {
    expect(puddleDay('2026-10-20', '2026-10-19', 'sunny')).toBe('2026-10-19')
    expect(puddleDay('2026-10-20', '2026-10-19', 'rain')).toBe('2026-10-20')
  })
})

describe('weather looks', () => {
  it('umbrellas in rain, scarves in snow, deeper footprints in snow', () => {
    expect(umbrellaOn('rain')).toBe(true)
    expect(umbrellaOn('snow')).toBe(false)
    expect(scarfOn('snow')).toBe(true)
    expect(scarfOn('rain')).toBe(false)
    expect(footprintDepth('snow')).toBeGreaterThan(1)
    expect(footprintDepth('sunny')).toBe(1)
  })
})

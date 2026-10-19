import { describe, expect, it } from 'vitest'
import { boughtThisVisit, isMarketDay, marketStock, marketTomorrow, MARKET_RARE, marketSiteOnIsland, mysteryPick, pickMarketSite, visitKey, weekdayOf } from './market'
import { flatWithin } from './tiers'
import { isWalkable } from './island'
import { SPAWN } from './world'

describe('market day', () => {
  it('Saturday is the market day, by the calendar', () => {
    expect(weekdayOf('2026-10-17')).toBe(6) // 2026-10-17 은 토요일
    expect(isMarketDay('2026-10-17')).toBe(true)
    expect(isMarketDay('2026-10-18')).toBe(false)
    expect(weekdayOf('bad')).toBeNull()
  })

  it('villagers can warn about it the day before', () => {
    expect(marketTomorrow('2026-10-16')).toBe(true)
    expect(marketTomorrow('2026-10-17')).toBe(false)
    expect(marketTomorrow('2026-12-31')).toBe(false)
  })
})

describe('market stock', () => {
  it('shows three different rare pieces from the list, the same on the same day', () => {
    const a = marketStock('2026-10-17')
    expect(a.rare).toHaveLength(3)
    expect(new Set(a.rare.map((r) => r.itemId)).size).toBe(3)
    for (const r of a.rare) expect(MARKET_RARE[r.itemId]).toBe(r.price)
    expect(marketStock('2026-10-17')).toEqual(a)
  })

  it('the rare pieces change from one market day to another', () => {
    const keys = ['2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07']
    const sets = new Set(keys.map((k) => marketStock(k).rare.map((r) => r.itemId).sort().join(',')))
    expect(sets.size).toBeGreaterThan(1)
  })
})

describe('mystery bag', () => {
  it('picks from the pool with the given random source', () => {
    expect(mysteryPick(() => 0)).toEqual({ itemId: 'flower-seed', count: 3 })
    expect(mysteryPick(() => 0.999999)).toEqual({ itemId: 'acorn-pouch', count: 1 })
  })
})

describe('once per visit', () => {
  it('a purchase counts for that market day only', () => {
    const bought = [visitKey('2026-10-17', 'snowman')]
    expect(boughtThisVisit(bought, '2026-10-17', 'snowman')).toBe(true)
    expect(boughtThisVisit(bought, '2026-10-24', 'snowman')).toBe(false)
    expect(boughtThisVisit(bought, '2026-10-17', 'telescope')).toBe(false)
  })
})

describe('stall site', () => {
  it('takes the first candidate that passes, scanning outward from the centre', () => {
    const site = pickMarketSite((x, z) => x > 0 && z > 0, { x: 0, z: 0 }, [5])
    expect(site).not.toBeNull()
    expect(site!.x).toBeGreaterThan(0)
    expect(site!.z).toBeGreaterThan(0)
  })

  it('returns null when nothing around the centre is good', () => {
    expect(pickMarketSite(() => false, { x: 0, z: 0 }, [3, 4])).toBeNull()
  })

  it('on the real island the stall sits on flat, walkable ground away from the water', () => {
    const site = marketSiteOnIsland()
    expect(site).not.toBeNull()
    expect(flatWithin(site!.x, site!.z, 1.4)).toBe(true)
    expect(isWalkable(site!.x, site!.z)).toBe(true)
    expect(Math.hypot(site!.x - SPAWN.x, site!.z - SPAWN.z)).toBeGreaterThan(4)
  })
})

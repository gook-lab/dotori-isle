import { describe, expect, it } from 'vitest'
import { countOf } from './inventory'
import { groundAt, isWalkable, TRIP } from './island'
import { ITEMS } from './items'
import { MILE_SHOP, MILESTONES, newMiles } from './miles'
import { craft, pickUnknown, RECIPES, STARTER_RECIPES } from './recipes'
import { blockedByProps, canStand, DOCKS, TREES, WORKBENCH } from './world'

describe('trip island', () => {
  it('is land far out at sea with water in between', () => {
    expect(groundAt(TRIP.x, TRIP.z)).toBe('grass')
    expect(groundAt(TRIP.x / 2, 0)).toBe('water')
    expect(isWalkable(TRIP.x / 2, 0)).toBe(false)
  })

  it('has orange trees', () => {
    const oranges = TREES.filter((t) => t.fruit === 'orange')
    expect(oranges.length).toBe(6)
    for (const t of oranges) expect(groundAt(t.x, t.z)).toBe('grass')
  })

  it('both docks sit on the beach, block the pelican spot, and arrive on standable ground', () => {
    expect(DOCKS.map((d) => d.id)).toEqual(['home', 'trip'])
    for (const d of DOCKS) {
      expect(groundAt(d.x, d.z)).toBe('sand')
      expect(blockedByProps(d.x, d.z)).toBe(true)
      expect(canStand(d.arrive.x, d.arrive.z)).toBe(true)
    }
  })

  it('the workbench blocks walking and sits on grass', () => {
    expect(blockedByProps(WORKBENCH.x, WORKBENCH.z)).toBe(true)
    expect(groundAt(WORKBENCH.x, WORKBENCH.z)).toBe('grass')
  })
})

describe('DIY recipes', () => {
  it('every recipe makes a known furniture item from known materials', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.id].kind).toBe('furniture')
      for (const m of Object.keys(r.materials)) expect(ITEMS[m]).toBeDefined()
    }
    for (const s of STARTER_RECIPES) expect(RECIPES.some((r) => r.id === s)).toBe(true)
  })

  it('crafting consumes materials and adds the result', () => {
    const r = RECIPES.find((x) => x.id === 'stone-lantern')!
    expect(craft(r, [{ id: 'stone', count: 5 }, { id: 'wood', count: 2 }])).toBeNull()
    const inv = craft(r, [{ id: 'stone', count: 7 }, { id: 'wood', count: 2 }])!
    expect(countOf(inv, 'stone')).toBe(1)
    expect(countOf(inv, 'wood')).toBe(0)
    expect(countOf(inv, 'stone-lantern')).toBe(1)
  })

  it('crafting fails when the result has nowhere to go', () => {
    const r = RECIPES.find((x) => x.id === 'log-stool')!
    const full = [{ id: 'wood', count: 30 }, ...Array.from({ length: 19 }, () => ({ id: 'squid', count: 1 }))]
    // 목재 4개를 써도 칸이 비지 않으므로(30→26) 결과물이 들어갈 자리가 없다.
    expect(craft(r, full)).toBeNull()
  })

  it('picks only unknown recipes', () => {
    const all = RECIPES.map((r) => r.id)
    expect(pickUnknown(all, Math.random)).toBeNull()
    expect(pickUnknown(all.slice(1), () => 0)).toBe(all[0])
  })
})

describe('mileage', () => {
  it('awards each tier once, even when several tiers are crossed at once', () => {
    const first = newMiles({ shake: 30 }, {})
    const m = MILESTONES.find((x) => x.id === 'shake')!
    expect(first.miles).toBe(m.miles[0] + m.miles[1])
    expect(first.claimed.shake).toBe(2)
    expect(newMiles({ shake: 30 }, first.claimed).miles).toBe(0)
    expect(newMiles({ shake: 100 }, first.claimed).miles).toBe(m.miles[2])
  })

  it('the exchange sells a trip ticket', () => {
    expect(MILE_SHOP.find((r) => r.id === 'trip-ticket')?.cost).toBeGreaterThan(0)
  })
})

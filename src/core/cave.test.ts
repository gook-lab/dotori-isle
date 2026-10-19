import { describe, expect, it } from 'vitest'
import { CHEST_EVERY, EMPTY_CAVE, sanitizeCave, caveOpen, chestDue, chestItem, chestWeek, MINE_PER_DAY, minesLeft, ORE_IDS, ORES, oreFor, tideHigh } from './cave'
import { FOSSIL_SPECIES } from './items'
import { RECIPES } from './recipes'

describe('광석 표', () => {
  it('has three ores with weights summing to one and distinct ids', () => {
    expect(ORES).toHaveLength(3)
    expect(ORES.reduce((a, o) => a + o.weight, 0)).toBeCloseTo(1)
    expect(new Set(ORE_IDS).size).toBe(3)
  })

  it('rarer ore sells for more', () => {
    const [amber, amethyst, moon] = ORES
    expect(amber.price).toBeLessThan(amethyst.price)
    expect(amethyst.price).toBeLessThan(moon.price)
  })

  it('oreFor is deterministic and covers all three over many seeds', () => {
    expect(oreFor(42).id).toBe(oreFor(42).id)
    const seen = new Set<string>()
    for (let s = 0; s < 400; s++) seen.add(oreFor(s * 7919).id)
    expect(seen.size).toBe(3)
  })
})

describe('캐기 횟수', () => {
  it('gives three mines a day and resets on a new day', () => {
    expect(MINE_PER_DAY).toBe(3)
    expect(minesLeft('2026-05-01', { day: '2026-05-01', mined: 0 })).toBe(3)
    expect(minesLeft('2026-05-01', { day: '2026-05-01', mined: 2 })).toBe(1)
    expect(minesLeft('2026-05-01', { day: '2026-05-01', mined: 3 })).toBe(0)
    expect(minesLeft('2026-05-02', { day: '2026-05-01', mined: 3 })).toBe(3)
  })
})

describe('밀물', () => {
  it('is high twice a day around 6 and 18 o’clock', () => {
    expect(tideHigh(6)).toBe(true)
    expect(tideHigh(18)).toBe(true)
    expect(tideHigh(12)).toBe(false)
    expect(tideHigh(0)).toBe(false)
  })

  it('closes the cave only while the tide is high', () => {
    expect(caveOpen(6)).toBe(false)
    expect(caveOpen(10)).toBe(true)
    expect(caveOpen(19)).toBe(false)
    expect(caveOpen(22)).toBe(true)
  })

  it('stays high for a few hours each time', () => {
    const hours = Array.from({ length: 48 }, (_, i) => i / 2).filter((h) => tideHigh(h))
    // 하루 두 번, 각각 세 시간 남짓
    expect(hours.length).toBeGreaterThan(8)
    expect(hours.length).toBeLessThan(16)
  })
})

describe('주간 상자', () => {
  it('opens once per week of days', () => {
    expect(CHEST_EVERY).toBe(7)
    expect(chestWeek(0)).toBe(0)
    expect(chestWeek(6)).toBe(0)
    expect(chestWeek(7)).toBe(1)
    expect(chestDue(7, 0)).toBe(true)
    expect(chestDue(8, 1)).toBe(false)
  })

  it('gives the same item for the same week', () => {
    expect(chestItem(3, [])).toEqual(chestItem(3, []))
  })

  it('gives a fossil or a recipe the player has not learned', () => {
    const learned = ['log-stool']
    for (let w = 0; w < 40; w++) {
      const it = chestItem(w, learned)
      if (it.kind === 'recipe') {
        expect(RECIPES.map((r) => r.id)).toContain(it.id)
        expect(learned).not.toContain(it.id)
      } else {
        expect(FOSSIL_SPECIES).toContain(it.id)
      }
    }
  })

  it('gives only fossils once every recipe is learned', () => {
    const all = RECIPES.map((r) => r.id)
    for (let w = 0; w < 20; w++) expect(chestItem(w, all).kind).toBe('fossil')
  })
})

describe('sanitizeCave', () => {
  it('정상 기록은 그대로 둔다', () => {
    expect(sanitizeCave({ day: '2026-10-19', mined: 2, chestWeek: 3 })).toEqual({ day: '2026-10-19', mined: 2, chestWeek: 3 })
  })
  it('망가진 값은 빈 기록으로 바꾼다', () => {
    expect(sanitizeCave(undefined)).toEqual(EMPTY_CAVE)
    expect(sanitizeCave({ day: 'nope', mined: 1, chestWeek: 0 })).toEqual(EMPTY_CAVE)
    expect(sanitizeCave({ day: '2026-10-19', mined: 9, chestWeek: 0 })).toEqual(EMPTY_CAVE)
    expect(sanitizeCave({ day: '2026-10-19', mined: 1, chestWeek: -5 })).toEqual(EMPTY_CAVE)
  })
})

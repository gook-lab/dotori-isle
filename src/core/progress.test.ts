import { describe, expect, it } from 'vitest'
import { generateDay } from './daily'
import { BLOOM, growOvernight, type Plant } from './garden'
import { groundAt } from './island'
import { ITEMS, TOOLS } from './items'
import { dailyQuests, isComplete, MAIN_QUESTS, QUESTS, questProgress } from './quests'
import { blockedByProps, ROCKS } from './world'

describe('garden', () => {
  const p = (stage: number, watered: boolean): Plant => ({ id: 'p', x: 0, z: 0, color: '#fff', stage, watered })

  it('only watered plants grow, and watering resets overnight', () => {
    const { plants, bloomed } = growOvernight([p(0, true), p(1, false), p(2, true), p(BLOOM, true)])
    expect(plants.map((x) => x.stage)).toEqual([1, 1, BLOOM, BLOOM])
    expect(plants.every((x) => !x.watered)).toBe(true)
    expect(bloomed).toBe(1)
  })
})

describe('rocks and dig spots', () => {
  it('ten home rocks and two trip rocks block walking', () => {
    expect(ROCKS.filter((r) => !r.id.startsWith('trip'))).toHaveLength(13)
    expect(ROCKS.filter((r) => r.id.startsWith('trip'))).toHaveLength(2)
    for (const r of ROCKS) expect(blockedByProps(r.x, r.z)).toBe(true)
  })

  it('nine home dig spots per day (one on the beach) and two on the trip island', () => {
    const all = generateDay('2026-10-18').digs
    const digs = all.filter((d) => !d.id.includes('tdig'))
    expect(digs).toHaveLength(9)
    expect(all.filter((d) => d.id.includes('tdig'))).toHaveLength(2)
    expect(digs.filter((d) => groundAt(d.x, d.z) === 'sand')).toHaveLength(1)
    for (const d of digs) expect(ITEMS[d.itemId]).toBeDefined()
  })
})

describe('quests', () => {
  it('every reference resolves: next quests, reward items and tools', () => {
    for (const q of MAIN_QUESTS) {
      for (const n of q.next ?? []) expect(QUESTS[n]).toBeDefined()
      for (const [id] of q.reward.items ?? []) expect(ITEMS[id]).toBeDefined()
      for (const t of q.reward.tools ?? []) expect(TOOLS[t]).toBeDefined()
    }
  })

  it('counts progress from the baseline and caps at the target', () => {
    const q = QUESTS.welcome
    const base = { shake: 5, earn: 40 }
    expect(questProgress(q, { shake: 6, earn: 40 }, base).map((p) => p.current)).toEqual([1, 0])
    expect(isComplete(q, { shake: 9, earn: 500 }, base)).toBe(true)
  })

  it('absolute goals ignore the baseline', () => {
    const q = QUESTS['home-mocha']
    expect(isComplete(q, { 'build:mocha': 1 }, { 'build:mocha': 1 })).toBe(true)
  })

  it('daily quests are two different ones, stable per day', () => {
    const a = dailyQuests('2026-10-18')
    expect(a).toEqual(dailyQuests('2026-10-18'))
    expect(a[0].title).not.toBe(a[1].title)
  })
})

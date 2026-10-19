import { describe, expect, it } from 'vitest'
import { lightingAt, isNight, timeLabel } from './clock'
import { bugPosition, generateDay } from './daily'
import { BITE_WINDOW, CAST_TIME, pressFishing, startCast, tickFishing, type FishingState } from './fishing'
import { addItem, INVENTORY_SIZE, totalValue } from './inventory'
import { groundAt, heightAt, ISLAND_R, isWalkable, normDist } from './island'
import { ITEMS, josa } from './items'
import { dateKey, mulberry32 } from './rng'
import { blockedByProps, canStand, SPAWN, TREES } from './world'

describe('inventory', () => {
  it('stacks up to the item limit then opens a new slot', () => {
    const { inv, added } = addItem([], 'peach', 13)
    expect(added).toBe(13)
    expect(inv).toEqual([
      { id: 'peach', count: 10 },
      { id: 'peach', count: 3 },
    ])
  })

  it('does not stack items with stack 1', () => {
    const { inv } = addItem(addItem([], 'sea-bass').inv, 'sea-bass')
    expect(inv).toHaveLength(2)
  })

  it('reports partial adds when full', () => {
    const full = Array.from({ length: INVENTORY_SIZE }, () => ({ id: 'squid', count: 1 }))
    expect(addItem(full, 'peach').added).toBe(0)
    const almost = [...full.slice(1), { id: 'peach', count: 9 }]
    expect(addItem(almost, 'peach', 3).added).toBe(1)
  })

  it('sums sale value', () => {
    expect(totalValue([{ id: 'peach', count: 3 }, { id: 'coral', count: 1 }])).toBe(3 * 20 + 80)
  })
})

describe('island', () => {
  it('is grass in the middle, water far out', () => {
    expect(groundAt(0, 0)).toBe('grass')
    expect(groundAt(ISLAND_R * 1.4, 0)).toBe('water')
    expect(heightAt(ISLAND_R * 1.4, 0)).toBeLessThan(0)
    expect(heightAt(0, 0)).toBeGreaterThan(0.8)
  })

  it('has a sand ring between grass and water', () => {
    const x = 0.9 * ISLAND_R
    // 방향마다 반경이 달라서 정규화 거리로 맞춘다.
    const scale = 0.9 / normDist(x, 0)
    expect(groundAt(x * scale, 0)).toBe('sand')
    expect(isWalkable(x * scale, 0)).toBe(true)
  })

  it('spawn is standable and trees block', () => {
    expect(canStand(SPAWN.x, SPAWN.z)).toBe(true)
    const t = TREES[0]
    expect(blockedByProps(t.x, t.z)).toBe(true)
    expect(TREES.filter((x) => x.kind === 'fruit').length).toBeGreaterThanOrEqual(5)
  })
})

describe('daily layout', () => {
  it('is deterministic per date and differs between dates', () => {
    expect(generateDay('2026-10-18')).toEqual(generateDay('2026-10-18'))
    expect(generateDay('2026-10-18').shells).not.toEqual(generateDay('2026-10-19').shells)
  })

  it('places shells on sand and bugs on grass', () => {
    const { shells, bugs: all } = generateDay('2026-10-18')
    // 집 섬 16개 + 여행 섬 5개 (+ 유리병·표류 소포는 날마다 따로 붙는다)
    expect(shells.filter((s) => s.itemId !== 'bottle' && s.itemId !== 'parcel').length).toBe(21)
    expect(shells.filter((s) => s.itemId === 'parcel').length).toBeLessThanOrEqual(2)
    for (const s of shells) expect(groundAt(s.x, s.z)).toBe('sand')
    // 물웅덩이 생물은 웅덩이(모래) 위라서 섬 벌레 검사에서 뺀다
    const bugs = all.filter((b) => !b.pool)
    expect(bugs.length).toBe(19)
    for (const b of bugs) {
      expect(groundAt(b.x, b.z)).toBe('grass')
      expect(ITEMS[b.day].kind).toBe('bug')
    }
  })

  it('bugs hover above ground', () => {
    const b = generateDay('2026-10-18').bugs[0]
    const [, y] = bugPosition(b, 12.3, false)
    expect(y).toBeGreaterThan(heightAt(b.x, b.z))
  })
})

describe('fishing', () => {
  const run = (s: FishingState, seconds: number) => {
    let st = s
    const events = []
    for (let t = 0; t < seconds; t += 0.05) {
      const [next, ev] = tickFishing(st, 0.05)
      st = next
      if (ev) events.push(ev)
    }
    return { st, events }
  }

  it('bites after the wait and catches inside the window', () => {
    const cast = startCast(40, 0, mulberry32(1), false)
    if (cast.phase !== 'cast') throw new Error('expected cast')
    const { st } = run(cast, CAST_TIME + cast.biteAt + 0.1)
    expect(st.phase).toBe('bite')
    const [reel, ev] = pressFishing(st)
    expect(reel.phase).toBe('reel')
    expect(ev).toEqual({ type: 'caught', fishId: cast.fishId })
  })

  it('escapes when pulled early', () => {
    const { st } = run(startCast(40, 0, mulberry32(2), false), CAST_TIME + 0.2)
    expect(st.phase).toBe('wait')
    expect(pressFishing(st)[1]).toEqual({ type: 'escaped', early: true })
  })

  it('escapes when the bite window passes, then returns to idle', () => {
    const cast = startCast(40, 0, mulberry32(3), true)
    if (cast.phase !== 'cast') throw new Error('expected cast')
    const { st, events } = run(cast, CAST_TIME + cast.biteAt + BITE_WINDOW + 2)
    expect(events).toEqual([{ type: 'escaped', early: false }])
    expect(st.phase).toBe('idle')
  })

  it('never offers day-only fish at night', () => {
    const rng = mulberry32(9)
    for (let i = 0; i < 200; i++) {
      const s = startCast(0, 0, rng, true)
      if (s.phase === 'cast') expect(s.fishId).not.toBe('sea-bass')
    }
  })
})

describe('clock & text', () => {
  it('labels and classifies hours', () => {
    expect(timeLabel(15.5)).toBe('오후 3:30')
    expect(timeLabel(0.25)).toBe('오전 12:15')
    expect(isNight(20)).toBe(true)
    expect(isNight(12)).toBe(false)
    expect(lightingAt(12).sunIntensity).toBeGreaterThan(lightingAt(23).sunIntensity)
  })

  it('picks the right particle', () => {
    expect(josa('복숭아', '을', '를')).toBe('복숭아를')
    expect(josa('농어', '을', '를')).toBe('농어를')
    expect(josa('참돔', '을', '를')).toBe('참돔을')
  })

  it('formats local date keys', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

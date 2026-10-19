import { describe, expect, it } from 'vitest'
import { fishPosition, generateDay, LURE_R, nearestFish } from './daily'
import { BITE_WINDOW, CAST_TIME, castAtShadow, castEmpty, pressFishing, tickFishing, type FishingEvent, type FishingState } from './fishing'
import { groundAt } from './island'
import { BUG_TABLE, FISH_TABLE, ITEMS, speciesFor } from './items'
import { mulberry32 } from './rng'
import { seasonFor, seasonOfMonth, SEASON_INFO } from './season'

const run = (s: FishingState, secs: number) => {
  const events: FishingEvent[] = []
  let st = s
  for (let t = 0; t < secs; t += 0.05) {
    const [next, ev] = tickFishing(st, 0.05)
    st = next
    if (ev) events.push(ev)
  }
  return { st, events }
}

describe('seasons', () => {
  it('maps months to the four seasons', () => {
    expect([3, 6, 9, 12].map(seasonOfMonth)).toEqual(['spring', 'summer', 'autumn', 'winter'])
    expect(seasonOfMonth(2)).toBe('winter')
    expect(seasonFor('2026-10-18')).toBe('autumn')
    for (const info of Object.values(SEASON_INFO)) expect(info.leaves).toHaveLength(4)
  })

  it('seasonal species only appear in their season', () => {
    expect(speciesFor(BUG_TABLE, false, false, 'summer').some((s) => s.id === 'cicada')).toBe(true)
    expect(speciesFor(BUG_TABLE, false, false, 'autumn').some((s) => s.id === 'cicada')).toBe(false)
    expect(speciesFor(BUG_TABLE, false, false).some((s) => s.id === 'red-dragonfly')).toBe(false)
    expect(speciesFor(FISH_TABLE, false, false, 'winter').some((s) => s.id === 'yellowtail')).toBe(true)
    for (const s of [...FISH_TABLE, ...BUG_TABLE]) expect(ITEMS[s.id]).toBeDefined()
    expect(generateDay('2026-07-10').bugs.some((b) => b.day === 'red-dragonfly')).toBe(false)
  })
})

describe('fish shadows', () => {
  const layout = generateDay('2026-10-18')

  it('swim in open water and every fish has a shadow size', () => {
    expect(layout.fish.length).toBeGreaterThanOrEqual(12)
    for (const f of layout.fish) {
      for (const t of [0, 40, 300]) {
        const p = fishPosition(f, t)
        expect(groundAt(p.x, p.z)).toBe('water')
      }
    }
    for (const s of FISH_TABLE) expect(s.shadow).toBeGreaterThan(0)
  })

  it('lures only shadows within reach that are not gone', () => {
    const f = layout.fish[0]
    const p = fishPosition(f, 10)
    expect(nearestFish(layout.fish, [], p.x + 1, p.z, 10)?.f.id).toBe(f.id)
    expect(nearestFish(layout.fish, [f.id], p.x + 1, p.z, 10)?.f.id).not.toBe(f.id)
    expect(nearestFish(layout.fish, [], p.x + LURE_R + 30, p.z + 30, 10)).toBeNull()
  })

  it('a lured fish swims over, nibbles, then bites as the shadow species', () => {
    const cast = castAtShadow(0, 0, mulberry32(1), { id: 'f1', fishId: 'sea-bass', x: 2, z: 0 })
    if (cast.phase !== 'cast' || !cast.lure) throw new Error('expected lure')
    expect(cast.biteAt).toBeGreaterThan(cast.lure.approach)
    const { st } = run(cast, CAST_TIME + cast.biteAt + 0.1)
    expect(st.phase).toBe('bite')
    expect(pressFishing(st)[1]).toEqual({ type: 'caught', fishId: 'sea-bass' })
    const missed = run(cast, CAST_TIME + cast.biteAt + BITE_WINDOW + 0.2).events
    expect(missed).toEqual([{ type: 'escaped', early: false, lureId: 'f1' }])
  })

  it('empty water never bites and says so', () => {
    const { events } = run(castEmpty(0, 0), 8)
    expect(events).toEqual([{ type: 'nothing' }])
    expect(pressFishing(run(castEmpty(0, 0), 1).st)[1]).toBeNull()
  })
})

describe('dialog moods', () => {
  it('reads a mood from the line', async () => {
    const { moodOf } = await import('./villagers')
    expect(moodOf('헤에?!')).toBe('surprised')
    expect(moodOf('와아, 고마워! 답례로 도토리 줄게.')).toBe('happy')
    expect(moodOf('미안… 오늘은 좀 피곤해')).toBe('sad')
    expect(moodOf('안녕! 나는 소다.')).toBe('calm')
  })
})

describe('daily requests', () => {
  it('only ask for things you can get that day', async () => {
    const { dailyRequest, VILLAGERS } = await import('./villagers')
    const { weatherFor } = await import('./weather')
    for (let i = 0; i < 120; i++) {
      const day = `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
      const season = seasonFor(day)
      for (const v of VILLAGERS) {
        const f = FISH_TABLE.find((x) => x.id === dailyRequest(v.id, day))
        if (!f) continue
        if (f.seasons) expect(f.seasons).toContain(season)
        if (f.rain) expect(weatherFor(day)).toBe('rain')
      }
    }
  })
})

describe('catch quips', () => {
  it('every catchable fish and bug has its own line', async () => {
    const { catchQuip } = await import('./quips')
    for (const s of [...FISH_TABLE, ...BUG_TABLE]) {
      const q = catchQuip(s.id)
      expect(q.length).toBeGreaterThan(5)
      if (ITEMS[s.id].kind !== 'junk') expect(q).toContain(ITEMS[s.id].name)
    }
  })
})

describe('villager homes', () => {
  it('rooms are flat, walkable inside and blocked by furniture and walls', async () => {
    const { roomCenter, roomWalkable, ROOM_ENTRY, ROOM_FURNITURE, ROOM_HOST, ROOM_W } = await import('./interior')
    const { heightAt, isWalkable } = await import('./island')
    const { canStand } = await import('./world')
    const c = roomCenter(3)
    expect(heightAt(c.x, c.z)).toBeCloseTo(0.1)
    expect(canStand(c.x + ROOM_ENTRY.x, c.z + ROOM_ENTRY.z)).toBe(true)
    expect(canStand(c.x + ROOM_HOST.x, c.z + ROOM_HOST.z)).toBe(true)
    const bed = ROOM_FURNITURE[0]
    expect(roomWalkable(c.x + bed.x, c.z + bed.z)).toBe(false)
    expect(isWalkable(c.x + ROOM_W, c.z)).toBe(false)
  })

  it('built villagers go home late at night only', async () => {
    const { isHomeAt, VILLAGERS } = await import('./villagers')
    const v = VILLAGERS[0]
    expect(isHomeAt(v, 23, [v.id])).toBe(true)
    expect(isHomeAt(v, 3, [v.id])).toBe(true)
    expect(isHomeAt(v, 14, [v.id])).toBe(false)
    expect(isHomeAt(v, 23, [])).toBe(false)
  })
})

describe('time of day', () => {
  it('has a long evening and a sun that crosses the sky', async () => {
    const { dayPart, lightingAt, sunDirection } = await import('./clock')
    expect([6, 9, 13, 18, 22].map(dayPart)).toEqual(['dawn', 'morning', 'day', 'evening', 'night'])
    // 저녁은 낮보다 어둡고 밤보다 밝다
    expect(lightingAt(18.5).sunIntensity).toBeLessThan(lightingAt(13).sunIntensity)
    expect(lightingAt(18.5).sunIntensity).toBeGreaterThan(lightingAt(22).sunIntensity)
    // 아침엔 동쪽(+x), 저녁엔 서쪽(-x)에서 비추고 한낮엔 높다
    expect(sunDirection(7)[0]).toBeGreaterThan(0.5)
    expect(sunDirection(17.5)[0]).toBeLessThan(-0.5)
    expect(sunDirection(12.3)[1]).toBeGreaterThan(0.95)
  })
})

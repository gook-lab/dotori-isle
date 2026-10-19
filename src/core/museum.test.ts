import { describe, expect, it } from 'vitest'
import { ITEMS, TIDE_TABLE } from './items'
import { BENCHES, canDonate, curatorLine, DONATABLE, donate, donationKind, DONATION_MILES, museumLayout, museumOpen, museumSite, museumSolids, MUSEUM_SITE, pickMuseumPlot, POTS, sanitizeDonated, slotOffset, TANK_R, ZONE_MILES, zoneProgress } from './museum'

const dexOf = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]))

describe('전시관 문 열림', () => {
  it('opens when ten species are in the dex', () => {
    expect(museumOpen(dexOf(...DONATABLE.slice(0, 9)))).toBe(false)
    expect(museumOpen(dexOf(...DONATABLE.slice(0, 10)))).toBe(true)
  })
})

describe('기증 대상', () => {
  it('takes every fish and bug, the tide-pool creatures, and the six fossil species, and nothing else', () => {
    const fish = Object.values(ITEMS).filter((d) => d.kind === 'fish')
    const bugs = Object.values(ITEMS).filter((d) => d.kind === 'bug' && !TIDE_TABLE.some((t) => t.id === d.id))
    expect(DONATABLE).toHaveLength(fish.length + bugs.length + TIDE_TABLE.length + 6)
    expect(donationKind('tide-crab')).toBe('tide')
    expect(donationKind('tide-starfish')).toBe('tide')
    expect(donationKind('amber-bug')).toBe('fossil')
    expect(donationKind('sea-bass')).toBe('fish')
    expect(donationKind('ladybug')).toBe('bug')
    expect(donationKind('fossil')).toBe('fossil')
    expect(donationKind('acorn-pouch')).toBeNull()
    expect(donationKind('peach')).toBeNull()
  })

  it('drops unknown or repeated ids from a saved list', () => {
    expect(sanitizeDonated(['sea-bass', 'nope', 'sea-bass', 'fossil'])).toEqual(['sea-bass', 'fossil'])
    expect(sanitizeDonated(undefined)).toEqual([])
    expect(sanitizeDonated('fossil')).toEqual([])
  })
})

describe('기증 가능 여부', () => {
  const dex = dexOf('sea-bass', 'fossil')
  it('needs the species in the dex, one in the pocket, and no earlier donation', () => {
    expect(canDonate('sea-bass', dex, [], 1)).toEqual({ ok: true })
    expect(canDonate('sea-bass', dex, [], 0).ok).toBe(false)
    expect(canDonate('mackerel', dex, [], 1).ok).toBe(false)
    expect(canDonate('sea-bass', dex, ['sea-bass'], 1).ok).toBe(false)
    expect(canDonate('peach', dex, [], 1).ok).toBe(false)
  })
})

describe('기증 마일리지와 구역 보너스', () => {
  it('pays a fixed amount per donation', () => {
    const r = donate([], 'sea-bass')
    expect(r.donated).toEqual(['sea-bass'])
    expect(r.miles).toBe(DONATION_MILES)
    expect(r.zone).toBeNull()
  })

  it('adds the zone bonus only on the donation that completes the zone', () => {
    const fossils = DONATABLE.filter((id) => donationKind(id) === 'fossil')
    expect(donate(fossils.slice(0, -1), fossils[fossils.length - 1]).zone).toBe('fossil')
    expect(donate(fossils.slice(0, -1), fossils[fossils.length - 1]).miles).toBe(DONATION_MILES + ZONE_MILES)
    expect(donate([], 'fossil').zone).toBeNull()

    const fish = Object.values(ITEMS).filter((d) => d.kind === 'fish').map((d) => d.id)
    const almost = fish.slice(0, -1)
    expect(donate(almost, fish[fish.length - 1]).zone).toBe('fish')
    // 이미 다 찬 구역에 또 넣을 수는 없다. 그래서 보너스는 한 번만 난다.
    const full = donate(almost, fish[fish.length - 1]).donated
    expect(zoneProgress(full, 'fish')).toEqual({ done: fish.length, total: fish.length })
  })

  it('gives the tide-pool zone its own completion bonus', () => {
    const tide = DONATABLE.filter((id) => donationKind(id) === 'tide')
    expect(tide).toEqual(TIDE_TABLE.map((t) => t.id))
    expect(donate(tide.slice(0, -1), tide[tide.length - 1])).toEqual({ donated: tide, miles: DONATION_MILES + ZONE_MILES, zone: 'tide' })
    expect(zoneProgress(tide.slice(0, 1), 'tide')).toEqual({ done: 1, total: tide.length })
  })
})

describe('전시 배치', () => {
  const fish = Object.values(ITEMS).filter((d) => d.kind === 'fish').map((d) => d.id)
  const bugs = Object.values(ITEMS).filter((d) => d.kind === 'bug' && !TIDE_TABLE.some((t) => t.id === d.id)).map((d) => d.id)

  const tide = TIDE_TABLE.map((t) => t.id)

  it('an empty museum shows every slot as a placeholder, and its furniture still blocks walking', () => {
    const l = museumLayout([])
    expect(l.tanks.flatMap((t) => t.items).every((id) => id === null)).toBe(true)
    expect(l.terrariums.flatMap((t) => t.items).every((id) => id === null)).toBe(true)
    expect(l.tidePool.items.every((id) => id === null)).toBe(true)
    expect(l.plinths.every((p) => p.itemId === null)).toBe(true)
    expect(museumSolids(l)).toHaveLength(BENCHES.length + POTS.length + l.tanks.length + l.terrariums.length + 1 + l.plinths.length)
  })

  it('puts the tide-pool creatures in the shallow pool and nowhere else', () => {
    const l = museumLayout([...tide])
    expect(l.tidePool.items).toEqual(tide)
    expect(l.tanks.flatMap((t) => t.items).every((id) => id === null)).toBe(true)
    expect(l.terrariums.flatMap((t) => t.items).every((id) => id === null)).toBe(true)
  })

  it('packs four fish to a tank and three bugs to a terrarium, keeping every donation', () => {
    const l = museumLayout([...fish, ...bugs, 'fossil'])
    expect(l.tanks.every((t) => t.items.length === 4)).toBe(true)
    expect(l.tanks.flatMap((t) => t.items)).toEqual(fish)
    expect(l.terrariums.every((t) => t.items.length === 3)).toBe(true)
    expect(l.terrariums.flatMap((t) => t.items)).toEqual(bugs)
    expect(l.plinths.map((p) => p.itemId).filter((id) => id !== null)).toEqual(['fossil'])
  })

  it('no two exhibits stand on the same spot', () => {
    const l = museumLayout([...fish, ...bugs, 'fossil'])
    const spots = [...l.tanks, ...l.terrariums, l.tidePool, ...l.plinths]
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThanOrEqual(1.2 - 1e-9)
    }
  })

  it('a tank holds up to four fish in a 2 by 2 grid inside its glass', () => {
    for (let k = 0; k < 4; k++) {
      const o = slotOffset(k)
      expect(Math.abs(o.x)).toBeLessThan(TANK_R)
      expect(Math.abs(o.z)).toBeLessThan(TANK_R)
    }
  })
})

describe('건물 자리', () => {
  it('the museum site is either found on the island or absent, and never on the market or the home', () => {
    if (!MUSEUM_SITE) return
    const plot = pickMuseumPlot()
    expect(plot).not.toBeNull()
    expect(Math.hypot(MUSEUM_SITE.x, MUSEUM_SITE.z - 2)).toBeGreaterThan(13)
  })

  it('the front door faces the plaza and the curator stands beside it', () => {
    const s = museumSite({ x: 10, z: 10 })
    expect(Math.hypot(s.door.x - 10, s.door.z - 10)).toBeCloseTo(2.1)
    expect(Math.hypot(s.curator.x - s.door.x, s.curator.z - s.door.z)).toBeCloseTo(1.7)
  })
})

describe('학예사 줄', () => {
  it('greets an empty museum differently from one with donations, and a full one thanks the player', () => {
    expect(curatorLine(0, 10)).toContain('기증해 주세요')
    expect(curatorLine(3, 10)).toContain('3점')
    expect(curatorLine(10, 10)).toContain('가득')
  })
})

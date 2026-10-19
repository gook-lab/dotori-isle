import { describe, expect, it } from 'vitest'
import { countOf, removeOne } from './inventory'
import { groundAt } from './island'
import { ITEMS, SHOP_FURNITURE } from './items'
import { canPlace, placementCell, type Placed } from './placement'
import { blockedByHouses, dailyRequest, friendshipLevel, HOUSE_R, nextLevelAt, talkLines, VILLAGERS, villagerPosition, WANDER_R } from './villagers'
import { SHOP_DOOR, TREES } from './world'

describe('inventory removal', () => {
  it('removes one from the last matching slot', () => {
    const inv = [{ id: 'peach', count: 10 }, { id: 'peach', count: 2 }]
    expect(removeOne(inv, 'peach')).toEqual([{ id: 'peach', count: 10 }, { id: 'peach', count: 1 }])
    expect(removeOne([{ id: 'squid', count: 1 }], 'squid')).toEqual([])
    expect(removeOne([], 'squid')).toBeNull()
    expect(countOf(inv, 'peach')).toBe(12)
  })
})

describe('furniture placement', () => {
  it('snaps the cell in front of the player', () => {
    expect(placementCell(0.2, 0.1, 0)).toEqual({ x: 0, z: 2 })
    expect(placementCell(0, 0, Math.PI / 2)).toEqual({ x: 2, z: 0 })
  })

  it('accepts open grass and rejects water, trees, the shop door and occupied cells', () => {
    // 고정 좌표 대신 열린 잔디 칸을 하나 찾아 쓴다(섬 배치가 바뀌어도 테스트가 버티게).
    let open: [number, number] | null = null
    for (let x = -15; x <= 15 && !open; x++) for (let z = -15; z <= 15 && !open; z++) if (canPlace(x, z, [])) open = [x, z]
    expect(open).not.toBeNull()
    const [ox, oz] = open!
    expect(canPlace(ox, oz, [], [{ x: ox, z: oz }])).toBe(false)
    const taken: Placed[] = [{ id: 'a', itemId: 'chair', x: 4, z: 4, rot: 0 }]
    expect(canPlace(4, 4, taken)).toBe(false)
    expect(canPlace(60, 0, [])).toBe(false)
    expect(canPlace(Math.round(SHOP_DOOR.x), Math.round(SHOP_DOOR.z), [])).toBe(false)
    const t = TREES[0]
    expect(canPlace(Math.round(t.x), Math.round(t.z), [])).toBe(false)
    const v = VILLAGERS[0]
    expect(canPlace(Math.round(v.home.x), Math.round(v.home.z), [])).toBe(false)
  })

  it('every shop furniture has a buy price above its resale', () => {
    expect(SHOP_FURNITURE.length).toBeGreaterThanOrEqual(5)
    for (const f of SHOP_FURNITURE) expect(f.buy!).toBeGreaterThan(f.price)
  })
})

describe('villagers', () => {
  it('every villager has a home and house plots on grass, clear of trees and each other', () => {
    expect(VILLAGERS.map((v) => v.id)).toEqual(['mocha', 'bomi', 'pengdol', 'guriguri', 'dongri', 'somi', 'soda', 'bori', 'maro', 'coco', 'yuja', 'sora', 'toto', 'kongi', 'mimi', 'gomdol', 'darami', 'bamtol', 'chumbung'])
    for (const v of VILLAGERS) {
      expect(groundAt(v.home.x, v.home.z)).toBe('grass')
      expect(groundAt(v.house.x, v.house.z)).toBe('grass')
      for (const t of TREES) {
        expect(Math.hypot(t.x - v.home.x, t.z - v.home.z)).toBeGreaterThan(WANDER_R + 1)
        expect(Math.hypot(t.x - v.house.x, t.z - v.house.z)).toBeGreaterThan(HOUSE_R + 1)
      }
      for (const o of VILLAGERS) {
        if (o === v) continue
        // 다른 주민 산책 원이 이 집과 겹치지 않는다.
        expect(Math.hypot(o.home.x - v.house.x, o.home.z - v.house.z)).toBeGreaterThan(WANDER_R + HOUSE_R)
      }
    }
    expect(VILLAGERS.filter((v) => v.newcomer && !v.guest).map((v) => v.name)).toEqual(['구리구리', '동그리'])
  })

  it('built houses block walking, unbuilt plots do not', () => {
    const v = VILLAGERS[0]
    expect(blockedByHouses(v.house.x, v.house.z, [])).toBe(false)
    expect(blockedByHouses(v.house.x, v.house.z, [v.id])).toBe(true)
  })

  it('wander stays near home', () => {
    const v = VILLAGERS[0]
    for (let t = 0; t < 200; t += 3.7) {
      const p = villagerPosition(v, t)
      expect(Math.hypot(p.x - v.home.x, p.z - v.home.z)).toBeLessThanOrEqual(WANDER_R + 0.01)
    }
  })

  it('friendship levels and thresholds', () => {
    expect(friendshipLevel(0)).toBe(0)
    expect(friendshipLevel(3)).toBe(1)
    expect(friendshipLevel(14)).toBe(2)
    expect(friendshipLevel(99)).toBe(3)
    expect(nextLevelAt(4)).toBe(8)
    expect(nextLevelAt(20)).toBeNull()
  })

  it('daily requests are deterministic and obtainable', () => {
    const r = dailyRequest('mocha', '2026-10-18')
    expect(r).toBe(dailyRequest('mocha', '2026-10-18'))
    expect(['fruit', 'shell', 'bug', 'fish']).toContain(ITEMS[r].kind)
  })

  it('talk lines change with the request state', () => {
    const v = VILLAGERS[1]
    const base = { firstToday: true, level: 0, night: false, request: 'peach', requestDone: false, hasItem: false }
    expect(talkLines(v, base)[1]).toContain('복숭아가')
    expect(talkLines(v, { ...base, hasItem: true })[1]).toContain('복숭아를')
    expect(talkLines(v, { ...base, requestDone: true })[1]).toContain('고마웠어')
  })
})

describe('yuja', () => {
  const u = VILLAGERS.find((v) => v.id === 'yuja')!
  const base = { firstToday: true, level: 0, night: false, request: 'peach', requestDone: false, hasItem: false }

  it('talks only in shouts and gestures but still tells what it wants', () => {
    const lines = talkLines(u, base)
    expect(lines[0]).toBe('얍!')
    expect(lines[1]).toContain('복숭아')
    expect(talkLines(u, { ...base, hasItem: true })[1]).toContain('와햐')
  })
})

describe('somi', () => {
  it('speaks in tiny sounds but still shows the request', () => {
    const c = VILLAGERS.find((v) => v.id === 'somi')!
    const lines = talkLines(c, { firstToday: true, level: 0, night: false, request: 'peach', requestDone: false, hasItem: false })
    expect(lines[0]).toBe('…응!')
    expect(lines[1]).toContain('복숭아')
  })
})

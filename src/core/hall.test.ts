import { describe, expect, it } from 'vitest'
import { CAVE_ROOM, HALL_OBJECTS, HALL_ROOM, HOME_ROOM, MUSEUM_ROOM, ROOM_ENTRY, roomCenter, roomWalkable } from './interior'
import { hallSite, HALL_SITE, pickHallPlot } from './hall'
import { MUSEUM_SITE } from './museum'
import { SPAWN } from './world'

describe('마을회관 — 자리', () => {
  it('방 칸 번호는 다른 방과 겹치지 않는다', () => {
    const rooms = [HOME_ROOM, MUSEUM_ROOM, CAVE_ROOM, HALL_ROOM]
    expect(new Set(rooms).size).toBe(rooms.length)
  })

  it('섬에서 자리는 항상 나오고, 광장과 전시관에서 떨어져 있다', () => {
    const plot = pickHallPlot()
    // 자리는 항상 있어야 한다(없으면 건물이 서지 않는다)
    expect(plot).not.toBeNull()
    if (!plot) return
    expect(Math.hypot(plot.x - SPAWN.x, plot.z - SPAWN.z)).toBeGreaterThanOrEqual(8)
    if (MUSEUM_SITE) expect(Math.hypot(plot.x - MUSEUM_SITE.x, plot.z - MUSEUM_SITE.z)).toBeGreaterThan(6)
    expect(HALL_SITE).not.toBeNull()
    expect(HALL_SITE!.door.z).toBeGreaterThan(HALL_SITE!.z)
  })

  it('문은 건물 남쪽(+z)에 있다', () => {
    const s = hallSite({ x: 4, z: -2 })
    expect(s.door).toEqual({ x: 4, z: -2 + 2.4 + 0.5 })
    expect(s.rot).toBe(0)
  })
})

describe('마을회관 — 방 안', () => {
  it('책상과 게시판은 방 안쪽에 있다', () => {
    for (const o of Object.values(HALL_OBJECTS)) {
      expect(Math.abs(o.x)).toBeLessThan(4)
      expect(Math.abs(o.z)).toBeLessThan(3.6)
    }
  })

  it('입구에서는 걸을 수 있고, 책상 가운데는 걸을 수 없다', () => {
    const c = roomCenter(HALL_ROOM)
    expect(roomWalkable(c.x + ROOM_ENTRY.x, c.z + ROOM_ENTRY.z)).toBe(true)
    expect(roomWalkable(c.x + HALL_OBJECTS.reception.x, c.z + HALL_OBJECTS.reception.z)).toBe(false)
    expect(roomWalkable(c.x + HALL_OBJECTS.mic.x, c.z + HALL_OBJECTS.mic.z)).toBe(false)
  })
})

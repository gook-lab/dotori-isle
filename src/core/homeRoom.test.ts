import { afterEach, describe, expect, it } from 'vitest'
import { canPlaceInHome, homeBed, homeCells, homeChest, homePlaceBlocker, homeRoomFull, homeSolids } from './home'
import { ATTIC, ATTIC_CELLS, bedOf, chestOf, entryOf, exitOf, HOME_ROOM_SIZES, homeRoom, HOME_ROOM, roomCenter, roomFloorY, roomSizeAt, roomWalkable } from './interior'
import type { Placed } from './placement'

const reset = () => {
  homeRoom.stage = 0
  homeRoom.floor = 0
}
afterEach(reset)

const at = (x: number, z: number, floor: 0 | 1 = 0): Placed => ({ id: `${x}:${z}:${floor}`, itemId: 'chair', x, z, rot: 0, floor })

describe('집 방 크기 표', () => {
  it('텐트 6×5 → 작은 집 8×6 → 큰 집·다락방 10×8 로 커진다', () => {
    expect(HOME_ROOM_SIZES.map((s) => `${s.w}x${s.d}`)).toEqual(['6x5', '8x6', '10x8', '10x8', '10x8', '10x8'])
    homeRoom.stage = 1
    expect(roomSizeAt(HOME_ROOM)).toEqual({ w: 8, d: 6 })
  })

  it('침대와 보관함은 방 뒤 모서리에 붙고, 방 안쪽에 있다', () => {
    for (const size of HOME_ROOM_SIZES) {
      for (const f of [bedOf(size), chestOf(size)]) {
        expect(Math.abs(f.x) + f.r).toBeLessThan(size.w / 2)
        expect(f.z - f.r).toBeGreaterThan(-size.d / 2)
      }
    }
    expect(homeBed(0)).toEqual(bedOf(HOME_ROOM_SIZES[0]))
    expect(homeChest(2).x).toBeCloseTo(5 - 1.3)
  })

  it('문 앞과 입구는 방 안에서 앞쪽(+z)에 있다', () => {
    for (const size of HOME_ROOM_SIZES) {
      expect(exitOf(size).z).toBeLessThan(size.d / 2)
      expect(entryOf(size).z).toBeLessThan(exitOf(size).z)
    }
  })
})

describe('방 걸을 수 있는 범위', () => {
  it('작은 방에서는 벽 가까이가 막힌다', () => {
    homeRoom.stage = 0
    const c = roomCenter(HOME_ROOM)
    expect(roomWalkable(c.x, c.z + 1.5)).toBe(true)
    expect(roomWalkable(c.x, c.z + 2.6)).toBe(false)
    expect(roomWalkable(c.x + 3.4, c.z)).toBe(false)
  })

  it('다락 위에서는 다락 바닥 안에서만 걸을 수 있고, 높이가 올라간다', () => {
    homeRoom.stage = 3
    homeRoom.floor = 1
    const c = roomCenter(HOME_ROOM)
    expect(roomWalkable(c.x + 2.5, c.z - 2)).toBe(true)
    expect(roomWalkable(c.x - 3, c.z - 2)).toBe(false)
    expect(roomFloorY(c.x + 2.5, c.z - 2)).toBeGreaterThan(1)
    homeRoom.floor = 0
    expect(roomFloorY(c.x + 2.5, c.z - 2)).toBeLessThan(0.2)
  })
})

describe('가구 칸과 층', () => {
  it('단계마다 칸이 방 크기 안에 들어간다', () => {
    for (let stage = 0 as 0 | 1 | 2 | 3; stage <= 3; stage++) {
      const size = HOME_ROOM_SIZES[stage]
      for (const cell of homeCells(stage)) {
        expect(Math.abs(cell.x)).toBeLessThan(size.w / 2)
        expect(cell.z).toBeLessThan(size.d / 2 - 0.5)
      }
    }
  })

  it('다락 칸은 3단계에서만 4×3 이고, 그 밖에서는 없다', () => {
    expect(homeCells(3, 1)).toHaveLength(ATTIC_CELLS.w * ATTIC_CELLS.h)
    expect(homeCells(2, 1)).toEqual([])
    expect(homeCells(3, 1).every((c) => c.x >= ATTIC.x0 && c.x <= ATTIC.x1 && c.z >= ATTIC.z0 && c.z <= ATTIC.z1)).toBe(true)
  })

  it('같은 칸이라도 층이 다르면 서로 방해하지 않는다', () => {
    const ground = [at(1, -3, 0)]
    expect(canPlaceInHome(1, -3, 3, ground, 0)).toBe(false)
    expect(canPlaceInHome(1, -3, 3, ground, 1)).toBe(true)
  })

  it('다락 층의 부딪힘 원에는 방바닥 침대가 들어가지 않는다', () => {
    const solids = homeSolids([at(1, -3, 0), at(2, -2, 1)], 3, 1)
    expect(solids.map((s) => [s.x, s.z])).toEqual([[2, -2]])
    expect(homeSolids([], 2, 0)).toHaveLength(2)
  })
})

describe('방이 가득 찼는지', () => {
  it('빈 방은 가득 차지 않고, 놓을 칸을 모두 막으면 가득 찬 것이다', () => {
    expect(homeRoomFull(1, [], 0)).toBe(false)
    const cells = homeCells(1, 0).map((c, i) => ({ id: `f${i}`, itemId: 'table', x: c.x, z: c.z, rot: 0 }))
    expect(homeRoomFull(1, cells, 0)).toBe(true)
  })

  it('벽에 건 가구는 바닥 칸을 막지 않아 가득 찬 것으로 보지 않는다', () => {
    const cells = homeCells(1, 0).map((c, i) => ({ id: `w${i}`, itemId: 'wall-clock', x: c.x, z: c.z, rot: 0, wall: 'n' as const }))
    expect(homeRoomFull(1, cells, 0)).toBe(false)
  })
})

describe('다락 사다리 앞 자리', () => {
  it('사다리를 올라와 서는 칸은 가구를 놓을 수 없고, 옆 칸은 놓을 수 있다', () => {
    expect(homePlaceBlocker(2, -1, 5, [], 1)).toBe('사다리 앞이라 놓을 수 없어요')
    expect(homePlaceBlocker(3, -1, 5, [], 1)).toBe('사다리 앞이라 놓을 수 없어요')
    expect(homePlaceBlocker(1, -3, 5, [], 1)).toBeNull()
    expect(homePlaceBlocker(4, -3, 5, [], 1)).toBeNull()
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { canPlaceInHome, floorOpen, homeCells, homeSolids, startHomeUpgrade, settleHome, NEW_HOME } from './home'
import { CELLAR_CELLS, HOME_MOVES, HOME_ROOM, homeFloorOf, homeRoom, roomCenter, roomSizeAt, roomSolids, roomWalkable, SIDE_CELLS, SIDE_ROOM } from './interior'
import type { Placed } from './placement'
import { scoreHome } from './homeScore'

const reset = () => {
  homeRoom.stage = 0
  homeRoom.floor = 0
  roomSolids.home = []
}
afterEach(reset)

const at = (x: number, z: number, floor: 0 | 1 | 2 | 3 = 0, itemId = 'chair'): Placed => ({ id: `${x}:${z}:${floor}`, itemId, x, z, rot: 0, floor })

describe('옆방·지하실 증축 값', () => {
  it('옆방은 빚 7000, 지하실은 빚 9000 으로 짓고 빚이 0 이어야 맡길 수 있다', () => {
    const r = startHomeUpgrade({ ...NEW_HOME, stage: 3 }, '2026-10-18')
    expect(r.ok && r.to).toBe(4)
    expect(r.ok && r.state.loan).toBe(7000)
    expect(startHomeUpgrade({ ...NEW_HOME, stage: 3, loan: 10 }, '2026-10-18').ok).toBe(false)
  })

  it('맡긴 다음 날 아침에 옆방이 완성된다', () => {
    const r = startHomeUpgrade({ ...NEW_HOME, stage: 3 }, '2026-10-18')
    if (!r.ok) throw new Error('맡기기가 막혔어요')
    expect(settleHome(r.state, '2026-10-18').stage).toBe(3)
    expect(settleHome(r.state, '2026-10-19').stage).toBe(4)
  })
})

describe('자리 열림과 가구 칸', () => {
  it('자리마다 여는 단계가 다르다: 다락 3, 옆방 4, 지하실 5', () => {
    expect(floorOpen(2, 1)).toBe(false)
    expect(floorOpen(3, 1)).toBe(true)
    expect(floorOpen(3, 2)).toBe(false)
    expect(floorOpen(4, 2)).toBe(true)
    expect(floorOpen(4, 3)).toBe(false)
    expect(floorOpen(5, 3)).toBe(true)
  })

  it('옆방 가구 칸은 5×4, 지하실은 6×5 이고 열리지 않은 자리는 칸이 없다', () => {
    expect(homeCells(4, 2)).toHaveLength(SIDE_CELLS.w * SIDE_CELLS.h)
    expect(homeCells(5, 3)).toHaveLength(CELLAR_CELLS.w * CELLAR_CELLS.h)
    expect(homeCells(3, 2)).toEqual([])
    expect(homeCells(4, 3)).toEqual([])
  })

  it('가구는 자리마다 따로 놓인다: 옆방 칸에 본채 가구가 있어도 옆방 칸은 비어 있다', () => {
    const sideCell = { x: SIDE_CELLS.x0, z: SIDE_CELLS.z0 }
    expect(canPlaceInHome(sideCell.x, sideCell.z, 4, [at(sideCell.x, sideCell.z, 0)], 2)).toBe(true)
    expect(canPlaceInHome(sideCell.x, sideCell.z, 4, [at(sideCell.x, sideCell.z, 2)], 2)).toBe(false)
  })

  it('옆방과 지하실에는 침대·보관함 원이 없다', () => {
    expect(homeSolids([at(0, 0, 2)], 4, 2)).toEqual([{ x: 0, z: 0, r: expect.any(Number) }])
    expect(homeSolids([], 5, 3)).toEqual([])
  })
})

describe('자리 이동과 걸을 수 있는 땅', () => {
  it('옆방과 지하실은 자기 방 크기 안에서만 걸을 수 있다', () => {
    homeRoom.stage = 5
    homeRoom.floor = 2
    expect(roomSizeAt(HOME_ROOM)).toEqual(SIDE_ROOM)
    const c = roomCenter(HOME_ROOM)
    expect(roomWalkable(c.x - 2.6, c.z, 0.3)).toBe(true)
    expect(roomWalkable(c.x + 4, c.z - 1, 0.3)).toBe(false)
  })

  it('이동하면 도착하는 자리는 도착한 자리 안에서 걸을 수 있다', () => {
    homeRoom.stage = 5
    for (const m of HOME_MOVES) {
      homeRoom.floor = m.to
      roomSolids.home = homeSolids([], 5, m.to)
      const c = roomCenter(HOME_ROOM)
      expect(roomWalkable(c.x + m.arrive.x, c.z + m.arrive.z, 0.3)).toBe(true)
    }
  })

  it('저장값을 자리 번호로 바꾼다. 모르는 값은 본채 방바닥이다', () => {
    expect([undefined, 0, 1, 2, 3, 9, '2'].map(homeFloorOf)).toEqual([0, 0, 1, 2, 3, 0, 0])
  })
})

describe('꾸미기 점수의 벽 판정', () => {
  it('옆방 가구는 옆방 칸 기준으로 벽에 붙었는지 본다', () => {
    const edge = { itemId: 'chair', x: SIDE_CELLS.x0, z: SIDE_CELLS.z0 }
    expect(scoreHome({ stage: 4, furniture: [{ ...edge, floor: 2 }], framed: false }).wall).toBe(1)
    expect(scoreHome({ stage: 4, furniture: [{ ...edge, floor: 0 }], framed: false }).wall).toBe(0)
  })
})

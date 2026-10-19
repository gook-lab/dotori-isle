import { describe, expect, it } from 'vitest'
import { homeCells } from './home'
import { homePlaceBlocker } from './home'
import { frameFloor, frameHung, HOME_MAX, scoreHome } from './homeScore'
import type { Placed } from './placement'
import { WALL_HEIGHT, isWallItem, rehomeSouthWalls, roomFor, wallBlocker, wallCells, wallDirOf, wallFace, wallHeightOf, wallPose, wallSlots, wallSpot, wallTopOf, WALL_ITEM_TOP, WALL_SCALE, WALL_TOP_CLEARANCE } from './wallHang'

const STAGE = 0 as const
const item = (over: Partial<Placed>): Placed => ({ id: 'w1', itemId: 'photo-frame', x: 0, z: 0, rot: 0, ...over })

describe('벽걸이 가구', () => {
  it('벽에 거는 가구는 액자와 현판이다', () => {
    expect(isWallItem('photo-frame')).toBe(true)
    expect(isWallItem('house-plaque')).toBe(true)
    expect(isWallItem('chair')).toBe(false)
  })

  it('보는 방향을 가장 가까운 벽 방향으로 바꾼다', () => {
    expect(wallDirOf(0)).toBe('s')
    expect(wallDirOf(Math.PI)).toBe('n')
    expect(wallDirOf(Math.PI / 2)).toBe('e')
    expect(wallDirOf(-Math.PI / 2)).toBe('w')
  })

  it('벽 면은 방 가장자리 칸마다 바깥 쪽에 방이 없는 면이다', () => {
    const inside = new Set(wallCells(STAGE, 0).map((c) => `${c.x},${c.z}`))
    const slots = wallSlots(STAGE, 0)
    expect(slots.length).toBeGreaterThan(0)
    for (const s of slots) {
      expect(inside.has(`${s.x},${s.z}`)).toBe(true)
      const step = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[s.dir]
      expect(inside.has(`${s.x + step[0]},${s.z + step[1]}`)).toBe(false)
    }
  })

  it('벽 자리는 벽을 보고 서야 하고, 한 면에는 하나만 걸린다', () => {
    const slot = wallSlots(STAGE, 0)[0]
    const opposite = { n: 's', s: 'n', e: 'w', w: 'e' }[slot.dir] as 'n' | 'e' | 's' | 'w'
    expect(wallBlocker(slot.x, slot.z, slot.dir, STAGE, 0, [])).toBeNull()
    expect(wallBlocker(slot.x, slot.z, opposite, STAGE, 0, [])).not.toBeNull()
    expect(wallBlocker(99, 99, slot.dir, STAGE, 0, [])).toContain('벽 앞에')
    expect(wallBlocker(slot.x, slot.z, slot.dir, STAGE, 0, [item({ wall: slot.dir, x: slot.x, z: slot.z })])).toContain('이미 걸린')
  })

  it('벽을 보고 서지 않으면 어느 벽인지 알 수 없다고 알려 준다', () => {
    const cell = homeCells(STAGE, 0)[0]
    const spot = wallSpot(cell.x, cell.z, 0, STAGE, 0, [])
    expect(spot.why).not.toBeNull()
  })

  it('벽 자리의 놓임은 벽 면 안쪽이고, 회전은 벽 방향으로 정해진다', () => {
    expect(wallPose(0, -1, 'n', STAGE, 0).rot).toBe(0)
    expect(wallPose(0, 1, 's', STAGE, 0).rot).toBeCloseTo(Math.PI)
    // 옆벽은 카메라 쪽으로 18도 돌린다
    expect(wallPose(1, 0, 'e', STAGE, 0).rot).toBeCloseTo(-Math.PI / 2 + (18 * Math.PI) / 180)
    expect(wallPose(-1, 0, 'w', STAGE, 0).rot).toBeCloseTo(Math.PI / 2 - (18 * Math.PI) / 180)
    expect(wallPose(0, -1, 'n', STAGE, 0).z).toBeLessThan(-0.4)
  })

  it('벽 가구는 바닥 칸을 막지 않는다', () => {
    // 같은 칸에 벽에 건 가구가 있어도 바닥 가구는 그 칸에 놓을 수 있다
    const c = homeCells(STAGE, 0).find((x) => homePlaceBlocker(x.x, x.z, STAGE, [], 0) === null)!
    expect(homePlaceBlocker(c.x, c.z, STAGE, [item({ wall: 'n', x: c.x, z: c.z })], 0)).toBeNull()
  })

  it('사진 점수는 벽에 건 사진이나 벽에 건 사진 액자만 든다', () => {
    expect(frameHung(true, [])).toBe(true)
    expect(frameHung(false, [item({})])).toBe(false)
    expect(frameHung(false, [item({ wall: 'n' })])).toBe(true)
    expect(frameHung(false, [item({ itemId: 'house-plaque', wall: 'n' })])).toBe(false)
  })

  it('벽시계와 작은 벽 선반도 벽에 걸린다', () => {
    expect(isWallItem('wall-clock')).toBe(true)
    expect(isWallItem('wall-shelf')).toBe(true)
  })

  it('벽걸이 모델은 벽 위 창 아래 선 높이에서 키워서 건다', () => {
    const p = wallPose(0, 0, 'n', STAGE, 0)
    expect(p.y).toBe(wallHeightOf(STAGE, 0, 'n'))
    expect(p.scale).toBe(WALL_SCALE)
    expect(WALL_SCALE).toBeGreaterThan(1)
  })
})

describe('사진 점수 — 바닥 액자 절반', () => {
  const floorFrame = item({ wall: undefined })

  it('바닥 액자만 있으면 frameFloor 이고 사진 점수는 절반이다', () => {
    expect(frameFloor(false, [floorFrame])).toBe(true)
    expect(frameFloor(false, [item({ wall: 'n' })])).toBe(false)
    const s = scoreHome({ stage: STAGE, furniture: [floorFrame], framed: frameHung(false, [floorFrame]), framedFloor: frameFloor(false, [floorFrame]) })
    expect(s.framed).toBe(false)
    expect(s.framedFloor).toBe(true)
    expect(s.parts.frame).toBe(HOME_MAX.frame / 2)
  })

  it('벽에 걸면 절반이 아니라 전체를 받는다', () => {
    const hung = [item({ wall: 'n' })]
    const s = scoreHome({ stage: STAGE, furniture: hung, framed: frameHung(false, hung), framedFloor: frameFloor(false, hung) })
    expect(s.parts.frame).toBe(HOME_MAX.frame)
    expect(s.framedFloor).toBe(false)
  })

  it('바닥 액자가 있는 기존 집은 액자 때문에 점수가 0이 되지 않는다', () => {
    const before = scoreHome({ stage: STAGE, furniture: [], framed: false, framedFloor: false }).total
    const after = scoreHome({ stage: STAGE, furniture: [floorFrame], framed: frameHung(false, [floorFrame]), framedFloor: frameFloor(false, [floorFrame]) })
    expect(after.parts.frame).toBe(HOME_MAX.frame / 2)
    expect(after.total).toBeGreaterThan(before)
  })
})

describe('카메라 쪽 벽(s)', () => {
  // 앞줄(s 쪽)이면서 오른쪽 벽에 닿은 모서리 칸: s 벽은 막히고 e 벽으로 옮겨진다
  const southCell = () => wallCells(STAGE, 0).reduce((a, b) => (b.z > a.z || (b.z === a.z && b.x > a.x) ? b : a))

  it('s 벽에는 걸 수 없고 까닭을 알려 준다', () => {
    const c = southCell()
    expect(wallBlocker(c.x, c.z, 's', STAGE, 0, [])).toBe('이쪽 벽에는 걸 수 없어요')
    expect(wallSlots(STAGE, 0).some((x) => x.dir === 's')).toBe(false)
  })

  it('저장된 s 벽 가구는 다른 벽으로 옮기거나 가방으로 돌린다', () => {
    const c = southCell()
    const moved = rehomeSouthWalls([item({ id: 'a', x: c.x, z: c.z, wall: 's' })], STAGE)
    expect(moved.bag).toHaveLength(0)
    expect(moved.items).toHaveLength(1)
    expect(moved.items[0].wall).not.toBe('s')
    expect(wallBlocker(c.x, c.z, moved.items[0].wall!, STAGE, 0, [])).toBeNull()
  })

  it('다른 가구는 그대로 둔다', () => {
    const floorItem = item({ id: 'f', itemId: 'chair', x: 0, z: 0, wall: undefined })
    const hung = item({ id: 'n', x: 0, z: -1, wall: 'n' })
    const r = rehomeSouthWalls([floorItem, hung], STAGE)
    expect(r.items).toEqual([floorItem, hung])
    expect(r.bag).toHaveLength(0)
  })

  it('옆벽 가구는 카메라 쪽으로 15~20도 돌아서 앞면이 보인다', () => {
    const e = wallPose(0, 0, 'e', STAGE, 0).rot
    const w = wallPose(0, 0, 'w', STAGE, 0).rot
    const deg = (rad: number) => Math.abs(rad) * (180 / Math.PI)
    // 앞면의 법선은 (sin rot, cos rot). 카메라는 +z 쪽이다
    expect(Math.cos(e)).toBeGreaterThan(0)
    expect(Math.cos(w)).toBeGreaterThan(0)
    expect(Math.sin(e)).toBeLessThan(0)
    expect(Math.sin(w)).toBeGreaterThan(0)
    expect(deg(e - -Math.PI / 2)).toBeGreaterThanOrEqual(15)
    expect(deg(e - -Math.PI / 2)).toBeLessThanOrEqual(20)
    expect(deg(w - Math.PI / 2)).toBeGreaterThanOrEqual(15)
    expect(deg(w - Math.PI / 2)).toBeLessThanOrEqual(20)
    expect(Math.cos(wallPose(0, 0, 'n', STAGE, 0).rot)).toBeCloseTo(1)
  })
})

describe('벽걸이 위치 — 실제 방 벽 면에 붙는다', () => {
  const STAGES = [0, 1, 2, 3, 4, 5] as const
  const FLOORS = [0, 1, 2, 3] as const
  // 벽 면에서 원점까지의 거리(방 쪽으로 잰 값)
  const gap = (dir: 'n' | 'e' | 'w', pose: { x: number; z: number }, room: { w: number; d: number }) => {
    if (dir === 'n') return pose.z - wallFace('n', room)
    if (dir === 'e') return wallFace('e', room) - pose.x
    return pose.x - wallFace('w', room)
  }

  it('모든 단계와 층의 벽 자리는 벽 면에서 0.1 이하로 떨어져 있다', () => {
    for (const stage of STAGES) {
      for (const floor of FLOORS) {
        const room = roomFor(stage, floor)
        for (const slot of wallSlots(stage, floor)) {
          const pose = wallPose(slot.x, slot.z, slot.dir, stage, floor)
          const d = gap(slot.dir as 'n' | 'e' | 'w', pose, room)
          expect(d, `stage ${stage} floor ${floor} ${slot.dir}@${slot.x},${slot.z}`).toBeGreaterThan(0)
          expect(d, `stage ${stage} floor ${floor} ${slot.dir}@${slot.x},${slot.z}`).toBeLessThanOrEqual(0.1)
        }
      }
    }
  })

  it('본채는 단계마다 뒤(n), 오른쪽(e), 왼쪽(w) 벽에 걸 수 있다', () => {
    for (const stage of STAGES) {
      const dirs = new Set(wallSlots(stage, 0).map((x) => x.dir))
      expect(dirs.has('n'), `stage ${stage} n`).toBe(true)
      expect(dirs.has('e'), `stage ${stage} e`).toBe(true)
      expect(dirs.has('w'), `stage ${stage} w`).toBe(true)
    }
  })

  it('다락은 뒤 벽(n)에만 걸리고, 옆벽은 가구가 닿지 않아 자리가 없다', () => {
    const dirs = new Set(wallSlots(3, 1).map((x) => x.dir))
    expect([...dirs]).toEqual(['n'])
  })

  it('문이 있는 벽의 문 앞 칸에는 걸 수 없다', () => {
    // 4단계부터 본채 오른쪽 벽에 옆방 문이 있다(z = -1)
    expect(wallBlocker(4, -1, 'e', 4, 0, [])).toContain('문')
    expect(wallBlocker(4, -3, 'e', 4, 0, [])).toBeNull()
  })
})

describe('벽걸이 높이 — 벽 윗선 아래에 든다', () => {
  it('모든 단계와 층의 벽걸이 윗변은 벽 윗선보다 0.3 이상 아래다', () => {
    for (const stage of [0, 1, 2, 3, 4, 5] as const) {
      for (const floor of [0, 1, 2, 3] as const) {
        for (const slot of wallSlots(stage, floor)) {
          const pose = wallPose(slot.x, slot.z, slot.dir, stage, floor)
          const top = wallTopOf(stage, floor, slot.dir)
          expect(pose.y + WALL_ITEM_TOP, `stage ${stage} floor ${floor} ${slot.dir}`).toBeLessThanOrEqual(top - WALL_TOP_CLEARANCE)
        }
      }
    }
  })

  it('큰 집과 다락방 증축 본채는 뒤 벽 윗선이 높아 기본 높이로 건다', () => {
    expect(wallHeightOf(2, 0, 'n')).toBe(WALL_HEIGHT)
    expect(wallHeightOf(3, 0, 'n')).toBe(WALL_HEIGHT)
  })

  it('다락 뒤 벽은 바닥 위 낮은 자리에 걸리고, 다락 옆벽은 걸 수 없다', () => {
    const h = wallHeightOf(3, 1, 'n')
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(WALL_HEIGHT)
    expect(wallHeightOf(3, 1, 'e')).toBeLessThan(0)
    expect(wallBlocker(4, -3, 'e', 3, 1, [])).toContain('너무 낮아서')
  })

  it('방 안쪽 칸에서 벽을 보라는 안내는 해요체로 쉽게 말한다', () => {
    expect(wallBlocker(99, 99, 'n', STAGE, 0, [])).toBe('벽 앞에 서서 벽 쪽을 봐 주세요')
  })
})

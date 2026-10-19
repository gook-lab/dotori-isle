import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ATTIC, HOME_ROOM, roomCenter } from '../core/interior'
import { NEW_HOME } from '../core/home'
import { migrateSave, useGame } from './store'
import { runtime } from './runtime'

const fresh = useGame.getState()

beforeEach(() => {
  useGame.setState({ ...fresh, inHome: true, home: { ...NEW_HOME, stage: 3 }, homeFloor: 0, homeFurniture: [], inventory: [{ id: 'chair', count: 2 }], homePlacing: 'chair' })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('다락방 사다리', () => {
  it('방바닥에서 올라가면 다락 안쪽에 서고, 다시 내려오면 방바닥 쪽에 선다', () => {
    useGame.getState().climbHome()
    expect(useGame.getState().homeFloor).toBe(1)
    const c = roomCenter(HOME_ROOM)
    expect(runtime.player.z).toBeCloseTo(c.z + ATTIC.climbZ)
    useGame.getState().climbHome()
    expect(useGame.getState().homeFloor).toBe(0)
    expect(runtime.player.z).toBeCloseTo(c.z + ATTIC.descendZ)
  })

  it('다락방 단계가 아니면 올라가지 못한다', () => {
    useGame.setState({ home: { ...NEW_HOME, stage: 2 } })
    useGame.getState().climbHome()
    expect(useGame.getState().homeFloor).toBe(0)
  })

  it('다락에서 놓은 가구는 그 층 칸에 floor 1 로 저장된다', () => {
    useGame.getState().climbHome()
    // 다락 첫 칸(방 가운데 기준 1, -3)
    const c = roomCenter(HOME_ROOM)
    useGame.setState({ homePlacing: 'chair' })
    useGame.getState().placeInHome(1, -3)
    const placed = useGame.getState().homeFurniture
    expect(placed).toHaveLength(1)
    expect(placed[0].floor).toBe(1)
    expect(c.x).toBeDefined()
  })

  it('예전 저장의 가구는 방바닥(floor 0)으로 읽힌다', () => {
    const save = migrateSave({ homeFurniture: [{ id: 'h1', itemId: 'chair', x: 1, z: -3, rot: 0 }] })
    expect(save.homeFurniture[0].floor).toBe(0)
  })
})

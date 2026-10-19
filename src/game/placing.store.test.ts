import { beforeEach, describe, expect, it } from 'vitest'
import { homeCells, homePlaceBlocker } from '../core/home'
import { placeBlocker } from '../core/placement'
import { pathCellsOf } from '../core/paths'
import { findAction } from './actions'
import { runtime } from './runtime'
import { useGame } from './store'

// 주머니의 가구 칸을 누르면: 집 밖에서는 섬 놓기(placing), 집 안에서는 방 놓기(homePlacing)로 들어간다.
// 꽃씨는 집 안에서 심을 수 없어 안내만 나온다. 주머니에 없는 것은 놓기에 들어가지 않는다.
describe('가구 놓기 시작', () => {
  beforeEach(() => {
    useGame.setState({ inventory: [{ id: 'flowerpot', count: 1 }, { id: 'flower-seed', count: 1 }], inHome: false, placing: null, homePlacing: null, panel: null })
  })

  it('집 밖에서 가구를 고르면 섬 놓기 상태가 된다', () => {
    useGame.getState().startPlacing('flowerpot')
    expect(useGame.getState().placing).toBe('flowerpot')
    expect(useGame.getState().homePlacing).toBeNull()
  })

  it('집 안에서 가구를 고르면 방 놓기 상태가 된다', () => {
    useGame.setState({ inHome: true })
    useGame.getState().startPlacing('flowerpot')
    expect(useGame.getState().homePlacing).toBe('flowerpot')
    expect(useGame.getState().placing).toBeNull()
  })

  it('집 안에서 꽃씨는 놓기에 들어가지 않고 안내만 한다', () => {
    useGame.setState({ inHome: true })
    useGame.getState().startPlacing('flower-seed')
    expect(useGame.getState().homePlacing).toBeNull()
  })

  it('주머니에 없는 것은 놓기에 들어가지 않는다', () => {
    useGame.getState().startPlacing('chair')
    expect(useGame.getState().placing).toBeNull()
  })
})

// 방 놓기 중 손가락으로 찍은 칸: 미리보기와 놓기가 그 칸을 쓰고, 키보드 안내는 그대로 R 이다
describe('방 놓기 찍은 칸', () => {
  beforeEach(() => {
    useGame.setState({ inventory: [{ id: 'flowerpot', count: 1 }], inHome: true, placing: null, homePlacing: 'flowerpot', homePlacingRot: 0, homePlaceCell: null, panel: null })
    runtime.player.x = 0
    runtime.player.z = 0
    runtime.player.facing = 0
  })

  it('놓기 중이 아니면 찍은 칸을 정하지 않는다', () => {
    useGame.setState({ homePlacing: null })
    useGame.getState().setHomePlaceCell({ x: 1, z: 1 })
    expect(useGame.getState().homePlaceCell).toBeNull()
  })

  it('놓기 중에는 찍은 칸을 정하고, 같은 칸을 다시 찍어도 바뀌지 않는다', () => {
    const cell = { x: 1, z: 1 }
    useGame.getState().setHomePlaceCell(cell)
    expect(useGame.getState().homePlaceCell).toEqual(cell)
    useGame.getState().setHomePlaceCell({ x: 1, z: 1 })
    expect(useGame.getState().homePlaceCell).toBe(cell)
  })

  it('놓기를 새로 시작하면 찍은 칸을 지운다', () => {
    useGame.getState().setHomePlaceCell({ x: 1, z: 1 })
    useGame.getState().startPlacing('flowerpot')
    expect(useGame.getState().homePlaceCell).toBeNull()
  })

  it('안내와 놓기는 찍은 칸을 쓴다(터치 문구는 ↻ 돌리기, 키보드는 R 돌리기)', () => {
    // 방이 허락하는 첫 칸을 찍는다(놓을 수 없는 칸이면 안내가 그 까닭을 보여 준다)
    const { stage } = useGame.getState().home
    const cell = homeCells(stage).find((c) => !homePlaceBlocker(c.x, c.z, stage, [], 0))
    expect(cell).toBeDefined()
    useGame.getState().setHomePlaceCell(cell!)
    const touch = findAction({ touch: true })
    // 뒤에 '점수 +N' 미리보기가 붙을 수 있어 앞부분만 본다
    expect(touch).toMatchObject({ kind: 'home-place', x: cell!.x, z: cell!.z })
    expect(touch?.label).toMatch(/^화분 놓기 · ↻ 돌리기/)
    const keys = findAction()
    expect(keys).toMatchObject({ kind: 'home-place', x: cell!.x, z: cell!.z })
    expect(keys?.label).toMatch(/^화분 놓기 · R 돌리기/)
  })

  it('찍은 칸이 없으면 바라보는 칸을 쓴다', () => {
    const a = findAction()
    expect(a).toMatchObject({ kind: 'home-place' })
  })
})

// 섬 놓기 중 손가락으로 찍은 칸: 미리보기와 놓기가 그 칸을 쓰고, 집 밖에서도 놓기 상태만 바뀐다
describe('섬 놓기 찍은 칸', () => {
  beforeEach(() => {
    useGame.setState({ inventory: [{ id: 'flowerpot', count: 1 }], inHome: false, placing: 'flowerpot', placingRot: 0, placeCell: null, homePlacing: null, panel: null })
    runtime.player.x = 0
    runtime.player.z = 0
    runtime.player.facing = 0
  })

  it('놓기 중이 아니면 찍은 칸을 정하지 않는다', () => {
    useGame.setState({ placing: null })
    useGame.getState().setPlaceCell({ x: 1, z: 1 })
    expect(useGame.getState().placeCell).toBeNull()
  })

  it('놓기를 새로 시작하면 찍은 칸을 지운다', () => {
    useGame.getState().setPlaceCell({ x: 2, z: 2 })
    useGame.getState().startPlacing('flowerpot')
    expect(useGame.getState().placeCell).toBeNull()
  })

  it('찍은 칸이 놓을 수 있는 칸이면 안내와 놓기가 그 칸을 쓴다', () => {
    const gs = useGame.getState()
    const live = { felled: gs.felled, day: gs.day, holes: gs.holes, paths: pathCellsOf(gs.infra.paths) }
    let cell: { x: number; z: number } | null = null
    for (let x = -12; x <= 12 && !cell; x++) for (let z = -12; z <= 12 && !cell; z++) {
      if (placeBlocker(x, z, gs.placed, [], live) === null && (x !== 0 || z !== 0)) cell = { x, z }
    }
    expect(cell).not.toBeNull()
    useGame.getState().setPlaceCell(cell)
    const a = findAction()
    expect(a).toMatchObject({ kind: 'place', x: cell!.x, z: cell!.z, ok: true })
  })
})

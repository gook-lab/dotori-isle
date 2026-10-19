import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PAINT, INTERIOR_WALL_COST, PAINT_COST } from '../core/homePaint'
import { useGame } from './store'

beforeEach(() => {
  useGame.setState({
    home: { stage: 2, loan: 0, order: null },
    homePaint: DEFAULT_PAINT,
    homePaintAt: 0,
    money: 5000,
    panel: null,
  })
})

describe('외관 색 바꾸기', () => {
  it('고르면 즉시 바뀌고 그만큼 도토리가 든다', () => {
    useGame.getState().paintHome('roof', 2)
    const s = useGame.getState()
    expect(s.homePaint?.roof).toBe(2)
    expect(s.money).toBe(5000 - PAINT_COST.roof)
    expect(s.homePaintAt).toBeGreaterThan(0)
  })

  it('같은 색을 다시 고르면 돈이 들지 않는다', () => {
    useGame.getState().paintHome('wall', 0)
    expect(useGame.getState().money).toBe(5000)
    expect(useGame.getState().homePaintAt).toBe(0)
  })

  it('도토리가 모자라면 색이 바뀌지 않는다', () => {
    useGame.setState({ money: PAINT_COST.roof - 1 })
    useGame.getState().paintHome('roof', 1)
    expect(useGame.getState().homePaint?.roof).toBe(0)
  })

  it('텐트 단계에서는 바깥 색을 바꿀 수 없다', () => {
    useGame.setState({ home: { stage: 0, loan: 0, order: null } })
    useGame.getState().paintHome('door', 1)
    expect(useGame.getState().homePaint?.door).toBe(0)
    expect(useGame.getState().money).toBe(5000)
  })
})

describe('외관 색 바꾸기 — 막히는 경우', () => {
  it('짓는 중에는 색이 바뀌지 않고 돈도 들지 않는다', () => {
    useGame.setState({ home: { stage: 2, loan: 0, order: { to: 3, day: '2026-10-18' } } })
    useGame.getState().paintHome('wall', 1)
    expect(useGame.getState().homePaint?.wall).toBe(0)
    expect(useGame.getState().money).toBe(5000)
  })

  it('도토리가 모자라면 정가를 알려 준다', () => {
    useGame.setState({ money: 100 })
    useGame.getState().paintHome('wall', 1)
    expect(useGame.getState().noticeLog.at(-1)?.text).toBe(`도토리가 ${PAINT_COST.wall.toLocaleString()}개 필요해요`)
  })

  it('같은 색이면 이미 그 색이라고 알린다', () => {
    useGame.getState().paintHome('door', 0)
    expect(useGame.getState().noticeLog.at(-1)?.text).toBe('이미 밤나무 색이에요')
  })
})

describe('실내 벽지 고르기', () => {
  beforeEach(() => {
    useGame.setState({ interiorWall: 0, money: 5000 })
  })

  it('고르면 바로 바뀌고 정가만큼 도토리가 든다', () => {
    useGame.getState().paintInterior(2)
    expect(useGame.getState().interiorWall).toBe(2)
    expect(useGame.getState().money).toBe(5000 - INTERIOR_WALL_COST)
  })

  it('같은 벽지를 다시 고르면 돈이 들지 않는다', () => {
    useGame.getState().paintInterior(0)
    expect(useGame.getState().money).toBe(5000)
    expect(useGame.getState().noticeLog.at(-1)?.text).toBe('이미 크림 벽지예요')
  })

  it('도토리가 모자라면 벽지가 바뀌지 않는다', () => {
    useGame.setState({ money: INTERIOR_WALL_COST - 1 })
    useGame.getState().paintInterior(1)
    expect(useGame.getState().interiorWall).toBe(0)
    expect(useGame.getState().noticeLog.at(-1)?.text).toBe(`도토리가 ${INTERIOR_WALL_COST.toLocaleString()}개 필요해요`)
  })

  it('텐트 단계와 짓는 중에는 고를 수 없다', () => {
    useGame.setState({ home: { stage: 0, loan: 0, order: null } })
    useGame.getState().paintInterior(1)
    expect(useGame.getState().interiorWall).toBe(0)
    useGame.setState({ home: { stage: 2, loan: 0, order: { to: 3, day: '2026-10-18' } } })
    useGame.getState().paintInterior(1)
    expect(useGame.getState().interiorWall).toBe(0)
    expect(useGame.getState().money).toBe(5000)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expandCost } from '../core/houseExpand'
import { useGame } from './store'

// 주민 집 증축: 지어진 집을 지갑의 도토리로 넓히고, 값이 차면 다음 날 아침에 차양이 달린다.
const DAY = '2026-10-26'
const ID = 'mocha'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${DAY}T11:00:00`))
  useGame.setState({
    day: DAY,
    money: 20000,
    home: { stage: 5, loan: 0, order: null },
    houses: [ID],
    houseExpand: null,
    expanded: [],
    toast: null,
    toastQueue: [],
  })
})

describe('주민 집 증축 — 기부와 완성', () => {
  it('한 번 누르면 1,000개만 보태고, 값이 차면 다음 날 아침에 증축 목록에 든다', () => {
    useGame.getState().donateHouseExpand(ID)
    expect(useGame.getState().houseExpand).toEqual({ villagerId: ID, fund: 1000, ready: null })
    expect(useGame.getState().money).toBe(19000)
    // 대화를 다시 걸면 이어서 낼 수 있다. 나머지는 여러 번 눌러 채운다.
    while (useGame.getState().houseExpand?.ready === null) useGame.getState().donateHouseExpand(ID)
    const after = useGame.getState()
    expect(after.houseExpand).toEqual({ villagerId: ID, fund: expandCost(ID), ready: '2026-10-27' })
    expect(after.money).toBe(20000 - expandCost(ID))
    expect(after.expanded).toEqual([])

    vi.setSystemTime(new Date('2026-10-27T09:00:00'))
    useGame.setState({ day: DAY })
    useGame.getState().syncClock()
    expect(useGame.getState().expanded).toEqual([ID])
    expect(useGame.getState().houseExpand).toBeNull()
  })

  it('집 5단계 전에는 기부할 수 없다', () => {
    useGame.setState({ home: { stage: 4, loan: 0, order: null } })
    useGame.getState().donateHouseExpand(ID)
    expect(useGame.getState().houseExpand).toBeNull()
    expect(useGame.getState().money).toBe(20000)
  })
})

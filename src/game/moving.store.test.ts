import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addDays } from '../core/economy'
import { MOVE_ASK } from '../core/moving'
import { VILLAGERS } from '../core/villagers'
import { migrateSave, useGame } from './store'

const fresh = useGame.getState()
const D0 = '2026-03-01'
const D1 = '2026-03-20'
const addDayStr = (key: string, n: number): string => addDays(key, n) ?? key

beforeEach(() => {
  useGame.setState({
    ...fresh,
    day: D1,
    islandStart: D0,
    houses: ['sora', 'toto'],
    moveTalk: null,
    lastMoveDay: null,
    arrivals: [],
    letters: [],
    friendship: { sora: 0, toto: 9 },
  })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('이사 오고 가기', () => {
  it('그대로 두면 사흘 뒤 떠나고 작별 편지와 액자를 남긴다', () => {
    useGame.setState({ moveTalk: { id: 'sora', since: D1 } })
    useGame.setState({ day: addDayStr(D1, 3) })
    const s = useGame.getState()
    expect(s.houses).not.toContain('sora')
    expect(s.moveTalk).toBeNull()
    const farewell = s.letters.find((l) => l.id.startsWith('farewell-sora'))
    expect(farewell?.gift).toBe('photo-frame')
  })

  it('떠난 자리에는 캠핑장 손님이 며칠 뒤 이사 온다', () => {
    useGame.setState({ moveTalk: { id: 'sora', since: D1 } })
    useGame.setState({ day: addDayStr(D1, 3) })
    const arr = useGame.getState().arrivals
    expect(arr).toHaveLength(1)
    const guest = arr[0].id
    expect(VILLAGERS.find((v) => v.id === guest)?.guest).toBe(true)
    expect(guest).not.toBe('sora')
    useGame.setState({ day: arr[0].day })
    expect(useGame.getState().houses).toContain(guest)
    expect(useGame.getState().arrivals).toHaveLength(0)
    expect(useGame.getState().letters.some((l) => l.id.startsWith('welcome-'))).toBe(true)
  })

  it('고민 중인 주민과 말하면 고민을 털어놓고 두 가지 대답을 고르게 한다', () => {
    useGame.setState({ moveTalk: { id: 'sora', since: D1 } })
    useGame.getState().talkTo(VILLAGERS.find((v) => v.id === 'sora')!)
    const d = useGame.getState().dialog!
    expect(d.ask?.options).toHaveLength(2)
    expect(d.lines[0]).toContain('이사를 생각')
    expect(useGame.getState().moveTalk?.id).toBe('sora')
  })

  it('같이 있자고 고르면 남고 우정이 두 칸 오른다', () => {
    useGame.setState({ moveTalk: { id: 'sora', since: D1 }, friendship: { sora: 0 } })
    useGame.getState().talkTo(VILLAGERS.find((v) => v.id === 'sora')!)
    useGame.getState().answer(0)
    expect(useGame.getState().moveTalk).toBeNull()
    expect(useGame.getState().friendship.sora).toBeGreaterThanOrEqual(2)
    useGame.setState({ day: addDayStr(D1, 3) })
    expect(useGame.getState().houses).toContain('sora')
  })

  it('새 곳도 좋겠다고 고르면 응원받고 사흘 뒤 떠난다', () => {
    useGame.setState({ moveTalk: { id: 'sora', since: D1 } })
    useGame.getState().talkTo(VILLAGERS.find((v) => v.id === 'sora')!)
    useGame.getState().answer(1)
    expect(useGame.getState().moveTalk?.id).toBe('sora')
    useGame.setState({ day: addDayStr(D1, 3) })
    expect(useGame.getState().houses).not.toContain('sora')
    expect(MOVE_ASK.options[1].stay).toBe(false)
  })

  it('한 달 안에는 새 고민을 시작하지 않는다', () => {
    // 처음 맞출 때 생긴 고민을 치우고, 대신 닷새 전에 고민이 있었던 것으로 둔다
    useGame.setState({ moveTalk: null, lastMoveDay: addDayStr(D1, -5) })
    useGame.setState({ day: addDayStr(D1, 1) })
    expect(useGame.getState().moveTalk).toBeNull()
  })

  it('저장된 이사 고민은 아는 주민만 남긴다', () => {
    const s = migrateSave({ moveTalk: { id: 'nobody', since: D1 }, arrivals: [{ id: 'sora', day: D1 }, { id: 'ghost', day: D1 }] })
    expect(s.moveTalk).toBeNull()
    expect(s.arrivals.map((a) => a.id)).toEqual(['sora'])
  })
})

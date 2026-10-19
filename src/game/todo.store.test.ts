import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TODO_DAY_CAP, TODO_REWARD } from '../core/todo'
import { migrateSave, useGame } from './store'

const fresh = useGame.getState()
const D1 = '2026-03-16'
const D2 = '2026-03-17'

beforeEach(() => {
  useGame.setState({ ...fresh, day: D1, miles: 0, talked: [], todo: { day: null, settled: [], miles: 0, fish: 0, bug: 0 }, outLetters: [], letters: [], plants: [], dug: [], marketBought: [], giftDay: {} })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('오늘의 할 일 마일리지', () => {
  it('해낸 항목마다 마일리지를 한 번만 준다', () => {
    useGame.setState({ talked: ['mocha'] })
    const s = useGame.getState()
    expect(s.todo).toMatchObject({ day: D1, miles: TODO_REWARD })
    expect(s.todo.settled).toContain('talk')
    expect(s.miles).toBe(TODO_REWARD)
    // 같은 날 다시 바뀌어도 이미 정산한 항목은 또 주지 않는다
    useGame.setState({ talked: ['mocha', 'bomi'] })
    expect(useGame.getState().miles).toBe(TODO_REWARD)
  })

  it('잡은 물고기 기록이 생기면 낚시 항목을 정산한다', () => {
    useGame.setState({ todo: { day: D1, settled: [], miles: 0, fish: 1, bug: 0 } })
    expect(useGame.getState().todo.settled).toContain('fish')
    expect(useGame.getState().miles).toBe(TODO_REWARD)
  })

  it('날이 바뀌면 정산 기록을 비우고, 다시 해낸 항목은 새로 준다', () => {
    useGame.setState({ talked: ['mocha'] })
    useGame.setState({ day: D2, talked: ['mocha'] })
    const s = useGame.getState()
    expect(s.todo).toMatchObject({ day: D2, miles: TODO_REWARD })
    expect(s.miles).toBe(TODO_REWARD * 2)
  })

  it('하루 상한을 넘지 않는다', () => {
    useGame.setState({ talked: ['mocha'], marketBought: [], plants: [] })
    useGame.setState({ todo: { day: D1, settled: [], miles: TODO_DAY_CAP, fish: 0, bug: 0 } })
    useGame.setState({ talked: ['mocha', 'bomi'] })
    expect(useGame.getState().todo.miles).toBe(TODO_DAY_CAP)
  })

  it('저장을 읽을 때 이상한 값은 정리한다', () => {
    const save = migrateSave({ todo: { day: 'nope', settled: ['talk', 'bogus'], miles: 500 } })
    expect(save.todo).toEqual({ day: null, settled: ['talk'], miles: TODO_DAY_CAP, fish: 0, bug: 0 })
  })
})

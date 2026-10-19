import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newReq } from '../core/requests'
import { migrateSave } from './store'
import { useGame } from './store'

const DAY = '2026-10-19'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12))
  useGame.setState({ day: DAY, money: 0, requests: {}, letters: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('saved village requests', () => {
  it('keeps valid requests and drops broken ones on load', () => {
    const save = migrateSave({
      requests: {
        guriguri: { kind: 'water', day: DAY, progress: 1, target: 3, done: false },
        bad: { kind: 'nope', day: DAY },
      },
    })
    expect(Object.keys(save.requests)).toEqual(['guriguri'])
    expect(save.requests.guriguri.progress).toBe(1)
  })

  it('an older save without requests loads with none', () => {
    expect(migrateSave({}).requests).toEqual({})
  })
})

describe('finishing a request', () => {
  it('pays acorns once and marks the request done', () => {
    useGame.setState({ requests: { guriguri: newReq('water', DAY) } })
    useGame.getState().completeReq('guriguri')
    const s = useGame.getState()
    expect(s.requests.guriguri.done).toBe(true)
    expect(s.money).toBe(15)
    useGame.getState().completeReq('guriguri')
    expect(useGame.getState().money).toBe(15)
  })

  it('a request from yesterday cannot be finished today', () => {
    useGame.setState({ requests: { guriguri: newReq('water', '2026-10-18') } })
    useGame.getState().completeReq('guriguri')
    expect(useGame.getState().money).toBe(0)
  })

  it('a new day clears the requests and the lost items on the ground', () => {
    useGame.setState({
      requests: { guriguri: newReq('water', DAY) },
      ground: [{ id: `lost-guriguri-${DAY}`, itemId: 'conch', x: 1, z: 1 }],
    })
    vi.setSystemTime(new Date(2026, 9, 20, 8))
    useGame.setState({ day: DAY })
    useGame.getState().syncClock()
    expect(useGame.getState().requests).toEqual({})
    expect(useGame.getState().ground.some((g) => g.id.startsWith('lost-'))).toBe(false)
  })
})

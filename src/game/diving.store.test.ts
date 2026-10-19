import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bubbleSpots, DIVE_SECONDS } from '../core/diving'
import { ITEMS } from '../core/items'
import { DEFAULT_OUTFIT } from '../core/wardrobe'
import { runtime } from './runtime'
import { useGame } from './store'

const DAY = '2026-10-19'
const KEY = (() => {
  const b = bubbleSpots(DAY)[0]
  return `${b.x},${b.z}`
})()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12))
  runtime.swim = null
  runtime.dive = null
  runtime.dived = { day: '', keys: [] }
  useGame.setState({
    day: DAY,
    wear: { hat: null, outfit: 'swim-suit' },
    inventory: [],
    dex: {},
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('바다 수영과 잠수 상태', () => {
  it('수영복이 없으면 바다에 들어가지 않는다', () => {
    useGame.setState({ wear: { hat: null, outfit: DEFAULT_OUTFIT } })
    useGame.getState().startSwim()
    expect(runtime.swim).toBeNull()
  })

  it('수영복을 입으면 바다에 들어가고, 다시 불러도 한 번만 들어간다', () => {
    useGame.getState().startSwim()
    const first = runtime.swim
    expect(first).not.toBeNull()
    useGame.getState().startSwim()
    expect(runtime.swim).toBe(first)
  })

  it('잠수가 끝나면 해산물을 주머니에 넣고 도감을 올리고 거품을 오늘 쓴 것으로 표시한다', () => {
    useGame.getState().startSwim()
    useGame.getState().diveAt(KEY)
    expect(runtime.dive?.key).toBe(KEY)
    vi.advanceTimersByTime(DIVE_SECONDS * 1000)

    const s = useGame.getState()
    expect(runtime.dive).toBeNull()
    expect(runtime.dived).toEqual({ day: DAY, keys: [KEY] })
    const caught = s.inventory.filter((x) => ITEMS[x.id]?.kind === 'seafood' || ITEMS[x.id]?.kind === 'shell')
    expect(caught.length).toBe(1)
    const id = caught[0].id
    expect(s.dex[id]).toBe(1)
  })

  it('같은 거품은 같은 날 두 번 잡을 수 없다', () => {
    useGame.getState().startSwim()
    useGame.getState().diveAt(KEY)
    vi.advanceTimersByTime(DIVE_SECONDS * 1000)
    useGame.getState().diveAt(KEY)
    expect(runtime.dive).toBeNull()
    expect(useGame.getState().inventory.reduce((n, x) => n + x.count, 0)).toBe(1)
  })

  it('수영 중이 아니면 잠수하지 않는다', () => {
    useGame.getState().diveAt(KEY)
    expect(runtime.dive).toBeNull()
  })

  it('다음 날에는 같은 거품을 다시 잡을 수 있다', () => {
    runtime.dived = { day: '2026-10-18', keys: [KEY] }
    useGame.getState().startSwim()
    useGame.getState().diveAt(KEY)
    expect(runtime.dive?.key).toBe(KEY)
  })
})

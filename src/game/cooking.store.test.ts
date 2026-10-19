import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HAPPY_SECONDS, HASTE_SECONDS } from '../core/cooking'
import { HITS_PER_ROCK, useGame } from './store'
import { runtime } from './runtime'

const DAY = '2026-10-19'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'performance'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12))
  useGame.setState({ day: DAY, money: 20, pocket: 20, inventory: [] })
  runtime.hasteUntil = 0
  runtime.happyUntil = 0
  runtime.rockCharge = false
})

afterEach(() => {
  vi.useRealTimers()
})

describe('요리 만들기', () => {
  it('재료가 모자라면 주머니는 그대로이고 부족한 재료를 알린다', () => {
    useGame.setState({ inventory: [{ id: 'peach', count: 2 }] })
    useGame.getState().cookAt('dish-fruit-pie')
    expect(useGame.getState().inventory).toEqual([{ id: 'peach', count: 2 }])
  })

  it('재료가 있으면 재료를 쓰고 요리를 넣는다. 쿠키는 도토리를 쓴다', () => {
    useGame.setState({ inventory: [{ id: 'peach', count: 3 }] })
    useGame.getState().cookAt('dish-fruit-pie')
    expect(useGame.getState().inventory).toEqual([{ id: 'dish-fruit-pie', count: 1 }])
    useGame.getState().cookAt('dish-acorn-cookie')
    expect(useGame.getState().money).toBe(15)
    expect(useGame.getState().inventory.find((s) => s.id === 'dish-acorn-cookie')?.count).toBe(1)
  })
})

describe('요리 먹기', () => {
  it('파이를 먹으면 3분 동안 달리기가 빨라지고, 한 개가 줄어든다', () => {
    useGame.setState({ inventory: [{ id: 'dish-fruit-pie', count: 2 }] })
    useGame.getState().eatDish('dish-fruit-pie')
    expect(useGame.getState().inventory).toEqual([{ id: 'dish-fruit-pie', count: 1 }])
    expect(runtime.hasteUntil - performance.now() / 1000).toBeCloseTo(HASTE_SECONDS, 0)
  })

  it('꽃잎 차를 먹으면 기쁨 표정이 2분 동안 이어진다', () => {
    useGame.setState({ inventory: [{ id: 'dish-petal-tea', count: 1 }] })
    useGame.getState().eatDish('dish-petal-tea')
    expect(runtime.happyUntil - performance.now() / 1000).toBeCloseTo(HAPPY_SECONDS, 0)
    expect(useGame.getState().inventory).toEqual([])
  })

  it('생선구이를 먹으면 다음 바위 한 번에 깨기가 걸린다', () => {
    useGame.setState({ inventory: [{ id: 'dish-grilled-fish', count: 1 }] })
    useGame.getState().eatDish('dish-grilled-fish')
    expect(runtime.rockCharge).toBe(true)
  })

  it('요리가 아닌 물건은 먹을 수 없다', () => {
    useGame.setState({ inventory: [{ id: 'peach', count: 1 }] })
    useGame.getState().eatDish('peach')
    expect(useGame.getState().inventory).toEqual([{ id: 'peach', count: 1 }])
  })
})

describe('바위 한 번에 깨기', () => {
  const rock = { id: 'rock-test', x: 0, z: 0 } as Parameters<ReturnType<typeof useGame.getState>['hitRock']>[0]

  it('효과가 걸린 다음 타격은 남은 타수를 한 번에 깨고 효과를 쓴다', () => {
    runtime.rockCharge = true
    useGame.setState({ rockHits: { [rock.id]: 1 } })
    useGame.getState().hitRock(rock)
    expect(useGame.getState().rockHits[rock.id]).toBe(HITS_PER_ROCK)
    expect(runtime.rockCharge).toBe(false)
  })

  it('효과가 없으면 평소처럼 한 번씩 친다', () => {
    useGame.setState({ rockHits: { [rock.id]: 1 } })
    useGame.getState().hitRock(rock)
    expect(useGame.getState().rockHits[rock.id]).toBe(2)
  })
})
